"""実戦の連続オートを計測。計測用ラッパーはブラウザ内にだけ注入する。"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(os.environ.get('AUTO_SOURCE_ROOT',Path(__file__).resolve().parents[2]))
BASE=os.environ.get('AUTO_BASE','http://localhost:8000')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']+(['--disable-frame-rate-limit'] if os.environ.get('AUTO_UNCAPPED') else []))
  page=await browser.new_page(viewport={'width':1024,'height':1366} if os.environ.get('AUTO_TABLET') else {'width':390,'height':844},device_scale_factor=2 if os.environ.get('AUTO_TABLET') else 1,service_workers='block')
  await page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
  await page.add_init_script('''window.plannerDuringFx=0;window.timings={};window.measure=(name,fn)=>{const t=performance.now();try{return fn();}finally{(timings[name]||=[]).push(performance.now()-t);}};''')
  async def instrument(route):
   name=route.request.url.split('/')[-1];s=(ROOT/'src'/name).read_text()
   names={'game.js':['renderParty','renderCombatCanvas','applyImpact','renderCombatMenu','renderCombat','renderActingPlate','renderAutoBanner','autosave','callPartyAction','setPlateCall'],'autotactics.js':['decideAuto']}.get(name,[])
   for fn in names:
    s=s.replace('function '+fn+'(', 'function '+fn+'Measured(',1)
    s+='\nfunction '+fn+'(...args){if(typeof window==="undefined")return '+fn+'Measured(...args);return window.measure("'+fn+'",()=>'+fn+'Measured(...args));}\n'
    if name=='autotactics.js':s=s.replace('export function decideAutoMeasured','function decideAutoMeasured')+'\nexport {decideAuto};\n'
   if name=='auto-planner.js':s=s.replace('export async function planAuto(b,actor,resistKnown,fallback){', 'export async function planAuto(b,actor,resistKnown,fallback){if(window.__game?.G.fx)window.plannerDuringFx++;')
   if name=='game.js':s+='\nwindow.testRenderParty=renderParty;\n'
   await route.fulfill(content_type='text/javascript',body=s)
  await page.route('**/src/game.js',instrument);await page.route('**/src/autotactics.js',instrument);await page.route('**/src/auto-planner.js',instrument);await page.route('**/src/townart.js',instrument)
  await page.goto(BASE+'/?testDungeon=w01&testPlace=town')
  await page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
  await page.evaluate('''async()=>{
   const audio=await import('/src/audio.js');audio.initAudio();
   const {reseedRng}=await import('/src/rng.js');reseedRng(42);
   const {G}=__game;for(const a of G.party){a.hp=a.maxhp=100000;a.mp=a.maxmp=99999;a.agi=1000;a.atk=100;a.tactic='all';a.spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','TATEWARI','KYOUGEKI','CHOUHATSU'];}
   const enemies=__game.spawnCardEnemies('bs_bonepile',1,1);for(const e of enemies){e.hp=e.maxhp=10000000;e.agi=1;e.ability=null;}
   __game.startBattle(enemies,null);document.getElementById('town-shell').classList.add('hidden');
  }''')
  await page.locator('#combat-menu[data-mode="input"] .cmd-auto').wait_for()
  if os.environ.get('AUTO_CPU'):
   cdp=await page.context.new_cdp_session(page);await cdp.send('Emulation.setCPUThrottlingRate',{'rate':float(os.environ['AUTO_CPU'])})
  await page.evaluate('(v)=>window.expectWorker=v',not bool(os.environ.get('AUTO_SOURCE_ROOT')))
  await page.evaluate('''async()=>{
   const cards=[...document.querySelectorAll('#party .pc')];__game.G.party[0].hp--;testRenderParty();
   if(window.expectWorker&&cards.some((c,i)=>c!==document.querySelectorAll('#party .pc')[i]))throw Error('HPだけの更新でカードを交換した');
   const {SFX}=await import('/src/audio.js');for(const k of ['warmSkill','skill','skillImpact']){const fn=SFX[k];SFX[k]=(...a)=>measure('audio.'+k,()=>fn(...a));}
   window.timings={};window.gaps=[];window.longTasks=[];window.measuring=true;let last=null;
   new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});
   function frame(t){if(!measuring)return;if(last!==null)gaps.push(t-last);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  }''')
  if os.environ.get('AUTO_PROFILE'):
   profiler=await page.context.new_cdp_session(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start')
  await page.locator('#combat-menu .cmd-auto').click();await page.wait_for_timeout(40000)
  await page.evaluate('measuring=false')
  report=await page.evaluate('''async()=>{measuring=false;__game.G.autoCombat=false;const stats=a=>{a=[...a].sort((a,b)=>a-b);return {count:a.length,p95:a[Math.floor(a.length*.95)]||0,max:a.at(-1)||0,total:a.reduce((a,b)=>a+b,0)};};return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},plannerDuringFx,planner:await import('/src/auto-planner.js').then(m=>m.autoPlannerStats).catch(()=>null),frames:stats(gaps),over34:gaps.filter(x=>x>34).length,longTasks:stats(longTasks),stages:Object.fromEntries(Object.entries(timings).map(([k,a])=>[k,stats(a)]))};}''')
  if not os.environ.get('AUTO_SOURCE_ROOT'):
   assert report['planner']['worker']>=10 and report['planner']['fallback']==0,report
   assert report['plannerDuringFx']==0,report
   trace=await page.evaluate("async()=>(await import('/src/battle-trace.js')).battleTrace()")
   for name in ['sync:renderCombatCanvas','sync:renderParty','sync:applyImpact','sync:auto.snapshot','wait:auto.workerRoundtrip']:
    assert trace['summary'][name]['count']>0,(name,trace)
   report['timeline']=trace
  out=Path(os.environ.get('AUTO_REPORT','/tmp/dos-auto-baseline.json'));out.write_text(json.dumps(report,indent=2));print(json.dumps(report,ensure_ascii=False))
  if os.environ.get('AUTO_PROFILE'):
   profile=await profiler.send('Profiler.stop');Path(os.environ['AUTO_PROFILE']).write_text(json.dumps(profile))
  await browser.close()
asyncio.run(main())

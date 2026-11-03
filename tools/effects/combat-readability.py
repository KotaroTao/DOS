"""実戦の5連撃を手動/オートで再生し、初回描画・方向・一撃ごとの数値を確認する。"""
import asyncio,base64,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('/tmp/dos-combat-readability');OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
  reports=[]
  for mode in ['manual','auto']:
   ctx=await browser.new_context(service_workers='block',viewport={'width':390,'height':844})
   await ctx.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
   page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town',wait_until='domcontentloaded')
   await page.wait_for_function('window.__game?.G.state==="town"&&!document.body.classList.contains("booting")')
   await page.evaluate('''async()=>{
    const {G}=__game;G.autoCombat=false;G.fastAnim=false;for(const a of G.party){a.agi=1000;a.hp=a.maxhp=100000;}
    const enemies=__game.spawnCardEnemies('bs_bonepile',1,1);for(const e of enemies){e.hp=e.maxhp=1000000;e.agi=1;e.ability=null;}
    const {prepareSprite}=await import('/src/sprites.js');await Promise.all(enemies.map(e=>prepareSprite(e.mon)));await document.fonts.ready;
    __game.startBattle(enemies,null);document.getElementById('town-shell').classList.add('hidden');
   }''')
   await page.wait_for_function('__game.G.battle?.phase==="input"&&!__game.G.animating')
   await page.evaluate('''async mode=>{
    const {Battle}=await import('/src/combat.js');const {SFX}=await import('/src/audio.js');
    const actor=__game.G.battle.current;actor.mp=actor.maxmp=999;actor.spells=['ZANKOU'];actor.hitBonus=1;actor.atk=100;
    // 見た目の検査では5撃を確実に当て、命中率の検査とは分ける。
    const physical=Battle.prototype._physical;Battle.prototype._physical=function(a,t,opt){return physical.call(this,a,t,{...opt,sureHit:true});};
    const choose=Battle.prototype.chooseAction;Battle.prototype.chooseAction=function(action,...args){return ['attack','spell'].includes(action)?choose.call(this,'spell','ZANKOU'):choose.call(this,action,...args);};
    const raf=window.requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,ts=>{window.frameStamp=ts;cb(ts);});
    window.frames=[];window.firstFx=null;window.battleFrame=null;let tracked=null,lastFrame=-1;
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
     const fx=__game.G.fx,e=fx?.skill.find(e=>e.type==='skillScene'&&e.design.family==='flurry');
     if(this.canvas.id==='view'&&e&&image.width===1152&&image.height===288){
      if(!tracked){tracked=fx;firstFx={t0:e.t0,dur:e.dur,floats:fx.floats.filter(f=>['dmg','crit'].includes(f.kind)).map(f=>({text:f.text,t0:f.t0,dur:f.dur})),presentationAt:fx.presentationAt};if(mode==='auto')__game.G.autoCombat=false;}
      if(fx===tracked&&window.frameStamp!==lastFrame){
       lastFrame=window.frameStamp;const m=this.getTransform();frames.push({at:performance.now(),progress:performance.now()-e.t0,angle:Math.atan2(m.b,m.a)});
      }
     }
     const value=draw.call(this,image,...args);
     if(this.canvas.id==='view'&&fx===tracked&&e&&performance.now()-e.t0>175&&!window.battleFrame){const canvas=this.canvas;queueMicrotask(()=>{if(!window.battleFrame)window.battleFrame=canvas.toDataURL();});}
     return value;
    };
   }''',mode)
   if mode=='auto':await page.locator('#combat-menu .cmd-auto').click()
   else:
    await page.locator('#combat-menu .cmd-attack').click()
    targets=page.locator('#combat-menu .target-list button')
    if await targets.count():await targets.first.click()
   await page.wait_for_function('firstFx!==null',timeout=10000)
   await page.wait_for_timeout(550)
   result=await page.evaluate('({firstFx,frames})');result['mode']=mode
   assert result['firstFx']['dur']==(485 if mode=='manual' else 445),result
   assert len(result['firstFx']['floats'])==5,result
   assert [f['dur'] for f in result['firstFx']['floats']]==[85]*4+[145 if mode=='manual' else 105],result
   times=[f['t0'] for f in result['firstFx']['floats']]
   assert all(abs(times[i]-times[0]-i*85)<.1 for i in range(5)),times
   assert result['frames'][0]['progress']<35,result
   assert len(result['frames'])>=12,result
   angles={round(f['angle'],1) for f in result['frames']}
   assert len(angles)>=5,result
   frame=await page.evaluate('battleFrame');assert frame
   (OUT/(mode+'-battle.png')).write_bytes(base64.b64decode(frame.split(',')[1]))
   assert not errors,errors
   reports.append(result);await ctx.close()
  (OUT/'frames.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
  for r in reports:print(json.dumps({'mode':r['mode'],'duration':r['firstFx']['dur'],'frames':len(r['frames']),'firstPaintMs':r['frames'][0]['progress'],'directions':len({round(f['angle'],1) for f in r['frames']})},ensure_ascii=False))
  await browser.close()
asyncio.run(main())

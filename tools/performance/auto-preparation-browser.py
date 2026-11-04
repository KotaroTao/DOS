"""実画面と別Workerの戦闘処理で、構え・保存準備・先読み・解除を検査する。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 for auto in [False,True]:
  page=browser.new_page(service_workers='block',viewport={'width':390,'height':844})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
  def instrument(r):
   s=(ROOT/'src/game.js').read_text()
   s=s.replace('function serverBattle() {','function serverBattle() { if(window.prepareProbe)return true;')
   s=s.replace('function quickBattlePresentation() {','function quickBattlePresentation() { if(window.prepareProbe)return true;')
   s=s.replace('await cloudBattlePrepared(action,','await window.testBattleReply(action,')
   s=s.replace('await acknowledgeCloudSave(', 'await testAck(')
   s=s.replace('confirmed.ack = acknowledgeCloudSave(', 'confirmed.ack = testAck(')
   s=s.replace('if (normalAttack) await windup?.complete();','if (normalAttack) { await windup?.complete(); if(window.prepareProbe)prepareProbe.releases.push(performance.now()); }')
   s=s.replace('function applyImpact(res) {','function applyImpact(res) { if(window.prepareProbe)prepareProbe.impacts.push(performance.now());')
   s+='''
async function testAck(raw,packet){
 if(window.prepareProbe){prepareProbe.acks.push({at:performance.now(),animating:G.animating,windup:!!document.querySelector('.battle-windup')});await new Promise(r=>setTimeout(r,450));}
 return acknowledgeCloudSave(raw,packet);
}
window.testStopAuto=stopAutoCombat;
'''
   r.fulfill(content_type='text/javascript',body=s)
  page.route('**/src/game.js',instrument)
  def planner_probe(r):
   s=(ROOT/'src/auto-planner.js').read_text().replace('  prepared=null;\n  let plan;', """  if(cached&&cached.key!==key){
    const diffs=[],seen=new Map();
    function diff(a,b,path){if(a===b)return;if(a&&b&&typeof a==='object'&&typeof b==='object'){if(seen.get(a)===b)return;seen.set(a,b);for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path+'.'+k);}else if(diffs.length<20)diffs.push([path,a,b]);}
    diff(refDeserialize(JSON.parse(cached.key)),refDeserialize(snapshot),'input');
    (window.planDiffs||=[]).push(diffs);
   }
   prepared=null;
   let plan;""")
   r.fulfill(content_type='text/javascript',body=s)
  page.route('**/src/auto-planner.js',planner_probe)
  page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
  page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
  page.evaluate('''()=>{
   const {G}=__game;for(const a of G.party){a.hp=a.maxhp=100000;a.mp=a.maxmp=99999;a.agi=1000;a.atk=100;a.tactic='blade';}
   const es=__game.spawnCardEnemies('bs_bonepile',1,1);for(const e of es){e.hp=e.maxhp=10000000;e.agi=1;e.ability=null;}
   __game.startBattle(es,null);document.getElementById('town-shell').classList.add('hidden');
  }''')
  page.locator('#combat-menu[data-mode="input"] .cmd-auto').wait_for()
  page.evaluate('''()=>{
   window.prepareProbe={releases:[],impacts:[],acks:[],requests:0};
   const source=`import {resolveCloudTurn} from '${location.origin}/src/cloud-battle.js';import {refDeserialize} from '${location.origin}/src/savegraph.js';self.onmessage=({data})=>{try{postMessage(resolveCloudTurn(refDeserialize(data.graph),data.action));}catch(e){postMessage({error:String(e)});}};`;
   const worker=new Worker(URL.createObjectURL(new Blob([source],{type:'text/javascript'})),{type:'module'});
   window.testBattleReply=async(action,get)=>{
    prepareProbe.requests++;const graph=await get();
    return new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.error?reject(Error(data.error)):resolve(data);worker.postMessage({action,graph});});
   };
  }''')
  if auto:
   page.locator('#combat-menu .cmd-auto').click()
   page.wait_for_function('prepareProbe.impacts.length>=3',timeout=30000)
   page.evaluate('testStopAuto()')
  else:
   page.locator('#combat-menu .cmd-attack').click()
   targets=page.locator('#combat-menu .target-list button')
   if targets.count():targets.first.click()
   page.wait_for_function('prepareProbe.impacts.length>=1',timeout=15000)
  report=page.evaluate('''async()=>({probe:prepareProbe,diffs:window.planDiffs,planner:(await import('/src/auto-planner.js')).autoPlannerStats})''')
  gaps=[b-a for a,b in zip(report['probe']['releases'],report['probe']['impacts'])]
  if auto:
   assert all(0<=n<120 for n in gaps),report
   assert report['planner']['reused']>=2,report
   requests=report['probe']['requests']
   page.wait_for_timeout(2000)
   assert page.evaluate('prepareProbe.requests')==requests,'解除後に次の行動を送った'
   assert any(a['animating'] and not a['windup'] for a in report['probe']['acks']),report
  else:
   assert gaps[0]>=440,report
   assert report['planner']['prefetched']==0,report
  assert not errors,errors
  print({'auto':auto,'releaseToImpact':gaps,**report['planner']},flush=True)
  page.close()
 browser.close()

"""確定済みの通常攻撃/連撃の結果を実画面で描き、数値・撃破・消去画面の完了順を確認。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 for quick in [False,True]:
  for fast,auto in [(False,False),(False,True),(True,False),(True,True)]:
   page=b.new_page(service_workers='block',viewport={'width':390,'height':844})
   page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
   def instrument(r):
    s=(ROOT/'src/game.js').read_text()
    s=s.replace('function combatStep() {','function combatStep() { window.readyBattleSteps=(window.readyBattleSteps||0)+1;')
    s=s.replace('function quickBattlePresentation() {','function quickBattlePresentation() { if(window.forceQuick!==undefined)return window.forceQuick;')
    s=s.replace('function drawFloatText(f, t, stageH = VH) {','function drawFloatText(f, t, stageH = VH) { if(window.resultProbe)resultProbe.floatTail=Math.max(resultProbe.floatTail,t);')
    s=s.replace('function drawEffects(fx, now, stageH) {','function drawEffects(fx, now, stageH) { if(window.resultProbe)for(const d of fx.deaths||[])resultProbe.deathTail=Math.max(resultProbe.deathTail,(now-d.t0)/(d.dur||360*effectSpeed()));')
    s=s.replace('  return end;\n}\n\n// 消えた状態','  if(window.resultProbe){resultProbe.end=end;resultProbe.floatDurations=fx.floats.map(f=>f.dur);resultProbe.deathDurations=fx.deaths.map(d=>d.dur);}\n  return end;\n}\n\n// 消えた状態')
    s+='\nwindow.testAnimate=animateResult;window.testDeadShown=e=>_deadShown.has(e);window.testForget=e=>_deadShown.delete(e);window.testRender=renderCombatCanvas;window.testRestore=e=>{_deadShown.delete(e);renderCombatCanvas();};\n'
    s=s.replace('function renderCombatCanvas() {','function renderCombatCanvas() { if(window.resultProbe&&!G.fx)resultProbe.cleanAt=performance.now();')
    r.fulfill(content_type='text/javascript',body=s)
   page.route('**/src/game.js',instrument)
   page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
   page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
   page.evaluate('''()=>{const {G}=__game;for(const a of G.party){a.agi=1000;a.hp=a.maxhp=100000;}const es=__game.spawnCardEnemies('bs_bonepile',1,1);for(const e of es){e.agi=1;e.hp=e.maxhp=100000;}__game.startBattle(es,null);document.getElementById('town-shell').classList.add('hidden');}''')
   page.wait_for_function('window.readyBattleSteps>0&&__game.G.battle?.phase==="input"&&!__game.G.animating')
   page.locator('#combat-menu[data-mode="input"] .cmd-attack').wait_for(state='visible')
   for action in ['attack','ZANKOU','GOKUENRAN']:
    result=page.evaluate('''async({quick,fast,auto,action})=>{
     const {G}=__game;window.forceQuick=quick;G.fastAnim=fast;G.autoCombat=auto;G.animating=true;
     const e=G.battle.enemies[0];e.alive=true;e.hp=100000;testRestore(e);e.alive=false;e.hp=0;
     window.resultProbe={floatTail:0,deathTail:0,cleanAt:null,end:null};
     const n=action==='ZANKOU'?5:1,hits=Array.from({length:n},(_,i)=>({target:e,dmg:10,died:i===n-1}));
     await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(JSON.stringify({state:G.state,animating:G.animating,phase:G.battle?.phase,fx:!!G.fx,probe:resultProbe}))),10000);testAnimate({side:'party',actor:G.battle.current,action:action==='attack'?'attack':'spell',spellKey:action==='attack'?undefined:action,hits},()=>{resultProbe.doneAt=performance.now();resultProbe.fxGone=G.fx===null;resultProbe.deadGone=testDeadShown(e);clearTimeout(timer);resolve();});const ghost={...e,uid:999999};G.battle.enemies.push(ghost);testForget(ghost);testRender();resultProbe.ghostHidden=testDeadShown(ghost);G.battle.enemies.pop();});
     G.autoCombat=false;return resultProbe;
    }''',{'quick':quick,'fast':fast,'auto':auto,'action':action})
    assert result['floatDurations'] and all(d==400 for d in result['floatDurations']),result
    assert result['deathDurations']==[400],result
    assert result['doneAt']>=result['end'],result
    assert result['floatTail']>.9 and result['deathTail']>.9,result
    assert result['ghostHidden'],result
    assert result['fxGone'] and result['deadGone'] and result['end']<=result['cleanAt']<result['doneAt'],result
    print({'quick':quick,'fast':fast,'auto':auto,'action':action,'completionLag':round(result['doneAt']-result['end'])},flush=True)
   page.close()
 b.close()

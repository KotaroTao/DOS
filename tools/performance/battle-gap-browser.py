"""行動間隔の設定・保存と、実際のオートの演出終了後の待機を検査する。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},service_workers='block')
 page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
 def instrument(r):
  s=(ROOT/'src/game.js').read_text().replace('function postResolve() {','function postResolve() { window.gapStart=performance.now();')
  s=s.replace('function advanceAfterPresentation(b) {','function advanceAfterPresentation(b) { if(G.battle===b&&G.state==="combat")window.gapSamples.push(performance.now()-window.gapStart);')
  r.fulfill(content_type='text/javascript',body=s)
 page.route('**/src/game.js',instrument)
 page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
 page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
 page.evaluate("async()=>{(await import('/src/ui/ctx.js')).UI.settingsSheet({});}")
 slider=page.get_by_role('slider',name='戦闘の行動間隔',exact=True)
 assert slider.input_value()=='0'
 slider.fill('300');slider.dispatch_event('change')
 assert slider.get_attribute('aria-valuetext')=='0.3秒'
 page.reload();page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
 assert page.evaluate("async()=>(await import('/src/ui/prefs.js')).battleActionGap()") ==300
 page.evaluate('''()=>{
 window.gapSamples=[];const {G}=__game;
 for(const a of G.party){a.hp=a.maxhp=100000;a.mp=a.maxmp=99999;a.agi=1000;a.atk=100;a.spells=['ZANKOU'];}
 const enemies=__game.spawnCardEnemies('bs_bonepile',1,1);for(const e of enemies){e.hp=e.maxhp=10000000;e.agi=1;e.ability=null;}
 __game.startBattle(enemies,null);document.getElementById('town-shell').classList.add('hidden');
 }''')
 page.locator('#combat-menu[data-mode="input"] .cmd-auto').wait_for()
 page.locator('#combat-menu .cmd-auto').click()
 for fast,gap in [(False,300),(True,300),(True,0)]:
  page.evaluate('''async({fast,gap})=>{__game.G.fastAnim=fast;(await import('/src/ui/prefs.js')).setPref('battleActionGap',gap);window.gapSamples=[];}''',{'fast':fast,'gap':gap})
  page.wait_for_function('gapSamples.length>=4',timeout=30000)
  samples=page.evaluate('gapSamples.slice(1,4)')
  assert all(gap-10<=v<gap+200 for v in samples),(fast,gap,samples)
  print({'fast':fast,'gap':gap,'measured':samples})
 assert page.evaluate("async() => {const p=await import('/src/ui/prefs.js');p.setPref('battleActionGap','broken');return p.battleActionGap();}")==0
 b.close()

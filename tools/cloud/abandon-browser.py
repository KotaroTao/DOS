"""実ゲーム・Worker・Edge・SQLで戦闘中断後の帰還と保存を確かめる。"""
import json,re
import os
import runpy
from pathlib import Path
art=runpy.run_path(str(Path(__file__).resolve().parent/"choice-bench/trial-browser.py"))
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
with sync_playwright() as p:
 b=p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER')=='webkit' else p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
 def stub_image(r):
  key=r.request.url.rsplit('/',1)[-1].split('.')[0]
  size=art['MONSTER_SIZES'].get(key,(2,2))
  if '/art/dungeon/' in r.request.url:size=(1254,1254) if key=='crypt-walker' else (1536,1024)
  if any('/art/'+part+'/' in r.request.url for part in ['items','collectibles','treasury']):size=(384,384)
  if any('/art/'+part+'/' in r.request.url for part in ['misc','offerings']):size=(320,320)
  r.fulfill(content_type='image/png',body=art['placeholder'](*size))
 c.route('**/art/**',stub_image)
 c.request.post('http://127.0.0.1:8002/test/reset')
 if os.environ.get('DOS_LEDGER_NO_WORKER'):c.add_init_script('window.Worker=undefined')
 c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
 calls=[];errors=[];hold={'on':False,'routes':[]};drop={'on':False}
 def api(r):
  u=urlparse(r.request.url);body=r.request.post_data_json if r.request.method=='POST' else None
  response=r.fetch(url='http://127.0.0.1:8002'+u.path+('?' +u.query if u.query else ''))
  calls.append({'path':u.path,'body':body,'status':response.status,'bytes':len(response.body())})
  if u.path.endswith('/cloud_battle_append') and hold['on']:
   hold['routes'].append(r);return
  if u.path.endswith('/cloud_battle_append') and drop['on']:
   drop['on']=False;r.fulfill(status=503,json={'message':'response lost'});return
  r.fulfill(response=response)
 c.route('https://cloud.test/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8001/?testDungeon=w18')
 page.wait_for_function("window.__game?.G.board && !document.body.classList.contains('booting')",timeout=60000)
 snap=page.evaluate('''async()=>{
  const {Battle}=await import('/src/combat.js');const g=__game.G;
  // 応答喪失・復旧を調べる戦闘は固定の乱数から始める。初手の回避で待機条件を満たせない揺れを避ける。
  const {reseedRng}=await import('/src/rng.js');reseedRng(42);
  const foe=__game.spawnCardEnemies('bs_bonepile',1,1)[0];Object.assign(foe,{hp:150,maxhp:150,atk:1,agi:1,ability:null});
  g.state='combat';g.battle=new Battle(g.party,[foe],()=>{});
  return JSON.parse(__game.inf.saveJSON());
 }''')
 page.evaluate('''async snap=>{
  const cloud=await import('/src/cloud-save.js');const {LEGAL_VERSION}=await import('/src/legal.js');
  localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:true}}));
  localStorage.setItem('dos-legal-version:11111111-1111-4111-8111-111111111111',LEGAL_VERSION);
  await cloud.connectCloud(null);await cloud.cloudSave(snap);
 }''',snap)
 def reopen():
  page.goto('http://127.0.0.1:8001/')
  page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
  page.wait_for_function("window.__game?.G.battle && document.querySelector('.cloud-gate')?.hidden && __game.G.battle.phase==='input' && !__game.G.animating",timeout=60000)
 reopen()
 page.wait_for_function("!document.body.classList.contains('game-starting')&&!document.querySelector('.ttl-overlay')",timeout=60000)
 # 実際の手帳と同じ操作から、戦闘の断念→赤い魂20→街へ戻る。
 red=page.evaluate('__game.G.redSoul')
 page.evaluate("""async()=>{const {game}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();__game.G.prompt=false;game.confirmAbandonDungeon();}""")
 page.get_by_role('button',name='諦める',exact=True).click()
 page.get_by_role('button',name=re.compile('赤い魂 20 で全てを守る')).first.click()
 page.wait_for_function("__game.G.state==='town'&&!__game.G.battle",timeout=60000)
 page.evaluate("async()=>{await (await import('/src/cloud-save.js')).cloudFlush()}")
 assert page.evaluate('__game.G.redSoul')==red-20
 assert not page.evaluate("(document.querySelector('.cloud-gate')&&!document.querySelector('.cloud-gate').hidden)")
 page.goto('http://127.0.0.1:8001/')
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 try:
  page.wait_for_function("__game.G.state==='town'&&document.querySelector('.cloud-gate')?.hidden",timeout=60000)
 except Exception:
  print(page.evaluate("({state:__game.G.state,gate:document.querySelector('.cloud-gate')?.innerText,red:__game.G.redSoul})"),errors,[(v['path'],v['status'],v['body'].get('op') if v['body'] else None) for v in calls[-8:]])
  raise
 assert page.evaluate('__game.G.redSoul')==red-20
 # 帰還後に金貨を更新し、次の戦闘を開始しても古い戦闘と衝突しない。
 page.evaluate("""async()=>{
  const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();__game.G.prompt=false;
  __game.G.gold+=77;await __game.autosave(true);
  const foe=__game.spawnCardEnemies('bs_bonepile',1,1)[0];Object.assign(foe,{hp:99999,maxhp:99999,atk:1,agi:1,ability:null});
  __game.startBattle([foe],null);
 }""")
 page.wait_for_function("__game.G.state==='combat'&&!__game.G.animating&&__game.G.battle.phase==='input'",timeout=60000)
 page.evaluate("async()=>{await (await import('/src/cloud-save.js')).cloudFlush()}")
 assert not page.evaluate("!document.querySelector('.cloud-gate').hidden")
 assert not errors,errors
 cancels=[x for x in calls if x['body'] and x['body'].get('op')=='ledger-cancel']
 assert len(cancels)==1,cancels
 assert cancels[0]['status']==200,cancels
 assert all(x['status']==200 for x in calls),calls
 print('戦闘中に諦める→赤い魂20で帰還→再読込で街・支払維持→通常保存→次の戦闘: OK')
 c.close();b.close()

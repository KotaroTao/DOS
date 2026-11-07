"""実際のゲーム・Worker・Edge・SQLで本番B方式を通す。"""
import json
import os
import runpy
from pathlib import Path
art=runpy.run_path(str(Path(__file__).resolve().parent/"browser-fixtures.py"))
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
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
 page.goto('http://127.0.0.1:8001/?testDungeon=w01')
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
 before=page.evaluate('__game.G.battle.enemies[0].hp')
 drop['on']=True
 page.locator('#combat-menu .cmd-main button.primary').first.click()
 try:
  page.wait_for_function("__game.G.battle.phase==='input' && !__game.G.animating && __game.G.battle.enemies[0].hp<150",timeout=60000)
 except Exception:
  print('戦闘復旧の診断:',json.dumps({'state':page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,animating:__game.G.animating,hp:__game.G.battle?.enemies.map(e=>e.hp),log:__game.G.logs?.slice(-6),gate:document.querySelector('.cloud-gate')?.textContent})"),'errors':errors,'requests':[{'path':v['path'],'status':v['status']} for v in calls[-8:]]},ensure_ascii=False))
  raise
 duplicates=[x for x in calls if x['path'].endswith('/cloud_battle_append')]
 assert len(duplicates)>=2 and duplicates[0]['body']==duplicates[1]['body'],'応答喪失で命令を変えている'
 before=page.evaluate('__game.G.battle.enemies[0].hp')
 hold['on']=True
 page.locator('#combat-menu .cmd-main button.primary').first.click()
 page.wait_for_timeout(6200)
 diagnostic=page.evaluate("async()=>(await import('/src/action-wait.js')).actionWaitReport()")
 assert any(v['waitMs']>=5000 and any(t['stage']=='http.ledger-command' for t in v['active']) for v in diagnostic['records']),diagnostic
 assert hold['routes'],calls[-5:]
 assert page.evaluate('__game.G.battle.enemies[0].hp')==before,'ACK前に結果を表示した'
 assert any(x['path'].endswith('/cloud_battle_append') and x['status']==200 for x in calls)
 hold['on']=False
 for route in hold['routes']:route.abort('failed')
 hold['routes']=[]
 # 送信待ち・選択・途中セーブをすべて消す。サーバーに追記済みの選択は消えない。
 page.evaluate("""()=>{for(const key of Object.keys(localStorage))if(/dos-cloud-(pending|choice|checkpoint):/.test(key))localStorage.removeItem(key)}""")
 reopen()
 persisted=page.evaluate("async()=>(await import('/src/action-wait.js')).actionWaitReport().records")
 assert persisted and persisted[-1]['waitMs']>=5000,'再読込で診断が消えた'
 after=page.evaluate('__game.G.battle.enemies[0].hp')
 assert after<before,(before,after)
 assert not any(x['body'] and x['body'].get('op')=='command' for x in calls),'毎手の重いEdge経路を使った'
 # 通常保存で戦闘を巻き戻そうとしても拒否する。
 rejection=page.evaluate('''async snap=>{
  const response=await fetch('https://cloud.test/functions/v1/game-save',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify({protocol:1,op:'save',sessionId:localStorage.getItem('dos-cloud-session:11111111-1111-4111-8111-111111111111'),revision:1,commandId:crypto.randomUUID(),snapshot:snap})});return response.status;
 }''',snap)
 assert rejection==409,rejection
 # 作戦シートで変えた命令は確定済みの古い応答でも戻らず、戦闘後も保存する。
 page.evaluate("async()=>{const {openPartyTactics}=await import('/src/ui/party.js');openPartyTactics(__game.G.party)}")
 page.locator('.pt-tac-who').first.click()
 page.locator('.pt-tac-b').filter(has_text='刃のみ振るえ').click()
 page.get_by_role('button',name='閉じる',exact=True).last.click()
 page.get_by_role('button',name='閉じる',exact=True).last.click()
 assert page.evaluate('__game.G.party[0].tactic')=='blade'
 page.get_by_role('button',name='オート',exact=True).first.click()
 page.wait_for_function("__game.G.state!=='combat'",timeout=90000)
 page.evaluate("async()=>{await (await import('/src/cloud-save.js')).cloudFlush()}")
 finishes=[x for x in calls if x['body'] and x['body'].get('op')=='ledger-finish']
 assert len(finishes)==1 and finishes[0]['status']==200,finishes
 assert page.evaluate('__game.G.party[0].tactic')=='blade','戦闘応答で作戦が戻った'
 # 端末を読み直し、サーバーに保存された作戦も確認する。
 page.reload()
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.wait_for_function("window.__game?.G.party?.length && document.querySelector('.cloud-gate')?.hidden",timeout=60000)
 assert page.evaluate('__game.G.party[0].tactic')=='blade','戦闘後の保存で作戦が消えた'
 assert not errors,errors
 appends=[x for x in calls if x['path'].endswith('/cloud_battle_append')]
 assert all(x['bytes']<100 for x in appends),appends
 print(json.dumps({'appendRequests':len(appends),'maxReplyBytes':max(x['bytes'] for x in appends),'finishRequests':len(finishes),'errors':errors},ensure_ascii=False))
 c.close();b.close()

"""実SQL/Edgeの命令戦闘。応答喪失・再送・途中終了と再開・通信量を確認。"""
import json
import uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
 c.request.post('http://127.0.0.1:8002/test/reset')
 c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
 commands=[];sizes=[];drop={'once':True};conflict={'once':False};hold={'on':False,'held':[]};errors=[]
 def api(r):
  u=urlparse(r.request.url);body=r.request.post_data_json if r.request.method=='POST' else None
  if body and body.get('op')=='command' and conflict['once']:
   conflict['once']=False
   other={**body,'op':'save','commandId':str(uuid.uuid4()),'change':[]}
   advanced=r.fetch(url='http://127.0.0.1:8002'+u.path,post_data=json.dumps(other))
   assert advanced.status==200
  response=r.fetch(url='http://127.0.0.1:8002'+u.path+('?' +u.query if u.query else ''))
  if body and body.get('op')=='command':
   commands.append(body);sizes.append((len(r.request.post_data.encode()),len(response.body())))
   if drop['once']:
    drop['once']=False;r.fulfill(status=503,json={'error':'response lost'});return
  if body and body.get('op')=='command' and hold['on']:
   hold['held'].append((r,body));return
  r.fulfill(response=response)
 c.route('https://cloud.test/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8001/?testDungeon=w01')
 page.wait_for_function("window.__game?.G.board && !document.body.classList.contains('booting')",timeout=60000)
 snap=page.evaluate('''async()=>{
  const {Battle}=await import('/src/combat.js');const {ITEMS}=await import('/src/items.js');const g=__game.G;
  g.party=g.party.slice(0,1);g.reserve=[];g.inventory=Array.from({length:1000},()=>({...ITEMS.u_styptic_salve}));g.party[0].items=g.inventory;
  Object.assign(g.party[0],{hp:50000,maxhp:50000,atk:50,agi:1000});
  const foe=__game.spawnCardEnemies('bs_bonepile',1,1)[0];Object.assign(foe,{hp:100000,maxhp:100000,atk:1,agi:1,ability:null});
  g.state='combat';g.battle=new Battle(g.party,[foe],()=>{});g.battle.chooseAction('attack');
  return JSON.parse(__game.inf.saveJSON());
 }''')
 page.evaluate('''async snap=>{
  const cloud=await import('/src/cloud-save.js');const {LEGAL_VERSION}=await import('/src/legal.js');
  localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:true}}));
  localStorage.setItem('dos-legal-version:11111111-1111-4111-8111-111111111111',LEGAL_VERSION);
  await cloud.connectCloud(null);await cloud.cloudSave(snap);
 }''',snap)
 page.goto('http://127.0.0.1:8001/')
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.locator('#combat-menu .target-list button').first.wait_for(timeout=60000)
 # 読込時に再計算した能力と、サーバーが使う能力が一致する。
 assert page.evaluate("""async()=>{
  const {refDeserialize}=await import('/src/savegraph.js');
  const sessionId=localStorage.getItem('dos-cloud-session:11111111-1111-4111-8111-111111111111');
  const response=await fetch('https://cloud.test/functions/v1/game-save',{method:'POST',headers:{apikey:'test',Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify({protocol:1,sessionId,op:'claim',compactGraph:true})});
  const state=refDeserialize((await response.json()).snapshot);return state.party[0].atk===__game.G.party[0].atk&&state.party[0].maxhp===__game.G.party[0].maxhp;
 }""")
 before=page.evaluate('__game.G.battle.enemies[0].hp')
 page.locator('#combat-menu .target-list button').first.click()
 page.wait_for_function("__game.G.battle.enemies[0].hp<100000 && !__game.G.animating && __game.G.battle.phase==='input'",timeout=60000)
 assert len(commands)>=2 and commands[0]==commands[1],commands
 assert commands[0]['op']=='command' and 'snapshot' not in commands[0]
 after=page.evaluate('__game.G.battle.enemies[0].hp')
 awaitable="async()=>{await (await import('/src/cloud-save.js')).cloudFlush()}"
 page.evaluate(awaitable)
 page.reload();page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.wait_for_function("window.__game?.G.battle && document.querySelector('.cloud-gate')?.hidden",timeout=60000)
 assert page.evaluate('__game.G.battle.enemies[0].hp')==after
 assert page.evaluate('__game.G.inventory.length')==1000
 # 実際の選択ボタンから命令を送り、DB確定後の返答を止めて画面を閉じる。
 page.wait_for_function("__game.G.battle.phase==='input' && !__game.G.animating",timeout=60000)
 hold['on']=True
 page.locator('#combat-menu .cmd-main button.primary').first.click()
 page.wait_for_timeout(1500)
 assert hold['held'],'命令が送信されない'
 held_body=hold['held'][0][1]
 assert page.evaluate("""async()=>{const m=await import('/src/cloud-save.js');window.unexpectedSave=false;const ok=await m.cloudPrepareReload(()=>{unexpectedSave=true;return Promise.resolve(true)});return ok===false&&!unexpectedSave;}""")
 assert page.evaluate("!!localStorage.getItem('dos-cloud-choice:11111111-1111-4111-8111-111111111111')")
 for route,_ in hold['held']: route.abort('failed')
 c.unroute_all(behavior='ignoreErrors');page.close();hold['on']=False
 c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
 c.route('https://cloud.test/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8001/')
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.wait_for_function("window.__game?.G.battle && document.querySelector('.cloud-gate')?.hidden",timeout=60000)
 assert sum(x['commandId']==held_body['commandId'] for x in commands)>=2
 assert page.evaluate('__game.G.battle.enemies[0].hp')<after
 page.wait_for_function("__game.G.battle.phase==='input' && !__game.G.animating",timeout=60000)
 page.evaluate(awaitable)
 # 別の更新が先に確定した場合、古い選択を退避して最新記録へ戻れる。
 before_conflict=page.evaluate('__game.G.battle.enemies[0].hp')
 conflict['once']=True
 page.locator('#combat-menu .cmd-main button.primary').first.click()
 page.get_by_role('button',name='最新の記録から再開',exact=True).wait_for(timeout=60000)
 with page.expect_navigation(wait_until='domcontentloaded'):
  page.get_by_role('button',name='最新の記録から再開',exact=True).click()
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.wait_for_function("window.__game?.G.battle && document.querySelector('.cloud-gate')?.hidden",timeout=60000)
 assert page.evaluate('__game.G.battle.enemies[0].hp')==before_conflict
 assert page.evaluate("!localStorage.getItem('dos-cloud-choice:11111111-1111-4111-8111-111111111111') && !!localStorage.getItem('dos-cloud-choice:11111111-1111-4111-8111-111111111111:recovery')")
 assert not errors,errors
 print('版競合: 選択を退避し、過去へ戻らず最新の記録から再開 OK')
 print('選択のDB確定→応答停止→画面終了→同じIDで再開 OK')
 print('命令戦闘: 応答喪失でも同じ命令を再送・再起動で確定済み結果・袋1000個の維持 OK')
 print('要求/応答本文バイト:',sizes)
 c.unroute_all(behavior='ignoreErrors');c.close();b.close()

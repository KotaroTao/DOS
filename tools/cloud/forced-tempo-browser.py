"""実SQL/Edgeと900msの通信遅延で、選択不要の3手の通信削減と開始時の背面を確認。"""
import json
import gzip
import base64
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 measurements={}
 for batch in [False,True]:
  c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
  c.request.post('http://127.0.0.1:8002/test/reset')
  c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
  held=[];sent=[];mode={'measure':False,'startup':False};errors=[]
  def api(r):
   u=urlparse(r.request.url);body=r.request.post_data_json if r.request.method=='POST' else None
   if body:sent.append(body)
   if body and body['op']=='save' and mode['startup']:held.append(r);return
   if body and body['op']=='command' and mode['measure']:time.sleep(.9)
   response=r.fetch(max_retries=2,url='http://127.0.0.1:8002'+u.path+('?' +u.query if u.query else ''))
   if body and body['op']=='claim':
    value=response.json()
    if value.get('wireFormat')=='gzip-base64':value=json.loads(gzip.decompress(base64.b64decode(value['payload'])))
    value['forcedTurns']=batch;r.fulfill(json=value)
   else:r.fulfill(response=response)
  c.route('https://cloud.test/**',api)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8001/?testDungeon=w01')
  page.wait_for_function("window.__game?.G.board && !document.body.classList.contains('booting')")
  snap=page.evaluate('''async()=>{
   const {Battle}=await import('/src/combat.js'),{reseedRng,rngState}=await import('/src/rng.js');const g=__game.G;
   g.party=g.party.slice(0,1);g.reserve=[];g.inventory=[];g.party[0].items=g.inventory;g.party[0].agi=1000;
   reseedRng(7);g.rng=rngState();
   const foes=Array.from({length:3},()=>__game.spawnCardEnemies('bs_bonepile',1,1)[0]);
   for(const f of foes)Object.assign(f,{hp:100000,maxhp:100000,atk:1,agi:1,ability:null});
   g.state='combat';g.battle=new Battle(g.party,foes,()=>{});g.battle.chooseAction('attack');
   return JSON.parse(__game.inf.saveJSON());
  }''')
  page.evaluate('''async snap=>{
   const cloud=await import('/src/cloud-save.js'),{LEGAL_VERSION}=await import('/src/legal.js');
   localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:true}}));
   localStorage.setItem('dos-legal-version:11111111-1111-4111-8111-111111111111',LEGAL_VERSION);
   await cloud.connectCloud(null);await cloud.cloudSave(snap);
  }''',snap)
  mode['startup']=True
  page.goto('http://127.0.0.1:8001/')
  page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
  page.wait_for_timeout(1800)
  assert held,'再開時の記録補正を保留できない'
  page.wait_for_function("window.__game?.G.battle && !document.querySelector('.ttl-overlay')")
  assert page.evaluate("getComputedStyle(document.getElementById('app')).opacity==='0'"),'準備中に背面のゲーム画面が見える'
  mode['startup']=False
  for route in held:
   u=urlparse(route.request.url);route.fulfill(response=route.fetch(max_retries=2,url='http://127.0.0.1:8002'+u.path))
  page.locator('#combat-menu .target-list button').first.wait_for(timeout=60000)
  page.wait_for_function("getComputedStyle(document.getElementById('app')).opacity==='1' && !document.querySelector('.ttl-overlay')")
  mode['measure']=True;offset=len(sent)
  page.evaluate('''batch=>{
   const g=__game.G,token=g.battle._commandToken;window.roundMs=null;const t=performance.now();
   const tick=()=>{
    if(g.battle.phase==='input'&&!g.animating&&g.battle._commandToken!==token){roundMs=performance.now()-t;return;}
    // 確定した演出の途中で保存契機が来ても、古い表示地点をサーバーへ書き戻さない。
    if(batch&&['enemy','stunned'].includes(g.battle.phase))__game.autosave(true);
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  }''',batch)
  page.locator('#combat-menu .target-list button').first.click()
  page.wait_for_function('window.roundMs!==null',timeout=30000)
  elapsed=page.evaluate('roundMs');ops=[b['op'] for b in sent[offset:]]
  if batch:assert ops.count('command')==1 and 'save' not in ops,ops
  else:assert ops.count('command')==4,ops
  measurements[batch]=elapsed
  assert page.locator('.cloud-gate').is_hidden()
  assert not errors,errors
  print(('まとめて確定' if batch else '1手ずつ確定'),round(elapsed),'ms / 次の選択まで、要求',ops,flush=True)
  c.unroute_all(behavior='ignoreErrors');c.close()
 assert measurements[True]<measurements[False]*.75,measurements
 print('900ms通信遅延: 敵3体の通信を3回削減・次の選択までの待ちを短縮、準備中の背面表示なし OK',flush=True)
 browser.close()

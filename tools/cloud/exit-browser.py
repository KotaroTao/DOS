"""Workerの保存準備が止まった直後でも、終了時の最新地点を回収する。"""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town');page.wait_for_function('window.__game?.G.party.length>0')
 seed=page.evaluate('()=>{__game.G.apprenticeName="再開の検査";return __game.inf.saveJSON()}')
 legal=page.evaluate("async()=>(await import('/src/legal.js')).LEGAL_VERSION")
 state={'snapshot':json.loads(seed),'revision':0};commands=[]
 config='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
 c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=config))
 auth={'access_token':'test','expires_at':9999999999,'user':{'id':'exit-test','email':'test@example.invalid'}}
 page.evaluate('([auth,legal])=>{localStorage.setItem("dos-cloud-auth",JSON.stringify(auth));localStorage.setItem("dos-legal-version:exit-test",legal)}',[auth,legal])
 def api(r):
  if r.request.url.endswith('/auth/v1/user'):r.fulfill(json=auth['user']);return
  cmd=r.request.post_data_json;commands.append(cmd)
  if cmd['op']=='save':
   assert cmd.get('snapshot'),'回収時に本文を欠落させない'
   state['snapshot']=cmd['snapshot'];state['revision']+=1
  r.fulfill(json={**state,'compactGraph':True,'backgroundBattle':True})
 c.route('https://cloud.test/**',api)
 def start():
  page.goto('http://localhost:8000/')
  page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
  page.wait_for_function('window.__game?.G.party.length>0 && !document.querySelector(".ttl-overlay")')
 start();page.evaluate('async()=>{await __game.autosave(true)}')
 for event in ['visibilitychange','beforeunload','pagehide']:
  # Workerを止めたまま金貨と品を変更し、終了用のイベントを同じタスクで起こす。
  page.evaluate('''async event=>{
   window.actualPost=Worker.prototype.postMessage;
   Worker.prototype.postMessage=function(){};
   __game.G.gold+=1234;
   __game.G.inventory.push({id:'audit-marker',slot:'misc',name:'終了直前の品'});
   __game.autosave(true);
   if(event==='visibilitychange'){
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
    document.dispatchEvent(new Event(event));
   }else window.dispatchEvent(new Event(event));
  }''',event)
  before=page.evaluate('({gold:__game.G.gold,n:__game.G.inventory.length})')
  start()
  after=page.evaluate('({gold:__game.G.gold,n:__game.G.inventory.length})')
  assert after==before,(event,before,after)
  assert page.evaluate('__game.G.party.every(d=>d.items===__game.G.inventory)')
  print(event+': Worker停止中の終了直前の金貨・品・共有袋を次回起動で回収 OK',flush=True)
 assert not errors,errors
 c.close();b.close()

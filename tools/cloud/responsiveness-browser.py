"""通信応答を止めても戦闘が進み、終了後に最新地点へ復旧する。移動中の描画も確認。"""
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
 c.request.post('http://127.0.0.1:8002/test/reset')
 c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
 hold={'on':False};held=[];held_routes=[];sent=[];reply_sizes=[];errors=[]
 def api(r):
  u=urlparse(r.request.url);body=r.request.post_data_json if r.request.method=='POST' else None
  if body:sent.append(body)
  if hold['on'] and body and body['op']=='save':held.append(body);held_routes.append(r);return
  response=r.fetch(max_retries=2,url='http://127.0.0.1:8002'+u.path+('?' +u.query if u.query else ''))
  if body and body['op']=='save':
   reply_sizes.append(len(response.body()))
   assert len(response.body())<100,(len(response.body()),response.body())
  r.fulfill(response=response)
 c.route('https://cloud.test/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8001/?testDungeon=w01')
 page.wait_for_function("window.__game?.G.board && !document.body.classList.contains('booting')")
 snap=page.evaluate('''async()=>{
  const {Battle}=await import('/src/combat.js');const {ITEMS}=await import('/src/items.js');const g=__game.G;
  g.party=g.party.slice(0,1);g.reserve=[];g.inventory=Array.from({length:1000},()=>({...ITEMS.u_styptic_salve}));g.party[0].items=g.inventory;
  const foe=__game.spawnCardEnemies('bs_bonepile',1,1)[0];Object.assign(foe,{hp:100000,maxhp:100000,atk:1,agi:1,ability:null});
  g.state='combat';g.battle=new Battle(g.party,[foe],()=>{});
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
 page.wait_for_function("window.__game?.G.battle?.phase==='input' && !__game.G.animating && !document.body.classList.contains('booting') && document.querySelector('#combat-menu button')")
 assert page.evaluate("async()=>{const c=await import('/src/cloud-save.js');return c.cloudBackgroundBattle()&&c.cloudCommandMode()}")
 page.evaluate("async()=>await (await import('/src/cloud-save.js')).cloudFlush()")
 page.evaluate("async()=>{__game.G.gold++;await __game.autosave(true);await (await import('/src/cloud-save.js')).cloudFlush()}")
 assert any(b['op']=='save' and 'change' in b for b in sent),'通常保存の差分がない'
 offset=len(sent);hold['on']=True
 page.evaluate('''()=>{
  const g=__game.G,b=g.battle;window.actions=[];g.fastAnim=true;
  const advance=Object.getPrototypeOf(b).advance;
  b.advance=function(){const result=advance.call(this);actions.push(performance.now());if(actions.length>=8)g.autoCombat=false;return result;};
  g.autoCombat=true;__game.world.resumeFromState();
 }''')
 page.wait_for_function("actions.length>=8 && !__game.G.animating && __game.G.battle.phase==='input'",timeout=15000)
 times=page.evaluate('actions.slice(1).map((t,i)=>t-actions[i])')
 assert max(times)<1000,times
 assert held and all(b['op']=='save' for b in sent[offset:]),sent[offset:]
 assert page.locator('.cloud-gate').is_hidden()
 # 通信未確定でも終了直前の最新地点を残し、次の起動で旧要求→最新地点の順に送る。
 expected=page.evaluate('({hp:__game.G.party[0].hp,enemy:__game.G.battle.enemies[0].hp,rng:[...__game.G.rng],n:__game.G.inventory.length})')
 page.evaluate("window.dispatchEvent(new Event('pagehide'))")
 checkpoint=page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-checkpoint:11111111-1111-4111-8111-111111111111'))")
 assert checkpoint
 hold['on']=False
 for route in held_routes:route.fulfill(status=503,json={'error':'response lost'})
 page.reload()
 page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
 page.wait_for_function("window.__game?.G.battle && !document.body.classList.contains('booting') && document.querySelector('.cloud-gate').hidden",timeout=60000)
 actual=page.evaluate('({hp:__game.G.party[0].hp,enemy:__game.G.battle.enemies[0].hp,rng:[...__game.G.rng],n:__game.G.inventory.length})')
 assert actual==expected,(expected,actual)
 print('応答を全停止: 8行動継続、行動間隔ms',times,flush=True)
 print('差分要求・1,000品・途中終了後のHP/敵HP/乱数の一致 OK、保存応答本文bytes',reply_sizes,flush=True)
 # めくり・スライドの途中でHUDを組み直さず、動く蓋の枠を補間する。
 page.goto('http://127.0.0.1:8001/?testDungeon=w02')
 page.wait_for_function("window.__game?.G.board && !__game.G.anim && !document.body.classList.contains('booting')")
 result=page.evaluate('''async()=>{
  const g=__game.G,{moveStep}=__game.autoMove;
  const x=g.px===0?1:g.px-1,y=g.py,c=g.board.cells[y][x];
  c.type='empty';c.revealed=false;c.cleared=true;c.walls={n:false,s:false,w:false,e:false};
  g.prompt=false;g.settingsOpen=false;
  let hudDuringFlip=0;const smoothing=[];const dimensions=[];
  const observer=new MutationObserver(()=>{if(g.flipAnim||g.heroAnim)hudDuringFlip++;});
  for(const id of ['party','runbar','hint'])observer.observe(document.getElementById(id),{subtree:true,childList:true});
  const proto=CanvasRenderingContext2D.prototype,original=proto.drawImage;
  proto.drawImage=function(...args){
   if(this.canvas.id==='view'&&new Error().stack.includes('drawFlipSlab'))smoothing.push(this.imageSmoothingEnabled);
   return original.apply(this,args);
  };
  const timer=setInterval(()=>{if(g.flipAnim||g.heroAnim){const v=document.getElementById('view');dimensions.push(v.width+'x'+v.height);}},10);
  try{await new Promise(resolve=>moveStep(x,y,resolve));}
  finally{observer.disconnect();clearInterval(timer);proto.drawImage=original;}
  if(hudDuringFlip)throw Error('移動中に周辺UIが更新された: '+hudDuringFlip);
  if(smoothing.length<2||smoothing.some(v=>!v))throw Error('動く枠の補間なし: '+smoothing);
  if(new Set(dimensions).size!==1)throw Error('移動中の寸法変化: '+dimensions);
  return {frames:smoothing.length,hudDuringFlip,dimensions:[...new Set(dimensions)]};
 }''')
 print('めくり/歩行中の周辺UI再生成なし・枠の補間・寸法の安定',result,flush=True)
 assert not errors,errors
 c.unroute_all(behavior='ignoreErrors');c.close();browser.close()

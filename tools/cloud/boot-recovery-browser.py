"""送信待ちの回収後、最新記録の再取得が終わるまで起動中の入力を守る。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page()
 page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1}'))
 page.route('**/harness',lambda r:r.fulfill(content_type='text/html',body='<button id="game">まだ起動中の画面</button>'))
 page.goto('http://127.0.0.1:8001/harness')
 page.evaluate('''async()=>{
  const {LEGAL_VERSION}=await import('/src/legal.js');
  const {refSerialize}=await import('/src/savegraph.js');
  localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:9999999999,user:{id:'boot-test'}}));
  localStorage.setItem('dos-legal-version:boot-test',LEGAL_VERSION);
  localStorage.setItem('dos-cloud-checkpoint:boot-test',JSON.stringify({id:'new',sessionId:'session',snapshot:refSerialize({gold:4321})}));
  window.claims=0;window.reloaded=false;window.clicks=0;
  document.querySelector('#game').addEventListener('click',()=>clicks++);
  window.fetch=async(url,init)=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:'boot-test'});
   const cmd=JSON.parse(init.body);
   if(cmd.op==='claim'){
    claims++;
    if(claims===2){await new Promise(r=>window.finishRead=r);reloaded=true;}
   }
   return Response.json({revision:claims,snapshot:{gold:claims===2?4321:1}});
  };
  window.cloud=await import('/src/cloud-save.js');
  window.started=cloud.connectCloud(null);
 }''')
 page.wait_for_function('claims===2')
 assert page.evaluate('!cloud.cloudReady() && cloud.cloudBusy()'), '復旧後の読み戻し中に入力を解除しない'
 assert page.locator('.cloud-gate').evaluate('(e)=>!e.hidden')
 page.evaluate('document.querySelector("#game").click()');assert page.evaluate('clicks')==0
 page.evaluate('finishRead()')
 page.evaluate('async()=>{const s=await started;if(s.gold!==4321)throw Error("最新記録ではない")}')
 assert page.evaluate('cloud.cloudReady() && !cloud.cloudBusy()')
 print('起動復旧: 最新記録の読み戻し完了まで入力を維持し、完了後だけ解除 OK')
 b.close()

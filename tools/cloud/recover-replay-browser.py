"""再開中の再現不一致から、選択を退避して確定済み記録を読み直せる。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER')=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(service_workers='block')
    page.route('**/replay-harness',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
    page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1}'))
    page.add_init_script('''window.Worker=undefined;window.fetch=async(url,init)=>{
      if(url.endsWith('/auth/v1/user'))return Response.json({id:'replay-test'});
      const command=JSON.parse(init.body);
      if(command.op==='ledger-preview')return Response.json({message:'cloud_invalid_choice'},{status:400});
      return Response.json({revision:1,snapshot:JSON.parse(localStorage.getItem('test-latest')),ledger:{id:'battle',seq:0},actionCommands:true,commandReplay:true,battleLedger:true});
    };''')
    page.goto(os.environ.get('DOS_TEST_URL','http://127.0.0.1:8001')+'/replay-harness')
    page.evaluate('''async()=>{
      const {LEGAL_VERSION}=await import('/src/legal.js'),{refSerialize}=await import('/src/savegraph.js');
      localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:9999999999,user:{id:'replay-test'}}));
      localStorage.setItem('dos-legal-version:replay-test',LEGAL_VERSION);
      localStorage.setItem('test-latest',JSON.stringify(refSerialize({gold:4321,state:'combat'})));
      localStorage.setItem('dos-cloud-choice:replay-test',JSON.stringify({sessionId:'session',commandId:crypto.randomUUID(),command:{operation:'commit',action:'defend'}}));
      localStorage.setItem('dos-cloud-session:replay-test','session');
      window.cloud=await import('/src/cloud-save.js');window.start=cloud.connectCloud(null);start.catch(e=>window.startError=e.message);
    }''')
    page.get_by_role('button',name='最新の記録から再開',exact=True).wait_for()
    assert page.evaluate('!window.startError&&!cloud.cloudReady()&&!!localStorage.getItem("dos-cloud-choice:replay-test")')
    with page.expect_navigation():page.get_by_role('button',name='最新の記録から再開',exact=True).click()
    assert page.evaluate('!localStorage.getItem("dos-cloud-choice:replay-test")&&!!localStorage.getItem("dos-cloud-choice:replay-test:recovery")')
    page.evaluate('''async()=>{window.cloud=await import('/src/cloud-save.js');const snapshot=await cloud.connectCloud(null);const {refDeserialize}=await import('/src/savegraph.js');if(refDeserialize(snapshot).gold!==4321)throw Error('確定記録が変化した');}''')
    assert page.evaluate('cloud.cloudReady()&&!cloud.cloudBusy()')
    print('再開中の不一致: 一般エラーへ落とさず復旧操作を表示・選択退避・確定済み記録の再開: OK')
    browser.close()

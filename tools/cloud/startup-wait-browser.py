"""端末の使用確認が終わらない時も復旧操作を表示し、例外を起動側へ返す。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    page.route('**/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1}'))
    page.route('**/harness',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
    for fails in [False,True]:
        page.goto('http://127.0.0.1:8001/harness')
        page.evaluate('''async fails=>{
          const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===15000?100:ms,...args);
          localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id:'test'}}));
          const {LEGAL_VERSION}=await import('/src/legal.js');localStorage.setItem('dos-legal-version:test',LEGAL_VERSION);
          window.fetch=async url=>Response.json(url.endsWith('/auth/v1/user')?{id:'test'}:{revision:1,snapshot:null});
          Object.defineProperty(navigator,'locks',{value:{request:()=>fails?Promise.reject(new Error('使用確認の失敗')):new Promise(()=>{})}});
          const cloud=await import('/src/cloud-save.js');
          cloud.connectCloud(null).catch(e=>{window.caught=e.message;cloud.cloudFatal()});
        }''',fails)
        if fails:
            page.get_by_role('button',name='再接続',exact=True).wait_for()
            assert page.evaluate('caught')=='使用確認の失敗'
        else:
            page.get_by_role('button',name='再読み込み',exact=True).wait_for()
            assert 'この端末の使用確認' in page.locator('.cloud-panel').inner_text()
    browser.close()
print('起動待機: 使用確認の停止・例外から復旧操作を表示 OK')

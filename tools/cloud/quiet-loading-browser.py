"""待機だけの画面には見出しや進捗の文を出さず、操作が必要なパネルは表示する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    page.route('**/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'))
    page.route('**/quiet-harness',lambda r:r.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/cloud.css"><button id="game">街</button>'))
    page.goto('http://127.0.0.1:8001/quiet-harness')
    page.evaluate('''async()=>{
      window.cloud=await import('/src/cloud-save.js');
      const {LEGAL_VERSION}=await import('/src/legal.js');
      localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:9999999999,user:{id:'quiet-test'}}));
      localStorage.setItem('dos-legal-version:quiet-test',LEGAL_VERSION);
      window.fail=false;window.holdSave=false;
      window.fetch=async(url,init)=>{
        if(url.endsWith('/auth/v1/user')){await new Promise(r=>window.releaseAuth=r);return Response.json({id:'quiet-test'});}
        const b=JSON.parse(init.body);
        if(b.op==='claim')await new Promise(r=>window.releaseClaim=r);
        if(b.op==='save'&&holdSave)await new Promise(r=>window.releaseSave=r);
        if(fail)throw Error('通信失敗');
        return Response.json({revision:1,snapshot:null});
      };
      window.connected=cloud.connectCloud(null);
    }''')
    def quiet():
        assert page.locator('.cloud-gate').is_visible()
        assert page.locator('.cloud-panel').is_hidden()
        assert page.locator('.cloud-gate').inner_text()==''
        assert page.evaluate('cloud.cloudBusy()')
    page.wait_for_function('!!window.releaseAuth');quiet()
    page.evaluate('releaseAuth()')
    page.wait_for_function('!!window.releaseClaim');quiet()
    page.evaluate('releaseClaim()')
    page.evaluate('async()=>await connected')
    assert page.locator('.cloud-gate').is_hidden()
    page.evaluate('()=>{holdSave=true;window.saved=cloud.cloudSave({gold:1});window.account=cloud.cloudManageAccount()}')
    page.wait_for_function('!!window.releaseSave');quiet()
    page.evaluate('releaseSave()')
    page.get_by_role('button',name='冒険へ戻る',exact=True).click()
    page.evaluate('async()=>await account')
    page.evaluate('()=>{holdSave=false;fail=true;window.saved=cloud.cloudSave({gold:2})}')
    page.get_by_role('button',name='再接続',exact=True).wait_for()
    assert page.locator('.cloud-panel').is_visible()
    assert '保存できません' in page.locator('.cloud-gate').inner_text()
    page.evaluate('fail=false;holdSave=true')
    page.get_by_role('button',name='再接続',exact=True).click()
    quiet()
    page.evaluate('releaseSave()')
    page.evaluate('async()=>await saved')
    page.evaluate('()=>{window.reloading=cloud.cloudPrepareReload(()=>cloud.cloudSave({gold:3}))}')
    page.wait_for_timeout(50);quiet()
    page.evaluate('releaseSave()')
    assert page.evaluate('async()=>await reloading')
    browser.close()
print('接続・読込・管理への遷移・再接続・終了保存は文字なし、通信失敗の説明と復旧操作は表示 OK')

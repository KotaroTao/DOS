"""失敗した要求が再起動をまたいで残る場合の復旧操作を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page()
    page.route("**/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1}'))
    page.route("**/harness", lambda r: r.fulfill(content_type="text/html", body='<button>ゲーム画面</button>'))
    page.goto("http://127.0.0.1:8001/harness")
    page.evaluate("""async () => {
      localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id:'test'}}));
      const {LEGAL_VERSION}=await import('/src/legal.js');
      localStorage.setItem('dos-legal-version:test',LEGAL_VERSION);
      window.cloud=await import('/src/cloud-save.js');
      window.fail=false;
      window.fetch=async(url,init)=>{
        if(url.endsWith('/auth/v1/user'))return Response.json({id:'test'});
        const b=JSON.parse(init.body);
        if(fail && b.op==='turn')return Response.json({error:'不正な戦闘',requestId:'test-request'}, {status:400});
        return Response.json({revision:1,snapshot:{saved:true},battleTurn:true});
      };
      await cloud.connectCloud(null);
      fail=true;window.pending=cloud.cloudBattle('commit',{test:true});
    }""")
    page.get_by_role('button',name='保存済みの記録から再開',exact=True).wait_for()
    assert 'HTTP 400' in page.locator('.cloud-panel').inner_text()
    assert 'test-request' in page.locator('.cloud-panel').inner_text()
    raw = page.evaluate("localStorage.getItem('dos-cloud-pending:test')")
    assert raw
    # 普通の再起動では同じ要求を回収し、同じ失敗になる。
    page.reload()
    page.evaluate("""async()=>{
      window.cloud=await import('/src/cloud-save.js');
      window.fetch=async(url,init)=>{
        if(url.endsWith('/auth/v1/user'))return Response.json({id:'test'});
        const b=JSON.parse(init.body);
        if(b.op==='turn')return new Response('',{status:400});
        return Response.json({revision:1,snapshot:{saved:true},battleTurn:true});
      };
      window.connected=cloud.connectCloud(null);
    }""")
    page.get_by_role('button',name='保存済みの記録から再開',exact=True).wait_for()
    # localStorageが満杯でも、IndexedDBへ退避完了してから再開する。
    page.evaluate("""() => {
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key.endsWith(':recovery'))throw new DOMException('容量不足','QuotaExceededError');
        return original.call(this,key,value);
      };
    }""")
    with page.expect_navigation():
        page.get_by_role('button',name='保存済みの記録から再開',exact=True).click()
    assert page.evaluate("localStorage.getItem('dos-cloud-pending:test')") is None
    archived = page.evaluate("""() => new Promise((resolve,reject)=>{
      const open=indexedDB.open('dos-cloud-recovery',1);
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('requests');
        const get=tx.objectStore('requests').get('dos-cloud-pending:test');
        get.onsuccess=()=>resolve(get.result);
        tx.oncomplete=()=>db.close();
      };
    })""")
    assert archived == raw
    page.evaluate("""async()=>{
      window.ops=[];
      window.fetch=async(url,init)=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:'test'});ops.push(JSON.parse(init.body).op);return Response.json({revision:1,snapshot:{saved:true},battleTurn:true});};
      window.cloud=await import('/src/cloud-save.js');
      window.snapshot=await cloud.connectCloud(null);
    }""")
    assert page.evaluate("snapshot.saved && !ops.includes('turn') && !cloud.cloudBusy()")
    browser.close()
print('クラウド復旧画面: 再起動後の再送失敗・HTTP表示・退避・保存済み記録から再開 OK')

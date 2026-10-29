"""通常のクラウド通信が遅くてもゲーム画面を覆わないことを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.route("**/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1}'))
    page.route("**/harness", lambda r: r.fulfill(content_type="text/html", body='<button id="game">ゲーム画面</button>'))
    page.goto("http://127.0.0.1:8001/harness")
    page.evaluate("""async () => {
      localStorage.setItem('dos-cloud-auth', JSON.stringify({access_token:'test',expires_at:Date.now()/1000+3600,user:{id:'test'}}));
      window.ops=[]; window.slow=false; window.offline=false;
      window.fetch=async (url, init) => {
        if(url.endsWith('/auth/v1/user')) return Response.json({id:'test'});
        const body=JSON.parse(init.body); ops.push(body.op);
        if(slow) await new Promise(r=>setTimeout(r,600));
        if(offline) throw new Error('通信失敗');
        return Response.json({revision:ops.length,snapshot:null});
      };
      window.cloud=await import('/src/cloud-save.js');
      const {LEGAL_VERSION}=await import('/src/legal.js');
      localStorage.setItem('dos-legal-version:test',LEGAL_VERSION);
      await cloud.connectCloud(null);
      window.flashes=0;
      new MutationObserver(()=>{if(!document.querySelector('.cloud-gate').hidden) flashes++})
        .observe(document.querySelector('.cloud-gate'),{attributes:true});
      slow=true;
      window.saved=cloud.cloudSave({gold:123});
      window.battled=cloud.cloudBattle('commit');
    }""")
    page.wait_for_timeout(200)
    assert page.evaluate("cloud.cloudBusy()")
    assert page.locator(".cloud-gate").is_hidden()
    assert page.locator("#game").is_visible()
    page.evaluate("async()=>{await saved;await battled;await cloud.cloudFlush()}")
    assert page.evaluate("flashes === 0 && !cloud.cloudBusy()")
    # 復帰時の占有延長も画面を隠さない。
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(200)
    assert page.locator(".cloud-gate").is_hidden()
    page.wait_for_function("!cloud.cloudBusy()")
    assert page.evaluate("ops.includes('renew') && flashes === 0")
    # 本当の通信失敗では復旧操作を残し、成功したらゲームへ戻る。
    page.evaluate("() => {offline=true;window.saved=cloud.cloudSave({gold:124});}")
    page.get_by_role("button", name="再接続", exact=True).wait_for()
    page.evaluate("offline=false")
    page.get_by_role("button", name="再接続", exact=True).click()
    page.evaluate("async()=>await saved")
    assert page.locator(".cloud-gate").is_hidden()
    assert page.evaluate("!cloud.cloudBusy()")
    browser.close()
print("クラウド通信: 低速保存・戦闘・占有延長で画面維持、通信失敗から復旧 OK")

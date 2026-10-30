"""規約・ゲスト・同一IDの登録・一枠・再開を実SQL/APIで確認する。Authのみ模擬。"""
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
GAME = "http://127.0.0.1:8001/"
CONFIG = 'export const CLOUD_CONFIG = {enabled:true,url:"https://cloud.test",anonKey:"test-key",protocol:1};'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport={"width":390,"height":844}, reduced_motion="reduce")
    context.route("**/src/cloud-config.js", lambda r:r.fulfill(content_type="text/javascript",body=CONFIG))
    sent=[]
    failing={"registration":False,"refresh":False}
    def api(route):
        u=urlparse(route.request.url)
        sent.append((u.path, route.request.post_data))
        if u.path=="/auth/v1/user" and route.request.method=="PUT" and failing["registration"]:
            route.fulfill(status=422,content_type="application/json",body='{"msg":"Email already exists"}'); return
        if u.path=="/auth/v1/token" and failing["refresh"]:
            route.fulfill(status=503,content_type="application/json",body='{"msg":"temporarily unavailable"}'); return
        route.fulfill(response=route.fetch(url="http://127.0.0.1:8002"+u.path+("?"+u.query if u.query else "")))
    context.route("https://cloud.test/**",api)
    context.request.post("http://127.0.0.1:8002/test/reset")
    page=context.new_page(); errors=[]; page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(GAME+"?saveSlot=3")
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").wait_for()
    assert not sent, "タイトル表示だけではユーザーを作らない"
    assert page.locator(".ttl-slot").count()==0
    page.screenshot(path="/tmp/dos-onboarding-title.png")
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    agree=page.get_by_role("button",name="同意して進む",exact=True); agree.wait_for(); assert agree.is_disabled()
    page.get_by_role("button",name="利用規約を読む",exact=True).click()
    page.get_by_role("dialog",name="利用規約",exact=True).wait_for()
    page.get_by_role("dialog",name="利用規約",exact=True).get_by_role("button",name="閉じる",exact=True).click()
    page.get_by_role("checkbox").check(); agree.click()
    page.get_by_role("button",name="ゲストではじめる",exact=True).wait_for()
    assert not sent
    page.get_by_role("button",name="ゲストではじめる",exact=True).click()
    page.wait_for_function("window.__game && document.querySelector('.cloud-gate').hidden")
    assert len([x for x in sent if x[0]=="/auth/v1/signup"])==1
    uid=page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")
    page.get_by_role("dialog",name="弟子の名前").get_by_role("textbox").fill("リュカ")
    page.get_by_role("button",name="旅を始める",exact=True).click()
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    page.evaluate("() => { __game.G.gold=4321; __game.autosave(true); }")
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    # 旧版で案内済みでも、修道院の踏破帰還後に新しい案内が出る。
    page.evaluate("""() => {
      localStorage.setItem('dos-cloud-register-hint:' + JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id, '1');
      const g = __game.G;
      g.dungeonIdx = __game.inf.DUNGEONS.findIndex(d => d.id === 'w03');
      __game.inf.returnToTown({outcome:'return'});
    }""")
    page.wait_for_timeout(700)
    assert page.locator('.cloud-gate').evaluate('(e) => e.hidden')
    page.evaluate("() => { __game.inf.returnToTown({outcome:'clear'}); }")
    page.get_by_role("button",name="記録を守る・引き継ぎの準備",exact=True).wait_for()
    assert "端末を買い替えた時" in page.locator(".cloud-panel").inner_text().replace("\u200b", "")
    assert "メールアドレスを登録" not in page.locator(".cloud-panel").inner_text().replace("\u200b", "")
    page.get_by_role("button",name="冒険へ戻る",exact=True).click()
    page.evaluate("() => { __game.inf.returnToTown({outcome:'clear'}); }")
    page.wait_for_timeout(700)
    assert page.locator('.cloud-gate').evaluate('(e) => e.hidden')
    page.evaluate("() => import('./src/cloud-save.js').then(m => {m.cloudManageAccount();})")
    page.get_by_role("button",name="記録を守る・引き継ぎの準備",exact=True).click()
    page.get_by_label("メールアドレス",exact=True).fill("player@example.invalid")
    page.get_by_label("パスワード",exact=True).fill("test-password")
    failing["registration"]=True
    page.get_by_role("button",name="アカウントを作成",exact=True).click()
    page.wait_for_function("document.querySelector('.cloud-panel [role=status]').textContent.includes('登録できません')")
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")==uid
    assert page.evaluate("__game.G.gold")==4321
    failing["registration"]=False
    page.get_by_role("button",name="アカウントを作成",exact=True).click()
    page.get_by_role("button",name="冒険へ戻る",exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")==uid
    assert page.evaluate("__game.G.gold")==4321
    page.reload(); page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("document.querySelector('.cloud-gate')?.hidden && !!window.__game")
    assert page.get_by_role("button",name="同意して進む",exact=True).count()==0
    assert page.evaluate("__game.G.gold")==4321
    assert page.evaluate("__game.G.apprenticeName")=="リュカ"
    assert page.evaluate("async () => (await import('./src/local-save.js')).saveSlotFromURL()")==1
    assert len([x for x in sent if x[0]=="/auth/v1/signup"])==1
    # 認証の更新に通信障害があっても、ゲストの接続情報を捨てずに再接続する。
    page.evaluate("() => { const a=JSON.parse(localStorage.getItem('dos-cloud-auth')); a.expires_at=1; localStorage.setItem('dos-cloud-auth',JSON.stringify(a)); }")
    failing["refresh"]=True
    page.reload(); page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.get_by_role("button",name="再接続",exact=True).wait_for()
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")==uid
    failing["refresh"]=False
    page.get_by_role("button",name="再接続",exact=True).click()
    page.wait_for_function("document.querySelector('.cloud-gate')?.hidden && !!window.__game")
    assert page.evaluate("__game.G.gold")==4321
    # メール確認後も同じID・同じ記録。実際のメール配信は外部の確認が必要。
    context.request.post("http://127.0.0.1:8002/test/confirm")
    page.reload(); page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("document.querySelector('.cloud-gate')?.hidden && !!window.__game")
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.is_anonymous") is False
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")==uid
    assert page.evaluate("__game.G.gold")==4321
    # 退会では本人のアカウントとクラウド記録を削除する。
    page.reload()
    page.get_by_role("button",name="データ削除",exact=True).click()
    page.get_by_role("alertdialog",name="データ削除の確認").wait_for()
    page.get_by_role("button",name="やめる",exact=True).click()
    assert not [x for x in sent if x[1] and '"op":"reset"' in x[1]]
    page.get_by_role("button",name="データ削除",exact=True).click()
    page.get_by_role("button",name="消して始める",exact=True).click()
    page.wait_for_function("document.querySelector('.ttl-overlay:not(.ttl-out) .ttl-btn-t')?.textContent.replaceAll('\\u200b', '') === '冒険を始める'")
    assert page.get_by_role("button",name="つづきから",exact=False).count()==0
    page.reload()
    page.wait_for_function("document.querySelector('.ttl-overlay:not(.ttl-out) .ttl-btn-t')?.textContent.replaceAll('\\u200b', '') === '冒険を始める'")
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").wait_for()
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.get_by_role("dialog",name="弟子の名前").wait_for()
    assert page.evaluate("__game.G.gold")==0
    assert page.evaluate("__game.G.party.length")==0
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")==uid
    assert [x for x in sent if x[1] and '"op":"reset"' in x[1]]
    page.get_by_role("dialog",name="弟子の名前").get_by_role("textbox").fill("新たな弟子")
    page.get_by_role("button",name="旅を始める",exact=True).click()
    page.evaluate("async () => { __game.G.gold=7; await __game.autosave(true); }")
    page.reload()
    page.wait_for_function("document.querySelector('.ttl-overlay:not(.ttl-out) .ttl-btn-t')?.textContent.replaceAll('\\u200b', '') === 'つづきから'")
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("!!window.__game && document.querySelector('.cloud-gate')?.hidden")
    assert page.evaluate("__game.G.gold")==7
    page.evaluate("() => import('./src/cloud-save.js').then(m => {m.cloudManageAccount();})")
    page.get_by_role("button",name="退会・記録を削除",exact=True).click()
    page.get_by_label("削除の確認",exact=True).fill("削除")
    page.get_by_role("button",name="アカウントと記録を完全に削除",exact=True).click()
    page.wait_for_function("!localStorage.getItem('dos-cloud-auth')")
    state=context.request.get("http://127.0.0.1:8002/test/state").json()
    assert state=={"saves":0,"users":0},state
    assert not errors,errors
    page.wait_for_load_state("domcontentloaded")
    page.screenshot(path="/tmp/dos-onboarding-resume.png")
    context.unroute_all(behavior="ignoreErrors")
    context.close(); browser.close()
print("タイトル優先・未同意時の匿名作成なし・規約表示・ゲスト保存・同一ID登録・登録失敗と認証更新失敗の保全・再開・旧枠URLの無効化・退会 OK")

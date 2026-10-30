"""ローカルAPIとゲームをPlaywrightで確認する。実アカウントは使わない。"""
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

GAME = "http://127.0.0.1:8001/"
CONFIG = 'export const CLOUD_CONFIG = Object.freeze({ enabled: true, url: "https://cloud.test", anonKey: "test-public-key", protocol: 1 });'

def connect_existing(page):
    page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("!!window.__game && document.querySelector('.cloud-gate')?.hidden")
    page.wait_for_function("!document.querySelector('.ttl-overlay.ttl-out')")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
    context.request.post("http://127.0.0.1:8002/test/reset")
    errors = []
    failed = {"value": False}
    def routes(route):
        if failed["value"] and "/functions/" in route.request.url:
            route.abort("failed")
            return
        parsed = urlparse(route.request.url)
        response = route.fetch(url="http://127.0.0.1:8002" + parsed.path + ("?" + parsed.query if parsed.query else ""))
        route.fulfill(response=response)
    context.route("**/src/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body=CONFIG))
    context.route("https://cloud.test/**", routes)
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(GAME)
    page.locator(".ttl-overlay .ttl-menu .ttl-btn.primary").click()
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="同意して進む", exact=True).click()
    page.get_by_role("button", name="登録済みの方はこちら", exact=True).click()
    page.get_by_label("メールアドレス", exact=True).fill("player@example.invalid")
    page.get_by_label("パスワード", exact=True).fill("test-password")
    page.get_by_role("button", name="ログイン", exact=True).click()
    page.wait_for_function("!!window.__game && document.querySelector('.cloud-gate').hidden")
    page.wait_for_function("!document.querySelector('.ttl-overlay.ttl-out')")
    page.screenshot(path="/tmp/dos-cloud-login-desktop.png")
    page.get_by_role("dialog", name="弟子の名前", exact=True).get_by_role("textbox").fill("リュカ")
    page.get_by_role("button", name="旅を始める", exact=True).click()
    page.wait_for_function("!document.querySelector('.cloud-gate') || document.querySelector('.cloud-gate').hidden")
    page.wait_for_function("window.__game.G.state === 'town'")
    page.evaluate("""async () => {
      window.__game.G.gold = 4321;
      await window.__game.autosave(true);
    }""")
    page.reload(); connect_existing(page)
    assert page.locator(".ttl-slot").count() == 0
    assert page.evaluate("__game.G.gold") == 4321
    # 再読み込みしても端末の古い記録を使わず、クラウドの金貨を読み込む。
    page.evaluate("localStorage.setItem('dos-save-v7', JSON.stringify({root:{$r:0},heap:[{o:{gold:999999}}]}))")
    page.reload()
    connect_existing(page)
    assert page.evaluate("window.__game.G.gold") == 4321, page.evaluate("({gold:__game.G.gold, name:__game.G.apprenticeName, state:__game.G.state, tut:__game.G.tut, msq:__game.G.msq})")
    assert page.evaluate("window.__game.G.apprenticeName") == "リュカ"
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    page.wait_for_function("!document.querySelector('.ttl-overlay')")
    page.evaluate("__game.UI.settingsSheet()")
    page.get_by_role("button", name="プレイヤー名を編集", exact=True).click()
    page.get_by_label("プレイヤー名", exact=True).fill("セイン")
    page.get_by_role("button", name="保存する", exact=True).click()
    page.locator(".player-name-sheet").wait_for(state="detached")
    page.get_by_role("button", name="閉じる", exact=True).first.click()
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    # 同一端末での別タブはロックされる。
    second = context.new_page()
    second.goto(GAME)
    second.locator(".ttl-overlay .ttl-menu .ttl-btn.primary").click()
    second.locator(".cloud-gate").get_by_role("button", name="再接続", exact=True).wait_for()
    second.close()
    # 接続を失った時には進行を止め、再接続後に送信待ちを保存する。
    failed["value"] = True
    page.evaluate("() => { window.__game.G.gold = 4320; window.__game.autosave(true); }")
    page.get_by_role("button", name="再接続", exact=True).wait_for()
    assert page.evaluate("!document.querySelector('.cloud-gate').hidden")
    failed["value"] = False
    page.get_by_role("button", name="再接続", exact=True).click()
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    page.reload()
    connect_existing(page)
    assert page.evaluate("window.__game.G.gold") == 4320
    assert page.evaluate("window.__game.G.apprenticeName") == "セイン"
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path="/tmp/dos-cloud-title-mobile.png")
    # 実際のゲームの戦闘画面から、防御→敵の攻撃→全滅をサーバー経由で進める。
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    page.wait_for_function("!document.querySelector('.ttl-overlay')")
    page.evaluate("""async () => {
      const api = window.__game, g = api.G;
      const rng = await import('./src/rng.js'); rng.reseedRng(7); g.rng = rng.rngState();
      const hero = Object.assign(api.ev.makeDoll('検証の人業'), {hp:1,maxhp:20,atk:1,vit:1,agi:1});
      g.party = [hero]; g.reserve = []; g.souls = [];
      g.state = 'board'; g.prompt = false; g.msq = {n:1,state:'world'};
      api.townshell.hide();
      g.world.open.w01 = true; g._evOpening = 'preempt';
      g.run = {gold:0,soulPts:0,items:[],souls:[],ev:{}};
      const foe = api.spawnCardEnemies('bs_ghoul',1,1)[0];
      foe.hp = foe.maxhp = 1000000; foe.atk = 1000000; foe.ability = null;
      api.startBattle([foe],null);
    }""")
    try:
        page.locator("#combat-menu .cmd-attack").wait_for(timeout=15000)
    except Exception:
        print(errors, page.evaluate("({state:__game.G.state,prompt:__game.G.prompt,phase:__game.G.battle?.phase,gate:document.querySelector('.cloud-gate').innerText})"), flush=True)
        page.screenshot(path="/tmp/dos-cloud-failure.png")
        raise
    attack = page.locator("#combat-menu .cmd-attack").bounding_box()
    page.mouse.move(attack["x"]+attack["width"]/2, attack["y"]+attack["height"]/2)
    page.mouse.down(); page.wait_for_timeout(700); page.mouse.up()
    try:
        page.wait_for_function("window.__game.G.party[0].hp === 0 && document.querySelector('.cloud-gate').hidden", timeout=20000)
    except Exception:
        print(page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,acted:__game.G.battle?._acted,hp:__game.G.party[0].hp,gate:document.querySelector('.cloud-gate').innerText})"))
        print(errors)
        raise
    assert page.evaluate("window.__game.G.party[0].alive") is False
    page.reload(); connect_existing(page)
    assert page.evaluate("window.__game.G.party[0].alive") is False
    page.locator(".has-performance").get_by_role("button", name="次へ", exact=True).click()
    try:
        page.wait_for_function("window.__game.G.state === 'over'", timeout=20000)
    except Exception:
        print(page.evaluate("({state:__game.G.state,result:__game.G.battle?.result,seen:__game.G.battle?.performanceSeen,prompt:__game.G.prompt})"), errors, flush=True)
        page.screenshot(path="/tmp/dos-cloud-end-failure.png")
        raise
    assert not errors, errors
    context.unroute_all(behavior="ignoreErrors")
    context.close()

    # 未ログインのモバイル画面で入力・ボタンのはみ出しを確認する。
    mobile = browser.new_context(viewport={"width": 390, "height": 844})
    mobile.route("**/src/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body=CONFIG))
    m = mobile.new_page(); m.goto(GAME)
    m.locator(".ttl-overlay .ttl-menu .ttl-btn.primary").click()
    m.get_by_role("checkbox").check()
    m.get_by_role("button", name="同意して進む", exact=True).click()
    m.get_by_role("button", name="登録済みの方はこちら", exact=True).click()
    m.get_by_label("メールアドレス", exact=True).wait_for()
    m.screenshot(path="/tmp/dos-cloud-login-mobile.png")
    assert m.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for bounds in m.locator(".cloud-controls input, .cloud-controls button").evaluate_all("xs => xs.map(x => {const r=x.getBoundingClientRect(); return {left:r.left,right:r.right,bottom:r.bottom};})"):
        assert bounds["left"] >= 0 and bounds["right"] <= 390 and bounds["bottom"] <= 844
    mobile.close(); browser.close()
print("ブラウザ: ログイン・最新記録・別タブ・再接続・戦闘と全滅の再開・PC/モバイル表示 OK")

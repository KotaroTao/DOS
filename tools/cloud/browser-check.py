"""ローカルAPIとゲームをPlaywrightで確認する。実アカウントは使わない。"""
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

GAME = "http://127.0.0.1:8001/"
CONFIG = 'export const CLOUD_CONFIG = Object.freeze({ enabled: true, url: "https://cloud.test", anonKey: "test-public-key", protocol: 1 });'

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
    page.get_by_label("メールアドレス", exact=True).fill("player@example.invalid")
    page.get_by_label("パスワード", exact=True).fill("test-password")
    page.get_by_role("button", name="ログイン", exact=True).click()
    page.wait_for_selector(".ttl-overlay")
    page.screenshot(path="/tmp/dos-cloud-login-desktop.png")
    page.locator(".ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("!document.querySelector('.cloud-gate') || document.querySelector('.cloud-gate').hidden")
    page.wait_for_function("window.__game.G.state === 'town'")
    page.evaluate("""async () => {
      window.__game.G.gold = 4321;
      await window.__game.autosave(true);
    }""")
    # 再読み込みしても端末の古い記録を使わず、クラウドの金貨を読み込む。
    page.evaluate("localStorage.setItem('dos-save-v7', JSON.stringify({root:{$r:0},heap:[{o:{gold:999999}}]}))")
    page.reload()
    page.wait_for_selector(".ttl-overlay")
    assert page.evaluate("window.__game.G.gold") == 4321
    page.locator(".ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
    # 同一端末での別タブはロックされる。
    second = context.new_page()
    second.goto(GAME)
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
    page.wait_for_selector(".ttl-overlay")
    assert page.evaluate("window.__game.G.gold") == 4320
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path="/tmp/dos-cloud-title-mobile.png")
    # 実際のゲームの戦闘画面から、防御→敵の攻撃→全滅をサーバー経由で進める。
    page.locator(".ttl-menu .ttl-btn.primary").click()
    page.wait_for_function("document.querySelector('.cloud-gate').hidden")
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
    page.locator("#combat-menu .cmd-defend").wait_for(timeout=15000)
    page.locator("#combat-menu .cmd-defend").click()
    try:
        page.wait_for_function("window.__game.G.state === 'over' && document.querySelector('.cloud-gate').hidden", timeout=20000)
    except Exception:
        print(page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,acted:__game.G.battle?._acted,hp:__game.G.party[0].hp,gate:document.querySelector('.cloud-gate').innerText})"))
        print(errors)
        raise
    assert page.evaluate("window.__game.G.party[0].alive") is False
    page.reload(); page.wait_for_selector(".ttl-overlay")
    assert page.evaluate("window.__game.G.party[0].alive") is False
    assert page.evaluate("window.__game.G.state") == "over"
    assert not errors, errors
    context.close()

    # 未ログインのモバイル画面で入力・ボタンのはみ出しを確認する。
    mobile = browser.new_context(viewport={"width": 390, "height": 844})
    mobile.route("**/src/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body=CONFIG))
    m = mobile.new_page(); m.goto(GAME)
    m.get_by_label("メールアドレス", exact=True).wait_for()
    m.screenshot(path="/tmp/dos-cloud-login-mobile.png")
    assert m.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for bounds in m.locator(".cloud-controls input, .cloud-controls button").evaluate_all("xs => xs.map(x => {const r=x.getBoundingClientRect(); return {left:r.left,right:r.right,bottom:r.bottom};})"):
        assert bounds["left"] >= 0 and bounds["right"] <= 390 and bounds["bottom"] <= 844
    mobile.close(); browser.close()
print("ブラウザ: ログイン・最新記録・別タブ・再接続・戦闘と全滅の再開・PC/モバイル表示 OK")

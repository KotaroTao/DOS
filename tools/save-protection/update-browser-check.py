"""公開更新の二重通知・試遊の継続・端末/遅いクラウド保存後の更新を実画面で確認する。"""
import asyncio
import base64
import re
import json
import os
from playwright.async_api import async_playwright, expect

BASE = os.environ.get("DOS_TEST_URL", "http://localhost:8000/")
INIT = """
window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),80);
window.cancelAnimationFrame=clearTimeout;
const worker = new EventTarget(), reg = new EventTarget(), sw = new EventTarget();
worker.controller = {}; reg.installing = sw; worker.ready = new Promise(()=>{});
worker.register = async()=>reg;
Object.defineProperty(navigator,'serviceWorker',{value:worker});
window.notifyUpdate=()=>{
 reg.dispatchEvent(new Event('updatefound')); sw.state='activated';
 sw.dispatchEvent(new Event('statechange')); worker.dispatchEvent(new Event('controllerchange'));
};
"""
CONFIG = 'export const CLOUD_CONFIG = {enabled:true,url:"https://cloud.test",anonKey:"public-test",protocol:1};'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        errors = []

        async def context(extra=""):
            c = await browser.new_context(service_workers="block", reduced_motion="reduce", viewport={"width":390,"height":844})
            await c.add_init_script(INIT + "if(location.protocol.startsWith('http')){" + extra + "}")
            pixel = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII=")
            await c.route(re.compile(r"\.(webp|png|jpg|jpeg)(\?.*)?$"), lambda r: r.fulfill(content_type="image/png", body=pixel))
            await c.route("https://**/*", lambda r: r.abort())
            c.on("page", lambda pg: pg.on("pageerror", lambda e: errors.append(str(e))))
            return c

        async def visit(page, query=""):
            await page.goto(BASE + query, wait_until="domcontentloaded")
            await page.wait_for_function("window.__game && !document.body.classList.contains('booting')")

        c = await context()
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        seed = await page.evaluate("__game.inf.saveJSON()")
        legal = await page.evaluate("async()=>(await import('/src/legal.js')).LEGAL_VERSION")
        await page.evaluate("__game.G.gold=76543; window.notifyUpdate(); window.notifyUpdate()")
        notice = page.locator(".game-update-notice")
        await expect(notice).to_have_count(1)
        await expect(notice).to_contain_text("試遊の進行は失われ")
        assert await page.evaluate("__game.G.gold") == 76543
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") is None
        page.on("dialog", lambda d: d.dismiss())
        await notice.get_by_role("button", name="試遊を終了して更新").click()
        assert await page.evaluate("__game.G.gold") == 76543
        assert await notice.evaluate("e=>e.getBoundingClientRect().right<=innerWidth && e.getBoundingClientRect().left>=0")
        await notice.get_by_role("button", name="あとで").click()
        await expect(notice).to_be_hidden()
        await page.evaluate("notifyUpdate()")
        await expect(notice).to_be_hidden()
        print("試遊の更新通知は1件、再起動なし・終了取消・通常記録の保全・スマホ表示・あとで: OK", flush=True)

        await page.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        await visit(page)
        await page.evaluate("__game.G.gold=87654; notifyUpdate()")
        await expect(page.locator(".game-update-notice")).to_be_visible()
        assert await page.evaluate("__game.G.gold") == 87654
        await page.evaluate("""() => { window.restoreStorage=Storage.prototype.setItem;
          Storage.prototype.setItem=function(k,v){if(k==='dos-save-v7')throw new Error('保存先が満杯');return restoreStorage.call(this,k,v)}; }""")
        await page.get_by_role("button", name="保存して更新", exact=True).click()
        assert await page.evaluate("__game.G.gold") == 87654
        await expect(page.locator(".game-update-notice")).to_be_visible()
        await page.evaluate("() => { Storage.prototype.setItem=restoreStorage; }")
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.get_by_role("button", name="保存して更新", exact=True).click()
        await page.wait_for_function("window.__game && !document.body.classList.contains('booting')")
        assert await page.evaluate("__game.G.gold") == 87654
        print("端末保存は自動再読込せず、保存失敗時も留まり、明示更新後に最新の金貨で再開: OK", flush=True)
        await c.close()

        # 初回のService Worker導入では更新案内を出さない。
        c = await context("navigator.serviceWorker.controller=null;")
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        await page.evaluate("navigator.serviceWorker.controller={}; notifyUpdate()")
        await expect(page.locator(".game-update-notice")).to_have_count(0)
        await c.close()
        print("初回導入では案内も再起動も発生しない: OK", flush=True)

        # 実際のCloudSaveClientを使い、APIの保存応答だけを遅らせる。
        auth = {"access_token":"test", "refresh_token":"test", "expires_at":9999999999,"user":{"id":"update-test","email":"test@example.invalid"}}
        c = await context("localStorage.setItem('dos-cloud-auth'," + json.dumps(json.dumps(auth)) + ");localStorage.setItem('dos-legal-version:update-test'," + json.dumps(legal) + ");")
        await c.route("**/src/cloud-config.js", lambda r: r.fulfill(content_type="text/javascript", body=CONFIG))
        snapshot = json.loads(seed)
        revision = 0
        received = asyncio.Event()
        release = asyncio.Event()
        async def api(route):
            nonlocal snapshot, revision
            if route.request.url.endswith("/auth/v1/user"):
                await route.fulfill(json=auth["user"]); return
            body = route.request.post_data_json
            if body["op"] == "save":
                received.set()
                await release.wait()
                snapshot = body["snapshot"]
                revision += 1
            await route.fulfill(json={"snapshot":snapshot,"revision":revision})
        await c.route("https://cloud.test/**", api)
        page = await c.new_page()
        await visit(page)
        await page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
        await page.wait_for_function("!document.querySelector('.ttl-overlay:not(.ttl-out)') && __game.G.party.length")
        await page.evaluate("__game.G.gold=98765; notifyUpdate()")
        await page.get_by_role("button", name="保存して更新", exact=True).click()
        await asyncio.wait_for(received.wait(), timeout=10)
        await expect(page.get_by_role("button", name="保存して更新", exact=True)).to_be_disabled()
        assert await page.evaluate("__game.G.gold") == 98765
        assert await page.evaluate("document.querySelector('.cloud-gate').hidden") is False
        async with page.expect_navigation(wait_until="domcontentloaded"):
            release.set()
        await page.wait_for_function("window.__game && !document.body.classList.contains('booting')")
        await page.locator(".ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary").click()
        await page.wait_for_function("!document.querySelector('.ttl-overlay:not(.ttl-out)') && __game.G.party.length")
        assert await page.evaluate("__game.G.gold") == 98765
        print("クラウド保存の応答待ちでは再読込せず、保存完了後に最新記録から再開: OK", flush=True)
        assert not errors, errors
        await c.close()
        await browser.close()

asyncio.run(main())

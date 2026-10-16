"""三つの冒険の切り替え・再開・削除・別画面の保護を実際の画面で確認する。"""
import asyncio
import os
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright, expect

BASE = os.environ.get("DOS_TEST_URL", "http://localhost:8000/")
QUIET = """Object.defineProperty(HTMLImageElement.prototype,'src',{
 set(v){queueMicrotask(()=>this.onerror?.(new Event('error')))},get(){return ''}});
 window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),80);
 window.cancelAnimationFrame=clearTimeout;"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        c = await browser.new_context(service_workers="block", reduced_motion="reduce", viewport={"width":390,"height":844})
        await c.add_init_script(QUIET)
        await c.route("https://**/*", lambda r: r.abort())
        errors = []
        c.on("page", lambda pg: pg.on("pageerror", lambda e: errors.append(str(e))))
        page = await c.new_page()

        async def ready(pg=page):
            await pg.wait_for_selector(".ttl-overlay.ttl-ready")
            await pg.wait_for_function("!document.body.classList.contains('booting')")

        async def select(slot):
            async with page.expect_navigation(wait_until="domcontentloaded"):
                await page.get_by_role("button", name=f"記録{slot}", exact=True).press("Enter")
            await page.wait_for_url(lambda u: parse_qs(urlparse(u).query).get("saveSlot") == [str(slot)], wait_until="domcontentloaded")
            await ready()
            await expect(page.get_by_role("button", name=f"記録{slot}", exact=True)).to_have_attribute("aria-pressed", "true")

        await page.goto(BASE+"?testDungeon=w05&testPlace=town")
        await page.wait_for_function("window.__game?.G.party.length>0 && !document.body.classList.contains('booting')")
        await page.evaluate("""async()=>{
          const g=__game.G;
          const {_TUTS}=await import('/src/ui/tutorial.js');
          _TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.tut.cur=null;g.irene.greeted=true;g.insightNotified=Number.MAX_SAFE_INTEGER;
          for(const id of Object.keys(g.world.cleared)) g.world.beats['mem_'+id]=true;
        }""")
        seed = await page.evaluate("__game.inf.saveJSON()")
        await page.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        await page.goto(BASE)
        await ready()
        await expect(page.locator(".ttl-slots button")).to_have_count(3)
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == seed
        await page.evaluate("__game.G.apprenticeName='一の旅';__game.G.gold=111;__game.autosave(true)")
        for slot in [2,3]:
            await select(slot)
            await expect(page.locator(".ttl-save")).to_have_count(0)
            assert await page.evaluate("__game.G.gold") != 111
            await page.locator(".ttl-menu .ttl-btn.primary").click()
            await page.get_by_role("dialog", name="弟子の名前", exact=True).get_by_role("textbox").fill(f"旅人{slot}")
            await page.get_by_role("button", name="旅を始める", exact=True).click()
            await page.wait_for_function(f"__game.G.apprenticeName==='旅人{slot}'")
            await page.evaluate(f"__game.G.gold={slot*111};__game.autosave(true)")
            # 設定から戻る実処理を通す。
            async with page.expect_navigation(wait_until="domcontentloaded"):
                await page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');await game.returnToTitle()}")
            await ready()
            assert await page.evaluate("__game.G.gold") == slot*111
            await expect(page.locator(".ttl-save")).to_contain_text(f"旅人{slot}")
        for slot in [1,2,3,1]:
            await select(slot)
            assert await page.evaluate("__game.G.gold") == slot*111
        await page.locator(".ttl-menu .ttl-btn.primary").click()
        await page.locator(".ttl-overlay").wait_for(state="detached")
        await page.evaluate("__game.UI.openSettings()")
        await page.get_by_role("tab", name="自動化・データ", exact=True).click()
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.get_by_role("button", name="記録1を保存してタイトルへ", exact=False).click()
        await ready()
        assert await page.evaluate("__game.G.gold") == 111
        # 同じ枠は拒否し、別の枠は同時に開ける。
        same = await c.new_page(); await same.goto(BASE); await same.wait_for_selector("#local-save-gate")
        other = await c.new_page(); await other.goto(BASE+"?saveSlot=2"); await ready(other)
        await other.evaluate("__game.G.gold=224;__game.autosave(true)")
        await other.close(); await same.close()
        await select(2)
        assert await page.evaluate("__game.G.gold") == 224
        keep = await page.evaluate("[localStorage.getItem('dos-save-v7'),localStorage.getItem('dos-save-v7-slot-3')]")
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');game.resetAllData()}")
        await ready()
        assert await page.evaluate("localStorage.getItem('dos-save-v7-slot-2')") is None
        assert await page.evaluate("[localStorage.getItem('dos-save-v7'),localStorage.getItem('dos-save-v7-slot-3')]") == keep
        await expect(page.locator(".ttl-save")).to_have_count(0)
        await select(3)
        for width,height in [(390,844),(320,568),(1280,800)]:
            await page.set_viewport_size({"width":width,"height":height})
            await page.wait_for_timeout(250)
            for b in await page.locator(".ttl-slots button").all():
                await expect(b).to_be_in_viewport()
                box=await b.bounding_box()
                assert box['height']>=44 and box['x']>=0 and box['x']+box['width']<=width
        await page.screenshot(path="/tmp/dos-save-slots-desktop.png")
        await page.set_viewport_size({"width":390,"height":844})
        await page.screenshot(path="/tmp/dos-save-slots-mobile.png")
        assert not errors, errors
        print("既存記録の継承・三枠の新規/再開・設定からタイトル・削除の独立・枠ごとの排他・スマホ/PC表示: OK")
        await browser.close()

asyncio.run(main())

"""localhost:8000で起動遅延・複数画面・破損記録の退避/復旧を実操作で確認。"""
import asyncio
import os
from playwright.async_api import async_playwright, expect

BASE = os.environ.get("DOS_TEST_URL", "http://localhost:8000/")
# 原画の通信と音の解禁を省き、保存とUIは本番の処理を使う。
QUIET = """Object.defineProperty(HTMLImageElement.prototype,'src',{
 set(v){queueMicrotask(()=>this.onerror?.(new Event('error')))},get(){return ''}});
 window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),80);
 window.cancelAnimationFrame=clearTimeout;"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        errors = []

        async def context():
            c = await browser.new_context(service_workers="block", reduced_motion="reduce", accept_downloads=True)
            await c.add_init_script(QUIET)
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
        await page.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');game.resetAllData()}")
        await page.wait_for_function("window.__game?.G.party.length>0 && !document.body.classList.contains('booting')")
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == seed
        print("試遊のやり直しは通常記録を消さずに再開: OK", flush=True)
        await c.close()

        c = await context()
        page = await c.new_page()
        release = asyncio.Event()
        async def delay(route):
            await release.wait()
            await route.continue_()
        await page.route("**/src/game.js", delay)
        navigation = asyncio.create_task(page.goto(BASE + "?testDungeon=w05&testPlace=town", wait_until="domcontentloaded"))
        await expect(page.locator("#boot-notice")).to_have_text("読み込み中です回線の速さによって時間がかかることがあります。そのままお待ちください。再読み込み", timeout=15000)
        await expect(page.get_by_text("キャッシュを消して再読み込み", exact=True)).to_have_count(0)
        release.set()
        await navigation
        await page.wait_for_function("window.__game?.G.party.length>0 && !document.body.classList.contains('booting')")
        await expect(page.locator("#boot-notice")).to_have_count(0)
        print("5秒超の起動待ちから正常復帰し、案内が残らない: OK", flush=True)
        await c.close()

        c = await context()
        page = await c.new_page()
        await page.route("**/src/game.js", lambda r: r.abort())
        await page.goto(BASE, wait_until="domcontentloaded")
        await expect(page.get_by_text("キャッシュを消して再読み込み", exact=True)).to_be_visible()
        await c.close()
        print("本当のモジュール読込失敗は修復案内: OK", flush=True)

        c = await context()
        first = await c.new_page()
        await visit(first, "?testDungeon=w05&testPlace=town")
        await first.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        await visit(first)
        await first.evaluate("__game.G.gold=111;__game.autosave(true)")
        second = await c.new_page()
        await visit(second)
        await expect(second.locator("#local-save-gate")).to_contain_text("別の画面で冒険中")
        before = await second.evaluate("localStorage.getItem('dos-save-v7')")
        await second.evaluate("__game.G.apprenticeName='古い画面';__game.G.gold=222;__game.autosave(true);__game.clearSave()")
        assert await second.evaluate("localStorage.getItem('dos-save-v7')") == before
        await first.close()
        await visit(second)
        assert await second.evaluate("__game.G.gold") == 111
        await second.evaluate("__game.G.gold=333;__game.autosave(true)")
        await second.reload(wait_until="domcontentloaded")
        await second.wait_for_function("window.__game?.G.party.length>0")
        assert await second.evaluate("__game.G.gold") == 333
        print("二画面目の保存/削除を拒否、先の画面終了後は最新の記録で再開: OK", flush=True)

        # 以前の版など、ロックを使わない画面の更新も上書きしない。
        helper = await c.new_page()
        await visit(helper, "?testDungeon=w05&testPlace=town")
        await helper.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        await expect(second.locator("#local-save-gate")).to_contain_text("記録が変更されました")
        await second.evaluate("__game.autosave(true);__game.clearSave()")
        assert await helper.evaluate("localStorage.getItem('dos-save-v7')") == seed
        await c.close()
        print("ロックを使わない画面から更新された時も、古い原文の保存/削除を拒否: OK", flush=True)

        c = await context()
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        await page.evaluate("s=>{localStorage.setItem('dos-save-v7',s);localStorage.setItem('dos-save-v7-recovery',s)}", seed)
        await page.evaluate("localStorage.setItem('dos-save-v7','{broken-save')")
        await visit(page)
        await expect(page.locator("#local-save-gate")).to_contain_text("読み込めません")
        await expect(page.locator(".ttl-overlay")).to_have_count(0)
        await page.evaluate("__game.G.apprenticeName='上書き不可';__game.autosave(true);__game.clearSave()")
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == "{broken-save"
        async with page.expect_download() as d:
            await page.get_by_role("button", name="元の記録を書き出す", exact=True).click()
        download = await d.value
        from pathlib import Path
        assert Path(await download.path()).read_text() == "{broken-save"
        await page.get_by_role("button", name="前に読み込めた記録から復旧する", exact=True).click()
        await page.wait_for_function("window.__game?.G.party.length>0 && !!document.querySelector('.ttl-overlay')")
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == seed
        assert await page.evaluate("Object.keys(localStorage).some(k=>k.startsWith('dos-save-v7-damaged-') && localStorage[k]==='{broken-save')")
        await c.close()
        print("破損記録で新規開始せず、原文の書き出し・退避・前の記録からの復旧: OK", flush=True)

        c = await context()
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        await page.evaluate("localStorage.setItem('dos-save-v7','broken-no-backup')")
        await visit(page)
        await expect(page.get_by_role("button", name="前に読み込めた記録から復旧する", exact=True)).to_have_count(0)
        page.once("dialog", lambda d: d.dismiss())
        await page.get_by_role("button", name="元の記録を退避して、はじめから", exact=True).click()
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == "broken-no-backup"
        page.once("dialog", lambda d: d.accept())
        await page.get_by_role("button", name="元の記録を退避して、はじめから", exact=True).click()
        await expect(page.locator(".ttl-overlay")).to_be_visible()
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") is None
        assert await page.evaluate("Object.keys(localStorage).some(k=>k.startsWith('dos-save-v7-damaged-') && localStorage[k]==='broken-no-backup')")
        await page.get_by_role("button", name="はじめから", exact=False).click()
        await page.get_by_role("dialog", name="弟子の名前").get_by_role("textbox").fill("新しい弟子")
        await page.get_by_role("button", name="旅を始める", exact=False).click()
        await page.wait_for_function("localStorage.getItem('dos-save-v7')!==null")
        await c.close()
        print("退避後の新規開始は取消可能、了承後も原本を残して通常保存: OK", flush=True)

        c = await context()
        await c.add_init_script("const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('dos-save-v7-damaged-'))throw new DOMException('満杯','QuotaExceededError');return set.call(this,k,v)}")
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        await page.evaluate("localStorage.setItem('dos-save-v7','broken-full')")
        await visit(page)
        await expect(page.locator("#local-save-gate")).to_contain_text("退避先に保存できない")
        await expect(page.get_by_role("button", name="元の記録を退避して、はじめから", exact=True)).to_have_count(0)
        await page.evaluate("__game.G.apprenticeName='保存不可';__game.autosave(true)")
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == "broken-full"
        await c.close()
        print("退避先が満杯でも破損原本を上書きしない: OK", flush=True)

        c = await context()
        await c.add_init_script("Object.defineProperty(Navigator.prototype,'locks',{get(){return undefined}})")
        page = await c.new_page()
        await visit(page, "?testDungeon=w05&testPlace=town")
        await page.evaluate("s=>localStorage.setItem('dos-save-v7',s)", seed)
        await visit(page)
        await expect(page.locator("#local-save-gate")).to_contain_text("ブラウザを最新版に更新")
        await page.evaluate("__game.G.apprenticeName='保存不可';__game.autosave(true);__game.clearSave()")
        assert await page.evaluate("localStorage.getItem('dos-save-v7')") == seed
        await c.close()
        print("排他非対応のブラウザでも記録を変更しない: OK", flush=True)
        assert not errors, errors
        await browser.close()

asyncio.run(main())

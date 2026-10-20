"""低速・失敗・階の準備・戦闘の開始で、未完成の場面を開かないことを確認する。"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://localhost:8000/'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for mode in ['slow', 'failed']:
            ctx = await browser.new_context(service_workers='block', reduced_motion='reduce')
            await ctx.route('https://**', lambda r: r.abort())
            release = asyncio.Event()
            async def title(r):
                await release.wait()
                if mode == 'failed': await r.abort()
                else: await r.continue_()
            await ctx.route('**/art/title/**', title)
            page = await ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(BASE, wait_until='domcontentloaded')
            await page.wait_for_selector('.ttl-overlay')
            await page.wait_for_function("document.body.classList.contains('screen-loading')")
            assert await page.locator('#media-splash').is_visible()
            await page.keyboard.press('Enter')
            assert await page.locator('.ttl-overlay').count() == 1
            # ログイン・記録の復旧など、起動中に必要な対話を幕で隠さない。
            await page.evaluate("""() => {
              const gate=document.createElement('div'); gate.className='cloud-gate';
              gate.innerHTML='<input aria-label="ログイン確認">'; document.body.append(gate);
            }""")
            assert not await page.locator('#media-splash').is_visible()
            await page.locator('.cloud-gate input').focus()
            await page.keyboard.type('login')
            assert await page.locator('.cloud-gate input').input_value() == 'login'
            await page.locator('.cloud-gate').evaluate('n=>n.remove()')
            release.set()
            if mode == 'failed':
                await page.wait_for_selector('#media-splash[data-state="error"]')
                assert await page.locator('.media-retry').is_visible()
                # 同じセーブを保って再読み込みし、回線が戻れば再開できる。
                await ctx.unroute('**/art/title/**', title)
                await page.locator('.media-retry').click()
                await page.wait_for_function("!!document.querySelector('.ttl-overlay') && !document.body.classList.contains('screen-loading')")
            else:
                await page.wait_for_function("!document.body.classList.contains('screen-loading')")
            assert not errors, errors
            await ctx.close()
            print('タイトルの' + mode + '・入力抑止・再試行: OK', flush=True)

        ctx = await browser.new_context(service_workers='block', reduced_motion='reduce')
        await ctx.route('https://**', lambda r: r.abort())
        page = await ctx.new_page()
        await page.goto(BASE + '?testDungeon=w01&testPlace=town', wait_until='domcontentloaded')
        await page.wait_for_selector('.town-scene[data-art="painted"]')
        await page.wait_for_function("!document.body.classList.contains('booting')")
        await page.evaluate("""() => {
          window.splashCount=0;
          new MutationObserver(() => {
            if(document.body.classList.contains('screen-loading')) splashCount++;
          }).observe(document.body,{attributes:true,attributeFilter:['class']});
        }""")
        for tab in ['party', 'shop', 'hub', 'party', 'hub']:
            await page.evaluate("key=>__game.townshell.setTab(key)", tab)
            await page.wait_for_function("!document.querySelector('#town-screen > .scene-hold')")
            await page.evaluate("__game.renderTown()")
            await page.wait_for_function("!document.querySelector('#town-screen > .scene-hold')")
        assert await page.evaluate('splashCount') == 0
        await ctx.close()
        print('街・隊・商会の往復と同じ画面の再描画: 全画面待機0回', flush=True)

        ctx = await browser.new_context(service_workers='block', reduced_motion='no-preference')
        await ctx.route('https://**', lambda r: r.abort())
        release = asyncio.Event()
        async def monster(r):
            await release.wait()
            await r.continue_()
        await ctx.route('**/art/monsters/**', monster)
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(BASE + '?testDungeon=w01', wait_until='domcontentloaded')
        await page.wait_for_function("window.__game?.G.state === 'board'")
        await page.wait_for_function("document.body.classList.contains('screen-loading')")
        before = await page.evaluate('JSON.stringify([__game.G.px,__game.G.py,__game.G.rng])')
        await page.keyboard.press('ArrowUp')
        after = await page.evaluate('JSON.stringify([__game.G.px,__game.G.py,__game.G.rng])')
        assert before == after, (before, after)
        release.set()
        await page.wait_for_function("!document.body.classList.contains('screen-loading')", timeout=30000)
        # 肖像・装備などの待機や失敗で、起動用の幕と操作抑止を復活させない。
        await page.evaluate("""async () => {
          const {watchIllustration,mediaBusy}=await import('/src/imageloading.js');
          const owner=document.createElement('canvas');owner.width=32;owner.height=32;
          owner.style.cssText='position:fixed;top:0;left:0;width:32px;height:32px';document.body.append(owner);
          window.decoration={owner,mediaBusy};
          watchIllustration('decoration',new Promise(resolve=>decoration.done=resolve),owner);
        }""")
        await page.wait_for_timeout(550)
        assert not await page.locator('#media-splash').is_visible()
        assert not await page.evaluate('decoration.mediaBusy()')
        await page.evaluate('decoration.done(false)')
        await page.wait_for_selector('.image-loading[data-state="error"]')
        assert not await page.locator('#media-splash').is_visible()
        assert not await page.evaluate('decoration.mediaBusy()')
        await page.evaluate('decoration.owner.remove()')
        # 先読みの対象外だった特殊な敵も、登場演出を始める前に待つ。
        key = await page.evaluate("""async () => {
          const {MONSTERS}=await import('/src/sprites.js');
          return Object.keys(MONSTERS).find(key=>MONSTERS[key].photo && !MONSTERS[key].photo.img && !MONSTERS[key].boss);
        }""")
        special = asyncio.Event()
        async def special_image(r):
            await special.wait()
            await r.continue_()
        await ctx.route('**/art/monsters/' + key + '.webp', special_image)
        await page.evaluate("""key => {
          const g=__game; g.startBattle(g.spawnCardEnemies(key,g.G.floor,1),null);
        }""", key)
        await page.wait_for_function("__game.G.state === 'combat'")
        await page.wait_for_timeout(450)
        assert not await page.locator('#media-splash').is_visible()
        assert await page.evaluate('decoration.mediaBusy()')
        assert await page.evaluate('!__game.G.battleIntro')
        special.set()
        await page.wait_for_function("__game.G.battleIntro && !document.body.classList.contains('screen-loading')")
        assert not errors, errors
        assert await page.evaluate('__game.G.battle.enemies.every(e=>!e.mon.photo || e.mon.photo.img.naturalWidth>0)')
        await ctx.close()
        print('階の準備待ち・装備や肖像の待機/失敗は全画面待機なし・戦闘は盤面を保持: OK', flush=True)
        await browser.close()

asyncio.run(main())

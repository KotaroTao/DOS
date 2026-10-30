"""次画面の準備が遅れてもタイトル越しに途中の画面を見せない。"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for motion in ['reduce', 'no-preference']:
            for saved in [True, False]:
                ctx = await browser.new_context(service_workers='block', reduced_motion=motion)
                await ctx.route('**/handoff-review.html', lambda r: r.fulfill(content_type='text/html', body='<link rel="stylesheet" href="/title.css"><link rel="stylesheet" href="/ui.css"><body><div id="app">途中の画面</div></body>'))
                page = await ctx.new_page()
                await page.goto('http://localhost:8000/handoff-review.html')
                await page.evaluate('''async saved => {
                  const {showTitle}=await import('/src/title.js');
                  window.started=0;
                  showTitle({hasSave:saved, startName:saved?'':'旅人', onStart:()=>{
                    started++; return new Promise(resolve=>window.release=resolve);
                  }});
                }''', saved)
                await page.wait_for_selector('.ttl-overlay[data-scene-ready="true"]')
                await page.locator('.ttl-btn.primary').first.click()
                await page.wait_for_function('started===1')
                await page.wait_for_timeout(1700)
                assert await page.locator('.ttl-overlay').count() == 1
                assert await page.locator('.ttl-overlay').evaluate('n=>getComputedStyle(n).opacity') == '1'
                assert not await page.locator('.ttl-out').count()
                await page.evaluate('release(true)')
                await page.wait_for_selector('.ttl-overlay', state='detached')
                assert await page.evaluate('started') == 1
                # 短い区切りの待機でも、200msの表示猶予中に途中画面を露出しない。
                await page.evaluate('''async()=>{
                  const {holdIllustrations}=await import('/src/imageloading.js');
                  holdIllustrations('floor-test',new Promise(resolve=>window.floorDone=resolve));
                }''')
                assert await page.locator('body').evaluate('n=>n.classList.contains("scene-preparing")')
                assert await page.locator('body').evaluate('n=>getComputedStyle(n,"::before").backgroundColor') == 'rgb(0, 0, 0)'
                await page.evaluate('floorDone(true)')
                await page.wait_for_function('!document.body.classList.contains("scene-preparing")')
                print(f'{motion} / {"再開" if saved else "新規"}: 準備完了まで不透明・完了後に解除 OK', flush=True)
                await ctx.close()
        await browser.close()

asyncio.run(main())

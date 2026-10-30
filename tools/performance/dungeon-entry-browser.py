"""暗転の待機中と、実際の迷宮入場で別の場面を露出しない。"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://localhost:8000/'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for motion in ['reduce', 'no-preference']:
            ctx = await browser.new_context(service_workers='block', reduced_motion=motion)
            page = await ctx.new_page()
            await ctx.route('**/entry-review.html', lambda r: r.fulfill(content_type='text/html', body='<link rel="stylesheet" href="/ui.css"><body style="background:red">別の場面</body>'))
            await page.goto(BASE+'entry-review.html')
            for immediate in [False, True]:
                await page.evaluate('''async immediate=>{
                  const {sceneTransition}=await import('/src/ui/motion.js');
                  window.leaks=[];window.pending=false;window.done=false;
                  const sample=()=>{
                    const veil=document.querySelector('.ui-scene-veil');
                    if(pending && (!veil || getComputedStyle(veil).opacity!=='1')) leaks.push(performance.now());
                    if(!done) requestAnimationFrame(sample);
                  };requestAnimationFrame(sample);
                  window.transition=sceneTransition(()=>{
                    pending=true;return new Promise(resolve=>window.release=resolve);
                  },{immediate,embers:false}).then(()=>done=true);
                  if(immediate && getComputedStyle(document.querySelector('.ui-scene-veil')).opacity!=='1') throw Error('開始直後の幕が透明');
                }''', immediate)
                await page.wait_for_function('pending')
                await page.wait_for_timeout(1000)
                assert await page.evaluate('leaks') == []
                # 最初の描画を済ませるまでは、素材用の待機幕が消えても遷移の幕を残す。
                await page.evaluate("document.body.classList.add('scene-preparing')")
                await page.evaluate("document.body.classList.remove('scene-preparing')")
                assert await page.locator('.ui-scene-veil').evaluate('n=>getComputedStyle(n).opacity') == '1'
                await page.evaluate('pending=false;release(true)')
                await page.wait_for_function('done')
                assert await page.locator('.ui-scene-veil').count() == 0
            result=await page.evaluate("""async()=>{
              const {sceneTransition}=await import('/src/ui/motion.js');
              return sceneTransition(()=>false,{immediate:true,embers:false});
            }""")
            assert result is False
            assert await page.locator('.ui-scene-veil').evaluate('n=>getComputedStyle(n).opacity') == '1'
            await ctx.close()
            print(motion+': 即時暗転・通常暗転・非同期準備中の不透明維持 OK', flush=True)

            ctx = await browser.new_context(service_workers='block', reduced_motion=motion)
            await ctx.route('https://**', lambda r:r.abort())
            page = await ctx.new_page()
            await page.goto(BASE+'?testDungeon=w05&testPlace=town', wait_until='domcontentloaded')
            await page.wait_for_function("window.__game && !document.body.classList.contains('booting')")
            release=asyncio.Event()
            async def monsters(route):
                await release.wait()
                await route.continue_()
            await ctx.route('**/art/monsters/**',monsters)
            result=await page.evaluate('''async()=>{
              const {game}=await import('/src/ui/ctx.js');
              const result=game.departNow();
              const veil=document.querySelector('.ui-scene-veil');
              return {result,opaque:!!veil && getComputedStyle(veil).opacity==='1'};
            }''')
            assert result['result']['ok'] and result['opaque'],result
            await page.wait_for_function("__game.G.state==='board'")
            await page.wait_for_timeout(1000)
            assert await page.locator('.ui-scene-veil').evaluate('n=>getComputedStyle(n).opacity') == '1'
            release.set()
            await page.wait_for_selector('.ui-scene-veil',state='detached',timeout=60000)
            assert await page.evaluate("__game.G.state==='board' && !document.body.classList.contains('scene-preparing')")
            print(motion+': 実際の迷宮入場で素材到着・盤面描画まで黒い幕を維持 OK',flush=True)
            await ctx.close()
        await browser.close()

asyncio.run(main())

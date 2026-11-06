"""施設の原画・胸像の再表示、冷たい取得/失敗、不要な旧絵の準備を検査する。"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://localhost:8000/'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
        for failed in [False, True]:
            ctx = await browser.new_context(service_workers='block', reduced_motion='reduce')
            await ctx.route('https://**', lambda r: r.abort())
            release = asyncio.Event()
            async def image(route):
                await release.wait()
                if failed: await route.abort()
                else: await route.continue_()
            await ctx.route('**/art/town/**', image)
            await ctx.route('**/town-cache-review.html', lambda r: r.fulfill(content_type='text/html', body='<html><body></body></html>'))
            page = await ctx.new_page()
            errors, requests = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('request', lambda r: requests.append(r.url))
            await page.goto(BASE + 'town-cache-review.html')
            await page.evaluate('''async()=>{
              const town=await import('/src/townart.js'),images=await import('/src/imageloading.js');
              const root=document.createElement('div');root.id='town-screen';root.innerHTML='<p>前の施設</p>';document.body.append(root);
              const reveal=images.preserveScene(root),keeper=town.keeperCanvas('maiden'),view=town.vignetteCanvas('shrine');
              keeper.style.width='48px';keeper.style.height='56px';view.style.width='64px';view.style.height='40px';
              root.replaceChildren(keeper,view);reveal();window.review={town,images,root,keeper,view};
            }''')
            await page.wait_for_timeout(120)
            assert await page.locator('#town-screen>.scene-hold').count() == 1
            assert await page.locator('.scene-next').evaluate('n=>n.inert')
            assert not await page.evaluate('document.body.classList.contains("screen-loading")')
            release.set()
            if failed:
                await page.wait_for_selector('.image-loading[data-state="error"]')
                assert await page.locator('#town-screen>.scene-hold').count() == 1
                assert await page.locator('.scene-next').evaluate('n=>n.inert')
                assert not await page.evaluate('review.images.mediaBusy()')
                print('初回失敗: 旧画面保持・入力保護・再試行の表示・全画面待機なし OK', flush=True)
            else:
                await page.wait_for_function('!document.querySelector("#town-screen>.scene-hold")')
                result = await page.evaluate('''async()=>{
                  const {town,images,root,keeper,view}=review;
                  const k=town.keeperCanvas('maiden'),v=town.vignetteCanvas('shrine');
                  if(k.toDataURL()!==keeper.toDataURL()||v.toDataURL()!==view.toDataURL())throw Error('再表示の画素が変化');
                  const reveal=images.preserveScene(root);root.replaceChildren(k,v);reveal();
                  if(root.querySelector('.scene-hold'))throw Error('準備済みの施設を待った');
                  const all=await import('/src/townkeyart.js');
                  // 他の全施設・全番人・王・紋章も、再表示はその場で描ける。
                  let canvases=2;
                  const factories=[...Object.keys(all.TOWN_KEYART).filter(k=>!k.startsWith('panorama')).map(k=>()=>town.vignetteCanvas(k)),
                    ...Object.keys(all.TOWN_KEEPERART).map(k=>()=>town.keeperCanvas(k)),()=>town.kingCanvas(),
                    ...Object.keys(all.TOWN_ICONART).map(k=>()=>town.iconCanvas(k))];
                  for(const make of factories){
                    const a=make();a.style.width='48px';a.style.height='48px';root.replaceChildren(a);
                    await images.waitForScene(root);
                    const b=make();if(a.toDataURL()!==b.toDataURL())throw Error('施設・番人・紋章の画素が変化');
                    const show=images.preserveScene(root);root.replaceChildren(b);show();
                    if(root.querySelector('.scene-hold'))throw Error('準備済みの絵で待機');canvases++;
                  }
                  // 共通の画像取得キャッシュから追い出されても、焼いた施設の絵は再取得しない。
                  const {imageResource}=await import('/src/mediaready.js');
                  for(let i=0;i<30;i++)await imageResource('data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" id="${i}"/>`)).ready;
                  const again=town.vignetteCanvas('shrine');
                  if(again.toDataURL()!==view.toDataURL())throw Error('原画の取得キャッシュ解放後に画素が変化');
                  const resume=images.preserveScene(root);root.replaceChildren(again);resume();
                  if(root.querySelector('.scene-hold'))throw Error('焼いた情景を再取得した');
                  // 準備済みの要素は、待機判定のためのレイアウトも問い合わせない。
                  const ready=document.createElement('canvas');root.replaceChildren(ready);
                  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                  ready.getClientRects=()=>{throw Error('準備済みの位置を問い合わせた');};
                  images.watchIllustration('ready-check',Promise.resolve(true),ready);
                  await new Promise(r=>queueMicrotask(r));await images.waitForScene(root);
                  const show=images.preserveScene(root);root.replaceChildren(ready);show();
                  return {canvases,cachedWaits:0,readyLayoutQueries:0};
                }''')
                assert sum('/art/town/shrine.webp' in url for url in requests) == 1
                assert sum('/art/town/keepers/maiden.webp' in url for url in requests) == 1
                assert not errors, errors
                print('初回待機・全施設/胸像の画素一致・同期再表示・準備済みの位置問い合わせなし:', result, flush=True)
            assert not errors, errors
            await ctx.close()

        ctx = await browser.new_context(service_workers='block')
        page = await ctx.new_page()
        async def instrument(route):
            source = (ROOT / 'src/townart.js').read_text() + '''\n
              window.oldTownWork={scene:0,vignettes:[]};
              sceneStep=()=>{oldTownWork.scene++;return false;};
              vignetteFrames=key=>{oldTownWork.vignettes.push(key);return null;};'''
            await route.fulfill(content_type='text/javascript', body=source)
        await ctx.route('**/src/townart.js', instrument)
        await ctx.route('**/town-cache-review.html', lambda r: r.fulfill(content_type='text/html', body='<html><body></body></html>'))
        await page.goto(BASE + 'town-cache-review.html')
        await page.evaluate('''async()=>{
          const town=await import('/src/townart.js'),{TOWN_KEYART}=await import('/src/townkeyart.js');
          window.prewarm={town,TOWN_KEYART};town.prewarmTown(Object.keys(TOWN_KEYART));
        }''')
        await page.wait_for_timeout(300)
        assert await page.evaluate('oldTownWork') == {'scene': 0, 'vignettes': []}
        await page.evaluate('''()=>{delete prewarm.TOWN_KEYART.panoramaDay;delete prewarm.TOWN_KEYART.inn;prewarm.town.prewarmTown(['inn']);}''')
        await page.wait_for_function('oldTownWork.scene>0&&oldTownWork.vignettes.includes("inn")')
        print('原画がある時の旧絵準備0回・未登録時の下ごしらえを維持 OK', flush=True)
        await ctx.close()
        await browser.close()

asyncio.run(main())

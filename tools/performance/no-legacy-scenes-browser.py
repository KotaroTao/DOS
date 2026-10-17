"""原画のある背景・街・肖像は、取得中・失敗時にも旧絵へ戻らない。"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://localhost:8000/'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for failure in [False, True]:
            ctx = await browser.new_context(service_workers='block', reduced_motion='reduce')
            page = await ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            release = asyncio.Event()
            finished = 0
            async def image(route):
                nonlocal finished
                await release.wait()
                if failure:
                    await route.abort()
                else:
                    await route.continue_()
                finished += 1
            async def town(route):
                source = (ROOT / 'src/townart.js').read_text()
                source += '''\n
                pixelVignette=pixelKeeperCanvas=pixelIconCanvas=pixelTownScene=()=>{throw Error('街の旧イラストを生成した')};'''
                await route.fulfill(content_type='application/javascript', body=source)
            async def departure(route):
                source = (ROOT / 'src/ui/departure.js').read_text()
                source += "\nvistaCanvas=()=>{throw Error('出撃の旧情景を生成した')};window.reviewDeparture=dn=>{cur={};return vistaIllustration(dn)};"
                await route.fulfill(content_type='application/javascript', body=source)
            await ctx.route('**/art/**', image)
            await ctx.route('**/src/townart.js', town)
            await ctx.route('**/src/ui/departure.js', departure)
            await ctx.route('**/scene-review.html', lambda r: r.fulfill(content_type='text/html', body='<html><body></body></html>'))
            await page.goto(BASE + 'scene-review.html')
            count = await page.evaluate('''async()=>{
              const town=await import('/src/townart.js');
              const {TOWN_KEYART,TOWN_KEEPERART,TOWN_ICONART}=await import('/src/townkeyart.js');
              const key=Object.keys(TOWN_KEYART).find(k=>!k.startsWith('panorama'));
              const keeper=Object.keys(TOWN_KEEPERART)[0];
              const icon=Object.keys(TOWN_ICONART).find(k=>town.iconCanvas(k));
              const nodes=[town.vignetteCanvas(key),town.keeperCanvas(keeper),town.kingCanvas(),town.iconCanvas(icon),town.createTownScene()];
              const {questPortrait}=await import('/src/ui/questportrait.js');
              nodes.push(questPortrait({name:'隻眼のガルム'},40,()=>{throw Error('依頼人の旧肖像を生成した')}));
              const {soulAcquisitionArt}=await import('/src/ui/soulart.js');nodes.push(soulAcquisitionArt('fighter'));
              await import('/src/ui/departure.js');nodes.push(reviewDeparture({id:'w01',name:'地下墓地'}));
              document.body.append(...nodes.filter(Boolean));
              window.scenes={nodes};
              const {drawIllustratedBattleBackdrop}=await import('/src/battlebackgrounds.js');
              const cv=document.createElement('canvas');cv.width=320;cv.height=180;
              const draw=()=>{if(!drawIllustratedBattleBackdrop(cv.getContext('2d'),320,180,{dungeonId:'w01'}))throw Error('旧戦闘背景へ戻った')};
              draw();window.scenes.backdrop={cv,draw,before:cv.toDataURL()};
              const {TitleScene}=await import('/src/titleart.js');TitleScene.create=()=>{throw Error('旧タイトルを生成した')};
              const {showTitle}=await import('/src/title.js');window.scenes.title=showTitle();
              return nodes.filter(Boolean).length;
            }''')
            assert count == 8, count
            await page.wait_for_timeout(150)
            assert not errors, errors
            release.set()
            await page.wait_for_timeout(1500)
            assert finished >= 9, finished
            result = await page.evaluate('''()=>{
              const s=scenes;s.backdrop.draw();
              return {same:s.backdrop.before===s.backdrop.cv.toDataURL(),
                canvases:s.nodes.slice(0,5).map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v)),
                soul:!!document.querySelector('.ui-soul-art canvas'),
                hd:!!document.querySelector('.ttl-hd')};
            }''')
            assert result['same'] == failure, result
            assert result['canvases'] == [not failure] * 5, result
            assert not result['soul'], result
            assert result['hd'] == (not failure), result
            assert not errors, errors
            print(('通信失敗' if failure else '遅延後の取得成功') + ': 街・肖像・魂・戦闘背景・タイトル・出撃の旧絵表示なし', flush=True)
            await ctx.close()
        await browser.close()

asyncio.run(main())

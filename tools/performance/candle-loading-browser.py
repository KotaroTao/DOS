"""左下の燭台で複数画像の待機・失敗・再取得を示し、短い待機では灯を出さず、通常の画像待ちで操作を遮らない。"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = 'http://localhost:8000/'
ROOT = Path(__file__).resolve().parents[2]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
        page = await ctx.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        gates = {str(i): asyncio.Event() for i in range(1, 9)}
        fail = {'2'}
        async def art(route):
            url = route.request.url
            requests.append(url)
            key = url.rsplit('=', 1)[-1]
            await gates[key].wait()
            if key in fail:
                await route.abort()
            else:
                await route.fulfill(content_type='image/webp', body=(ROOT/'art/monsters/bs_wickmummy.webp').read_bytes())
        await ctx.route('**/art/**', art)
        await ctx.route('**/loading-review.html', lambda r: r.fulfill(content_type='text/html', body='''
          <html><head><meta charset="UTF-8"><link rel="stylesheet" href="/ui.css"></head>
          <body style="background:#121018;color:#c9bda7;font-family:serif"><p>魂の迷宮</p><button id="action">探索を続ける</button></body></html>'''))
        await page.goto(BASE+'loading-review.html')
        await page.evaluate('''async()=>{
          const {lazyPhoto}=await import('/src/photoload.js');
          const {spriteCanvas}=await import('/src/sprites.js');
          window.review={items:[],clicked:0};document.querySelector('#action').onclick=()=>review.clicked++;
          review.make=(id,attach=true)=>{
            const sprite=lazyPhoto('/art/monsters/bs_wickmummy.webp?id='+id);
            const canvas=spriteCanvas(sprite,4,24);
            if(attach)document.body.appendChild(canvas);
            const item={sprite,canvas};review.items.push(item);return item;
          };
          const {watchIllustration}=await import('/src/imageloading.js');
          const fast=document.createElement('div');document.body.appendChild(fast);
          let done;watchIllustration('fast',new Promise(r=>done=r),fast);done(true);
          await new Promise(r=>setTimeout(r,200));
          if(document.querySelector('.image-loading')?.dataset.state==='loading')throw Error('短い待機で燭台を表示');
          review.make(1);review.make(2);
        }''')
        lamp = page.locator('.image-loading')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        info = await lamp.evaluate('''el=>{
          const b=el.getBoundingClientRect(),body=el.querySelector('.image-loading-body'),flame=el.querySelector('.image-loading-flame');
          return {left:b.left,bottom:innerHeight-b.bottom,width:b.width,height:b.height,
            body:getComputedStyle(body).animationName,flame:getComputedStyle(flame).animationName,
            clip:getComputedStyle(flame).clipPath,pointer:getComputedStyle(el).pointerEvents,
            embedded:[...el.querySelectorAll('img')].every(i=>i.src.startsWith('data:image/webp;base64,')&&i.complete&&i.naturalWidth>0)};
        }''')
        assert info['left'] == 10 and info['bottom'] == 10, info
        assert info['body']=='none' and info['flame']=='image-loading-flame', info
        assert info['clip']=='inset(0px 0px 74%)' and info['pointer']=='none' and info['embedded'], info
        async def curtain(shown):
            info = await page.evaluate("""() => {
              const style=getComputedStyle(document.body,'::before');
              return {shown:document.body.classList.contains('screen-loading'),
                background:style.backgroundColor,position:style.position,
                covered:document.elementFromPoint(30,30)===document.body};
            }""")
            assert info['shown']==shown, info
            if shown:
                assert info['background']=='rgb(0, 0, 0)' and info['position']=='fixed' and info['covered'], info
        await curtain(False)
        # 通常の画像待ちでもキーボードとポインターで操作できる。
        await page.locator('#action').focus()
        await page.keyboard.press('Enter')
        await page.mouse.click(50,60)
        assert await page.evaluate('review.clicked')==2
        await page.screenshot(path='/tmp/dos-candle-loading.png')
        await page.emulate_media(reduced_motion='reduce')
        assert await lamp.locator('.image-loading-flame').evaluate('el=>getComputedStyle(el).animationName')=='none'
        await page.emulate_media(reduced_motion='no-preference')
        gates['1'].set()
        await page.wait_for_function('review.items[0].sprite.photo.img.complete')
        assert await lamp.get_attribute('data-state')=='loading'
        await curtain(False)
        gates['2'].set()
        await page.wait_for_selector('.image-loading[data-state="error"]')
        assert await lamp.locator('.image-loading-flame').evaluate('el=>getComputedStyle(el).animationName')=='none'
        assert await lamp.inner_text()=='画像を読み込めませんでした'
        await curtain(False)
        await page.locator('#action').click()
        assert await page.evaluate('review.clicked')==3
        # 失敗した画像枠を閉じ、再表示で取り直す。古い失敗を灯に残さない。
        fail.clear()
        await page.evaluate('review.items[1].canvas.remove();review.make(3)')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        gates['3'].set()
        await page.wait_for_function("document.querySelector('.image-loading').dataset.state==='idle'")
        await page.wait_for_timeout(250)
        assert not await lamp.is_visible()
        # 閉じた画面の画像と、通信だけを行う先読みでは灯を出さない。
        await page.evaluate('review.make(4)')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        await page.evaluate('review.items.at(-1).canvas.remove()')
        await page.wait_for_function("document.querySelector('.image-loading').dataset.state==='idle'")
        await page.evaluate('review.make(5,false)')
        await page.wait_for_timeout(350)
        assert await lamp.get_attribute('data-state')=='idle'
        gates['4'].set();gates['5'].set()
        # Canvas以外の肖像や挿絵も同じ灯へまとめる。
        await page.evaluate("const img=new Image();img.src='/art/monsters/bs_wickmummy.webp?id=6';document.body.appendChild(img)")
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        gates['6'].set()
        await page.wait_for_function("document.querySelector('.image-loading').dataset.state==='idle'")
        # 同じ挿絵のsrcを変えて取り直した時にも、失敗した灯を残さない。
        fail.add('7')
        gates['7'].set()
        await page.evaluate("document.body.lastElementChild.src='/art/monsters/bs_wickmummy.webp?id=7'")
        await page.wait_for_selector('.image-loading[data-state="error"]')
        await page.evaluate("document.body.lastElementChild.src='/art/monsters/bs_wickmummy.webp?id=8'")
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        gates['8'].set()
        await page.wait_for_function("document.querySelector('.image-loading').dataset.state==='idle'")
        assert len(requests)==8, requests
        assert not errors, errors
        print('左下の館の燭台・火だけの揺らぎ・複数画像の待機・通信失敗/再取得・閉じた画面/先読みの除外・動きを減らす設定・通常待機で暗転なし・操作継続・挿絵: OK')
        await ctx.close()
        # 街の背景待ち: 前画面のCanvasを保ち、到着・失敗・別画面への移動で解除する。
        ctx = await browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
        page = await ctx.new_page()
        await page.goto(BASE+'loading-review.html')
        await page.evaluate('''async()=>{
          const {preserveScene,sceneReady,watchIllustration}=await import('/src/imageloading.js');
          const root=document.createElement('div');root.id='town-screen';
          root.style.cssText='width:300px;height:200px';document.body.appendChild(root);
          const canvas=document.createElement('canvas');canvas.width=300;canvas.height=100;
          canvas.getContext('2d').fillStyle='red';canvas.getContext('2d').fillRect(0,0,300,100);root.appendChild(canvas);
          window.sceneTest={root,go:(track=true)=>{
            const reveal=preserveScene(root);root.replaceChildren();
            const next=document.createElement('canvas');next.width=300;next.height=100;root.appendChild(next);
            let done;const ready=new Promise(r=>done=r);sceneTest.done=done;
            if(track)sceneReady(next,ready);
            watchIllustration(ready,ready,next);reveal();
          }};
          sceneTest.go();
        }''')
        assert await page.locator('.scene-hold').count()==1
        assert await page.evaluate("document.querySelector('.scene-hold canvas').getContext('2d').getImageData(1,1,1,1).data[0]")==255
        assert await page.locator('.scene-next').evaluate('n=>n.inert')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        # 続けて別の画面へ移動しても古い完了通知が新しい画面を消さない。
        await page.evaluate('sceneTest.oldDone=sceneTest.done;sceneTest.go();sceneTest.oldDone(true)')
        await page.wait_for_timeout(100)
        assert await page.locator('.scene-hold').count()==1
        await page.evaluate('sceneTest.done(true)')
        await page.wait_for_function("!document.querySelector('.scene-hold')")
        assert await page.locator('.scene-next').count()==0
        await page.evaluate('sceneTest.go();sceneTest.done(false)')
        await page.wait_for_function("!document.querySelector('.scene-hold')")
        # 肖像など背景以外の待機では、画面を覆わない。
        await page.evaluate('sceneTest.go(false)')
        assert await page.locator('.scene-hold').count()==0
        await page.evaluate('sceneTest.done(true)')
        print('街の背景待ち: 直前のCanvas保持・二重操作抑止・到着/失敗で解除・連続遷移・肖像待ちの除外: OK')
        await ctx.close()
        # 実際の街でも、控え室へ移す夜景のCanvasが写しから消えない。
        ctx = await browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
        page = await ctx.new_page()
        await ctx.route('https://**/*', lambda r: r.abort())
        release_shrine = asyncio.Event()
        async def shrine_art(route):
            await release_shrine.wait()
            await route.continue_()
        await ctx.route('**/art/town/shrine.webp', shrine_art)
        await page.goto(BASE+'?testDungeon=w45&testPlace=town', wait_until='domcontentloaded')
        await page.wait_for_function('!!window.__game && !document.body.classList.contains("booting")')
        await page.wait_for_selector('.town-scene[data-art="painted"]')
        await page.evaluate('''async()=>{const shell=await import('/src/ui/townshell.js');shell.openPage('shrine')}''')
        await page.wait_for_selector('.scene-hold .town-scene')
        assert await page.locator('.scene-hold .town-scene').evaluate('''c=>{
          const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          return a.some((v,i)=>i%4===3&&v>0);
        }''')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        assert not await page.evaluate("document.body.classList.contains('screen-loading')")
        await page.screenshot(path='/tmp/dos-town-loading.png')
        release_shrine.set()
        await page.wait_for_function('!document.querySelector(".scene-hold")')
        print('実際の街→祠: 夜景の画素を保持・燭台・暗転なし・背景到着後に切り替え: OK')
        await ctx.close()
        # 実際の迷宮画面でも、中央の待機印を出さずに左下へまとめる。
        ctx = await browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
        page = await ctx.new_page()
        release_board = asyncio.Event()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        async def board_art(route):
            await release_board.wait()
            await route.continue_()
        await ctx.route('https://**/*', lambda r: r.abort())
        await ctx.route('**/art/dungeon/*', board_art)
        await page.goto(BASE+'?testDungeon=w01&testPlace=dungeon', wait_until='domcontentloaded')
        await page.wait_for_function("!document.body.classList.contains('booting')")
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        assert not await page.evaluate("document.body.classList.contains('screen-loading')")
        await page.screenshot(path='/tmp/dos-candle-board.png')
        release_board.set()
        await page.wait_for_function("document.querySelector('.image-loading').dataset.state==='idle'")
        assert not await page.evaluate("document.body.classList.contains('screen-loading')")
        assert not errors, errors
        print('実際の迷宮画面: 読み込み中の左下の灯・素材到着後に消えることを確認')
        await ctx.close()
        # 起動用モジュール・タイトル原画を別々に止めても、途中の画面は出さない。
        ctx = await browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
        page = await ctx.new_page()
        release_module, release_title = asyncio.Event(), asyncio.Event()
        async def module(route):
            await release_module.wait()
            await route.continue_()
        async def title_art(route):
            await release_title.wait()
            await route.continue_()
        await ctx.route('https://**/*', lambda r: r.abort())
        await ctx.route('**/src/game.js', module)
        await ctx.route('**/art/title/**', title_art)
        await page.goto(BASE, wait_until='commit')
        await page.wait_for_selector('.image-loading[data-state="loading"]')
        await page.wait_for_timeout(5500)
        assert await page.locator('#boot-notice').count()==0
        assert await page.locator('.image-loading').count()==1
        assert await page.evaluate("getComputedStyle(document.body,'::before').backgroundColor")=='rgb(0, 0, 0)'
        assert await page.locator('.image-loading img').evaluate_all("images=>images.every(i=>i.complete&&i.naturalWidth>0)")
        await page.screenshot(path='/tmp/dos-candle-boot.png')
        release_module.set()
        await page.wait_for_function("!document.body.classList.contains('booting')")
        await page.wait_for_selector('.ttl-overlay')
        assert await page.evaluate("document.body.classList.contains('screen-loading')")
        release_title.set()
        await page.wait_for_function("!document.body.classList.contains('screen-loading')")
        assert await page.locator('.image-loading').count()==1
        await page.screenshot(path='/tmp/dos-candle-title-ready.png')
        print('起動待機が5秒を超えても黒い幕と燭台のみ・タイトル原画到着後に表示・燭台の重複なし: OK')
        await ctx.close();await browser.close()

asyncio.run(main())

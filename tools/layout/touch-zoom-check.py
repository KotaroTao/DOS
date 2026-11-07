"""localhost:8000でiPad向けの連打・クリック座標・スクロール操作を確認する。"""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--browser', choices=['chromium', 'webkit', 'both'], default='chromium')
args = parser.parse_args()

with sync_playwright() as p:
    for engine in (('chromium', 'webkit') if args.browser == 'both' else (args.browser,)):
        opts = {'executable_path': '/usr/bin/chromium'} if engine == 'chromium' else {}
        browser = getattr(p, engine).launch(**opts)
        page = browser.new_page(viewport={'width': 820, 'height': 1180},
                                has_touch=True, is_mobile=True, service_workers='block')
        page.route('**/__touch_test', lambda r: r.fulfill(content_type='text/html', body='''
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <link rel="stylesheet" href="/styles.css">
            <script src="/src/touch-zoom.js"></script>
            <button id="tap" style="width:200px;height:80px">連打</button>
            <canvas id="board" width="300" height="150"></canvas>
            <div id="scroll" style="height:100px;overflow:auto;touch-action:pan-y">
              <div style="height:900px">一覧</div></div>
            <input id="text"><button id="disabled" disabled>無効</button>
        '''))
        page.goto('http://localhost:8000/__touch_test')
        page.evaluate('''() => {
          window.clicks = [];
          document.addEventListener('click', e => clicks.push([e.target.id,e.clientX,e.clientY]));
        }''')
        for _ in range(8):
            page.locator('#tap').tap()
        assert page.evaluate('clicks.length') == 8, '連打のクリックが欠落・重複'
        assert page.evaluate('visualViewport.scale') == 1, '連打で拡大'
        # ブラウザのジェスチャー処理とは別に、Safari向けの抑止と座標の引継ぎを検査。
        page.evaluate('''() => {
          let clock = 10000;
          const scroll = document.getElementById('scroll');
          const point = (x=120,y=140,id=1) => ({identifier:id,clientX:x,clientY:y,screenX:x,screenY:y});
          function send(type, touches, changed=touches, duration=20, target=board) {
            clock += duration;
            const e = new Event(type,{bubbles:true,cancelable:true});
            Object.defineProperties(e, {touches:{value:touches},changedTouches:{value:changed},timeStamp:{value:clock}});
            target.dispatchEvent(e);
            return e.defaultPrevented;
          }
          function tapAt(t=point(), target=board, duration=20) {
            send('touchstart',[t],[t],20,target);
            return send('touchend',[],[t],duration,target);
          }
          const check = (ok,msg) => { if(!ok) throw Error(msg); };
          clicks=[];
          check(!tapAt(),'最初のタップを抑止');
          check(tapAt(),'2回目のズームを抑止できない');
          check(tapAt(),'3回目のズームを抑止できない');
          check(clicks.length===2 && clicks.every(c=>c[0]==='board'&&c[1]===120&&c[2]===140),'盤面のクリック数・座標');
          check(!tapAt(point(230,240)),'離れたタップを抑止');
          check(!tapAt(point(),board,600),'長押しを抑止');
          send('touchstart',[point()]);
          check(!send('touchmove',[point(120,200)]),'スクロール開始を抑止');
          check(!send('touchend',[],[point(120,200)]),'スクロール終了を抑止');
          check(!tapAt(),'スクロール直後のタップを抑止');
          send('touchstart',[point(),point(160,140,2)]);
          check(!send('touchend',[],[point()]),'複数指を単一タップ扱い');
          check(!tapAt(),'複数指の後のタップを抑止');
          send('touchcancel',[]);
          check(!tapAt(),'キャンセル後のタップを抑止');
          check(!tapAt(point(),text),'入力欄の標準操作を抑止');
          clicks=[];
          tapAt(point(),disabled);
          check(clicks.length===0,'無効なボタンを実行');
          check(getComputedStyle(text).touchAction==='manipulation','入力欄のCSS対策なし');
          check(getComputedStyle(scroll).touchAction==='pan-y','内側の縦スクロールを変更');
        }''')
        # 実際のゲームでも起動・タップ・表示倍率を確認する。
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
        page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length > 0', timeout=60000)
        page.wait_for_function('!document.body.classList.contains("booting")', timeout=60000)
        if page.locator('#studio-splash').count():
            page.locator('#studio-splash').tap()
        page.wait_for_function('!document.querySelector("#studio-splash")')
        for width,height in [(820,1180),(1180,820),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            for _ in range(5):
                page.touchscreen.tap(width-10, height//2)
            assert page.evaluate('visualViewport.scale') == 1, (engine,width,'画面が拡大')
        assert not errors, errors
        browser.close()
        print(engine + ': 連打・座標・スクロール・長押し・複数指・入力欄・ゲーム起動 OK')

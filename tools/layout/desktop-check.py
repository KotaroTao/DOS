"""localhost:8000でPCの左右配置とスマホ・タブレットの表示維持を確認する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

Path("work").mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []
    def open_page(width, height, touch=False, mobile=False):
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch,
                                is_mobile=mobile, service_workers='block')
        page.on('pageerror', lambda e: errors.append(str(e)))
        # 外部フォントの応答待ちで起動監視が発火しないよう、端末の代替書体を使う。
        page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        # 検証用VMでは大量のES Modulesの取得が5秒を超えるため、起動監視だけ猶予を延ばす。
        def boot_page(route):
            response = route.fetch()
            route.fulfill(response=response, body=response.text().replace('}, 5000);', '}, 60000);'))
        page.route('http://localhost:8000/?testDungeon=*', boot_page)
        page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.wait_for_timeout(2000)
        return page

    geometry = '''() => Object.fromEntries(['app','view','party','hud','controls','hint','runbar'].map(id => {
      const r=document.getElementById(id).getBoundingClientRect();
      return [id,[r.x,r.y,r.width,r.height]];
    }))'''
    # 新CSSの有無で寸法が一致。大きなタブレットとマウス接続相当も含む。
    for width,height,touch,mobile in [(390,844,True,True),(768,1024,True,False),
            (1366,1024,True,False),(1024,768,False,False),(1280,580,False,False)]:
        page = open_page(width,height,touch,mobile)
        if touch:
            page.emulate_media()  # maxTouchPoints がタブレットを保護する。
        page.wait_for_timeout(500)
        before = page.evaluate(geometry)
        page.evaluate("document.querySelector('link[href=\"desktop.css\"]').disabled=true")
        page.wait_for_timeout(300)
        assert before == page.evaluate(geometry), (width,height,'従来の表示と異なる')
        page.close()
        print(f'{width}x{height} touch={touch}: 従来表示と一致')

    page = open_page(1280,720)
    for state in ['board','combat']:
        if state == 'combat':
            page.evaluate('''() => { __game.G.autoCombat=false;
              __game.startBattle(__game.spawnCardEnemies('bs_drainrat', 1),null);
              const b=__game.G.battle, sample=b.enemies[0];
              b.enemies=Array.from({length:6},(_,i)=>({...sample,uid:9000+i,alive:true,effects:[]}));
              __game.G._cmdStale=true; }''')
            page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
        for width,height in [(1100,600),(1280,720),(1920,1080),(2560,1440),(1280,900)]:
            page.set_viewport_size({'width':width,'height':height})
            page.wait_for_timeout(400)
            page.evaluate('''() => {
              const rect=id=>document.getElementById(id).getBoundingClientRect();
              const view=rect('view'),party=rect('party'),hud=rect('hud'),app=rect('app');
              if (getComputedStyle(document.getElementById('app')).display!=='grid') throw Error('PC配置にならない');
              if(view.right>party.left || view.right>hud.left) throw Error('左右の重なり');
              if(hud.top<party.bottom || rect('log').height<54) throw Error('隊と記録の重なり');
              for(const id of ['view','party','hud','controls','hint','runbar']) {
                const el=document.getElementById(id),r=rect(id);
                if(getComputedStyle(el).display==='none') continue;
                if(r.bottom>app.bottom+1 || r.right>app.right+1 || r.top<app.top-1) throw Error(id+'が画面外');
              }
              if(__game.G.state==='combat') {
                const {VW,VH}=__game.autoMove.viewSize();
                for(const pos of Object.values(__game.G.enemyPos))
                  if(pos.cx-pos.hw<0 || pos.cx+pos.hw>VW+1 || pos.cy-pos.hh<0 || pos.cy+pos.hh>VH+1)
                    throw Error('敵の絵が戦場外');
              }
              const log=document.getElementById('log'),r=rect('log');
              if(!log.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))) throw Error('記録を操作できない');
            }''')
            print(f'{state} {width}x{height}: 左右配置・収まり OK')
        page.wait_for_load_state('networkidle', timeout=60000)
        page.screenshot(path=f'work/desktop-{state}.png')
        # 窓を狭めて戻しても、PC配置へ復帰できる。
        page.set_viewport_size({'width':900,'height':720})
        page.wait_for_timeout(300)
        assert page.locator('#app').evaluate("e=>getComputedStyle(e).display") == 'flex'
        page.set_viewport_size({'width':1280,'height':720})
        page.wait_for_timeout(300)
    assert not errors, errors
    browser.close()

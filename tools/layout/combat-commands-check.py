"""localhost:8000でスマホの命令欄と攻撃対象選択・長押しを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664},
                            is_mobile=True, has_touch=True, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    page.wait_for_timeout(1500)
    page.evaluate('''() => {
      __game.G.autoCombat=false;
      __game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    page.evaluate('''() => {
      const b=__game.G.battle, sample=b.enemies[0];
      window.setEnemies=n=>{
        b.enemies=Array.from({length:n},(_,i)=>({...sample,uid:9000+i,alive:true,effects:[]}));
        __game.G._cmdStale=true;
      };
      window.actions=[];
      const commit=b.commit.bind(b);
      b.commit=()=>{actions.push({action:b.pending.action,target:b.pending.target?.uid});return commit();};
    }''')
    for banner in [True, False]:
        if not banner:
            page.locator('.test-play-banner').evaluate('(e)=>e.remove()')
        for width,height in [(320,550),(375,550),(390,664),(390,844),(430,932),(600,760)]:
            page.set_viewport_size({'width':width,'height':height})
            for count in [1,6]:
                for swap in [False, True]:
                    page.evaluate('''({count,swap})=>{
                      setEnemies(count);
                      __game.G.battle.current.items=swap?[{slot:'weapon',name:'検査の剣'}]:[];
                      __game.G._cmdStale=true;
                    }''', {'count':count,'swap':swap})
                    page.wait_for_timeout(100)
                    page.evaluate('''() => {
                      const app=document.getElementById('app'),r=app.getBoundingClientRect();
                      if(app.scrollHeight>app.clientHeight+1) throw Error('画面スクロールが必要 '+JSON.stringify({h:app.clientHeight,scroll:app.scrollHeight,parts:[...app.children].map(e=>[e.id,e.getBoundingClientRect().height])}));
                      const buttons=[...document.querySelectorAll('.cmd-main button,.cmd-sub button')];
                      for(const button of buttons) {
                        const b=button.getBoundingClientRect();
                        if(b.height<44 || b.bottom>r.bottom+1 || b.left<r.left || b.right>r.right+1)
                          throw Error('操作ボタンが小さい・画面外');
                        if(!button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)))
                          throw Error('操作ボタンが隠れている');
                      }
                      const tops=[...document.querySelectorAll('.cmd-sub button')].map(e=>e.offsetTop);
                      if(new Set(tops).size!==1) throw Error('補助ボタンが折り返されている');
                    }''')
        print(f'スマホ6寸法・敵1/6体・持ち替え有無 banner={banner}: OK', flush=True)
    page.set_viewport_size({'width':390,'height':664})
    page.evaluate('setEnemies(3)')
    page.wait_for_timeout(150)
    page.locator('.cmd-attack').tap()
    page.wait_for_function('__game.G.battle.phase === "target"')
    assert page.evaluate('actions.length') == 0
    assert page.locator('.tgt-enemy').count() >= 2
    page.locator('.cmd-back').tap()
    assert page.evaluate('actions.length') == 0
    page.locator('.cmd-attack').tap()
    page.evaluate('window.expectedTarget=__game.G.battle.targetOptions()[1].uid')
    page.locator('.tgt-enemy').nth(1).tap()
    assert page.evaluate('actions[0].target===expectedTarget && actions[0].action==="attack"')
    page.wait_for_function('__game.G.battle.phase === "input" && !__game.G.animating')
    # 作戦を開いてもオートを開始しない。
    auto = page.locator('.cmd-auto')
    auto.dispatch_event('pointerdown', {'clientX':0,'clientY':0})
    page.wait_for_timeout(500)
    auto.dispatch_event('pointerup')
    auto.dispatch_event('click')
    page.locator('.pt-tac').wait_for(state='visible')
    assert not page.evaluate('__game.G.autoCombat')
    page.evaluate("import('/src/ui/kit.js').then(({sheet})=>sheet.closeAll())")
    page.locator('.pt-tac').wait_for(state='detached')
    # 長押し後のクリックが攻撃に化けない（作り直される前のボタンへも送る）。
    page.evaluate('''() => {
      window.heldAttack=document.querySelector('.cmd-attack');
      heldAttack.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    }''')
    page.wait_for_timeout(500)
    page.evaluate('''() => {
      heldAttack.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
      heldAttack.click();
    }''')
    assert page.evaluate('actions.length===2 && actions[1].action==="defend"')
    page.wait_for_function('__game.G.battle.phase === "input" && !__game.G.animating')
    page.evaluate('setEnemies(1)')
    page.wait_for_timeout(150)
    page.locator('.cmd-attack').tap()
    assert page.evaluate('actions.length===3 && actions[2].action==="attack"')
    assert not errors, errors
    browser.close()
    print('複数対象の選択・取消・単体即攻撃・オート長押しの作戦・攻撃長押しの防御: OK')

"""localhost:8000でHP/MPの桁数・残量と戦闘の表示寸法、詳細・味方選択を確認する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664}, has_touch=True,
                            is_mobile=True, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    page.wait_for_timeout(2000)
    page.evaluate('''() => {
      __game.G.autoCombat=false;
      __game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      window.setVitals=(value,max)=>{
        for(const d of __game.G.party) {d.hp=d.mp=value;d.maxhp=d.maxmp=max;}
        game.renderParty();
      };
      window.enemySample=__game.G.battle.enemies[0];
      window.setEnemies=n=>{
        const b=__game.G.battle;
        b.enemies=Array.from({length:n},(_,i)=>({...enemySample,uid:9000+i,alive:true,effects:[]}));
        __game.G._cmdStale=true;
      };
      window.geometry=()=>{
        const rect=id=>document.getElementById(id).getBoundingClientRect();
        return ['view','party','controls'].map(id=>rect(id).height);
      };
    }''')
    # 試遊バナーありと通常プレイの両方を確認する。
    for banner in [True, False]:
        if not banner:
            page.evaluate("document.querySelector('.test-play-banner').remove()")
        sizes = [(390,664),(390,700),(390,744),(390,844),(430,932),(600,760)]
        if not banner:
            sizes = [(320,550),(375,550)] + sizes
        for w,h in sizes:
            page.set_viewport_size({'width':w,'height':h})
            for enemies in [1,6]:
                page.evaluate('n=>setEnemies(n)', enemies)
                page.evaluate('setVitals(999,999)')
                page.wait_for_timeout(200)
                baseline = page.evaluate('geometry()')
                for value,max_value,label in [(1000,9999,'1000'),(9999,9999,'9999'),
                        (10000,20000,'1万'),(19999,20000,'1.9万'),
                        (1234567,2345678,'123万'),(99999999,99999999,'9999万'),
                        (123456789,234567890,'1.2億'),(1,2345678,'1'),(0,2345678,'0')]:
                    page.evaluate('a=>setVitals(...a)', [value,max_value])
                    page.wait_for_timeout(30)
                    assert page.locator('.pc-vial.hp .pc-num').first.inner_text() == label
                    assert all(abs(a-b)<1 for a,b in zip(baseline,page.evaluate('geometry()'))), (w,h,value)
                    page.evaluate('''() => {
                      for(const n of document.querySelectorAll('.pc-num')) {
                        if(n.scrollWidth>n.clientWidth+1) throw Error('HP/MPの文字が欠ける');
                      }
                      const app=document.getElementById('app'),r=app.getBoundingClientRect();
                      if(app.scrollHeight>app.clientHeight+1) throw Error('画面全体のスクロールが必要');
                      for(const button of document.querySelectorAll('.cmd-sub button')) {
                        const b=button.getBoundingClientRect();
                        if(b.height<39.5 || b.bottom>r.bottom+1) throw Error('操作ボタンが小さい・画面外');
                      }
                    }''')
                print(f'{w}x{h} banner={banner} 敵{enemies}体: 桁数による寸法変化なし', flush=True)
    page.set_viewport_size({'width':390,'height':664})
    page.evaluate('setVitals(1234567,2345678)')
    page.locator('.cmd-run').wait_for(state='visible')
    Path('work').mkdir(exist_ok=True)
    page.screenshot(path='work/battle-vitals-mobile.png')
    page.locator('#party .pc').first.tap()
    page.locator('.dg-peek').wait_for(state='visible')
    assert page.locator('.dg-peek-bv').first.text_content().replace('\u200b','') == '1234567/2345678'
    page.evaluate("import('/src/ui/kit.js').then(({sheet})=>sheet.closeAll())")
    page.locator('.dg-peek').wait_for(state='detached')
    # 技の一覧は専用パネルでスクロールし、戻るボタンも画面内に残す。
    page.evaluate('''async () => {
      const {battleSkills}=await import('/src/souls.js');
      const b=__game.G.battle;
      b.current=[...b.party].sort((a,b)=>battleSkills(b).length-battleSkills(a).length)[0];
      __game.G._cmdStale=true;
    }''')
    page.wait_for_timeout(100)
    page.locator('.cmd-skill').tap()
    page.locator('.battle-skill-picker').wait_for(state='visible')
    page.wait_for_timeout(300)  # シートが下から現れる演出を待つ
    page.evaluate('''() => {
      const menu=document.querySelector('.battle-skill-picker');
      if(menu.getBoundingClientRect().bottom>innerHeight+1)
        throw Error('技の一覧の戻るボタンが画面外');
    }''')
    page.locator('.battle-skill-picker .ui-sheet-foot button').tap()
    page.locator('.battle-skill-picker').wait_for(state='detached')
    # 単体回復の対象選択では詳細を開かず、仲間へのタップを対象選択へ渡す。
    page.evaluate('''async () => {
      const {SPELLS}=await import('/src/combat.js');
      const [key]=Object.entries(SPELLS).find(([,s])=>s.target==='ally' && s.kind==='heal');
      const b=__game.G.battle;
      if(!b.chooseAction('spell',key).needTarget) throw Error('回復対象選択に入れない');
      window.targetChosen=false;
      b.chooseTarget=d=>{window.targetChosen=d===__game.G.party[0];b.phase='input';};
      __game.G._cmdStale=true;
    }''')
    page.locator('#party .pc').first.tap()
    assert page.evaluate('targetChosen')
    assert page.locator('.dg-peek').count() == 0
    assert not errors, errors
    browser.close()
    print('詳細の正確なHP/MP・味方対象選択 OK')

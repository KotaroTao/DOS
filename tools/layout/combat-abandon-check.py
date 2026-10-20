"""左上の手帳から戦闘を断念する。取消・演出/敵予約/オート停止・救済・無限迷宮を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
    page.route('https://**/*',lambda r:r.abort())
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))

    def setup(mode='input',infinite=False):
        page.goto('http://localhost:8000/?testDungeon=w03&testPlace='+('town&testUnlock=infinite' if infinite else 'board'),wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.evaluate('''async({mode,infinite})=>{
          const {game,UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          Object.assign(window,{api:game,ui:UI,sheets:sheet});const g=game.G;sheet.closeAll();g.tut.cur=null;
          _TUTS.forEach(t=>g.tut.done[t.key]=true);g.insightNotified=Number.MAX_SAFE_INTEGER;
          if(infinite){const {rollStartSouls}=await import('/src/abyss.js');const used=new Set(),picks=[];
            for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];used.add(k);picks.push(k)}
            if(!__game.inf.enterAbyss(picks))throw Error('無限迷宮へ入れない');sheet.closeAll();}
          g.autoCombat=false;g.fastAnim=false;g.prompt=false;g.anim=null;g.walking=false;g.redSoul=100;
          g._evOpening=mode==='enemy'?'ambush':'preempt';
          for(const d of g.party){d.alive=true;d.hp=d.maxhp=100000;d.agi=999;d.vit=100000;d.spells=[];}
          const foes=__game.spawnCardEnemies('bs_ghoul',1,1).slice(0,1);
          for(const e of foes){e.hp=e.maxhp=1000000;e.atk=1;e.vit=100000;e.agi=mode==='enemy'?99999:1;}
          __game.startBattle(foes,{type:'monster',revealed:true});
          window.battleRef=g.battle;window.enemyCalls=0;
          const act=battleRef.enemyAct.bind(battleRef);battleRef.enemyAct=()=>{enemyCalls++;return act()};
          window.signature=()=>JSON.stringify({gold:g.gold,red:g.redSoul,pts:g.soulPts,rng:g.rng,party:g.party.map(d=>[d.hp,d.mp,d.alive]),enemies:battleRef.enemies.map(e=>[e.hp,e.alive]),round:battleRef._roundNo});
        }''',{'mode':mode,'infinite':infinite})
        if mode=='input':
            page.wait_for_function('__game.G.battle?.phase==="input" && !__game.G.animating && !__game.G.battleIntro')
            page.wait_for_selector('#combat-menu .cmd-main')
        elif mode=='enemy':
            page.wait_for_function('__game.G.battle?.phase==="enemy" && __game.G.animating && !__game.G.battleIntro')
        else:
            page.wait_for_function('!!__game.G.battleIntro')

    def open_confirm(fast=True):
        # 実際の左上ボタンから開く。演出中の検査では、現在の一手が終わる前に操作する。
        if fast: page.locator('.dg-book').evaluate('b=>b.click()')
        else: page.locator('.dg-book').click()
        tile=page.locator('.dg-menu .dg-mtile').filter(has_text='迷宮を諦める')
        assert tile.is_enabled()
        tile.evaluate('b=>b.click()')
        dialog=page.locator('.ui-sheet-wrap:not(.closing) .ui-confirm')
        dialog.wait_for(state='visible')
        return dialog

    def give_up(dialog):
        dialog.get_by_role('button',name='諦める',exact=True).evaluate('b=>b.click()')
        page.wait_for_function('__game.G.state==="over"')
        assert page.evaluate('__game.G.run.abandoned && !__game.G.battle && !__game.G.autoCombat && !__game.G._autoTimer')
        assert page.evaluate('__game.G.party.every(d=>!d.alive && d.hp===0)')
        assert page.locator('.rs-wipe-sheet').count()==1
        assert page.evaluate('''async()=>{const {refDeserialize}=await import('/src/savegraph.js');const s=refDeserialize(JSON.parse(__game.inf.saveJSON()));return s.state==='over' && !s.battle && s.run.abandoned && s.party.every(d=>!d.alive)}''')
        page.evaluate('window.after=signature();window.callsAfter=enemyCalls')
        page.wait_for_timeout(1600)  # 予約された敵行動・演出完了・次の手番を越えて待つ。
        assert page.evaluate('signature()===after && enemyCalls===callsAfter && __game.G.state==="over"')
        assert page.locator('.rs-wipe-sheet').count()==1
        assert not errors,errors

    setup()
    for width,height in [(320,568),(390,844),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        dialog=open_confirm()
        page.evaluate('window.before=signature()')
        page.wait_for_timeout(350)
        assert page.evaluate('signature()===before'), '確認中に手番・乱数・資源が進んだ'
        dialog.get_by_role('button',name='やめる',exact=True).click()
        assert page.evaluate('__game.G.state==="combat" && signature()===before')
        print(f'{width}x{height}: 戦闘中の左上メニュー・確認・取消で消費なし OK',flush=True)
    page.set_viewport_size({'width':390,'height':844})
    # 取消後も通常の攻撃と勝利処理が進む。
    page.evaluate('''()=>{battleRef.enemies[0].hp=1;battleRef.enemies[0].vit=0;battleRef.enemies[0].agi=0;__game.G.party[0].atk=1000000;}''')
    page.locator('#combat-menu .cmd-main button').first.click()
    page.wait_for_function('__game.G.state!=="combat" || !!__game.G.battle?.result',timeout=20000)
    page.wait_for_selector('.rs-sheet',timeout=20000)
    assert page.evaluate('__game.G.battle?.result==="win" || __game.G.state==="board"')
    print('取消後の攻撃・通常勝利 OK',flush=True)

    setup()
    # 実際のオートを開始して手帳で止め、断念後に再開しないことを確認。
    page.locator('#combat-menu .cmd-sub button').filter(has_text='オート').first.evaluate('b=>{b.click();document.querySelector(".dg-book").click()}')
    assert page.evaluate('__game.G.autoCombat')
    page.locator('.dg-menu .dg-mtile').filter(has_text='迷宮を諦める').evaluate('b=>b.click()')
    dialog=page.locator('.ui-sheet-wrap:not(.closing) .ui-confirm');dialog.wait_for()
    give_up(dialog)
    # 赤い魂で守って帰還する既存の経路。
    page.locator('.rs-wipe-sheet .ui-sheet-foot button[aria-label^="赤い魂"]').click()
    page.wait_for_function('__game.G.state==="town"',timeout=20000)
    assert page.evaluate('__game.G.redSoul===80 && __game.G.party.every(d=>d.alive && d.hp===1)')
    print('オート停止・全滅扱い・赤い魂で保護帰還 OK',flush=True)

    for mode in ['intro','enemy','attack']:
        setup('input' if mode=='attack' else mode)
        if mode=='attack':
            page.locator('#combat-menu .cmd-main button').first.evaluate('b=>b.click()')
            assert page.evaluate('!!__game.G.fx')
        give_up(open_confirm())
        print(f'{mode}: 演出・実行待ちの敵行動を残さず断念 OK',flush=True)

    setup(infinite=True)
    give_up(open_confirm())
    assert '無限迷宮' in page.locator('.rs-wipe-sheet').inner_text().replace('\u200b','')
    page.locator('.rs-wipe-sheet .ui-sheet-foot button').filter(has_text='あきらめて街へ').click()
    page.wait_for_function('__game.G.state==="town"',timeout=20000)
    assert page.evaluate('!__game.G.abyss && __game.G.party.some(d=>d.alive)')
    print('無限迷宮も戦闘から断念・本編の隊を保って帰還 OK',flush=True)

    # 盤面からの断念も維持し、街と宿敵の再戦には誤適用しない。
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=board',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0 && __game.G.state==="board"')
    page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');const {_TUTS}=await import('/src/ui/tutorial.js');sheet.closeAll();__game.G.tut.cur=null;_TUTS.forEach(t=>__game.G.tut.done[t.key]=true);__game.G.insightNotified=Number.MAX_SAFE_INTEGER;}''')
    page.wait_for_function('''async()=>{const {uiBlocked}=await import('/src/ui/kit.js');return !uiBlocked()&&!__game.G.anim&&!__game.G.walking}''')
    dialog=open_confirm(fast=False);dialog.get_by_role('button',name='諦める',exact=True).click()
    page.wait_for_function('__game.G.state==="over"')
    assert page.evaluate('__game.G.run.abandoned')
    setup()
    page.evaluate('__game.G.rematch={}')
    page.locator('.dg-book').click()
    assert page.locator('.dg-menu .dg-mtile').filter(has_text='迷宮を諦める').is_disabled()
    assert not errors,errors
    print('盤面の断念を維持・宿敵の再戦では無効 OK',flush=True)
    browser.close()

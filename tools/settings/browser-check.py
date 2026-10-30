"""新規開始・再開の好みと装いの原画を実画面で確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/')
    page.evaluate("""() => {
      localStorage.setItem('dos-testlog', JSON.stringify({on:true,d:{}}));
      localStorage.setItem('dos-ui', JSON.stringify({autoKeep:true,chestAuto:true,autoCorpse:true,autoCloseResults:true,autoRest:true,sellUse:true,autoMoveAvoid:{foe:false,elite:false,event:true,chest:true}}));
      localStorage.setItem('dos-prefs', JSON.stringify({walkSpeed:4,bgm:0.3}));
    }""")
    page.reload()
    page.wait_for_function('window.__game && window.__game.G.tut')
    print(page.evaluate("""async () => {
      const {game}=await import('/src/ui/ctx.js'), P=await import('/src/ui/prefs.js');
      const check=(x,m)=>{if(!x)throw Error(m)};
      check(!localStorage.getItem('dos-testlog'),'廃止した集計の削除');
      for(const k of ['autoKeep','chestAuto','autoCorpse','autoCloseResults','autoRest','sellUse']) check(P.getPref(k)===false,k);
      check(JSON.stringify(P.autoMoveAvoid())===JSON.stringify({foe:true,elite:true,event:false,chest:false}),'避けるもの');
      check(!__game.G.fastAnim && game.PREFS.walkSpeed===1,'速さの初期値');
      check(game.PREFS.bgm===0.3,'音量を維持');
      __game.G.apprenticeName='確認'; __game.G.msq.granted=true;
      __game.G.fastAnim=true; game.PREFS.walkSpeed=3; game.savePrefs(); P.setPref('autoKeep',true);
      await __game.autosave(true);
      return '新規開始: 以前の端末設定にかかわらず自動化OFF・回避設定・倍速OFF・移動1倍 OK';
    }"""))
    page.reload();page.wait_for_function('window.__game && __game.G.apprenticeName === "確認"')
    assert page.evaluate("""async()=>{const {game}=await import('/src/ui/ctx.js');const P=await import('/src/ui/prefs.js');return __game.G.fastAnim && game.PREFS.walkSpeed===3 && P.getPref('autoKeep');}""")
    # 通常の新規開始はここまで。試遊では設定の描画を確認する。
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate("__game.UI.settingsSheet()")
    page.get_by_role('tab',name='装い',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.stg-wk-prev canvas').length===4")
    assert page.locator('.stg-wk-prev canvas').first.evaluate('(c)=>c.width>100')
    page.screenshot(path='/tmp/dos-settings-look.png')
    page.get_by_role('tab',name='自動化・データ',exact=True).click()
    assert 'テスト記録' not in page.locator('.stg-sheet').inner_text().replace('\u200b','')
    assert not errors,errors
    print('再開時は選択を維持・装い4方向が原画・テスト記録の入口撤去 OK')
    browser.close()

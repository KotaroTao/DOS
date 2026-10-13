"""商会の初回帰還・保存・再発防止と、購入困難時の進行を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {refSerialize, refDeserialize} = await import('/src/savegraph.js');
      const G = game.G, out = [];
      const check = (ok, msg) => { if (!ok) throw Error(msg); out.push(msg); };
      G.soulPts = 0; G.testPlay = false; G.msq.prologue = {phase:'crypt', gifts:{}};
      G.tut = {done:{repairSoul:true}}; G.prompt = false;
      G.party.forEach(d => { d.items = []; d.alive = true; });
      G.reserve = [];
      check(!UI.tutorialAfterReturn(), '未鑑定品がなければ始まらない');
      const it = __game.equipLv.cloneItem('shortSword', 50); it.unidentified = true;
      G.party[0].items.push(it);
      check(UI.tutorialAfterReturn(), '初回の未鑑定品で帰還案内を開始');
      check(!G.tut.cur && G.town.tab === 'hub' && UI.tutorialPending()?.arrival, '帰還後は街で商会への訪問を待つ');
      const saved = refDeserialize(refSerialize(G.tut));
      check(!saved.cur && saved.appraisePending, '商会への訪問待ちは保存される');
      G.tut = saved;
      return out;
    }'''))
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    page.wait_for_timeout(900)
    assert page.locator('.tut-intro').count() == 0
    assert page.evaluate('__game.G.town.tab') == 'hub'
    page.locator('.ui-tab[data-key="shop"].tut-glow').click()
    page.locator('.tut-intro').wait_for()
    assert page.evaluate('__game.G.tut.cur') == 'shopAppraise'
    for _ in range(20):
        page.wait_for_timeout(450)
        if page.evaluate('__game.G.tut.done.shopAppraise'): break
        glow = page.locator('.tut-glow:visible')
        if glow.count(): glow.first.click()
    assert page.evaluate('__game.G.tut.done.shopAppraise')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      if (UI.tutorialAfterReturn()) throw Error('再帰還で鑑定案内が再発した');
      game.G.gold = 0;
      if (!UI.tutorialPurchaseBlock()) throw Error('金貨不足の救済なし');
      game.G.gold = 500; game.G.shopStock = {};
      if (!UI.tutorialPurchaseBlock()) throw Error('売り切れの救済なし');
      return '鑑定案内は一度だけ。金貨不足・売り切れでも購入案内は詰まらない';
    }'''))
    assert not errors, errors
    page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    page.evaluate("""async () => {
      const {game,UI}=await import('/src/ui/ctx.js');
      const G=game.G;
      G.testPlay=false; G.prompt=false;
      G.tut={done:{repairSoul:true}};
      G.msq.prologue={phase:'cryptQuest',gifts:{}}; G.gold=0;
      delete G.world.open.w01;
      // 王の語りが閉じた時と同じ本番コールバックを実行する。
      UI.playStoryChain=(pages,done)=>{for(const p of pages){p.enter?.();p.leave?.();}done?.();};
      __game.world.prologueAudience();
    }""")
    page.wait_for_timeout(1000)
    assert page.evaluate('__game.G.gold') == 500
    assert page.evaluate('__game.G.town.tab') == 'hub'
    assert page.locator('.tut-intro').count() == 0
    assert not page.evaluate('__game.G.world.open.w01')
    page.locator('.ui-tab[data-key="shop"].tut-glow').click()
    page.locator('.tut-intro').wait_for()
    assert page.evaluate('__game.G.tut.cur') == 'buyEquipment'
    for _ in range(25):
        page.wait_for_timeout(450)
        if page.evaluate('__game.G.tut.done.buyEquipment'): break
        glow = page.locator('.tut-glow:visible')
        if glow.count(): glow.first.click()
    assert page.evaluate('__game.G.tut.done.buyEquipment && __game.G.world.open.w01 && __game.G.gold < 500')
    assert not errors, errors
    print('王の金貨受領 → 街で待機 → フッターの商会 → 説明・実購入 → 地下墓地解放')
    browser.close()

"""商会に売った収集品の単品・一括奉納と在庫・金貨を実画面で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.wait_for_timeout(1500)
    page.evaluate('''async () => {
      const {game, ops, UI} = await import('/src/ui/ctx.js');
      const {ITEMS} = await import('/src/items.js');
      const {sheet} = await import('/src/ui/kit.js');
      sheet.closeAll();
      const g = game.G;
      g.insightNotified = 1e9;
      g.inventory.length = 0; g.shopStock = {}; g.treasury = {donated:{}, claimed:{}, fresh:{}};
      const ids = Object.keys(ITEMS).filter(id => ITEMS[id].slot === 'misc');
      window.testIds = ids.slice(0, 4);
      // 実際の売却処理で棚へ送る。
      const sold = game.cloneItem(ids[0]); g.inventory.push(sold);
      game.sellItem(g.party[0], sold, game.sellPrice(sold));
      g.gold = 0;
      if (g.inventory.length || g.shopStock[ids[0]] !== 1) throw Error('売却');
      const list = ops.donatableList();
      if (list.length !== 1 || list[0].doll || list[0].dup || ops.counts().donatable !== 1) throw Error('候補と提案');
      UI.openPalace('treasury');
    }''')
    page.locator('.pl-tr-strip button').first.click()
    page.get_by_text('商会の棚から奉納する', exact=True).wait_for()
    page.locator('[data-act=donate]').click()
    assert page.evaluate('''() => {
      const g = __game.G, id = testIds[0];
      return g.shopStock[id] === 0 && g.treasury.donated[id] && g.treasury.fresh[id] && g.gold === 0 && !g.inventory.length;
    }''')
    print('売却→宝物庫で選択→単品奉納: 金貨0・袋を経由せず在庫消費', flush=True)

    page.evaluate('''async () => {
      const {game, ops} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      sheet.closeAll(); const g = game.G, [a,b,c,d] = testIds;
      g.treasury = {donated:{[a]:true}, claimed:{}, fresh:{}};
      g.shopStock = {[a]:2,[b]:3,[c]:2,[d]:0,dagger:1};
      g.inventory.length = 0;
      // 手持ちの重複品は従来どおり金貨に。棚の同種は残す。
      g.inventory.push(game.cloneItem(c), game.cloneItem(c), game.cloneItem(a));
      const list = ops.donatableList();
      if (list.length !== 4 || list.filter(x=>!x.dup).length !== 2 || list.filter(x=>!x.doll).length !== 1) throw Error('種類の重複');
      window.expectedGold = list.reduce((n,x)=>n+x.gold,0);
      const {donateSheet} = await import('/src/ui/palace.js'); donateSheet();
    }''')
    page.get_by_text('台帳に記される ・ 商会の棚', exact=True).wait_for()
    page.get_by_role('button', name='奉納する', exact=True).click()
    assert page.evaluate('''() => {
      const g=__game.G, [a,b,c,d]=testIds;
      return g.shopStock[a]===2 && g.shopStock[b]===2 && g.shopStock[c]===2 && g.shopStock[d]===0 &&
        g.shopStock.dagger===1 && g.treasury.donated[b] && g.treasury.donated[c] &&
        g.gold===expectedGold && !g.inventory.length;
    }''')
    print('一括奉納: 棚は新種を1点だけ消費、手持ち優先・奉納済み在庫保持・重複の金貨維持', flush=True)

    page.evaluate('''async () => {
      const {game, ops} = await import('/src/ui/ctx.js');
      const [a,b,c,d]=testIds, g=game.G;
      const gold=g.gold;
      if (ops.donatableList().length || ops.donateOne(null, game.cloneItem(b)).ok) throw Error('奉納済み再消費');
      if (ops.donateOne(null, game.cloneItem(d)).ok || ops.donateOne(null, game.cloneItem('dagger')).ok) throw Error('対象外');
      delete g.treasury.donated[b]; g.shopStock[b]=1;
      const stale=ops.donatableList()[0]; g.shopStock[b]=0;
      if (ops.donateOne(null, stale.item).ok || g.treasury.donated[b]) throw Error('在庫消失');
      g.shopStock[b]=1; g.state='dungeon';
      if (ops.donateOne(null, stale.item).ok || g.shopStock[b]!==1 || g.gold!==gold) throw Error('街以外');
      g.state='town';
      if (game.sellWarnings(stale.item).some(t=>t.includes('奉納できなく'))) throw Error('売却警告');
    }''')
    print('奉納済み・在庫なし・装備・古い候補・街以外の操作を拒否', flush=True)
    assert not errors, errors
    browser.close()

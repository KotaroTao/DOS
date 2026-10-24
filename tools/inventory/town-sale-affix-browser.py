"""街の一括売却後、棚の特性選択を待たせない。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    # テスト開始時の解放通知が開き終わってから、各検査の画面を準備する。
    page.wait_for_timeout(1500)

    def prepare():
        page.evaluate('''async () => {
          const {game, ops} = await import('/src/ui/ctx.js');
          const {sheet} = await import('/src/ui/kit.js');
          sheet.closeAll();
          const g = game.G;
          // 作った品の図鑑登録による見識通知は、売却の検査から外す。
          g.insightNotified = 1e9;
          g.shopStock = {dagger: 1}; g.shopAfx = {dagger: [{k:'A03', v:30}]};
          g.shopAfxDepth = {}; g.shopAfxPending = []; g.inventory.length = 0;
          for (let i = 0; i < 2; i++) {
            const it = game.cloneItem('dagger');
            it.afx = [{k:'A03', v:40+i}]; it.unidentified = false;
            g.inventory.push(it);
          }
          window.saleBefore = {gold:g.gold, price:ops.junkList().reduce((n,x)=>n+x.price,0)};
        }''')

    for subset in (False, True):
        prepare()
        # 帰還の報告や鑑定結果を開いたまま売る経路。subset は候補の一部だけ売る。
        result = page.evaluate('''async (subset) => {
          const {game, ops, UI} = await import('/src/ui/ctx.js');
          const {sheet, topSheet} = await import('/src/ui/kit.js');
          const {sellJunk} = await import('/src/ui/shop.js');
          const parent = sheet.open({title:'売却元の結果'});
          const list = ops.junkList();
          const expected = subset ? list[0].price : saleBefore.price;
          const start = performance.now();
          const r = subset ? sellJunk(list.slice(0,1)) : ops.sellJunkAll();
          const elapsed = performance.now()-start;
          if (!r.ok || r.gold !== expected || game.G.gold !== saleBefore.gold+expected) throw Error('売却額');
          if (parent.closed || topSheet().opts.title !== '追加の能力つきの品が重なった') throw Error('売却直後に開かない');
          const top = topSheet(); UI.queueAfxConflicts(); UI.openAfxConflicts();
          if (topSheet() !== top) throw Error('二重表示');
          return {elapsed, sold:r.n};
        }''', subset)
        page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).click()
        page.wait_for_function('!__game.G.shopAfxPending.length')
        assert page.evaluate('__game.G.shopAfx.dagger[0].v === ' + ('40' if subset else '41'))
        print(f'一括売却（部分={subset}）: {result}、元画面を保って即表示・選択結果保存', flush=True)

    prepare()
    page.evaluate('''async () => {
      const {confirmSellJunk} = await import('/src/ui/shop.js');
      confirmSellJunk();
    }''')
    toggle = page.locator('.wpc-toggle')
    if toggle.count():
        toggle.click()
    page.get_by_role('button', name='売る', exact=True).click()
    page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).wait_for(timeout=2000)
    assert page.evaluate('__game.G.inventory.length === 0 && __game.G.gold === saleBefore.gold+saleBefore.price')
    page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).click()
    page.wait_for_function('!__game.G.shopAfxPending.length')
    print('「まとめて売る」の確認画面からも売却直後に表示', flush=True)

    prepare()
    # 売却以外（帰還など）の自動通知も、シート中に予約したら閉じた後に開く。
    page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      game.G.shopAfxPending = [{id:'dagger', afx:[{k:'A03',v:40}]}];
      window.blocker = sheet.open({title:'別の確認'});
      UI.queueAfxConflicts(); UI.queueAfxConflicts();
    }''')
    page.wait_for_timeout(250)
    assert page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).count() == 0
    page.evaluate('blocker.close()')
    page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).wait_for(timeout=2000)
    page.wait_for_timeout(250)
    assert page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).count() == 1
    page.get_by_role('button', name='選んだ方を棚に置いておく', exact=True).click()
    page.wait_for_function('!__game.G.shopAfxPending.length')
    print('別のシートで見送った通知も、閉じた後に一度だけ表示', flush=True)
    assert not errors, errors
    browser.close()

"""見識増加のアラートを街・探索・戦闘で確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {EVENT_MAP} = await import('/src/events.js');
      const {MONSTERS} = await import('/src/sprites.js');
      const {refDeserialize} = await import('/src/savegraph.js');
      const {G, autosave} = __game;
      const out = [], check = (v, m) => { if (!v) throw Error(m); out.push(m); };
      const tick = () => new Promise(r => setTimeout(r, 30));
      const alerts = () => [...document.querySelectorAll('.ui-sheet')]
        .filter(e => e.querySelector('.ui-sheet-banner')?.textContent.replaceAll('\\u200b', '').includes('操霊師の見識'));
      const text = e => e.textContent.replaceAll('\\u200b', '');
      sheet.closeAll(); G.testUnlock = [];
      delete G.world.cleared.w02; delete G.world.reported.w02;
      G.insightNotified = null; autosave(true); await tick();
      check(!alerts().length && G.insightNotified === null, '解放前は通知しない');
      G.world.cleared.w02 = 1; autosave(true); await tick();
      check(!alerts().length && G.insightNotified === game.insightSummary().total, '旧記録の初回集計では通知しない');
      async function increase(change, state, label) {
        const before = game.insightSummary().total;
        G.state = state;
        if (state === 'board') __game.autoMove.setAutoMove(true);
        change();
        const after = game.insightSummary().total;
        autosave(true);
        const under = sheet.open({title: '入手結果'});
        await tick();
        const a = alerts();
        check(after > before && a.length === 1 && text(a[0]).includes(`見識 ＋${after-before}`)
          && text(a[0]).includes(after.toLocaleString('ja-JP')), label);
        check(document.querySelectorAll('.ui-sheet')[document.querySelectorAll('.ui-sheet').length-1] === a[0], '入手シートより前面に表示');
        if (state === 'board') check(!G.autoMove, '見識増加でオート移動を停止');
        autosave(true); await tick(); check(alerts().length === 1, '再保存で重複通知しない');
        a[0].querySelector('.ui-sheet-foot button').click();
        await new Promise(r => setTimeout(r, 250));
        check(!alerts().length && under.el.isConnected, '確認で閉じ、元のシートへ戻る');
        sheet.closeAll();
      }
      const items = Object.keys(__game.equipLv.ITEMS).filter(k => !G.codex.item[k]);
      await increase(() => { G.codex.item[items[0]] = true; }, 'town', '街で品の発見をアラート表示');
      await increase(() => {
        G.codex.item[items[1]] = true; autosave(true);
        G.codex.item[items[2]] = true;
      }, 'board', '同じ処理内の複数増加を合算');
      const mon = Object.keys(MONSTERS).find(k => !k.startsWith('ev_') && !G.codex.mon[k]);
      await increase(() => { G.codex.mon[mon] = {kills:10}; }, 'combat', '戦闘中の魔物の開示も通知');
      await increase(() => { G.codex.job.sera = {rank:5, lv:1}; }, 'town', '職業ランクによる増加も通知');
      const ev = Object.keys(EVENT_MAP).find(k => !G.events.seen[k]);
      await increase(() => { G.events.seen[ev] = 1; }, 'board', '出来事による増加も通知');
      check(refDeserialize(JSON.parse(__game.inf.saveJSON())).insightNotified === game.insightSummary().total, '通知済みの合計を保存');
      return out;
    }'''))
    assert not errors, errors
    browser.close()

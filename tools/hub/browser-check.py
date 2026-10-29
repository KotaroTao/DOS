"""localhost:8000で街の目標・次の行動の表示とタップを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async () => {
      const {UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      sheet.closeAll();
      window.hubTaps = [];
      // 3件の提案と帰還の報告が同時に出る、最も混み合う状態。
      for (let i = 0; i < 3; i++) UI.registerSuggestion(() => ({
        key: 'hub-check-' + i, prio: -100 + i, label: ['宿で休む','鑑定する','最適装備'][i],
        sub: '手負いの人業 5', cost: {kind: 'gold', n: 123456},
        run: () => window.hubTaps.push(i)
      }));
      UI.runReportBadge = () => ({banner: '生還の報告', where: '亡骸の囁く回廊'});
      UI.openRunReport = () => window.hubTaps.push('report');
      UI.shell.setTab('hub');
    }''')
    page.wait_for_timeout(800)
    for width, height in [(320, 480), (375, 550), (390, 664), (390, 844), (768, 1024)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(350)
        page.evaluate('''() => {
          if (document.querySelector('.hb-party')) throw Error('隊の常設表示が残っている');
          const panel = document.querySelector('.hb-actions').getBoundingClientRect();
          const hub = document.querySelector('.hb').getBoundingClientRect();
          if (panel.top < 0 || panel.bottom > hub.bottom + 1) throw Error('行動パネルが画面外');
          for (const b of document.querySelectorAll('.hb-actions button, .hb-fac-first button, .hb-hero .hb-rr')) {
            const r = b.getBoundingClientRect();
            if (r.x < 0 || r.right > innerWidth || r.height < 43.99 || r.bottom > hub.bottom + 1) throw Error('操作領域が不足 ' + b.className + ' ' + JSON.stringify(r));
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            if (!b.contains(hit)) throw Error('ボタンが隠れている');
          }
          const hero = document.querySelector('.hb-hero').getBoundingClientRect();
          const report = document.querySelector('.hb-rr').getBoundingClientRect();
          if (report.bottom > hero.bottom || hero.bottom - report.bottom > 8 || hero.right - report.right > 10)
            throw Error('報告が街の右下に収まっていない');
          const scroller = document.querySelector('.hb');
          scroller.scrollTop = scroller.scrollHeight;
          if (scroller.scrollHeight > scroller.clientHeight + 1 && (scroller.scrollTop <= 0 || document.querySelector('.hb-actions').getBoundingClientRect().top >= panel.top))
            throw Error('街全体をスクロールできない');
          const last = document.querySelector('.jr-shortcuts').getBoundingClientRect();
          if (last.bottom > hub.bottom + 1) throw Error('末尾の手引きまで進めない');
          scroller.scrollTop = 0;
        }''')
        # scrollIntoViewを使わず、現在画面に見えている座標を実際にタップする。
        for selector in ['.hb-sug:nth-child(1)', '.hb-sug:nth-child(2)', '.hb-sug:nth-child(3)', '.hb-hero .hb-rr']:
            rect = page.locator(selector).bounding_box()
            page.mouse.click(rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2)
        assert page.evaluate('window.hubTaps.splice(0)') == [0, 1, 2, 'report']
        page.screenshot(path=f'/tmp/hub-fac-{width}.png')
        print(f'{width}×{height}: 目標・提案3件・施設3件・報告の可視性と操作 OK')
    page.evaluate('''() => {
      const mid = document.querySelector('.hb-mid');
      for (let i = 0; i < 4; i++) {
        const banner = document.createElement('div');
        banner.style.height = '90px'; banner.textContent = '追加バナー';
        mid.prepend(banner);
      }
      const hub = document.querySelector('.hb');
      hub.scrollTop = hub.scrollHeight;
      if (document.querySelector('.jr-shortcuts').getBoundingClientRect().bottom > hub.getBoundingClientRect().bottom + 1)
        throw Error('バナー追加後に末尾まで進めない');
      hub.scrollTop = 0;
    }''')
    page.locator('.hb-goal-go').click()
    page.wait_for_timeout(400)
    assert page.locator('.dp-sheet').count() or page.locator('.ui-sheet').count()
    # 本来の提案で宿泊まで進み、隊は館から開けることも確かめる。
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async () => {
      const {UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      sheet.closeAll();
      const g = __game.G;
      g.gold = 999999;
      for (const d of g.party) { d.hp = 1; d.mp = 0; }
      __game.renderTown();
      UI.shell.setTab('hub');
    }''')
    page.wait_for_timeout(800)
    page.locator('.hb-tile-inn').click()
    page.wait_for_timeout(400)
    assert page.evaluate('__game.G.party.every(d => d.hp === d.maxhp && d.mp === d.maxmp)')
    page.evaluate('''async () => {
      const {UI} = await import('/src/ui/ctx.js');
      UI.shell.setTab('party');
    }''')
    page.wait_for_function("!document.querySelector('.scene-hold')")
    assert not page.locator('.hb').count()
    print('宿泊による全員の回復・人業の館への移動 OK')
    assert not errors, errors
    browser.close()

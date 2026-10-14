"""踏破報告と重なっても、街の目標が手ほどきの行き先・現在の操作を示す。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testScene=tutorial:trainSoul')
    page.wait_for_function('window.__game?.G.testTutorial')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {_TUTS} = await import('/src/ui/tutorial.js');
      const {unphrase} = await import('/src/ui/phrase.js');
      const G = game.G, checks = [];
      const check = (ok, message) => { if (!ok) throw Error(message); };
      // 序章後の帰還で、初踏破の報告と手ほどきが重なった状態。
      G.msq = {n: 1, state: 'world', prologue: {phase: 'done'}};
      const w = game.worldState();
      w.open.w03 = true; w.cleared.w03 = true; w.report = 'w03';
      const verify = (d, started) => {
        const pending = UI.tutorialPending(), o = game.objectiveInfo();
        check(o.key === 'tut' && o.text === pending.text && o.kind === pending.facility,
          d.key + ': 手ほどきの行き先・操作が目標と一致');
        check(o.sub.includes(d.name) && o.act === (started ? '続ける' : '手ほどき'),
          d.key + ': 手ほどきの名前・続行ボタン');
        const root = document.createElement('div');
        UI.renderHub(root);
        check(unphrase(root.querySelector('.hb-goal-t').textContent) === pending.text,
          d.key + ': 街の札の表示');
      };
      for (const d of _TUTS) {
        G.testTutorial = d.key;
        G.tut = {done: {}, cur: null, step: 0, ev: {}, base: {}};
        G.town = {tab: 'hub', page: null, facility: null};
        verify(d, false);
        G.tut.cur = d.key;
        // 館・商会・酒場・門の各施設内で、すべての手順を確認。
        const facility = d.facility || (d.who === 'irene' ? 'party' : d.who);
        G.town.tab = facility === 'tavern' ? 'hub' : facility;
        G.town.page = facility === 'tavern' ? 'tavern' : null;
        for (let step = 0; step < d.steps.length; step++) {
          G.tut.step = step;
          verify(d, true);
          check(game.objectiveInfo().text === d.steps[step].text, d.key + ': 現在の手順');
        }
        G.tut.done[d.key] = true;
        check(game.objectiveInfo().key === 'report', d.key + ': 完了後は王への報告に戻る');
        check(w.report === 'w03', d.key + ': 報告待ちを保持');
        checks.push(d.key + ': 訪問待ち・全手順・完了後の報告を確認');
      }
      // 通常プレイの解放条件で発生した案内も同じ優先順位になる。
      G.testPlay = false;
      G.tut = {done: Object.fromEntries(_TUTS.filter(d => d.key !== 'trainSoul').map(d => [d.key, true])),
        cur: null, step: 0, ev: {}, base: {}, trainPending: true};
      G.town = {tab: 'hub', page: null, facility: null};
      verify(_TUTS.find(d => d.key === 'trainSoul'), false);
      G.tut.cur = 'trainSoul';
      verify(_TUTS.find(d => d.key === 'trainSoul'), true);
      G.tut.done.trainSoul = true;
      check(game.objectiveInfo().key === 'report', '通常プレイでも完了後は報告に戻る');
      checks.push('通常プレイ: 解放条件による手ほどきと報告の重複');
      return checks;
    }'''))
    assert not errors, errors
    browser.close()

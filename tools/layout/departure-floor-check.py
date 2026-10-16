"""localhost:8000で出撃時の最深階の初期選択・手動選択・迷宮切替を確認する。"""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      window.api = game; window.ui = UI;
      window.kit = await import('/src/ui/kit.js');
      kit.sheet.closeAll();
      game.G.irene.greeted = true; game.G.tut.cur = null;
      const {_TUTS} = await import('/src/ui/tutorial.js');
      _TUTS.forEach(t => game.G.tut.done[t.key] = true);
      game.G.msq.prologue = {phase: 'done', gifts: {}};
      // 到達済みの帰還魔法陣を用意し、解放・物語の誘導はこの検査から切り離す。
      game.worldOpenIdx = () => true;
      game.blockForReport = game.blockForTutorial = () => false;
      game.storyGoal = () => null;
      game.autosave = () => {};
      const w = game.worldState();
      const candidates = game.DUNGEONS.map((d, i) => {
        w.gates[d.id] = 10;
        return {i, floors: game.startFloorsOf(d)};
      });
      window.deep = candidates.find(d => d.floors.includes(11));
      window.middle = candidates.find(d => d.floors.includes(6) && !d.floors.includes(11));
      window.shallow = candidates.find(d => d.floors.length === 1);
      if (!deep || !middle || !shallow) throw Error('検査に必要な迷宮が無い');
      game.G.dungeonIdx = deep.i; game.G._departPre = true;
    }''')
    page.wait_for_timeout(500)
    page.evaluate('ui.openDeparture()')
    selected = page.locator('.dp-go-f[aria-checked="true"]')
    expect(selected).to_have_text('B11F')
    page.get_by_role('radio', name='B1F', exact=True).click()
    # 定期再描画でも手動で選び直した階は保つ。
    page.wait_for_timeout(5200)
    expect(selected).to_have_text('B1F')

    def choose(target):
        page.evaluate('''key => {
          const name = api.DUNGEONS[window[key].i].name;
          const gate = [...document.querySelectorAll('.dp-gate[role="radio"]')]
            .find(e => e.querySelector('.dp-gate-n').firstChild.textContent.replaceAll('\u200b', '') === name);
          if (!gate) throw Error('迷宮の札が無い: ' + name);
          gate.click();
        }''', target)

    choose('middle')
    expect(selected).to_have_text('B6F')
    choose('deep')
    expect(selected).to_have_text('B11F')
    choose('shallow')
    expect(page.locator('.dp-go-fl')).to_have_count(0)
    expect(page.locator('.dp-cta')).to_contain_text('B1F')
    choose('deep')
    expect(selected).to_have_text('B11F')
    page.get_by_role('radio', name='B6F', exact=True).click()
    expect(selected).to_have_text('B6F')
    page.evaluate('kit.sheet.closeAll()')
    page.wait_for_timeout(500)
    page.evaluate('ui.openDeparture()')
    expect(selected).to_have_text('B11F')
    # 出撃処理へ渡す開始階も、画面の選択と一致する。
    page.evaluate('''() => {
      api.G.dungeonBriefed = true; api.G.stabilityBriefed = true;
      api.departWoes = () => null;
      api.departNow = spec => { window.departed = spec; };
    }''')
    page.locator('.dp-cta').click()
    assert page.evaluate('departed.from') == 11
    assert page.evaluate('departed.idx === deep.i')
    assert not errors, errors
    print('最深階の初期選択・迷宮切替・B1Fのみ・手動選択の保持・再表示・出撃の開始階 OK')
    browser.close()

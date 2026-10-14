"""酒場の新規印が再描画・再入場・セーブ再開で残ることを確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const G = __game.G, checks = [];
      const check = (v, m) => { if (!v) throw Error(m); checks.push(m); };
      G.tut = {done: {tavern: true, rumor: true}};
      G.tavernHeard = {t_rumor: 1};
      G.tavernCrowd = ['t_notes', 'l_king', 't_rumor', 'c_beg', 'l_fort1'].map(id =>
        ({id, name: id, type: '旅人', line: '旧い台詞', kind: 'chat'}));
      UI.openTavern('talk');
      const count = () => document.querySelectorAll('.fc-voice-new').length;
      check(count() === 2, '未読の心得・言い伝えだけに新規印');
      check([...document.querySelectorAll('.fc-voice-new')].every(e => e.textContent === '新規'), '印の表記は新規');
      check(G.tavernCrowd[0].fresh && G.tavernCrowd[1].fresh, '印は保存対象に残る');
      check(!G.tavernHeard.c_beg && !G.tavernHeard.l_fort1, '雑談・未解放の話を記録しない');
      check(!document.querySelector('.fc-crowd').textContent.includes('旧い台詞'), '台詞は現在の台帳を使う');
      __game.renderTown();
      check(count() === 2, '再描画後も印が残る');
      UI.openTavern('board'); UI.openTavern('talk');
      check(count() === 2 && game.markTavernHeard() === 0, '再入場後も印が残り二重記録なし');
      localStorage.setItem('dos-save-v7', __game.inf.saveJSON());
      return checks;
    }'''))
    page.goto('http://localhost:8000/')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      UI.openTavern('talk');
      if (document.querySelectorAll('.fc-voice-new').length !== 2) throw Error('セーブ再開で印が消えた');
      game.rollTavernCrowd();
      if (__game.G.tavernCrowd.some(m => m.fresh)) throw Error('新しい顔ぶれに旧い印が残った');
      return ['通常セーブからの再開後も印が残る', '顔ぶれの入れ替えで印をリセット'];
    }'''))
    assert not errors, errors
    browser.close()

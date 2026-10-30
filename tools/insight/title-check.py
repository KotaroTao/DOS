"""手帳・設定の称号廃止と分単位のプレイ時間を確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {playerNameCard, formatPlayTime, refreshPlayTime} = await import('/src/ui/playername.js');
      const check = (ok, msg) => {if (!ok) throw Error(msg)};
      for (const [ms, text] of [[undefined,'0'],[59999,'0'],[60000,'1'],[119999,'1'],[7200000,'120']])
        check(formatPlayTime(ms) === `プレイ時間 ${text}分`, '分境界');
      const G = game.G; G.stats.playMs = 119999;
      const card = playerNameCard(); document.body.append(card);
      check(!card.querySelector('.player-name-label'), '上部ラベル削除');
      check(!card.querySelector('.player-name-title'), '称号削除');
      check(card.querySelector('.player-name-insight').firstChild.textContent === 'プレイ時間 1分', '見識の左');
      G.stats.playMs = 120000; refreshPlayTime();
      check(card.querySelector('.player-name-play-time').textContent === 'プレイ時間 2分', '表示更新');
      G.world.cleared.w02 = 1;
      const unlocked = playerNameCard();
      check(!unlocked.querySelector('.player-name-points').hidden, '見識表示');
      card.remove(); return '表示・分境界・更新 OK';
    }'''))
    assert not errors, errors
    browser.close()

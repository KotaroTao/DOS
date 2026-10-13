"""localhost:8000で迷宮の記録・盤面・操作欄が重ならないことを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''() => {
      for (let i = 1; i <= 12; i++) __game.evApi.log('記録の確認 ' + i);
    }''')
    for width, height in [(320, 480), (375, 550), (390, 664), (390, 844), (768, 1024), (390, 664)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(500)
        page.evaluate('''() => {
          const rect = id => document.getElementById(id).getBoundingClientRect();
          const log = rect('log'), hud = rect('hud'), party = rect('party');
          if (log.height < 94 || log.bottom > hud.bottom || log.bottom > party.top)
            throw Error('記録の高さ不足・隊との重なり');
          if (rect('hint').bottom > rect('app').bottom + 1) throw Error('操作欄が画面外');
          const rows = [...document.querySelectorAll('#log > div')].slice(-4);
          for (const row of rows) {
            const r = row.getBoundingClientRect();
            if (r.top < log.top || r.bottom > log.bottom) throw Error('最新4行が欠けている');
            if (getComputedStyle(row).opacity !== '1') throw Error('記録が暗い');
          }
          for (const id of ['view', 'log']) {
            const r = rect(id), e = document.getElementById(id);
            if (!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))
              throw Error(id + 'が操作できない');
          }
        }''')
        print(f'{width}x{height}: 記録4行・盤面・操作欄 OK')
    page.locator('#board-camera-tools button').first.click()
    page.wait_for_timeout(300)
    page.locator('#board-camera-tools button').last.click()
    page.locator('#log').click()
    page.locator('.dg-logsheet').wait_for(state='visible')
    assert '記録の確認' in page.locator('.dg-logsheet').inner_text().replace('\u200b', '')
    page.evaluate('''async () => {
      (await import('/src/ui/kit.js')).sheet.closeAll();
      const g = __game;
      g.startBattle(g.spawnBossEnemies(), null);
    }''')
    page.wait_for_timeout(1500)
    for width, height in [(375, 550), (390, 664), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(500)
        page.evaluate('''() => {
          const log = document.getElementById('log').getBoundingClientRect();
          const party = document.getElementById('party').getBoundingClientRect();
          const controls = document.getElementById('controls').getBoundingClientRect();
          if (log.height < 54 || log.bottom > party.top) throw Error('戦闘中の記録が重なる');
          if (controls.bottom > innerHeight + 1) throw Error('戦闘の操作欄が画面外');
        }''')
    assert not errors, errors
    print('記録の履歴・全体/現在地の切替・戦闘中の記録 OK')
    browser.close()

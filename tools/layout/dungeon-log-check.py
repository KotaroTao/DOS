"""localhost:8000で迷宮の記録・盤面・操作欄が重ならないことを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 664}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # 外部フォントの応答待ちで起動監視が発火しないよう、端末の代替書体を使う。
    page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
    # 検証用VMでは大量のES Modulesの取得が5秒を超えるため、起動監視だけ猶予を延ばす。
    def boot_page(route):
        response = route.fetch()
        route.fulfill(response=response, body=response.text().replace('}, 5000);', '}, 60000);'))
    page.route('http://localhost:8000/?testDungeon=*', boot_page)
    page.goto('http://localhost:8000/?testDungeon=w02')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.wait_for_timeout(2000)
    page.evaluate('''() => {
      for (let i = 1; i <= 12; i++) __game.evApi.log('記録の確認 ' + i);
    }''')
    for width, height in [(320, 480), (375, 550), (390, 664), (390, 844), (430, 932), (600, 760), (768, 1024), (1280, 900), (390, 664)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(500)
        page.evaluate('''() => {
          const rect = id => document.getElementById(id).getBoundingClientRect();
          const log = rect('log'), hud = rect('hud'), party = rect('party');
          const a = __game.autoMove, cell = a.cellRect(0, 0), size = a.viewSize();
          if (innerWidth <= 600) {
            const view = rect('view');
            const w = cell.w * view.width / size.VW, h = cell.h * view.height / size.VH;
            if (Math.abs(w - h) > 0.1) throw Error('マスが正方形ではない');
            const bar = rect('runbar');
            const app=document.getElementById('app');
            const buttons=[...document.querySelectorAll('#runbar button,#hint button')].filter(b=>b.getBoundingClientRect().height>0);
            const compact=buttons.map(b=>b.getBoundingClientRect().height);
            const before=rect('runbar').height+rect('hint').height;
            app.classList.add('measure-explore-buttons');
            const full=buttons.map(b=>b.getBoundingClientRect().height);
            const saved=rect('runbar').height+rect('hint').height-before;
            app.classList.remove('measure-explore-buttons');
            for(let i=0;i<buttons.length;i++) {
              if(Math.abs(compact[i]-full[i]*0.9)>0.1) throw Error('探索のボタンが0.9倍ではない');
              const r=buttons[i].getBoundingClientRect();
              if(!buttons[i].contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))
                throw Error('探索のボタンに触れない');
            }
            const partyExtra=parseFloat(app.style.getPropertyValue('--party-log-extra'))||0;
            if(saved<=0 || Math.abs(log.height-32.5-partyExtra-saved)>0.1)
              throw Error('探索ボタンを縮めた分が記録へ渡っていない');
            for (const button of document.querySelectorAll('#board-camera-tools button')) {
              const r = button.getBoundingClientRect();
              if (r.height < 39.5 || r.top < bar.top || r.bottom > bar.bottom || r.right > bar.right)
                throw Error('盤面の表示ボタンが小さい・はみ出している');
            }
          }
          const desktop = getComputedStyle(document.getElementById('app')).display === 'grid';
          const overlap = desktop ? hud.top < party.bottom : log.bottom > party.top;
          const mobile = innerWidth <= 600;
          if ((mobile ? log.height < 32.4 : log.height < 94) || log.bottom > hud.bottom || overlap)
            throw Error('記録の高さ不足・隊との重なり');
          if (rect('hint').bottom > rect('app').bottom + 1) throw Error('操作欄が画面外');
          const rows = [...document.querySelectorAll('#log > div')].slice(innerWidth <= 600 ? -1 : -4);
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
        print(f'{width}x{height}: 記録の高さ・最新行・盤面・操作欄 OK')
    # 大きな数でもスマホのHP/MPは現在値だけの各1行。省いた高さは記録へ渡す。
    page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      for(const p of __game.G.party) {p.hp=p.mp=1234567;p.maxhp=p.maxmp=98765432;}
      game.renderParty();
    }''')
    page.wait_for_timeout(300)
    page.evaluate('''() => {
      const app=document.getElementById('app'),party=document.getElementById('party');
      const before=party.getBoundingClientRect().height;
      for(const n of party.querySelectorAll('.pc-num')) {
        if(n.innerText!=='123万' || getComputedStyle(n.querySelector('small')).display!=='none')
          throw Error('探索の最大値が表示されている');
        if(n.scrollWidth>n.clientWidth+1 || n.getBoundingClientRect().height>16)
          throw Error('探索のHP/MPが一行に収まらない');
      }
      party.classList.add('measure-vitals');
      const full=party.getBoundingClientRect().height;
      party.classList.remove('measure-vitals');
      const log=document.getElementById('log').getBoundingClientRect();
      if(full<=before || Math.abs(log.height-32.5-(parseFloat(app.style.getPropertyValue('--explore-button-log-extra'))||0)-(full-before))>1.1)
        throw Error('札を縮めた高さが記録へ渡っていない');
    }''')
    page.locator('#board-camera-tools button').first.click()
    page.wait_for_timeout(300)
    page.evaluate('''() => {
      const a = __game.autoMove, s = a.viewSize();
      const first = a.cellRect(0, 0), last = a.cellRect(__game.COLS-1, __game.ROWS-1);
      if (first.x < 0 || first.y < 0 || last.x+last.w > s.VW || last.y+last.h > s.VH)
        throw Error('全体表示で盤面が欠けている');
      if (document.getElementById('board-overview').getAttribute('aria-label') !== '現在地を拡大表示')
        throw Error('全体表示に切り替わらない');
    }''')
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
          if (log.height < 41 || log.bottom > party.top) throw Error('戦闘中の記録が重なる');
          const app = document.getElementById('app');
          if (controls.bottom > app.getBoundingClientRect().top + app.scrollHeight + 1)
            throw Error('戦闘の操作欄がスクロール範囲外');
        }''')
    assert not errors, errors
    print('記録の履歴・全体/現在地の切替・戦闘中の記録 OK')
    browser.close()

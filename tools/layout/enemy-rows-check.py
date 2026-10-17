"""localhost:8000で敵1〜6体の配置・表示切替・射程・長押しを確認する。"""
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
      const g = __game;
      g.G.autoCombat = false;
      g.startBattle(g.spawnCardEnemies('bs_drainrat', 1), null);
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating', timeout=30000)
    page.evaluate('''() => {
      window.enemySample = __game.G.battle.enemies[0];
      window.setEnemies = n => {
        const G = __game.G, b = G.battle;
        b.enemies = Array.from({length:n}, (_,i) => ({...enemySample, uid:9000+i,
          name:enemySample.mon.name+String.fromCharCode(65+i), alive:true, hp:enemySample.maxhp, effects:[]}));
        b.phase = 'input'; b.pending = null; b.result = null;
        b.current = G.party[0]; b.current.wRange = 'short';
        G._cmdStale = true;
      };
      window.battleSnapshot = () => {
        const G = __game.G, b = G.battle;
        return JSON.stringify({enemies:b.enemies, party:b.party, phase:b.phase, pending:b.pending,
          last:G._lastTargetUid, rng:G.rng, reach:b.attackableEnemies(b.current).map(e=>e.uid)},
          // 安定度の回復時計は戦闘の表示と無関係に5秒ごとに更新される。
          (key,value) => key === 'stabilityAt' ? undefined : value);
      };
    }''')
    for width, height in [(320, 480), (375, 550), (390, 664), (390, 844), (430, 932), (600, 700), (601, 700), (768, 1024), (1280, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        baseline = None
        for count in [1, 2, 3, 4, 5, 6]:
            page.evaluate('(n) => setEnemies(n)', count)
            page.wait_for_timeout(180)
            geometry = page.evaluate('''() => {
              const rect = id => document.getElementById(id).getBoundingClientRect();
              const view=rect('view'), log=rect('log'), party=rect('party'), controls=rect('controls');
              const {VW,VH} = __game.autoMove.viewSize();
              for (const e of __game.G.battle.enemies) {
                const p=__game.G.enemyPos[e.uid];
                if (!p || p.cx-p.hw < -1 || p.cx+p.hw > VW+1 || p.cy-p.hh < -1 || p.cy+p.hh > VH)
                  throw Error('敵の絵が戦場からはみ出す');
                if (innerWidth <= 600 && __game.G.battle.enemies.length <= 3) {
                  const widthLimit = VW / __game.G.battle.enemies.length - 24;
                  const heightLimit = VH - 44 - 12;
                  if (p.hw * 2 < widthLimit - 1 && p.hh * 2 < heightLimit - 1)
                    throw Error('敵の姿が列の幅・高さを使い切らず小さい');
                }
              }
              const app = document.getElementById('app');
              const minLog = innerWidth <= 600 ? 32.5 : 54;
              if (innerWidth <= 600 && Math.abs(log.height - minLog) > 0.1) throw Error('探索と戦闘の記録の高さが違う');
              const desktop = getComputedStyle(document.getElementById('app')).display === 'grid';
              const overlap = desktop ? rect('hud').top < party.bottom : log.bottom > party.top+1;
              if (log.height < minLog || overlap || controls.bottom > rect('app').top+app.scrollHeight+1)
                throw Error('記録・操作欄の重なり');
              return [view.height,log.y,log.height,party.y,controls.y];
            }''')
            if baseline is None:
                baseline = geometry
            extra = 0
            expected = [baseline[0], baseline[1]+extra, baseline[2]-extra, baseline[3], baseline[4]]
            assert all(abs(a-b) < 1 for a,b in zip(expected, geometry)), (width,height,count,expected,geometry)
            names = page.locator('#enemy-names')
            assert names.is_visible()
            assert names.locator('.enemy-name').count() == count
            assert '？' in names.inner_text(), '未判明の敵名が明かされた'
            page.evaluate('''() => {
              const bar=document.getElementById('enemy-names'), r=bar.getBoundingClientRect();
              for (const name of bar.querySelectorAll('.enemy-name')) {
                const range=document.createRange();range.selectNodeContents(name);
                for (const text of range.getClientRects())
                  if(text.top<r.top-1 || text.bottom>r.bottom+1) throw Error('敵名の文字が名前欄から欠ける');
              }
              if (innerWidth<=600 && getComputedStyle(bar).zIndex==='auto')
                throw Error('敵名が戦場の枠の影に隠れる');
            }''')
            if width <= 600:
                # 敵名の有無で座標・大きさ・戦場の高さを変えない。
                page.evaluate('''async () => {
                  const snapshot=()=>JSON.stringify({pos:__game.G.enemyPos,
                    view:document.getElementById('view').getBoundingClientRect().toJSON()});
                  const before=snapshot(),bar=document.getElementById('enemy-names');
                  if (bar.getBoundingClientRect().top < document.getElementById('view').getBoundingClientRect().bottom-1)
                    throw Error('敵名が敵の絵・HP・状態の領域に重なる');
                  bar.style.display='none';
                  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                  if (before!==snapshot()) throw Error('敵名表示の有無で敵の配置が変わる');
                  bar.style.removeProperty('display');
                }''')
            if width > 600:
                page.evaluate('''() => {
                  const bar=document.getElementById('enemy-names').getBoundingClientRect();
                  const view=document.getElementById('view').getBoundingClientRect();
                  const {VH}=__game.autoMove.viewSize();
                  if (Math.abs(bar.bottom-view.bottom)>1) throw Error('敵名が戦場の下端にない');
                  for (const pos of Object.values(__game.G.enemyPos))
                    if (view.top+(pos.cy+pos.hh)*view.height/VH > bar.top)
                      throw Error('敵の絵と名前が重なる');
                }''')
            button = page.locator('#enemy-row-toggle')
            assert button.is_visible() == (count > 3 and width <= 600)
            if count > 3 and width <= 600:
                page.evaluate('window.beforeRows = battleSnapshot()')
                page.evaluate('''() => {
                  const r=document.getElementById('enemy-row-toggle').getBoundingClientRect();
                  const v=document.getElementById('view').getBoundingClientRect();
                  if(r.height<44 || r.bottom>v.bottom || r.right>v.right) throw Error('表示ボタンの位置・大きさ');
                }''')
                button.click()
                page.wait_for_timeout(80)
                assert page.evaluate('beforeRows === battleSnapshot()'), page.evaluate('''() => {
                  const a=JSON.parse(beforeRows),b=JSON.parse(battleSnapshot()),out=[];
                  const walk=(x,y,path)=>{if(JSON.stringify(x)===JSON.stringify(y))return;
                    if(x && y && typeof x==='object' && typeof y==='object') for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],path+'.'+k);
                    else out.push([path,x,y]);};walk(a,b,'戦闘状態');return out;
                }''')
                assert page.evaluate('!__game.G.enemyPos[9003].distant && __game.G.enemyPos[9000].distant')
                button.click()
        print(f'{width}x{height}: 1〜6体の外側の配置が一致・前後切替・射程と乱数維持 OK')
        page.locator('#controls .cmd-main button').first.scroll_into_view_if_needed()
        page.evaluate('''() => {
          const b = document.querySelector('#controls .cmd-main button'), r = b.getBoundingClientRect();
          if (r.height < 44 || r.top < 0 || r.bottom > innerHeight || !b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))
            throw Error('戦闘の操作ボタンに触れない');
          document.getElementById('app').scrollTop = 0;
        }''')

    page.set_viewport_size({'width':390,'height':664})
    page.evaluate('setEnemies(6)')
    page.wait_for_timeout(150)
    # 知らない敵の名を明かさず、同種の記号を保つ。長押しの後に攻撃しない。
    page.evaluate('''() => {
      delete __game.G.codex.mon[enemySample.key];
      window.beforeHold = battleSnapshot();
    }''')
    point = page.evaluate('''() => {
      const r=document.getElementById('view').getBoundingClientRect(), p=__game.G.enemyPos[9000];
      const {VW,VH}=__game.autoMove.viewSize();
      return {x:r.x+p.cx*r.width/VW,y:r.y+p.cy*r.height/VH};
    }''')
    page.mouse.move(point['x'], point['y'])
    page.mouse.down()
    page.wait_for_timeout(520)
    page.mouse.up()
    page.locator('.ui-sheet').last.wait_for(state='visible')
    assert '？' in page.locator('.ui-sheet').last.inner_text()
    assert page.evaluate('beforeHold === battleSnapshot()'), '長押しで攻撃された'
    page.evaluate('''async () => { (await import('/src/ui/kit.js')).sheet.closeAll(); }''')

    # 対象選択の途中でも対象候補とpendingを保持し、名前と照準を対応させる。
    page.evaluate('''() => {
      const G=__game.G,b=G.battle;
      G.codex.mon[enemySample.key]={kills:10};
      b.chooseAction('attack'); G._cmdStale=true;
    }''')
    page.locator('.tgt-enemy').first.wait_for(state='visible')
    page.locator('.tgt-enemy').first.focus()
    page.wait_for_timeout(100)
    assert 'A' in page.locator('#enemy-focus').inner_text()
    page.evaluate('window.beforeRows = battleSnapshot()')
    page.locator('#enemy-row-toggle').click()
    assert page.evaluate('beforeRows === battleSnapshot()')
    # 手前に表示した後列も、短射程なら攻撃できない。
    point = page.evaluate('''() => {
      const r=document.getElementById('view').getBoundingClientRect(),p=__game.G.enemyPos[9003];
      const {VW,VH}=__game.autoMove.viewSize();return {x:r.x+p.cx*r.width/VW,y:r.y+p.cy*r.height/VH};
    }''')
    page.mouse.click(point['x'],point['y'])
    assert page.evaluate('beforeRows === battleSnapshot()'), '表示切替で射程外の敵へ攻撃できた'
    assert '射程外' in page.locator('#log').inner_text().replace('\u200b','')
    # 描画に敵名を常設しない（選択名はDOMに出す）。
    page.evaluate('''() => {
      window.canvasText=[]; const ctx=document.getElementById('view').getContext('2d');
      const original=ctx.fillText.bind(ctx); ctx.fillText=(t,...args)=>{canvasText.push(t);original(t,...args);};
    }''')
    page.wait_for_timeout(180)
    assert page.evaluate('canvasText.length > 0 && !canvasText.some(t=>t.includes(enemySample.mon.name))')
    page.screenshot(path='/tmp/dos-enemy-rows.png')
    # 広い画面では演出中も既知名・呼び分けを残す。
    page.set_viewport_size({'width':1280,'height':900})
    page.evaluate('__game.G.animating=true')
    page.wait_for_timeout(180)
    assert page.locator('#enemy-names .enemy-name').count() == 6
    enemy_name_in_bar = page.locator('#enemy-names').inner_text().replace('\u200b','')
    assert page.evaluate('enemySample.mon.name') in enemy_name_in_bar
    assert 'A' in enemy_name_in_bar and 'F' in enemy_name_in_bar
    page.evaluate('__game.G.animating=false')
    page.set_viewport_size({'width':390,'height':664})
    page.wait_for_timeout(180)
    assert page.locator('#enemy-names').is_visible()
    assert page.locator('#enemy-names .enemy-name').count() == 6
    page.screenshot(path='/tmp/dos-enemy-names-mobile.png')
    # 前列全滅・後列だけ残った時は拡大表示へ。新しい戦闘では表示を初期化する。
    page.evaluate('''() => {
      const b=__game.G.battle;b.cancelTarget();b.enemies.slice(0,3).forEach(e=>{e.alive=false;e.hp=0});
      __game.G._cmdStale=true;
    }''')
    page.wait_for_timeout(180)
    assert not page.locator('#enemy-row-toggle').is_visible()
    assert page.evaluate('__game.G.battle.enemies.slice(3).every(e=>!__game.G.enemyPos[e.uid].distant && !__game.G.battle.isBackRow(e))')
    page.set_viewport_size({'width':1280,'height':900})
    page.wait_for_timeout(180)
    assert page.locator('#enemy-names .enemy-name').count() == 3
    assert 'A' not in page.locator('#enemy-names').inner_text()
    page.screenshot(path='/tmp/dos-enemy-names-desktop.png')
    page.set_viewport_size({'width':390,'height':664})
    page.evaluate('''() => {
      setEnemies(6); const G=__game.G;
      G.battle=Object.assign(Object.create(Object.getPrototypeOf(G.battle)),G.battle);
    }''')
    page.wait_for_timeout(180)
    assert page.evaluate('!__game.G.enemyPos[9000].distant && __game.G.enemyPos[9003].distant')
    page.evaluate('__game.G.animating=true')
    page.set_viewport_size({'width':391,'height':664})
    page.wait_for_timeout(150)
    assert page.locator('#enemy-row-toggle').is_disabled()
    assert not errors, errors
    print('未知名・長押し・対象選択・射程外拒否・前列全滅・次戦リセット・演出中の無効化 OK')
    browser.close()

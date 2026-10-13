"""8000番でゲームを配信し、選択ボタンから実際の演出・効果・乱数を確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(service_workers='block', viewport={'width':390,'height':844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testInf=1&testInfLv=10')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {SFX} = await import('/src/audio.js');
      const {reseedRng, rngState, random} = await import('/src/rng.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {G, ev:{evApi:A, runEvent}} = __game;
      const sounds = [], originals = {...SFX};
      for (const k of Object.keys(SFX)) SFX[k] = (...args) => { sounds.push(k); return originals[k](...args); };
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const result = [];
      const click = text => {
        const button = [...document.querySelectorAll('button')].reverse().find(b => b.textContent.replace(/\\u200b/g, '').startsWith(text));
        check(button, '選択肢がない: '+text); button.click();
      };
      const test = (id, text, sound, color, seed) => {
        sheet.closeAll(); G.prompt = false; G.state = 'board';
        document.querySelectorAll('.screen-flash').forEach(e => e.remove());
        const cell = {type:'event', evId:id, evSeen:true};
        runEvent(A, cell); reseedRng(seed); sounds.length = 0;
        click(text);
        check(cell.cleared, id + ': 未完了');
        check(sounds.filter(k=>k === sound).length === 1, id + ': 効果音 ' + sounds);
        check(document.querySelector('.screen-flash')?.style.background === color, id + ': 画面の光');
        result.push(id + ': ' + sound);
      };
      let good, bad;
      for(let seed=1;good==null||bad==null;seed++) { reseedRng(seed); if(random()<0.7) good??=seed; else bad??=seed; }
      let before = G.soulPts;
      test('inf_u19', '壁画に語りかける', 'itemget', 'rgb(128, 207, 255)', good);
      check(G.soulPts>before, '壁画の魂獲得');
      const actual = [...rngState()]; reseedRng(good); random(); random();
      check(JSON.stringify(actual)===JSON.stringify(rngState()), '演出が遊びの乱数を消費した');
      const mods = A.floorEv().mods.length;
      test('inf_u19', '壁画に語りかける', 'trap', 'rgb(138, 43, 146)', bad);
      check(A.floorEv().mods.length===mods+1 && A.floorEv().mods.at(-1).enemyMul===1.2, '壁画の呪い');
      test('inf_u19', '壁画を削り取る', 'itemget', 'rgb(255, 216, 74)', good);
      G.party[0].hp = 1;
      test('inf_c01', '腰を下ろして休む', 'heal', 'rgb(95, 184, 148)', good);
      check(G.party[0].hp>1, '回復');
      test('inf_c55', '刃を研ぐ', 'spell', 'rgb(192, 138, 255)', good);
      // 立ち去る時には結果の光を出さず、出来事を残す。
      document.querySelectorAll('.screen-flash').forEach(e=>e.remove());
      const cell={type:'event',evId:'inf_u19',evSeen:true};
      runEvent(A,cell); click('立ち去る');
      check(!cell.cleared && !document.querySelector('.screen-flash'), '立ち去る時の誤演出');
      return result;
    }'''))
    assert not errors, errors
    browser.close()

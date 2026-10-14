"""実際の出来事・見識・図鑑・保存で、立ち去りと実行を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390, 'height':844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=board&testUnlock=insight')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game,UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {refDeserialize} = await import('/src/savegraph.js');
      const {G,ev:{evApi:A,runEvent},autosave} = __game;
      const out=[], check=(v,m)=>{if(!v)throw Error(m);out.push(m);};
      const pause=()=>new Promise(r=>setTimeout(r,300));
      const click=label=>{
        const b=[...document.querySelectorAll('button')].reverse()
          .find(b=>b.textContent.replaceAll('\\u200b','').startsWith(label));
        check(b,'選択肢: '+label);b.click();
      };
      const alerts=()=>[...document.querySelectorAll('.ui-sheet-banner')]
        .filter(e=>e.textContent.replaceAll('\\u200b','').includes('操霊師の見識'));
      sheet.closeAll();G.prompt=false;
      for(const id of ['c01','c28','c17']) {
        delete G.events.seen[id]; delete G.events.fresh[id]; delete G.events.picks[id];
      }
      G.insightNotified=null;autosave(true);
      const baseline=game.insightSummary().total, soul=G.soulPts;
      const cell=G.board.cells[G.py][G.px];
      Object.assign(cell,{type:'event',evId:'c01',cleared:false});
      delete cell.evSeen;delete cell.evVisited;
      runEvent(A,cell);autosave(true);await pause();
      check(!G.events.seen.c01&&!G.events.fresh.c01&&G.soulPts===soul,'踏むだけでは図鑑・初回報酬なし');
      check(game.insightSummary().total===baseline&&!alerts().length,'踏むだけでは見識・通知なし');
      click('立ち去る');await pause();
      check(!cell.cleared&&cell.evVisited&&!cell.evSeen,'立ち去っても再実行でき、訪問の印だけ残る');
      const snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      const saved=snap.board.cells[G.py][G.px];
      check(saved.evVisited&&!saved.evSeen&&!snap.events.seen.c01,'保存にも立ち去った出来事の登録なし');
      UI.openPalace('codex:ev');await pause();
      check(![...document.querySelectorAll('.pl-card')].some(e=>e.textContent.includes('苔むした祭壇')),'立ち去った出来事を図鑑で開示しない');
      sheet.closeAll();G.prompt=false;G.state='board';
      runEvent(A,cell);click('祈るだけ');await pause();
      check(G.events.seen.c01===1&&G.events.fresh.c01&&cell.evSeen,'実行して初めて図鑑・回数・新着に記録');
      check(game.insightSummary().total===baseline+1&&alerts().length===1,'実行時に見識を加算・通知');
      sheet.closeAll();G.prompt=false;
      const repeated=G.soulPts;A.seen(__game.ev.EVENT_MAP.c01,cell);
      check(G.events.seen.c01===1&&G.soulPts===repeated,'同じマスは二重に登録・報酬付与しない');
      const cancel={type:'event',evId:'c28'};
      runEvent(A,cancel);click('石を落として去る');await pause();
      check(cancel.cleared&&!G.events.seen.c28&&!G.events.picks.c28,'専用の立ち去り選択肢も図鑑・選択履歴に記録しない');
      sheet.closeAll();G.prompt=false;
      const merchant={type:'event',evId:'c17'};
      let opts;
      const capture={...A,choice:(_t,o)=>{opts=o;},giveItemId:(_id,next)=>next?.(),reopen:()=>{}};
      G.gold=1000000;
      runEvent(capture,merchant);opts.find(o=>o.label.startsWith('薬草を買う')).fn();
      runEvent(capture,merchant);opts.find(o=>o.label.startsWith('薬草を買う')).fn();
      check(G.events.seen.c17===1&&Object.values(G.events.picks.c17).reduce((a,b)=>a+b,0)===2,'繰り返せる取引はマス1回の登録・選択履歴2回');
      const final=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(final.events.seen.c01===1&&!final.events.seen.c28&&final.events.seen.c17===1,'実行済みの図鑑記録だけ保存');
      await pause();
      return out;
    }'''))
    assert not errors, errors
    browser.close()

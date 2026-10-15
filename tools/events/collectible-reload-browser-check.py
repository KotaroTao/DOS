"""収集品の入手直後・袋の整理中の再読み込みを実際のセーブで確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=board', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate("localStorage.setItem('dos-save-v7', __game.inf.saveJSON())")
    page.goto('http://localhost:8000/', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    setup = '''async (full) => {
      const {UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      sheet.closeAll();
      const {G,ev:{evApi:A,runEvent},autosave}=__game;
      G.state='board'; G.prompt=false;
      const cell=G.board.cells[G.py][G.px];
      Object.assign(cell,{type:'event',evId:'c12',cleared:false});
      delete cell.evCollectible;
      G.inventory.splice(0);
      if(full) G.inventory.push(...Array.from({length:50},()=>__game.inf.cloneItem('herb')));
      for(const m of G.party) m.items=G.inventory;
      autosave(true);
      runEvent(A,cell);
      const b=[...document.querySelectorAll('button')].reverse().find(b=>b.textContent.replaceAll('\\u200b','').startsWith('ろうを持ち帰る'));
      if(!b) throw Error('収集品の選択肢がない');
      b.click();
      return {pending:cell.evCollectible, count:new Set(G.party.flatMap(m=>m.items).filter(i=>i.slot==='misc')).size};
    }'''
    got = page.evaluate(setup, False)
    assert got['count'] == 1
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    assert page.evaluate('''() => {
      const {G}=__game,c=G.board.cells[G.py][G.px];
      return c.cleared&&!c.evCollectible&&new Set(G.party.flatMap(m=>m.items).filter(i=>i.slot==='misc')).size===1;
    }''')
    print('入手通知を閉じる前の再読み込み: 入手品と完了状態を保持 OK')
    pending = page.evaluate(setup, True)['pending']
    assert pending
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    assert page.evaluate('''async (id) => {
      const {UI}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js'); sheet.closeAll();
      const {G,ev:{evApi:A,runEvent}}=__game,c=G.board.cells[G.py][G.px];
      G.prompt=false;
      if(c.evCollectible!==id||c.cleared)throw Error('未受け取りの品が変化');
      const rng=JSON.stringify(G.rng), picks=JSON.stringify(G.events.picks), soul=G.soulPts;
      let incoming;
      UI.openDiscard=o=>{incoming=o.incoming.id;o.onSkip();};
      runEvent(A,c);
      return incoming===id&&JSON.stringify(G.rng)===rng&&JSON.stringify(G.events.picks)===picks&&G.soulPts===soul&&c.cleared&&!c.evCollectible;
    }''', pending)
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    assert page.evaluate('''() => {const {G}=__game,c=G.board.cells[G.py][G.px];return c.cleared&&!c.evCollectible;}''')
    print('袋の整理中の再読み込み: 同じ品で再開・選択と報酬の重複なし・置いていく判断も保存 OK')
    assert not errors, errors
    browser.close()

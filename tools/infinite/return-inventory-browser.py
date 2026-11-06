"""無限迷宮の戦闘応答後に断念・保護帰還しても本編の品を増殖させない。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for outcome in ['saved', 'ad', 'wipe', 'return']:
        page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town&testUnlock=infinite', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.evaluate('''async()=>{
          const {game}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          const {syncFormationItems}=await import('/src/formations.js');
          const {refSerialize,refDeserialize,applySavePatch}=await import('/src/savegraph.js');
          const g=game.G;sheet.closeAll();g.tut.cur=null;g.prompt=false;g.redSoul=100;
          _TUTS.forEach(t=>g.tut.done[t.key]=true);
          const bag=g.inventory;bag.splice(0,bag.length,...Array.from({length:50},()=>game.cloneItem('dagger')));
          g.formations=[{name:'検証の編成',members:g.party.map(d=>({uid:d.uid,equip:{...d.equip}}))}];
          syncFormationItems(g);
          window.homeExpected={bag,items:[...bag],party:g.party,formations:g.formations};
          if(!__game.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']))throw Error('出撃失敗');
          sheet.closeAll();g.prompt=false;g.anim=null;g.walking=false;
          window.loot=game.cloneItem('dagger');g.inventory.push(loot);
          // 旧サーバーの応答で保存編成が複製される状況を繰り返す。
          for(let n=0;n<24;n++){
            const snapshot=refDeserialize(refSerialize({party:g.party,reserve:g.reserve,inventory:g.inventory,formations:g.formations}));
            applySavePatch(g,{snapshot});syncFormationItems(g);
          }
          if(bag.length!==homeExpected.items.length)throw Error('戦闘応答で本編の袋が増殖した');
          window.shelfBefore=g.shopStock.dagger||0;
        }''')
        if outcome == 'return':
            page.evaluate("__game.inf.returnToTown({outcome:'return'})")
        else:
            page.locator('.dg-book').click()
            page.locator('.dg-menu .dg-mtile').filter(has_text='迷宮を諦める').click()
            page.locator('.ui-confirm').get_by_role('button', name='諦める', exact=True).click()
            page.wait_for_function('__game.G.state==="over"')
            buttons = page.locator('.rs-wipe-sheet .ui-sheet-foot button')
            if outcome == 'saved':
                page.locator('.rs-wipe-sheet .ui-sheet-foot button[aria-label^="赤い魂"]').click()
            elif outcome == 'ad':
                buttons.filter(has_text='広告視聴').click()
            else:
                buttons.filter(has_text='あきらめて街へ').click()
        page.wait_for_function('__game.G.state==="town"')
        assert page.evaluate('''outcome=>{
          const g=__game.G,h=homeExpected;
          return !g.abyss&&g.inventory===h.bag&&g.party===h.party&&g.formations[0]===h.formations[0]
            &&g.inventory.length===h.items.length&&g.inventory.every((it,i)=>it===h.items[i])
            &&g.party.every(d=>d.items===h.bag)&&!g.inventory.includes(loot)
            &&g.redSoul===(outcome==='saved'?80:100)
            &&(g.shopStock.dagger||0)===shelfBefore+(outcome==='wipe'?0:1);
        }''', outcome), outcome
        print(outcome+': 本編の袋・装備・保存編成を維持、戦利品は商会へ OK', flush=True)
    assert not errors, errors
    browser.close()

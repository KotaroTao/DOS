"""ローカルのゲームで共通袋・商会・保存・端末別レイアウトを確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=rusui,infinite')
    page.wait_for_function('window.__game?.G.party.length > 0')
    result = page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const shop = await import('/src/ui/shop.js');
      const items = await import('/src/items.js');
      const {skillTargets} = await import('/src/ui/appraise.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {refSerialize, refDeserialize} = await import('/src/savegraph.js');
      const G=__game.G, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      check([...G.party,...G.reserve].every(d=>d.items===G.inventory), '隊・控えの共通袋');
      G.inventory.length=0; G.gold=1000000;
      const id='dagger';
      for(let i=0;i<50;i++) check(!!game.giveItem(id), `取得${i+1}`);
      check(G.inventory.length===50&&!game.giveItem(id), '51個目の取得を停止');
      G.shopStock[id]=5;
      const gold=G.gold,stock=G.shopStock[id];
      check(!shop.shopBuy(id,G.party[1])&&G.gold===gold&&G.shopStock[id]===stock,'満杯の購入は金貨・在庫を変更しない');
      G.inventory.pop();
      check(shop.shopBuy(id,G.party[1])&&G.inventory.length===50,'空き1枠へ購入');
      for(const x of G.inventory)x.unidentified=false;
      const it=G.inventory[0], d=G.party[0]; d.equip.weapon=null;
      check(game.equipAt(d,it,'weapon',G.party[1]).ok&&G.inventory.length===49&&d.equip.weapon===it,'共通袋から別の隊員が装備');
      const newer=G.inventory[0];
      G.inventory.push(game.cloneItem(id));
      check(game.equipAt(d,newer,'weapon',G.party[1]).ok&&G.inventory.length===50&&G.inventory.includes(it),'50枠のまま装備交換');
      G.inventory.splice(0,G.inventory.length,game.cloneItem(id),game.cloneItem(id));
      for(const x of G.inventory)x.unidentified=true;
      check(shop.unidCount()===2&&__game.ops.counts().unid===2&&skillTargets().length===2,'鑑定対象を人数分に重複させない');
      for(const x of G.inventory)x.unidentified=false;
      check(__game.ops.junkList().length===2,'売却候補を人数分に重複させない');
      __game.UI.openDiscard({incoming:G.inventory[0],members:G.party});
      check(document.querySelectorAll('.dc-line').length===1,'装備する品を捨てる候補から除外');
      sheet.closeAll();
      const round=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(round.inventory===round.party[0].items&&round.inventory===round.reserve[0].items&&round.inventory.length===2,'セーブの共通参照');
      // 旧セーブの個別袋を実際の読み込み経路へ渡す。
      delete round.inventory;
      const old1=game.cloneItem(id),old2=game.cloneItem(id);old1.q=17;old1.locked=true;old2.q=89;old2.unidentified=true;
      round.party.forEach((d,i)=>d.items=i===0?[old1]:[]);
      round.reserve.forEach((d,i)=>d.items=i===0?[old2]:[]);
      localStorage.setItem('dos-save-v7',JSON.stringify(refSerialize(round)));
      // 無限迷宮では本編の袋と混ざらず、帰還で元の袋へ戻る。
      const home=G.inventory;
      sheet.closeAll();G.prompt=false;
      check(__game.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter'])!==false,'無限迷宮へ出撃');
      check(G.inventory!==home&&G.inventory.length===0&&G.abyss.home.inventory===home,'無限迷宮の共通袋を分離');
      __game.inf.returnToTown({outcome:'return'});
      check(G.inventory===home&&G.inventory.length===2,'帰還後に本編の袋を復元');
      return out.filter(x=>!/^取得/.test(x));
    }''')
    print('操作:', result)
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''() => {const g=__game.G;g.inventory.splice(0,g.inventory.length,...Array.from({length:50},()=>__game.equipLv.cloneItem('dagger')));__game.UI.openParty(0,{seg:'equip',inPlace:true});}''')
    for width,height in [(320,740),(390,844),(768,1024),(1024,768),(1440,900),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(120)
        layout=page.evaluate('''() => {
          const bag=document.querySelector('.pt-bag');
          const cells=[...bag.querySelectorAll('button')];
          return {count:cells.length,cols:getComputedStyle(bag).gridTemplateColumns.split(' ').length,
            overflow:document.documentElement.scrollWidth>innerWidth,
            scroll:bag.scrollHeight>bag.clientHeight,
            min:Math.min(...cells.map(x=>Math.min(x.clientWidth,x.clientHeight)))};
        }''')
        assert layout['count']==50 and not layout['overflow'] and layout['scroll'],layout
        assert layout['cols']==(8 if width>=1000 else 6 if width>=600 else 4),layout
        assert layout['min']>=44,layout
        page.locator('.pt-bag').evaluate('(bag)=>bag.scrollTop=bag.scrollHeight')
        page.locator('.pt-bag button').last.click()
        page.wait_for_function("document.querySelectorAll('.ui-sheet-wrap').length >= 2")
        page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.top()?.close();}''')
        print('表示:',width,height,layout)
    page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();__game.UI.openParty(0,{seg:'equip'});}''')
    for width,height in [(390,844),(768,1024),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(120)
        assert page.evaluate('''()=>!document.documentElement.scrollWidth || document.documentElement.scrollWidth<=innerWidth''')
        assert page.evaluate('''()=>Math.min(...[...document.querySelectorAll('.pt-bag button')].map(x=>x.clientWidth))>=44''')
    page.evaluate("__game.UI.openShop('sell')")
    page.wait_for_selector('.wpc-drow-tiles')
    assert page.locator('.wpc-drow').count()==1
    assert page.locator('.wpc-drow-tiles > *').count()==50
    print('館・商会: 横はみ出しなし・共通袋を一度だけ表示')
    page.goto('http://localhost:8000/')
    page.wait_for_function('window.__game?.G.inventory.length === 2')
    saved=page.evaluate('''() => ({shared:[...__game.G.party,...__game.G.reserve].every(d=>d.items===__game.G.inventory),q:__game.G.inventory.map(x=>x.q),locked:__game.G.inventory[0].locked,unid:__game.G.inventory[1].unidentified})''')
    assert saved['shared'] and saved['q']==[17,89] and saved['locked'] and saved['unid'],saved
    print('旧セーブ読み込み:',saved)
    assert not errors,errors
    browser.close()

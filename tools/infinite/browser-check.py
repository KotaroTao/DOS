"""実画面で補給の全経路・袋50個・記録を確認する (localhost:8000)。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=infinite')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {ITEMS}=await import('/src/items.js');
      const {rollStartSouls}=await import('/src/abyss.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {sheet}=await import('/src/ui/kit.js');
      const G=__game.G, inf=__game.inf, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      const picks=[],used=new Set();for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];picks.push(k);used.add(k);}
      const home=G.inventory;check(inf.enterAbyss(picks),'通常の1階開始');
      G.floor=5;G.abyss.depth=5;G.gold=1000000;inf.newFloor();
      const id=inf.infTraderWares().find(id=>ITEMS[id].use?.mp);
      check(!!id,'MP回復の購入対象');
      for(let i=0;i<3;i++)check(!!inf.infBuy(id),`補給${i+1}個目`);
      const gold=G.gold, held=G.inventory.length;
      check(!inf.infBuy(id)&&G.gold===gold&&G.inventory.length===held,'4個目は金貨も袋も変更しない');
      check(inf.infSupplyStatus().left===0,'補給を使い切った');
      const it=G.inventory[0];check(inf.infSell(G.party[0],it),'道具を売る');
      check(!inf.infBuy(id),'売却しても購入枠は戻らない');
      G.floor=10;G.abyss.depth=10;check(inf.infSupplyStatus().left===3,'次の風だまりは3個');
      G.floor=5;G.abyss.depth=5;check(inf.infSupplyStatus().left===0,'再訪しても枠は戻らない');
      const saved=refDeserialize(JSON.parse(inf.saveJSON()));
      check(saved.abyss.supplyBought[5]===3&&saved.inventory===saved.party[0].items,'購入枠と共有袋をセーブ');
      G.abyss.supplyBought=JSON.parse(JSON.stringify(saved.abyss.supplyBought));
      check(!inf.infBuy(id),'復元後も4個目は禁止');
      G.inventory.length=0;
      for(let i=0;i<50;i++)check(!!inf.giveItem(id),`道具の拾得${i+1}`);
      check(!inf.giveItem(id)&&G.inventory.length===50,'道具だけで50個持てるが51個は不可');
      G.floor=10;G.abyss.depth=10;
      const before=G.gold;
      check(!inf.infBuy(id)&&G.gold===before&&inf.infSupplyStatus().left===3,'満杯時に金貨や補給枠を消費しない');
      G.inventory.pop();check(!!inf.infBuy(id)&&G.inventory.length===50,'袋の空きへ購入');
      G.inventory.length=0;
      check(!!inf.infBuy('u_float_feather')&&inf.infSupplyStatus().left===2,'羽は購入数の対象外');
      check(!game.infHealAll&&!game.infHealPlan&&!inf.infHealAll,'全回復の実行口を削除');
      inf.openInfRest();
      const text=document.body.innerText.replace(/\\u200b/g,'');
      check(!text.includes('道具で全回復')&&text.includes('残り2/3個'),'風だまりの表示');
      sheet.closeAll();
      const mpItem=inf.infBuy(id);G.party[0].mp=0;
      game.useItem(G.party[0],G.inventory.indexOf(mpItem),G.party[0]);
      check(G.abyss.trk.supply.used===1,'個別使用を記録');
      const {MONSTERS}=await import('/src/sprites.js');
      const battleItem=inf.infBuy(id);G.party[0].mp=0;
      G.state='board';G.prompt=false;
      __game.startBattle(inf.spawnCardEnemies(Object.keys(MONSTERS).find(k=>k.startsWith('bs_')),1),{type:'enemy'});
      const battle=G.battle,res={hits:[]};
      battle._useItem(G.party[0],{item:battleItem,owner:G.party[0],target:G.party[0]},res);
      check(res.hits.length>0 && G.abyss.trk.supply.used===2,'戦闘中の回復と消費を記録');
      battle._useItem(G.party[0],{item:battleItem,owner:G.party[0],target:G.party[0]},{hits:[]});
      check(G.abyss.trk.supply.used===2,'道具なしの再使用は数えない');
      G.battle=null;G.state='board';G.prompt=false;
      check(home!==G.inventory,'本編の袋を分離');
      return out.filter(x=>!x.startsWith('道具の拾得'));
    }'''))
    page.evaluate("__game.G.abyss.guardFloor=__game.G.floor; __game.inf.openInfRest()")
    page.screenshot(path='/tmp/dos-infinite-supplies.png')
    # 帰還の確認を実際に押し、街へ戻った結果を確かめる。
    def click_text(text):
        page.evaluate("""text=>{const b=[...document.querySelectorAll('button')].reverse().find(b=>b.textContent.replace(/\\u200b/g,'').trim().startsWith(text));if(!b)throw Error('ボタンが無い:'+text);b.click();}""",text)
    click_text('帰る')
    page.wait_for_timeout(200)
    click_text('帰る')
    page.wait_for_timeout(200)
    page.wait_for_function('__game.G.state === "town" && !__game.G.abyss')
    print('帰還の実操作 OK')
    assert not errors, errors
    browser.close()

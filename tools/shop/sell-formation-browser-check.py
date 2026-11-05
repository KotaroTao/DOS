"""別編成の登録品を商会の一覧・点数・鑑定対象に混ぜない。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1280]:
        page = browser.new_page(viewport={'width': width, 'height': 960}, service_workers='block')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.locator('#studio-splash').wait_for(state='detached')
        print(page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const {ITEMS,shareInventory}=await import('/src/items.js');
          const {syncFormationItems}=await import('/src/formations.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          const g=game.G;g.tut.cur=null;_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.irene.greeted=true;g.insightNotified=Number.MAX_SAFE_INTEGER;g.gold=1000000;
          const id=Object.values(ITEMS).find(it=>it.slot==='weapon'&&!it.cursed&&it.price>0).id;
          const make=(name,unidentified=false)=>Object.assign(game.cloneItem(id,50),{name,unidentified,rar:'r'});
          const normal=make('通常の所持品'),unid=make('現在の隊の未鑑定品',true);
          const saved=make('別編成の登録品'),savedUnid=make('別編成の未鑑定品',true);
          const worn=make('控えの装備');
          g.inventory.splice(0,g.inventory.length,normal,unid,saved,savedUnid,worn);
          const reserve=game.allDolls().find(d=>g.reserve.includes(d))||g.party.pop();
          if(!g.reserve.includes(reserve))g.reserve.push(reserve);
          reserve.equip.weapon=worn;shareInventory(g);
          g.formations=[{name:'別の隊',members:[{uid:reserve.uid,equip:{weapon:saved,shield:savedUnid}}]}];
          syncFormationItems(g);
          window.shopScopeTest={normal,unid,saved,savedUnid,worn};
          UI.openShop('sell');return '商会に通常品・別編成の登録品・控えの装備を用意';
        }'''))
        page.wait_for_function("document.querySelector('#town-screen .wpc-list.sell:not(.scene-hold *)')")
        print(page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const shop=await import('/src/ui/shop.js'),appraise=await import('/src/ui/appraise.js');
          const {normal,unid,saved,savedUnid,worn}=shopScopeTest;
          const list=document.querySelector('#town-screen .wpc-list.sell:not(.scene-hold *)');
          const labels=[...list.querySelectorAll('.wpc-cell')].map(x=>x.getAttribute('aria-label'));
          if(labels.length!==2||!labels.some(x=>x.includes(normal.name))||!labels.some(x=>x.includes('未鑑定')))throw Error(JSON.stringify(labels));
          const root=list.closest('.wpc-shop')||document.querySelector('#town-screen');
          const text=root.textContent.replaceAll('\\u200b','');
          if(!text.includes('持ち物 2点')||!text.includes('2/50'))throw Error('表示件数不一致');
          if(shop.unidList().length!==1||shop.unidList()[0].item!==unid)throw Error('有料鑑定対象');
          if(appraise.skillTargets().length!==1||appraise.skillTargets()[0].item!==unid)throw Error('技の鑑定対象');
          const hidden=new Set([saved,savedUnid,worn]);
          if(shop.junkList({keepUpgrades:false}).some(x=>hidden.has(x.item)))throw Error('一括売却対象');
          if(Object.values(shop.exclusions().groups).flat().some(x=>hidden.has(x.item)))throw Error('除外内訳への混入');
          const result=shop.identifyAllAndReveal();
          if(result.n!==1||unid.unidentified||!savedUnid.unidentified)throw Error('隠れた品を鑑定');
          if(!game.G.inventory.includes(saved)||!game.G.inventory.includes(savedUnid)||reserveMissing())throw Error('所有品変更');
          const sold=shop.sellJunk(shop.junkList({keepUpgrades:false}));
          if(!sold.ok||sold.n!==2||!game.G.inventory.includes(saved)||!game.G.inventory.includes(savedUnid)||reserveMissing())throw Error('一括売却の対象不一致');
          const {syncFormationItems}=await import('/src/formations.js');
          game.G.formations=[];syncFormationItems(game.G);
          if(shop.unidList().length!==1||shop.unidList()[0].item!==savedUnid)throw Error('登録解除後に通常の袋へ戻らない');
          function reserveMissing(){return !game.G.reserve.some(d=>d.equip.weapon===worn)}
          return '一覧・点数・売却内訳・技/有料鑑定の対象と実行、別編成の実物保持 OK';
        }'''))
        assert not errors, errors
        print(width, 'OK')
        page.close()
    browser.close()

"""無限迷宮の深度品を実際の取得・商会・付呪・保存読込・表示で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
    page.route('https://**/*',lambda r:r.abort())
    page.set_default_timeout(120000)
    page.add_init_script('window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=infinite,enchant',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    result=page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js'),{ITEMS,itemAtQuality}=await import('/src/items.js');
      const X=await import('/src/infaffix.js');
      const {statLines,equipPreviewDelta,itemDetailEl}=await import('/src/ui/itemview.js');
      const {G,inf}=__game,out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg)};
      check(inf.enterAbyss(['fighter','priest','thief','mage','knight','hunter'])!==false,'無限迷宮へ出撃');
      G.floor=500;G.abyss.depth=500;G.state='board';
      const it=inf.markDungeonLoot(inf.cloneItem('dagger',50));
      check(it.depth===500&&it.afx.length&&!it.unidentified,'B500Fで深度と追加の能力を保存');
      const once=JSON.stringify(it);G.floor=1000;G.abyss.depth=1000;inf.markDungeonLoot(it);
      check(JSON.stringify(it)===once,'持ち歩いても既存品の深度・能力は変わらない');
      const crits=[{k:'A09',v:.037},{k:'A10',v:.23},{k:'A11',v:.019},{k:'A12',v:.17}];
      const deep=itemAtQuality({...it,afx:crits},50);
      G.shopAfx={};G.shopAfxDepth={};G.shopAfxPending=[];G.shopStock={};
      inf.shopReceive(deep);
      const shelf=inf.shopAfxItem('dagger');
      check(shelf.depth===500&&shelf.price===deep.price&&shelf.crit===.037&&shelf.spellCrit===.019,'売却の棚・再構築で深度、価格と会心を維持');
      const shallow=itemAtQuality({...it,depth:0,afx:crits},50);
      G.inventory.length=0;G.inventory.push(shallow);
      G.floor=1000;G.abyss.depth=1000;
      const plan=game.infSellPlan(),c=plan.conflicts.find(c=>c.id==='dagger');
      check(c&&c.best===0&&c.sets[0].depth===500&&c.sets[0].power>c.sets[1].power,'一括比較は深度込みで強い棚の品を選ぶ');
      shallow.depth=300;
      check(!game.infSellAll(plan),'比較後の深度変更で一括売却を中止');
      const deeper=itemAtQuality({...it,depth:1000,afx:crits},50);inf.shopReceive(deeper);
      const conflict=inf.afxConflicts().find(c=>c.id==='dagger');
      check(conflict.best===1&&conflict.sets[1].lines.some(s=>s.includes('1000')),'街の棚の比較に深度と総合評価を表示');
      inf.resolveAfxConflicts({dagger:1});check(inf.shopAfxItem('dagger').depth===1000,'選択した深度を棚に保存');
      G.gold=1e12;
      const bought=inf.buyAffixed('dagger',G.party[0]);
      check(bought?.depth===1000&&!G.shopAfxDepth.dagger,'買い戻した実物へ深度を渡す');
      // 全特性を消しても深度の本体性能を棚に残せる。
      const bare=itemAtQuality({...it,afx:[]},50);inf.shopReceive(bare);
      check(inf.shopAfxItem('dagger').depth===500,'特性を消した深度品の本体も棚へ保存');
      const text=statLines(deep);
      check(text.includes('3.7%')&&text.includes('1.9%')&&text.includes('23%')&&text.includes('17%')&&text.includes('500'),'会心の小数・4種・深度を品に表示');
      const wearer=G.party[0];wearer.equip.weapon=null;inf.recalcAllDolls();
      const delta=equipPreviewDelta(wearer,deep);
      check(delta.crit===3.7&&delta.critDamage===23&&delta.spellCrit===1.9&&delta.spellCritDamage===17,'装備比較で小数の会心と倍率の増減を保持');
      wearer.equip.weapon=deep;inf.recalcAllDolls();
      check(wearer.critDamageBonus===.23&&wearer.spellCritBonus===.019&&wearer.spellCritDamageBonus===.17,'装備効果の集計に会心4種を反映');
      G.state='town';G.abyss=null;G.inventory.push(deep);
      inf.shopReceive(deeper,'new');
      document.body.appendChild(itemDetailEl(deep));
      check(document.body.textContent.includes('魔法会心')&&document.body.textContent.includes('B500F'),'品の詳細で魔法会心と深度を確認');
      const snapshot=inf.saveJSON();
      return {out,snapshot,expected:{price:deep.price,atk:deep.atk,depth:deep.depth}};
    }''')
    print('\n'.join('OK '+s for s in result['out']),flush=True)
    # テストプレイから作った記録を、通常の読み込み経路で復元する。
    page.evaluate('(raw)=>localStorage.setItem("dos-save-v7",raw)',result['snapshot'])
    page.goto('http://localhost:8000/',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.loadGame')
    print(page.evaluate('''async expected=>{
      const {G,inf}=__game;
      if(!__game.loadGame())throw Error('通常の保存読込に失敗');
      const it=G.inventory.find(x=>x.id==='dagger'&&x.depth===500&&x.afx?.some(a=>a.k==='A12'));
      if(!it||it.price!==expected.price||it.atk!==expected.atk||it.spellCrit!==.019)throw Error('ロードで性能・価格・会心が変化');
      if(inf.shopAfxItem('dagger').depth!==1000)throw Error('ロードで棚の深度が消失');
      const once=it.price;if(!__game.loadGame())throw Error('再読み込み失敗');
      if(G.inventory.find(x=>x===G.party[0].equip.weapon)?.price!==once)throw Error('共有装備参照が失われた');
      return 'OK 通常の保存読込・二重読込・共有参照・棚の深度と会心を保持';
    }''',result['expected']),flush=True)
    assert not errors,errors
    browser.close()

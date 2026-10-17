"""追加つき装備の全迷宮への拡張と、保存編成の登録装備を持ち物欄から隠す。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r:r.abort())
    page.set_default_timeout(120000)
    page.add_init_script("window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout")
    errors = []
    page.on('pageerror', lambda e:errors.append(str(e)))

    def visit():
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length === 6')

    visit()
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');
      const {CHAPTERS}=await import('/src/story.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {G,inf}=__game, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg)};
      G.testUnlock=[];G.world.reported={};G.state='board';
      const plain=inf.markDungeonLoot(inf.cloneItem('dagger'));
      check(!game.featureUnlocked('infinite')&&!plain.afx&&plain.unidentified,'解放前の本編では付与しない');
      G.world.reported[CHAPTERS.find(c=>c.no===8).finale]=true;
      check(game.featureUnlocked('infinite'),'第八章の結びで無限迷宮解放');
      const stats=JSON.stringify(G.stats.inf||null);
      for(const [idx,cfg] of inf.DUNGEONS.entries()){
        G.dungeonIdx=idx;G.floor=cfg.floors||1;
        for(const state of ['board','combat']){
          G.state=state;
          const it=inf.markDungeonLoot(inf.cloneItem('dagger'));
          check(it.afx?.length>0,cfg.id+':'+state+' 追加つき');
          const was=JSON.stringify(it.afx);inf.markDungeonLoot(it);
          check(JSON.stringify(it.afx)===was,'同じドロップを二重抽選しない');
          const restored=refDeserialize(JSON.parse(JSON.stringify(refSerialize({item:it}))));
          check(JSON.stringify(restored.item.afx)===was,'保存後も追加の値を保持');
        }
      }
      check(JSON.stringify(G.stats.inf||null)===stats,'本編ドロップは無限迷宮の勲章・称号に数えない');
      G.state='town';
      check(!inf.markDungeonLoot(inf.cloneItem('dagger')).afx,'解放後も街の贈り物には新規付与しない');
      G.state='board';
      check(!inf.markDungeonLoot(inf.cloneItem('herb')).afx,'消耗品には付与しない');
      const cursed=inf.cloneItem('dagger');cursed.cursed=true;
      check(!inf.markDungeonLoot(cursed).afx,'呪われた装備の対象外を維持');
      G.state='town';G.prompt=false;
      check(inf.enterAbyss(['fighter','priest','thief','mage','knight','hunter'])!==false,'無限迷宮へ出撃');
      G.floor=100;
      let rare=0;
      for(let i=0;i<50;i++){
        const it=inf.markDungeonLoot(inf.cloneItem('dagger'));
        check(it.afx?.length>0&&!it.unidentified,'無限迷宮では鑑定済みの追加つきを維持');
        if(['r','x'].includes(it.afxTier))rare++;
      }
      check(rare>0&&(G.stats.inf?.rareAfx||0)>0,'無限迷宮の秘・極の拾得数を維持');
      return 'OK: 全'+inf.DUNGEONS.length+'迷宮の探索/戦闘、解放前後、街、二重付与、対象外、保存、無限迷宮の数え';
    }'''), flush=True)
    visit()
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {bagCount}=await import('/src/items.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const G=game.G,d=G.party[0];
      G.inventory.length=0;
      const reserved=game.cloneItem('dagger');reserved.name='別の隊の短剣';
      d.equip.weapon=reserved;
      if(!game.saveFormation(0,'別の隊').ok)throw Error('編成の保存に失敗');
      if(!game.doUnequip(d,'weapon').ok)throw Error('登録装備を外せない');
      const ordinary=game.cloneItem('shortSword');ordinary.name='今の隊の剣';
      G.inventory.push(ordinary);
      window.reserved=reserved;window.ordinary=ordinary;
      if(!G.inventory.includes(reserved)||bagCount(G.inventory)!==1)throw Error('実物または別枠の保持に失敗');
      const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      if(!saved.inventory.includes(saved.formations[0].members[0].equip.weapon))throw Error('保存で実物の参照が壊れた');
      UI.openParty(0,{seg:'equip',inPlace:true});
      return 'OK: 登録装備を別枠で保持、通常の袋枠だけ数え、保存で参照を共有';
    }'''), flush=True)
    page.wait_for_selector('.pt-bag')
    assert page.locator('.pt-bag').last.locator('button').count()==1
    assert page.locator('.pt-bag').last.locator('button').first.get_attribute('title')=='今の隊の剣'
    assert page.locator('.pt-bagbar b').last.inner_text()=='1/50'
    page.locator('.ui-bag-sort-select').select_option('name')
    assert page.locator('.pt-bag').last.locator('button').count()==1, '並び替えても別の隊の装備を出さない'
    # 登録装備しか残っていない時は、持ち物を空として表示する。
    page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();const g=__game.G;g.inventory.splice(g.inventory.indexOf(ordinary),1);__game.UI.openParty(0,{seg:'equip',inPlace:true});}''')
    assert page.locator('.pt-bag').last.inner_text().replace('\u200b', '')=='隊の持ち物は空だ。'
    assert page.locator('.pt-bagbar b').last.inner_text()=='0/50'
    # 非表示の登録装備を、保存編成から再び装備できる。
    assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');const r=game.applyFormation(0);return r.ok&&game.G.party[0].equip.weapon===reserved;}''')
    # 最後の登録を解除して未装備にすると、通常の持ち物へ戻る。
    page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();game.doUnequip(game.G.party[0],'weapon');if(!game.saveFormation(0,null,true).ok)throw Error('解除失敗');UI.openParty(0,{seg:'equip',inPlace:true});}''')
    assert page.locator('.pt-bag').last.locator('button').count()==1
    assert page.locator('.pt-bag').last.locator('button').first.get_attribute('title')=='別の隊の短剣'
    assert page.locator('.pt-bagbar b').last.inner_text()=='1/50'
    assert not errors, errors
    print('OK: 持ち物の非表示・並べ替え・空表示・容量・編成の適用・登録解除後の復帰', flush=True)
    browser.close()

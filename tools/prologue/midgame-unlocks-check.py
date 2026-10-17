"""中盤の解放条件・館の語り・無限迷宮帰還・旧セーブの席を確認。"""
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8000/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':390,'height':900}, service_workers='block', reduced_motion='reduce')
    context.route('https://**/*', lambda r:r.abort())
    page = context.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def visit(query):
        page.goto(BASE+query, wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
    visit('?testDungeon=w02&testPlace=town&testUnlock=infinite')
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {IRENE_BEATS}=await import('/src/story.js');
      const {openInfSummary}=await import('/src/ui/infinite.js');
      const {unphrase}=await import('/src/ui/phrase.js');
      const {G,inf}=__game, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg)};
      G.testStoryFlow=true;G.state='town';G.prompt=false;G.msq.prologue={phase:'done'};
      G.tut={midUnlockVersion:1,earlySoulVersion:1,done:{}};
      G.world={open:{},cleared:{},reported:{w05:1,w06:1},found:{},beats:Object.fromEntries(IRENE_BEATS.filter(b=>b.id!=='irene_omokage').map(b=>[b.id,1]))};
      check(!game.featureUnlocked('order2')&&!game.pendingIreneBeat(),'第二章一報告では面影の語りも二の席も開かない');
      G.world.reported.w08=1;
      check(game.pendingIreneBeat()?.id==='irene_omokage'&&!game.featureUnlocked('order2'),'第二章二報告で面影の語り、二の席はまだ開かない');
      UI.playStoryChain=(pages,done)=>{pages.forEach(p=>{p.enter?.();p.leave?.()});done?.()};
      game.playIreneBeat();check(G.world.beats.irene_omokage,'セラの頭を未回収でも面影の語りを聞ける');
      G.world.reported.w09=1;check(game.featureUnlocked('order2'),'第二章の結びで二の席を解放');
      G.world.reported.w10=1;check(!game.featureUnlocked('sub2'),'第三章一報告では二枠目は未解放');
      G.world.reported.w11=1;
      check(game.featureUnlocked('sub2')&&!game.featureUnlocked('order3'),'第三章二報告でサブ魂二枠、三の席は未解放');
      G.world.reported.w17=1;check(game.featureUnlocked('order3'),'第四章の結びで三の席');
      check(!game.featureUnlocked('order4'),'第六章の結びの前は四の席は未解放');
      G.world.reported.w25=1;check(game.featureUnlocked('order4')&&!G.world.reported.w33,'第六章の結びで四の席、第八章の報告は不要');
      // 解放後の全迷宮ドロップと、実際の持ち帰りを区別する。
      const {applyAffixes}=await import('/src/infaffix.js');
      const {ITEMS}=await import('/src/items.js');
      const picks=['fighter','priest','thief','mage','knight','bishop'];
      window.summaries=[];UI.openInfSummary=r=>summaries.push(r);
      const reset=()=>{delete G.tut.affixReturned;delete G.tut.extremeReturned;delete G.tut.done.enchant;G.stats.enchant={};};
      const mk=(extreme=false)=>{
        const id=extreme?Object.values(ITEMS).find(t=>t.slot==='acc'&&!t.cursed&&t.price>0).id:'shortSword';
        const it=game.cloneItem(id,50);it.afx=[{k:extreme?'J02':'A03',v:extreme?1:2}];applyAffixes(it);return it;
      };
      const bag=(it)=>{G.inventory.push(it);G.run.items.push({owner:G.party[0],item:it});return it;};
      const depart=()=>{sheet.closeAll();G.state='town';G.prompt=false;G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now()});check(inf.enterAbyss(picks),'無限迷宮へ出撃')};
      const home=async(outcome)=>{inf.returnToTown({outcome});await new Promise(r=>setTimeout(r,360));return summaries.at(-1)};
      const normal=()=>{sheet.closeAll();G.state='board';G.run={items:[],souls:[]};};
      reset(); G.testUnlock=[];normal();
      check(Array.from({length:100},()=>game.markDungeonLoot(game.cloneItem('shortSword',50))).every(i=>!i.afx?.length),'無限迷宮解放前の本編では追加なし');
      G.testUnlock=['infinite'];
      check(Array.from({length:300},()=>game.markDungeonLoot(game.cloneItem('shortSword',50))).some(i=>i.afx?.length),'解放後は以前の本編迷宮でも追加つき装備が落ちる');
      inf.returnToTown();
      check(!game.featureUnlocked('enchant'),'空帰還では付呪未解放');
      depart();await home('return');check(!game.featureUnlocked('enchant'),'無限迷宮の初回空帰還でも未解放');
      depart();bag(mk());await home('wipe');check(!game.featureUnlocked('enchant'),'持ち帰れなかった追加つき装備では開かない');
      depart();bag(mk());let r=await home('return');
      check(game.featureUnlocked('enchant')&&r.enchantUnlocked&&!G.tut.extremeReturned,'追加つき装備の初持ち帰りで付呪のみ解放');
      openInfSummary(r);check(unphrase(document.body.innerText).includes('付呪が解放された'),'帰還結果に付呪の説明を表示');sheet.closeAll();
      depart();r=await home('return');check(!r.enchantUnlocked,'二度目の帰還で解放の説明を繰り返さない');
      reset();depart();bag(mk(true));r=await home('saved');
      check(game.featureUnlocked('enchant')&&G.tut.extremeReturned&&r.enchantUnlocked,'極つき装備の保護帰還は両方の案内対象');
      reset();normal();let dropped=bag(mk(true));G.inventory.splice(G.inventory.indexOf(dropped),1);inf.returnToTown();
      check(!game.featureUnlocked('enchant')&&!G.tut.extremeReturned,'本編でも捨てた装備を持ち帰りに数えない');
      normal();const unid=bag(mk());unid.unidentified=true;inf.returnToTown();
      check(game.featureUnlocked('enchant')&&!G.tut.extremeReturned,'本編の未鑑定の追加つき装備も実物を持ち帰れば対象');
      reset();normal();bag(mk(true));inf.returnToTown();
      check(G.tut.extremeReturned,'本編の極つき装備も持ち帰り対象');
      reset();depart();G.floor=5;G.state='board';const sold=bag(mk(true));sold.locked=true;
      check(!game.infSell(G.party[0],sold)&&!G.tut.extremeReturned,'売却に失敗した極は持ち帰りに数えない');
      delete sold.locked;
      check(game.infSell(G.party[0],sold,'shelf')&&G.tut.extremeReturned,'回収人への売却成功で極も持ち帰りに数える');
      await home('wipe');check(game.featureUnlocked('enchant')&&G.tut.extremeReturned,'売却後に全滅しても持ち帰り判定は残る');
      const {refDeserialize}=await import('/src/savegraph.js');
      check(refDeserialize(JSON.parse(inf.saveJSON())).tut.extremeReturned,'売却で得た極の持ち帰り記録も保存される');
      reset();depart();G.floor=5;G.state='board';bag(mk(true));
      check(game.infSellAll(game.infSellPlan())&&G.tut.extremeReturned,'回収人への一括売却も持ち帰りに数える');
      await home('wipe');check(game.featureUnlocked('enchant')&&G.tut.extremeReturned,'一括売却後の全滅でも記録を保持');
      reset();normal();const memory=bag(mk(true));memory.soulMemory=true;inf.returnToTown();
      check(!game.featureUnlocked('enchant')&&!G.tut.extremeReturned,'魂の記憶の装備は持ち帰りに数えない');
      reset();G.tut.enchantReturned=true;G.stats.inf={homeRets:1};G.abyssRec={v:2,recent:[{outcome:'saved'}]};G.world.reported.w45=1;
      check(!game.featureUnlocked('enchant'),'旧空帰還・第十一章報告だけでは新たに付呪を開かない');
      G.stats.enchant={written:1};check(game.featureUnlocked('enchant'),'既に付呪を使った記録は保持する');
      return out;
    }'''), flush=True)
    # 旧条件で開いた席を通常ロードで保持、新条件のセーブには旧条件を適用しない。
    for legacy in [True,False]:
        visit('?testDungeon=w02&testPlace=town')
        page.evaluate('''legacy=>{
          const {G,inf}=__game;
          G.world.reported={w05:1,w06:1,w07:1,w10:1,w11:1};
          G.world.cleared={};G.tut={done:{},earlySoulVersion:1};
          if(!legacy)G.tut.midUnlockVersion=1;
          localStorage.setItem('dos-save-v7',inf.saveJSON());
        }''', legacy)
        visit('')
        actual=page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return [game.featureUnlocked("order2"),game.featureUnlocked("order3"),game.featureUnlocked("sub2")]}')
        assert actual==[legacy,legacy,True], (legacy,actual)
        print(('旧' if legacy else '現行')+'セーブ: 結社の席の継続・新条件の分離 OK',flush=True)
    assert not errors,errors
    browser.close()

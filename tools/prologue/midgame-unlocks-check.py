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
      // 帰還は本番の出撃・本編復元・結果表示を通す。
      G.tut.enchantReturned=false;G.stats.inf={};G.abyssRec={v:2,bestDepth:0,runs:0,recent:[]};
      const picks=['fighter','priest','thief','mage','knight','bishop'];
      window.summaries=[];UI.openInfSummary=r=>summaries.push(r);
      const depart=()=>{sheet.closeAll();G.state='town';G.prompt=false;G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now()});check(inf.enterAbyss(picks),'無限迷宮へ出撃')};
      const home=async(outcome)=>{inf.returnToTown({outcome});await new Promise(r=>setTimeout(r,360));return summaries.at(-1)};
      check(!game.featureUnlocked('enchant'),'無限迷宮への帰還前は付呪未解放');
      depart();await home('wipe');check(!game.featureUnlocked('enchant'),'没収全滅だけでは付呪を開かない');
      depart();let r=await home('return');
      check(game.featureUnlocked('enchant')&&r.enchantUnlocked,'初めての通常帰還で付呪を解放し結果に知らせる');
      openInfSummary(r);check(unphrase(document.body.innerText).includes('付呪が解放された'),'帰還結果に付呪の説明を表示');sheet.closeAll();
      depart();r=await home('return');check(!r.enchantUnlocked,'二度目の帰還で解放の説明を繰り返さない');
      delete G.tut.enchantReturned;G.stats.inf={};G.abyssRec={v:2,bestDepth:0,runs:0,recent:[]};
      depart();r=await home('saved');check(game.featureUnlocked('enchant')&&r.enchantUnlocked,'初めての保護帰還でも付呪を解放');
      delete G.tut.enchantReturned;G.stats.inf={homeRets:1};G.abyssRec={v:2,recent:[]};
      check(game.featureUnlocked('enchant'),'既存の通常帰還記録を認める');
      G.stats.inf={};G.abyssRec.recent=[{outcome:'saved'}];check(game.featureUnlocked('enchant'),'既存の保護帰還記録を認める');
      G.abyssRec.recent=[];G.world.reported.w45=1;check(game.featureUnlocked('enchant'),'旧第十一章報告で開いた付呪を保持');
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

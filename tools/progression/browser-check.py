"""解放境界・深さ・異変・武魂の実操作。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w54&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game,UI} = await import('/src/ui/ctx.js');
      const {WORLD}=await import('/src/dungeons/world.js');
      const {CHAPTERS}=await import('/src/story.js');
      const a=__game.progression,G=__game.G;
      const check=(v,m)=>{if(!v)throw Error(m)};
      G.testUnlock=[];G.tut={done:{},midUnlockVersion:1};G.world={open:{},cleared:{},reported:{},found:{},beats:{},gates:{},fresh:{}};
      const keys=['enchant','bukonFusion','forge','orderLearning','mutators','order3','order4','orderLearning2','orderLearning3','infinite','infinite100','infinite150','infiniteDeep','order6'];
      // 結社・伝習は見識で開く (#1510) ので、章の報告で開く機能だけを数える
      for(const key of keys.filter(k=>game.FEATURES[k].chapter)){
        G.world.reported={};const f=game.FEATURES[key],ch=CHAPTERS.find(c=>c.no===f.chapter);
        check(!a.featureUnlocked(key),key+' before');
        if(f.report==='finale')G.world.reported[ch.finale]=1;
        else {G.world.reported[ch.dungeons[0]]=1;check(!a.featureUnlocked(key),key+' one');G.world.reported[ch.dungeons[1]]=1;}
        check(a.featureUnlocked(key),key+' after');
      }
      G.world.reported={w21:1};check(a.infDepthLimit()===50,'50階');
      for(const [id,n]of [['w29',100],['w41',150]]){G.world.reported[id]=1;check(a.infDepthLimit()===n,'深さ'+n);}
      // 第十一章の結びで深部へ (値は検査に書かない)。旧来の第十二章以降の段は廃止
      G.world.reported.w45=1;check(Number.isFinite(a.infDepthLimit())&&a.infDepthLimit()>150,'深部');
      check(!a.featureUnlocked('infinite200')&&!a.featureUnlocked('infinite250')&&!a.featureUnlocked('infinite300'),'旧段は廃止');
      check(!a.featureUnlocked('rebirth')&&!a.featureUnlocked('vow')&&!a.featureUnlocked('sub3'),'廃止');
      check(!a.featureUnlocked('order7')&&!a.featureUnlocked('order8'),'未実装章');
      G.world.reported={w25:1};
      check(!a.mutatorAllowed(WORLD.find(d=>d.id==='w22')),'第六章は対象外');
      check(a.mutatorAllowed(WORLD.find(d=>d.id==='w26')),'第七章は対象');
      G.world.reported={w13:1,w14:1,w15:1};G.bukonStock={};G.tut={done:{},midUnlockVersion:1};
      game.prepareBukonFusionTutorial();game.prepareBukonFusionTutorial();
      check(G.bukonStock['flat_hp:1']==='3','練習素材一度だけ');
      check(game.bukonAction('fuse',null,{k:'flat_hp',lv:2}),'実際に合成');
      check(G.bukonStock['flat_hp:2']==='1','合成結果');
      // 降下・飛び階・落下は上限判定より先に状態を変えない。
      G.world.reported={w21:1};G.abyss={started:true,depth:50};G.floor=50;G.state='board';
      for(const opts of [{},{skip:2},{fall:true}]){__game.inf.descend(opts);check(G.floor===50,'上限を越えない');}
      G.abyss=null;G.state='town';
      return 'OK 章の機能の解放前後・廃止機能・未実装章・深さ4段階・異変の章境界・練習素材と合成';
    }'''))
    assert not errors, errors
    browser.close()

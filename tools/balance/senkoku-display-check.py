"""開幕3種の複数撃破・描画前の演出切替・座標不在・生存/復活した敵の表示を確認。localhost:8000。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
source = (root / 'src/game.js').read_text() + '\nwindow.__senkokuDisplay = {applyImpact, animateResult, renderCombatCanvas};\n'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
    context.route('**/src/game.js', lambda r:r.fulfill(status=200,content_type='application/javascript',body=source))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=board')
    page.wait_for_function('window.__senkokuDisplay && __game.G.party.length>0')
    print('\n'.join(page.evaluate('''async()=>{
      const {G}=__game,H=__senkokuDisplay;
      const {Battle,spawnCardEnemies}=await import('/src/combat.js');
      const {makeDoll}=await import('/src/souls.js');
      const {useMathRandom}=await import('/src/rng.js');
      const {sheet}=await import('/src/ui/kit.js');
      const out=[],check=(ok,msg)=>{if(!ok)throw Error(msg);out.push('OK '+msg)};
      function scenario(count,{boss=false,rise=false,opening=null}={}) {
        sheet.closeAll();G.state='combat';G.prompt=false;G.animating=true;
        G.autoCombat=false;G.fastAnim=true;G.battleIntro=null;G.fx=null;G.partyFx=new Map();G.partyFxV=new Map();
        for(const [i,d] of G.party.entries()){d.alive=true;d.hp=d.maxhp;d.passiveMap=i?{}:{necroSenkoku:4};d.eff={};}
        const foes=Array.from({length:count},()=>spawnCardEnemies('bs_mournshade',1,1,{min:1})[0]);
        if(boss)foes.at(-1).boss=true;
        const original=Math.random;useMathRandom(true);Math.random=()=>0;
        try {G.battle=new Battle(G.party,foes,()=>{},{opening,foeRise:rise ? 0.5 : 0});}
        finally {Math.random=original;useMathRandom(false);}
        H.renderCombatCanvas();
        return {foes,res:G.battle.openingResults.find(r=>r.opening==='senkoku')};
      }
      const impact=res=>{G.fx={lunge:null,slashes:[],skill:[],floats:[],screen:null,flash:{},deaths:[]};H.applyImpact(res);H.renderCombatCanvas();};
      for(const count of [1,6])for(const missing of [false,true]) {
        const {foes,res}=scenario(count);
        check(res?.hits.length===count&&foes.every(e=>!e.alive&&e.hp===0),'本物の死の宣告で'+count+'体死亡');
        if(missing)G.enemyPos={};
        impact(res);
        check(foes.every(e=>!G.enemyPos[e.uid]&&!e._openDeath),'着弾直後に本体とHPゲージを除外（座標なし='+missing+'）');
        G.fx=null;H.renderCombatCanvas();
        check(foes.every(e=>!G.enemyPos[e.uid]),'演出の破棄後も死体が再表示されない');
        G.fx={deaths:[],skill:[],floats:[],slashes:[],flash:{}};H.renderCombatCanvas();
        check(foes.every(e=>!G.enemyPos[e.uid]),'次の演出でも死亡表示が戻らない');
      }
      {
        const {foes,res}=scenario(6,{boss:true,opening:'ambush'});impact(res);
        check(foes.slice(0,5).every(e=>!G.enemyPos[e.uid])&&!!G.enemyPos[foes[5].uid]&&foes[5].alive,'奇襲でも発動し、生存する主は消さない');
      }
      {
        const {foes,res}=scenario(3,{rise:true});impact(res);
        check(res.hits.every(h=>!h.died)&&foes.every(e=>e.alive&&G.enemyPos[e.uid]),'起き上がった敵を誤って消さない');
      }
      for(const mode of ['通常','オート','低フレームレート']) {
        const {foes,res}=scenario(6);G.autoCombat=mode==='オート';
        const originalRAF=window.requestAnimationFrame;
        if(mode==='低フレームレート')window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),1200);
        try {await new Promise(done=>H.animateResult(res,done));}
        finally {window.requestAnimationFrame=originalRAF;}
        check(foes.every(e=>!G.enemyPos[e.uid]&&!e._openDeath),mode+'の6体同時死亡でも演出後に残らない');
      }
      // 開幕は戦闘生成時に全員の結果が確定する。後続の着弾まで敵を早消ししない。
      for(const kind of ['iai','openSpell','mixed'])for(const missing of [false,true]) {
        sheet.closeAll();G.state='combat';G.animating=true;G.fx=null;G.autoCombat=false;G.battleIntro=null;
        G.party=Array.from({length:3},(_,i)=>Object.assign(makeDoll('開幕'+i),{
          atk:100000,int:100000,agi:1000,luk:100,maxmp:100,mp:100,
          passiveMap:{[kind==='mixed'?(i%2?'openSpell':'iai'):kind]:1}
        }));
        const foes=Array.from({length:4},()=>spawnCardEnemies('bs_mournshade',1,1,{min:1})[0]);
        for(const e of foes){e.hp=e.maxhp=1;e.vit=0;e.agi=0;e.physResist=e.magResist=0;}
        const original=Math.random;useMathRandom(true);Math.random=()=>0.5;
        try{G.battle=new Battle(G.party,foes,()=>{});}finally{Math.random=original;useMathRandom(false);}
        const list=G.battle.openingResults,dead=foes.filter(e=>!e.alive),alive=foes.filter(e=>e.alive);
        check(dead.length===3&&list.length===3,kind+'で本物の開幕スキルが3体撃破');
        H.renderCombatCanvas();
        check(foes.every(e=>G.enemyPos[e.uid]),'着弾前は後続の撃破対象も表示');
        // バックグラウンド戦闘では次の演出が前の描画より先に始まる。
        for(const [i,res]of list.entries()) {
          if(missing)G.enemyPos={};
          G.fx={lunge:null,slashes:[],skill:[],floats:[],screen:null,flash:{},deaths:[]};
          H.applyImpact(res);
          check(list.slice(i+1).every(r=>r.hits.every(h=>!h.died||h.target._openDeath)),'未着弾の敵の表示待ちを維持');
        }
        G.fx=null;H.renderCombatCanvas();
        check(dead.every(e=>!G.enemyPos[e.uid]&&!e._openDeath),kind+'の連続撃破後に画像・HPゲージが残らない（座標なし='+missing+'）');
        check(alive.every(e=>G.enemyPos[e.uid]),'生存している敵は消さない');
        G.fx={deaths:[],skill:[],floats:[],slashes:[],flash:{}};H.renderCombatCanvas();
        check(dead.every(e=>!G.enemyPos[e.uid]),'次の演出でも死体が戻らない');
      }
      return out;
    }''')))
    assert not errors,errors
    browser.close()

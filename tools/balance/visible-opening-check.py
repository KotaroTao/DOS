"""公開済み・感知した敵の開幕、掟の優先、先制/奇襲の表示を実ブラウザで確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=board')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {G,startBattle}=__game;
      const combat=await import('/src/combat.js');
      const rng=await import('/src/rng.js');
      const {DUNGEONS}=await import('/src/dungeons/index.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const check=(ok,msg)=>{if(!ok)throw Error(msg);};
      const home=G.dungeonIdx, foe='bs_mournshade';
      const reset=()=>{
        sheet.closeAll();G.state='board';G.prompt=false;G.animating=false;G.autoCombat=false;
        G.battle=null;G.battleIntro=null;G.specialFloor=null;G.mutator=null;G._evOpening=null;
        G.dungeonIdx=home;G.board.ev={mods:[]};G.events.flags={};
        G.run.ev={mods:[],preempt:0,ambushNext:0};
        for(const d of G.party){d.alive=true;d.hp=d.maxhp;d.mp=d.maxmp;d.passiveMap={};}
      };
      const one=()=>combat.spawnCardEnemies(foe,1).slice(0,1);
      const cell=()=>({type:'monster',monsterKey:foe,revealed:true,cleared:false});
      const fight=(r,where,spawn=one)=>{
        const original=Math.random;
        rng.useMathRandom(true);Math.random=()=>r;
        try { startBattle(spawn(),where);return G.battle.opening; }
        finally { Math.random=original;rng.useMathRandom(false); }
      };
      const cases=new Set();
      for(const r of [0,0.079999,0.080001,0.159999,0.160001,0.199999,0.200001,0.279999,0.280001,0.429999,0.430001,0.999999]){
        reset();const hidden=fight(r,{...cell(),revealed:false});
        check(hidden===(r<0.08?'ambush':r<0.16?'preempt':null),'伏せた敵の基礎確率 r='+r);
        reset();const visible=fight(r,cell());
        check(visible===(r<0.28?'preempt':null),'見えている敵は奇襲0%・先制28% r='+r);
        if(r>=0.08&&r<0.28)cases.add('加算');
        if(r>=0.28)cases.add('通常');
        if(r<0.08)cases.add('奇襲抑止');
        reset();G.party[0].passiveMap={hunterSaihai:3};
        const ini=fight(r,cell());check(ini===(r<0.43?'preempt':null),'待ち伏せ15ポイント＋可視20ポイント '+JSON.stringify({r,ini}));
        reset();
        check(fight(r,cell(),()=>combat.spawnEliteEnemies('el_palebutcher'))===(r<0.20?'preempt':null),'見えている強敵は20%');
      }
      check(cases.size===3,'境界の両側を検査できていない');
      const elite=()=>combat.spawnEliteEnemies('el_palebutcher');
      for(let lv=1;lv<=4;lv++){
        const bonus=[0,.05,.10,.15,.20][lv];
        for(const [visible,base] of [[false,0],[true,.20]])for(const r of [base+bonus-1e-6,base+bonus+1e-6]){
          reset();G.party[0].passiveMap={hunterSaihai:lv};
          check(fight(r,{...cell(),revealed:visible},elite)===(r<base+bonus?'preempt':null),'強敵の待ち伏せ固定加算');
        }
      }
      reset();G.party[0].passiveMap={initiative:1};
      check(fight(.30,cell())===null,'先の太刀は先制率を上げない');
      reset();G.party[0].passiveMap={hunterSaihai:4};G.party[1].passiveMap={hunterSaihai:2};
      check(fight(.49,cell())===null,'同じ待ち伏せは最高Lvのみ (可視48%)');
      reset();G.party[0].passiveMap={hunterSaihai:4};G.party[0].alive=false;
      check(fight(.30,cell())===null,'倒れた狩人は先制率に寄与しない');
      reset();G.party[0].passiveMap={hunterSaihai:4};
      check(fight(.01,cell(),()=>combat.spawnBossEnemies('dragon'))===null,'待ち伏せも主には無効');
      reset();G.party[0].passiveMap={hunterSaihai:4};
      G.dungeonIdx=DUNGEONS.findIndex(d=>d.trait?.alwaysAmbush);
      check(fight(.99,cell())==='ambush','待ち伏せより必ず奇襲の掟が優先');

      reset();G.specialFloor='tailwind';check(fight(0.9,cell())==='preempt','追い風の先制100%');
      reset();G.mutator='nightHunt';check(fight(0.9,cell())!=='ambush','闇討ちの宴でも見えていれば通常奇襲0%');
      reset();G.dungeonIdx=DUNGEONS.findIndex(d=>d.trait?.alwaysAmbush);G._evOpening='preempt';G.run.ev.preempt=2;
      check(fight(0.9,cell())==='ambush','必ず奇襲の掟を最優先');
      check(G.run.ev.preempt===2,'掟の下では先制の備えを消費しない');
      reset();G.run.ev.ambushNext=1;check(fight(0.9,cell())==='ambush','出来事の待ち伏せは有効');
      reset();G._evOpening='preempt';check(fight(0.9,null)==='preempt','出来事の先制は有効');
      reset();check(fight(0.01,{type:'stairs',revealed:true},()=>combat.spawnBossEnemies('dragon'))===null,'主は通常抽選の対象外');
      const r=0.01;
      reset();check(fight(r,{type:'chest',revealed:true})===(r<0.08?'ambush':r<0.16?'preempt':null),'宝箱の公開を敵の公開と混同しない');
      const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(saved.battle.opening===G.battle.opening,'開幕の結果をセーブに保持');
      window.openingCheck={reset,foe,cell,rng};
      // Canvasの帯・札も、実際に描いた文字で確認する。
      window.openingText=[];
      const fill=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){
        if(/先 制|奇 襲|先制 ―|奇襲 ―/.test(text))openingText.push(text);
        return fill.call(this,text,...args);
      };
      return '12種の境界値で基礎8%/先制28%/待ち伏せ込み43%/強敵20%・掟・出来事・主・保存を確認';
    }'''))

    # 実際の1歩で、めくる前の公開状態が判定に届くことを確認する。
    for kind, expected in [('hidden', 'ambush'), ('revealed', 'preempt'), ('sensed', 'preempt')]:
        page.evaluate('''kind=>{
          const {reset,foe,rng}=openingCheck,G=__game.G;reset();
          const x=G.px<__game.COLS-1?G.px+1:G.px-1,y=G.py;
          const c=G.board.cells[y][x];Object.assign(c,{type:'monster',monsterKey:foe,cleared:false,elite:false,metal:false,revealed:kind==='revealed'});
          G.board.psense={enemy:[[x,y]],chest:[]};
          if(kind==='sensed')G.party[0].passiveMap={senseEnemy:1};
          rng.useMathRandom(true);window.openingRandom=Math.random;Math.random=()=>0.04;
          __game.autoMove.moveStep(x,y);
        }''', kind)
        page.wait_for_function('__game.G.state === "combat" && !!__game.G.battle')
        assert page.evaluate('__game.G.battle.opening') == expected, kind
        page.wait_for_function('openingText.some(t=>t.includes("先 制")||t.includes("奇 襲"))')
        page.evaluate('''()=>{
          Math.random=openingRandom;openingCheck.rng.useMathRandom(false);
        }''')
        if kind == 'sensed':
            assert page.evaluate('__game.G.battleIntro.preempt && !__game.G.battleIntro.ambush')
            page.screenshot(path='/tmp/dos-preempt-intro.png')
        page.wait_for_function('__game.G.battleIntro === null')
        assert page.evaluate('''expected=>openingText.includes(expected==='preempt'?'先制 ― 隊が先に動く':'奇襲 ― 敵が先に動く')''', expected)
        page.evaluate('openingText.length=0')
    page.screenshot(path='/tmp/dos-preempt-turn.png')

    # 動きを減らす場合は帯を省略し、初ターンの札で先制を伝える。
    page.emulate_media(reduced_motion='reduce')
    page.evaluate('''()=>{
      openingCheck.reset();__game.G._evOpening='preempt';
      __game.startBattle(__game.spawnCardEnemies(openingCheck.foe,1).slice(0,1),null);
    }''')
    page.wait_for_function('__game.G.battle.phase === "input" && !__game.G.animating')
    assert page.evaluate('openingText.includes("先制 ― 隊が先に動く")')
    assert not errors, errors
    print('踏み込む前の公開/未公開/敵感知・先制/奇襲の帯と初ターン札・動きを減らす設定 OK')
    browser.close()

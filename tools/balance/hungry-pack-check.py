"""localhost:8000で飢えた狩場の全遭遇・通常時・記憶への再戦の敵数を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02')
    page.wait_for_function('window.__game?.G.party.length > 0')
    results = page.evaluate('''async () => {
      const {G, startBattle, activeCfg} = __game;
      const combat = await import('/src/combat.js');
      const {MONSTERS} = await import('/src/sprites.js');
      const {poolAt} = await import('/src/dungeons/world.js');
      const pool = poolAt(activeCfg(), G.floor);
      const key = pool[0];
      const elite = Object.keys(MONSTERS).find(k => MONSTERS[k].elite);
      const metal = Object.keys(MONSTERS).find(k => MONSTERS[k].metal);
      const event = Object.keys(MONSTERS).find(k => MONSTERS[k].evOnly);
      const one = () => combat.spawnCardEnemies(key, G.floor).slice(0,1);
      const cases = {
        ordinary: one,
        pair: () => combat.spawnCardEnemies(key, G.floor, 1, {min:2}).slice(0,2),
        elite: () => combat.spawnEliteEnemies(elite),
        metal: () => combat.spawnMetal(metal, {count:1}),
        mimic: () => combat.spawnMimic(1),
        masterMimic: () => combat.spawnMimic(1,1,true),
        boss: () => combat.spawnBossEnemies(activeCfg().boss || 'dragon'),
        event: () => combat.spawnRanked(event,1),
        duel: () => {const foes=one(); foes[0]._tuneK=1; return foes;},
        full: () => combat.spawnCardEnemies(key,G.floor,1,{min:6})
      };
      G.autoCombat=false;
      const result=[];
      const check=(ok,msg)=>{if(!ok) throw Error(msg);};
      for(const enabled of [false,true]) for(const [name,spawn] of Object.entries(cases)) {
        G.mutator=enabled?'hungryPack':null;
        const foes=spawn(), original=[...foes], n=foes.length;
        check(n>0, name+'の元の敵がいない');
        startBattle(foes,null);
        const actual=G.battle.enemies;
        check(actual.length === (enabled?Math.max(n,3):n), name+'の敵数が不正: '+actual.length);
        check(original.every(e=>actual.includes(e)), name+'の元の敵が失われた');
        check(new Set(actual.map(e=>e.uid)).size === actual.length, name+'のUIDが重複');
        check(new Set(actual.map(e=>e.name)).size === actual.length, name+'の個体名が重複');
        check(actual.slice(n).every(e=>pool.includes(e.key) && !e.boss && !e.metal && !e.mon.elite), name+'の取り巻きが不正');
        result.push([enabled,name,n,actual.length]);
      }
      G.mutator='hungryPack'; G.rematch={key:'test'};
      startBattle(one(),null);
      check(G.battle.enemies.length===1,'記憶への再戦に異変が効いた');
      G.rematch=null;
      return result;
    }''')
    assert not errors, errors
    print(results)
    browser.close()

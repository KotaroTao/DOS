"""回廊踏破を境にした修復費用と、単体・一括修復をブラウザーで確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {STORY_CELLS} = await import('/src/story.js');
      const {refSerialize,refDeserialize} = await import('/src/savegraph.js');
      const G = game.G, checks = [];
      const check = (ok,msg) => { if (!ok) throw Error(msg); checks.push(msg); };
      const breakDoll = d => Object.assign(d,{alive:false,hp:0,mp:0,reviveAt:null,ailment:'poison'});
      G.gold = 0; G.world = null;
      const d = G.party[0]; breakDoll(d);
      check(game.repairCostOf(d) === 0, '進行記録のないセーブも無料');
      check(game.repairDoll(d).ok && d.alive && d.hp === d.maxhp && d.mp === d.maxmp && !d.ailment && G.gold === 0, '金貨0で単体修復・HP/MP回復');
      const reserve = G.party.pop(); G.reserve.push(reserve);
      const targets = game.allDolls(); targets.forEach(breakDoll);
      game.worldState().cleared.w01 = 1;
      G.dungeonIdx = game.DUNGEONS.findIndex(c => c.id === 'w03');
      G.world = refDeserialize(refSerialize(G.world));
      check(targets.every(d => game.repairCostOf(d) === 0), '選択迷宮・保存再読込によらず回廊踏破前は無料');
      const all = game.repairAllDolls();
      check(all.ok && all.cost === 0 && all.count === targets.length && targets.every(d => d.alive && d.hp === d.maxhp && d.mp === d.maxmp) && G.gold === 0, '隊・控えを金貨0で一括修復');
      targets.forEach(breakDoll);
      targets[0].reviveAt = Date.now() - 1;
      targets[1].reviveAt = Date.now() + 60000;
      const ready = targets.filter(d => d !== targets[1]);
      check(!game.awaitingRepairRescue(targets[0]) && game.awaitingRepairRescue(targets[1]), '満了した器と連れ帰り待ちを区別');
      const expired = game.repairAllDolls();
      check(expired.ok && expired.count === ready.length && ready.every(d => d.alive) && !targets[1].alive, '監視更新前でも満了した器・隊・控えを一括修復');
      targets[1].reviveAt = null; game.repairAllDolls();
      breakDoll(d); d.reviveAt = Date.now() + 60000;
      check(game.repairDoll(d).reason === 'rescue', '無料でも回収待ちは修復不可');
      d.reviveAt = null; G.state = 'dungeon';
      check(game.repairDoll(d).reason === 'town', '無料でも迷宮内では修復不可'); G.state = 'town';
      G.world.cleared.w02 = 1; delete G.world.reported.w02;
      Object.assign(d,{jobRank:2,jobLv:7,clsKey:'fighter'});
      check(game.repairCostOf(d) === 140, '回廊踏破直後・報告前から通常料金');
      check(game.repairDoll(d).reason === 'gold' && !d.alive && G.gold === 0, '踏破後は金貨不足なら修復不可');
      const clue = Object.keys(STORY_CELLS).find(k => STORY_CELLS[k].boon?.kind === 'repair');
      G.world.found[clue] = 1;
      check(game.repairCostOf(d) === 126, '踏破後の手がかり割引を維持');
      G.gold = 126;
      check(game.repairDoll(d).ok && G.gold === 0 && d.alive, '踏破後は通常の割引料金を徴収');
      targets.forEach(breakDoll);
      targets[0].reviveAt = Date.now() - 1;
      targets[1].reviveAt = Date.now() + 60000;
      const total = ready.reduce((sum,d) => sum + game.repairCostOf(d),0);
      G.gold = total - 1;
      check(game.repairAllDolls().reason === 'gold' && targets.every(d => !d.alive) && G.gold === total - 1, '有料の一括修復は費用不足なら誰も修復しない');
      G.gold = total;
      const paid = game.repairAllDolls();
      check(paid.ok && paid.cost === total && paid.count === ready.length && G.gold === 0 && ready.every(d => d.alive && d.hp === d.maxhp && d.mp === d.maxmp && !d.reviveAt && !d._dead && !d.ailment) && !targets[1].alive, '満了直後の有料一括修復も合計金貨ぴったりで全対象を回復');
      return checks;
    }'''))
    assert not errors, errors
    browser.close()

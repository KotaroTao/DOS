"""酒場の依頼の出現・迷宮別の表示・共通依頼文を確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {dungeonGroups} = await import('/src/ui/questboard.js');
      const {rollBoard, commonQuestTextFits} = await import('/src/quests.js');
      const G = game.G, checks = [];
      const check = (ok, msg) => { if (!ok) throw Error(msg); checks.push(msg); };
      const ids = game.DUNGEONS.map(d => d.id);
      G.world.reported = Object.fromEntries(ids.map(id => [id, 1]));
      G.world.cleared = {...G.world.reported};
      G.world.open = {w01: 1, w02: 1, w03: 1, w04: 1};
      G.quest = {board: [
        {uid:'locked', type:'floor', dungeon:'w05', name:'未出現の迷宮'},
        {uid:'old-kill', type:'kill', keys:['bs_hand'], name:'旧討伐'},
        {uid:'old-soul', type:'soul', name:'古い戦友'},
        {uid:'common', type:'soul', name:'還れぬ魂'},
        {uid:'open', type:'chest', dungeon:'w02', name:'迷宮の宝箱'},
      ], active:[{uid:'accepted', type:'soul', name:'古い戦友', state:'active'}]};
      const list = game.questLists();
      check(list.offers.filter(q => !q.fixed).map(q => q.uid).join(',') === 'common,open',
        '旧セーブの未出現迷宮・共通討伐・場所指定の共通依頼を掲示板から除外');
      check(list.active.some(q => q.uid === 'accepted'), '受注済みの依頼を維持');
      check(list.offers.filter(q => q.fixed).every(q => !q.homeDungeon || G.world.open[q.homeDungeon] || q.def.opens?.includes(q.homeDungeon)),
        '固定の依頼は対象迷宮の出現を待つ');
      const unlock = list.offers.find(q => q.fixed && q.homeDungeon && !G.world.open[q.homeDungeon]);
      check(!!unlock, '迷宮を開く依頼は受注できる');
      const groups = dungeonGroups(list.offers);
      check(groups.find(g => g.name === '迷宮指定なし・納品').quests.every(q => !q.dungeon && !q.homeDungeon),
        '迷宮指定なしに特定迷宮の依頼を混ぜない');
      check(groups.find(g => g.name === '迷宮を開く依頼').quests.includes(unlock), '道を開く依頼を別枠に表示');
      G.quest.board.push({uid:'stale', type:'floor', dungeon:'w05'});
      check(!game.acceptQuest('stale'), '非表示の未出現迷宮の依頼は直接受注できない');
      G.world.open[unlock.homeDungeon] = 1;
      check(dungeonGroups([unlock]).some(g => g.id === unlock.homeDungeon), '開いた後は対象迷宮に分類');
      let seed = 42, seq = 0, commonCount = 0, specificCount = 0;
      const cfg = game.DUNGEONS.find(d => d.id === 'w03');
      for (let i = 0; i < 500; i++) {
        const board = rollBoard({dungeons:[cfg], unit:()=>({gold:20,soul:10}),
          common:{unit:{gold:20,soul:10}, minLv:1}, deliverIds:[], avoid:new Set(),
          rand:n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return Math.floor(seed/4294967296*n)},
          uid:()=>String(++seq)});
        for (const q of board) {
          if (!q.dungeon) {
            if (!commonQuestTextFits(q)) throw Error('共通枠に場所指定の依頼文: '+q.name);
            commonCount++;
          } else if (!commonQuestTextFits({...q, dungeon:null})) specificCount++;
        }
      }
      check(commonCount > 500 && specificCount > 0, '500回の生成で場所指定の依頼文は迷宮別にのみ出現');
      return checks;
    }'''))
    assert not errors, errors
    browser.close()

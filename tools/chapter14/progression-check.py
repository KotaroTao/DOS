"""第十四章の実際の解放処理・迷宮読み込み・物語表示を確認。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000/?testDungeon=w54&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {WORLD} = await import('/src/dungeons/world.js');
      const {CHAPTERS, STORY_CELLS, REPORTS, BOSS_MEMORIES, IRENE_BEATS} = await import('/src/story.js');
      const {FIXED_BY_ID} = await import('/src/quests.js');
      const {storyEntries} = await import('/src/journal.js');
      const G = __game.G, checks = [];
      const check = (v, message) => { if (!v) throw Error(message); checks.push(message); };
      const d = id => WORLD.find(d => d.id === id);
      G.msq.prologue = null;
      G.quest = {...G.quest, fixed:{}};
      for (const order of [['w55','w56'],['w56','w55']]) {
        G.world = {open:{},found:{},cleared:{},reported:{},beats:{},gates:{},fresh:{}};
        check(!game.worldUnlockMet(d('w54')), '十三章報告前は祈りの石段が閉鎖');
        G.world.reported.w53 = 1;
        check(game.worldUnlockMet(d('w54')), '十三章報告済みの旧セーブから祈りの石段へ接続');
        check(!game.worldUnlockMet(d('w55')), '発見前は再会の回廊が閉鎖');
        G.world.found.w54_shoes = 1;
        check(game.worldUnlockMet(d('w55')), '祈りの石段の手がかりで再会の回廊が解放');
        G.world.reported.w54 = 1;
        check(game.worldUnlockMet(d('w56')), '祈りの石段の報告で鐘楼が解放');
        G.world.reported[order[0]] = 1;
        check(!game.worldUnlockMet(d('w57')), '片側の報告だけでは大聖堂が閉鎖');
        G.world.reported[order[1]] = 1;
        check(game.worldUnlockMet(d('w57')), order.join('→')+'の順で大聖堂が解放');
      }
      for (const [id, clue] of [['fq_patterns','w55_reply'],['fq_letters','w56_prayer']]) {
        const q = FIXED_BY_ID[id], side = d(q.opens[0]);
        check(q.appear.found === clue && STORY_CELLS[clue].boon.kind === 'quest', id+'の発見条件と手がかりの恵みが一致');
        check(!game.worldUnlockMet(side), id+'受注前は寄り道が閉鎖');
        G.quest.fixed[id] = {state:'active'};
        check(game.worldUnlockMet(side), id+'受注で寄り道が解放');
        check(q.goal.dungeon === side.id && q.goal.type === 'clear', id+'の目標が寄り道の踏破');
      }
      for (const id of ['w54','w55','w56']) {
        const clue = REPORTS[id].need;
        check(STORY_CELLS[clue].dungeon === id, id+'は手がかりを見つけてから報告');
      }
      for (const id of ['irene_returned','irene_after_sleep']) {
        const beat = IRENE_BEATS.find(b => b.id === id);
        check(beat.beat === 'irene_sera_wake', id+'は覚醒記録で館の会話を開く');
        check(beat.lines.some(t => t.startsWith('セラ')), id+'は隊の編成を問わずセラと会話する');
      }
      const ch = CHAPTERS.find(c => c.no === 14);
      check(ch.finale === 'w57' && d(ch.finale).boss === 'bs_highpontiff', '章の結びと主の対応');
      const empty = storyEntries({world:{}}).filter(s=>s.chapter===14);
      check(!empty.length, '未体験の十四章は読み返しに出ない');
      G.world.found = {w54_shoes:1,w55_reply:1,w56_prayer:1,ws30_patterns:1,ws31_letters:1};
      G.world.reported = {w54:1,w55:1,w56:1,w57:1};
      G.world.beats = {pre_w57:1,pre_w57_retry:1,mem_w57:1,irene_returned:1,irene_after_sleep:1,ch14_end:1};
      for (const id of [...ch.dungeons,'ws30','ws31']) G.world.cleared[id] = 1;
      const snapshot = JSON.stringify(G.world);
      const entries = storyEntries(G);
      check(entries.filter(s => s.chapter === 14 && !s.id.startsWith('lore_')).length === 15, '体験済み全15場面を収録');
      check(['w54','w55','w56','w57','ws30','ws31'].every(id=>entries.some(s=>s.id==='lore_'+id)), '踏破した全6迷宮の由来を収録');
      check(JSON.stringify(G.world) === snapshot, '読み返しで進行を変更しない');
      UI.playStoryChain([{...BOSS_MEMORIES.w57, who:'none', kicker:'主の記憶'}]);
      check(!!document.querySelector('.sc-scene'), '挿絵未制作の主の記憶も表示できる');
      return checks;
    }'''))
    page.screenshot(path='/tmp/chapter14-story.png')
    assert not errors, errors
    # テストプレイで新迷宮の盤面と各階の敵の参照を読み込む。
    for dungeon, floor in [('w54', 1), ('w55', 6), ('w56', 10), ('w57', 15), ('ws30', 6), ('ws31', 6)]:
        page.goto(f'http://localhost:8000/?testDungeon={dungeon}&testFloor={floor}')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.wait_for_function('window.__game?.G.board && window.__game.G.state === "board"')
        actual = page.evaluate('''async () => {
          const {DUNGEONS} = await import('/src/dungeons/index.js');
          return {id:DUNGEONS[__game.G.dungeonIdx].id, floor:__game.G.floor};
        }''')
        assert actual == {'id': dungeon, 'floor': floor}, actual
        assert not errors, (dungeon, errors)
    print('6迷宮の盤面・敵の読み込みで例外なし')
    browser.close()

"""第十三章の実際の解放処理・迷宮読み込み・物語表示を確認。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000/?testDungeon=w50&testPlace=town')
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
      for (const order of [['w51','w52'],['w52','w51']]) {
        G.world = {open:{},found:{},cleared:{},reported:{},beats:{},gates:{},fresh:{}};
        check(!game.worldUnlockMet(d('w50')), '十二章報告前は搬入路が閉鎖');
        G.world.reported.w49 = 1;
        check(game.worldUnlockMet(d('w50')), '十二章報告済みの旧セーブから搬入路へ接続');
        check(!game.worldUnlockMet(d('w51')), '発見前は鋳造場が閉鎖');
        G.world.found.w50_orders = 1;
        check(game.worldUnlockMet(d('w51')), '搬入路の手がかりで鋳造場が解放');
        G.world.reported.w50 = 1;
        check(game.worldUnlockMet(d('w52')), '搬入路の報告で水路が解放');
        G.world.reported[order[0]] = 1;
        check(!game.worldUnlockMet(d('w53')), '片側の報告だけでは大炉が閉鎖');
        G.world.reported[order[1]] = 1;
        check(game.worldUnlockMet(d('w53')), order.join('→')+'の順で大炉が解放');
      }
      for (const [id, clue] of [['fq_joint','w51_mould'],['fq_restbell','w52_bell']]) {
        const q = FIXED_BY_ID[id], side = d(q.opens[0]);
        check(q.appear.found === clue && STORY_CELLS[clue].boon.kind === 'quest', id+'の発見条件と手がかりの恵みが一致');
        check(!game.worldUnlockMet(side), id+'受注前は寄り道が閉鎖');
        G.quest.fixed[id] = {state:'active'};
        check(game.worldUnlockMet(side), id+'受注で寄り道が解放');
        check(q.goal.dungeon === side.id && q.goal.type === 'clear', id+'の目標が寄り道の踏破');
      }
      for (const id of ['w50','w51','w52']) {
        const clue = REPORTS[id].need;
        check(STORY_CELLS[clue].dungeon === id, id+'は手がかりを見つけてから報告');
      }
      for (const id of ['irene_hands','irene_tomorrow']) {
        const beat = IRENE_BEATS.find(b => b.id === id);
        check(!beat.lines({beat:()=>false}).some(t => t.startsWith('セラ')), id+'は未覚醒のセラを登場させない');
        check(beat.lines({beat:k=>k==='irene_sera_wake'}).some(t => t.startsWith('セラ')), id+'は覚醒済みのセラとの会話を表示');
      }
      const ch = CHAPTERS.find(c => c.no === 13);
      check(ch.finale === 'w53' && d(ch.finale).boss === 'bs_forgemaster', '章の結びと主の対応');
      const empty = storyEntries({world:{}}).filter(s=>s.chapter===13);
      check(!empty.length, '未体験の十三章は読み返しに出ない');
      G.world.found = {w50_orders:1,w51_mould:1,w52_bell:1};
      G.world.reported = {w50:1,w51:1,w52:1,w53:1};
      G.world.beats = {pre_w53:1,pre_w53_retry:1,mem_w53:1,irene_hands:1,irene_tomorrow:1,ch13_end:1};
      for (const id of [...ch.dungeons,'ws28','ws29']) G.world.cleared[id] = 1;
      const snapshot = JSON.stringify(G.world);
      const entries = storyEntries(G);
      check(entries.filter(s => s.chapter === 13 && !s.id.startsWith('lore_')).length === 13, '体験済み全13場面を収録');
      check(['w50','w51','w52','w53','ws28','ws29'].every(id=>entries.some(s=>s.id==='lore_'+id)), '踏破した全6迷宮の由来を収録');
      check(JSON.stringify(G.world) === snapshot, '読み返しで進行を変更しない');
      UI.playStoryChain([{...BOSS_MEMORIES.w53, who:'none', kicker:'主の記憶'}]);
      check(!!document.querySelector('.sc-scene'), '挿絵未制作の主の記憶も表示できる');
      return checks;
    }'''))
    page.screenshot(path='/tmp/chapter13-story.png')
    assert not errors, errors
    # テストプレイで新迷宮の盤面と各階の敵の参照を読み込む。
    for dungeon, floor in [('w50', 1), ('w51', 6), ('w52', 10), ('w53', 15), ('ws28', 6), ('ws29', 6)]:
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

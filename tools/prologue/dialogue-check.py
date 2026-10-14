"""未出現の迷宮の台詞・修復案内・旧セーブの酒場の話を確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {_TUTS} = await import('/src/ui/tutorial.js');
      const {REPORTS} = await import('/src/story.js');
      const {TALK_MAP} = await import('/src/tavern.js');
      const {lineOpen} = await import('/src/ui/irene.js');
      const G = game.G, checks = [];
      const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
      G.testUnlock = []; G.world.open = {w01:1}; G.world.reported = {}; G.world.cleared = {};
      const repair = _TUTS.find(t => t.key === 'repairSoul');
      for (const alive of [false, true]) {
        G.party[0].alive = alive;
        const text = JSON.stringify([repair.intro(), repair.steps, repair.outro]);
        check(!/回廊|修道院/.test(text), '初回死亡後の修復説明に未出現の迷宮なし: alive=' + alive);
      }
      const state = {open:id=>!!G.world.open[id], reported:id=>!!G.world.reported[id], found:()=>false};
      check(!/坑口/.test(REPORTS.w03.lines(state).join('')), '王は未出現の坑口を紹介しない');
      G.world.open.w05 = 1;
      check(/坑口/.test(REPORTS.w03.lines(state).join('')), '坑口出現後は通行証の話が自然につながる');
      for (const [id, secret] of [['w11','大樹'],['w15','大神殿'],['w19','大釜'],['w23','大回廊'],['w27','よどみの底'],['w31','頂への道'],['w35','砂の上'],['w39','最奥へ']]) {
        check(!REPORTS[id].lines(state).at(-1).includes(secret), id + ': 道が開く前の報告に次の迷宮なし');
      }
      G.world.beats.mem_w05 = 1; G.world.open.w06 = 0;
      check(!lineOpen('c_layer4'), 'イレーヌは未出現の捨て砦を紹介しない');
      G.tavernCrowd = [
        {id:'t_fort2',line:'古い地下牢の話',name:'老兵'},
        {id:'t_repair',line:'修道院まで無料という古い文',name:'旅人'}
      ];
      G.tavernHeard = {t_fort2:1,t_repair:1};
      check(game.tavernCurrentCrowd().length === 1 && game.tavernCurrentCrowd()[0].line === TALK_MAP.t_repair.t, '旧セーブの台詞を更新し、未出現の地下牢の話を伏せる');
      check(!game.tavernNotes().some(t=>t.id==='t_fort2'), '書き留めた話も未出現なら伏せる');
      G.world.open.w07 = 1;
      check(game.tavernCurrentCrowd().length === 2 && game.tavernNotes().some(t=>t.id==='t_fort2'), '出現後は保存済みの話を再び読める');
      check(G.tavernHeard.t_fort2 === 1 && G.tavernCrowd[0].name === '老兵', '聞いた記録と顔ぶれは保持する');
      for (const t of Object.values(TALK_MAP).filter(t=>t.req?.startsWith('open:'))) {
        const id=t.req.slice(5); G.world.open={};
        G.tavernCrowd=[{id:t.id,line:'旧文'}];
        check(game.tavernCurrentCrowd().length===0, t.id+': 出現前は表示しない');
        G.world.open[id]=1;
        check(game.tavernCurrentCrowd()[0]?.line===t.t, t.id+': 出現後は最新の文を表示');
      }
      return checks.length + '項目成功';
    }'''))
    assert not errors, errors
    browser.close()

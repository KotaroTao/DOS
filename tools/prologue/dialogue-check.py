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
      const {REPORTS, IRENE_BEATS, STORY_CELLS} = await import('/src/story.js');
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
      // 面影は地下牢を訪ねず第二章を二報告しても案内される。
      const omokage = IRENE_BEATS.find(b=>b.id==='irene_omokage');
      for (const known of [[], ['irene_reveal'], ['irene_sera']]) {
        const lines=omokage.lines({beat:id=>known.includes(id)});
        check(known.length ? !lines.some(l=>l.includes('セラという子')) : lines.some(l=>l.includes('セラという子')), 'セラの紹介を既知・未知で切り替える: '+known);
        check(!lines.join('').includes('この顔') && !lines.join('').includes('頭をぬぐって'), '未回収の頭が館にある前提を置かない: '+known);
      }
      const {WORLD}=await import('/src/dungeons/world.js');
      check(WORLD.find(d=>d.id==='w04').hint.includes('B'+STORY_CELLS.w02_sigil.floor+'F'), '取水口の案内は実際の師の印の階と一致');
      G.tavernHeard.t_omokage=1;
      G.tavernCrowd=[{id:'t_omokage',line:'旧文'}];
      delete G.world.beats.irene_omokage;
      check(!game.tavernCurrentCrowd().length && !game.tavernNotes().some(t=>t.id==='t_omokage'), '面影の語りを聞く前は噂と心得を伏せる');
      G.world.beats.irene_omokage=1;
      check(game.tavernCurrentCrowd()[0]?.line===TALK_MAP.t_omokage.t && game.tavernNotes().some(t=>t.id==='t_omokage'), '面影の語りを聞いたら最新の噂と心得を読める');
      G.testUnlock=[];G.tut={earlySoulVersion:1,midUnlockVersion:1,done:{}};
      G.world={open:{},reported:{},cleared:{w03:1},found:{},beats:{}};
      G.stats.fusions=0;
      G.tavernCrowd=[{id:'t_fusesub',line:'旧文'}];
      check(game.featureUnlocked('sub1') && !game.tavernCurrentCrowd().length, 'サブ魂だけ開いても融合の噂はまだ伏せる');
      G.tut.fusionPending=true;
      check(game.tavernCurrentCrowd()[0]?.line===TALK_MAP.t_fusesub.t, '融合の案内が届いたら融合の噂も開く');
      return checks.length + '項目成功';
    }'''))
    assert not errors, errors
    browser.close()

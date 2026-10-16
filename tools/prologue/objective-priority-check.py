"""踏破報告と重なっても、街の目標が手ほどきの行き先・現在の操作を示す。localhost:8000。"""
import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': int(sys.argv[1]) if len(sys.argv) > 1 else 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testScene=tutorial:trainSoul')
    page.wait_for_function('window.__game?.G.testTutorial')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {_TUTS} = await import('/src/ui/tutorial.js');
      const {unphrase} = await import('/src/ui/phrase.js');
      const G = game.G, checks = [];
      const check = (ok, message) => { if (!ok) throw Error(message); };
      // 序章後の帰還で、初踏破の報告と手ほどきが重なった状態。
      G.msq = {n: 1, state: 'world', prologue: {phase: 'done'}};
      const w = game.worldState();
      w.open.w03 = true; w.cleared.w03 = true; w.report = 'w03';
      const verify = (d, started) => {
        const pending = UI.tutorialPending(), o = game.objectiveInfo();
        check(o.key === 'tut' && o.text === pending.text && o.kind === pending.facility,
          d.key + ': 手ほどきの行き先・操作が目標と一致');
        check(o.sub.includes(d.name) && o.act === (started ? '続ける' : '手ほどき'),
          d.key + ': 手ほどきの名前・続行ボタン');
        const root = document.createElement('div');
        UI.renderHub(root);
        check(unphrase(root.querySelector('.hb-goal-t').textContent) === pending.text,
          d.key + ': 街の札の表示');
      };
      for (const d of _TUTS) {
        G.testTutorial = d.key;
        G.tut = {done: {}, cur: null, step: 0, ev: {}, base: {}};
        G.town = {tab: 'hub', page: null, facility: null};
        verify(d, false);
        G.tut.cur = d.key;
        // 館・商会・酒場・門の各施設内で、すべての手順を確認。
        const facility = d.facility || (d.who === 'irene' ? 'party' : d.who);
        G.town.tab = facility === 'tavern' ? 'hub' : facility;
        G.town.page = facility === 'tavern' ? 'tavern' : null;
        for (let step = 0; step < d.steps.length; step++) {
          G.tut.step = step;
          verify(d, true);
          check(game.objectiveInfo().text === d.steps[step].text, d.key + ': 現在の手順');
        }
        G.tut.done[d.key] = true;
        check(game.objectiveInfo().key === 'report', d.key + ': 完了後は王への報告に戻る');
        check(w.report === 'w03', d.key + ': 報告待ちを保持');
        checks.push(d.key + ': 訪問待ち・全手順・完了後の報告を確認');
      }
      // 通常プレイの解放条件で発生した案内も同じ優先順位になる。
      G.testPlay = false;
      G.tut = {done: Object.fromEntries(_TUTS.filter(d => d.key !== 'trainSoul').map(d => [d.key, true])),
        cur: null, step: 0, ev: {}, base: {}, trainPending: true};
      G.town = {tab: 'hub', page: null, facility: null};
      verify(_TUTS.find(d => d.key === 'trainSoul'), false);
      G.tut.cur = 'trainSoul';
      verify(_TUTS.find(d => d.key === 'trainSoul'), true);
      G.tut.done.trainSoul = true;
      check(game.objectiveInfo().key === 'report', '通常プレイでも完了後は報告に戻る');
      checks.push('通常プレイ: 解放条件による手ほどきと報告の重複');
      // 試遊の強制解放を外し、全ての現行手ほどきを本来の条件で確認する。
      const {CHAPTERS} = await import('/src/story.js');
      const phases = {createThree:'three', createFourth:'fourth', createFifth:'fifth',
        createSixth:'sixth', prologueFormation:'formation', prologueAppraise:'appraise', buyEquipment:'shop'};
      __game.inf.addSoulInstance('monk');
      for (const d of _TUTS.filter(d => d.key !== 'rumor')) {
        G.msq = {n: 1, granted: true, state: 'world', prologue: {phase: phases[d.key] || 'done', gifts: {}}};
        G.tut = {done: Object.fromEntries(_TUTS.filter(t => t.key !== d.key).map(t => [t.key, true])),
          cur: null, step: 0, ev: {}, base: {}};
        G.stats.runs = 0; G.stats.fusions = 0; G.stats.questsDone = 0;
        G.party.forEach(doll => { doll.subs = []; });
        G.quest = {active: [], fixed: {}}; G.order = {picks: []};
        w.reported = Object.fromEntries(CHAPTERS[0].dungeons.map(id => [id, 1]));
        w.cleared.w03 = true;
        if (d.key === 'repairSoul') G.tut.repairPending = true;
        if (d.key === 'trainSoul') G.tut.trainPending = true;
        if (d.key === 'shopAppraise') G.tut.appraisePending = true;
        if (d.key === 'soulChange') G.tut.jobVisit = true;
        if (d.key === 'fusion') G.tut.fusionPending = true;
        check(d.open() && !d.used(), d.key + ': 通常の開始条件');
        G.town = {tab: 'hub', page: null, facility: null};
        verify(d, false);
        G.tut.cur = d.key;
        const facility = UI.tutorialPending().facility;
        G.town.tab = facility === 'tavern' ? 'hub' : facility;
        G.town.page = facility === 'tavern' ? 'tavern' : null;
        for (let step = 0; step < d.steps.length; step++) {
          G.tut.step = step;
          verify(d, true);
          check(game.objectiveInfo().text === d.steps[step].text, d.key + ': 通常の現在手順');
        }
        G.town = {tab: 'hub', page: null, facility: null};
        verify(d, true);
        G.tut.done[d.key] = true;
        check(game.objectiveInfo().key !== 'tut', d.key + ': 完了した案内を外す');
        checks.push(d.key + ': 通常条件・全手順・街に戻る・完了を確認');
      }
      // 旧版で開始した案内は、今の開始条件を満たさなくても完了まで保持する。
      G.msq.prologue.phase = 'done';
      for (const key of ['rumor', 'createFourth']) {
        G.tut = {done: Object.fromEntries(_TUTS.filter(d => d.key !== key).map(d => [d.key, true])),
          cur: key, step: 0, ev: {}, base: {}};
        const d = _TUTS.find(d => d.key === key);
        check(!d.open(), key + ': 新規開始の条件は不成立');
        verify(d, true);
        G.tut.done[key] = true;
        check(game.objectiveInfo().key !== 'tut', key + ': 開始済みでも完了後は通常目標');
        checks.push(key + ': 開始条件が変わっても進行中の案内を保持');
      }
      w.reported = {w01: 1};
      // 街の描画後に帰還の条件がそろう。取得した目標だけでなく表示中の札も確認。
      game.pendingIreneBeat = () => null;
      const {soulByUid} = await import('/src/souls.js');
      for (const doll of G.party) { const soul = soulByUid(doll.primary); soul.level = 1; soul.exp = 0; }
      for (const key of ['trainSoul', 'shopAppraise', 'soulChange', 'fusion']) {
        G.tut = {done: Object.fromEntries(_TUTS.filter(d => d.key !== key).map(d => [d.key, true])),
          cur: null, step: 0, ev: {}, base: {}};
        G.town = {tab: 'hub', page: null, facility: null};
        G.prompt = false;
        G.lastRun = null;
        G.soulPts = key === 'trainSoul' ? 100000 : 0;
        if (key === 'shopAppraise') {
          const item = __game.inf.cloneItem('shortSword', 50);
          item.unidentified = true; G.party[0].items.push(item);
        }
        if (['soulChange', 'fusion'].includes(key)) {
          __game.inf.addSoulInstance('monk');
          G.lastRun = {souls: ['monk'], outcome: 'return', sub1LearnedBeforeReturn: key === 'fusion'};
        }
        game.renderTown();
        check(game.objectiveInfo().key === 'report', key + ': 帰還判定前は報告');
        check(UI.tutorialAfterReturn(), key + ': 帰還で手ほどき発生');
        check(UI.tutorialPending()?.key === key, key + ': 対象の手ほどき');
        const shown = unphrase(document.querySelector('.hb-goal-t').textContent);
        check(shown === game.objectiveInfo().text, key + ': 帰還直後の表示更新');
        checks.push(key + ': 帰還判定後の目標を即更新');
      }
      // 帰還の街を描いた後に修復の手ほどきが発生しても、表示中の目標を更新する。
      const repair = _TUTS.find(d => d.key === 'repairSoul');
      for (const fallen of ['broken', 'rescued', 'revived']) {
        for (const interrupted of [false, true]) {
          G.tut = {done: Object.fromEntries(_TUTS.filter(d => !['repairSoul', 'trainSoul'].includes(d.key)).map(d => [d.key, true])),
            cur: interrupted ? 'trainSoul' : null, step: 0, ev: {}, base: {}, trainPending: interrupted};
          G.town = {tab: 'hub', page: null, facility: null};
          G.prompt = false;
          G.party[0].alive = fallen === 'revived';
          G.party[0].reviveAt = fallen === 'rescued' ? Date.now() + 60000 : null;
          if (fallen === 'revived') G.tut.repairFell = true;
          game.renderTown();
          check(UI.tutorialAfterReturn(), fallen + ': 帰還で修復案内を開始');
          check(UI.tutorialPending()?.key === 'repairSoul', fallen + ': 別の手ほどきより優先');
          const shown = unphrase(document.querySelector('.hb-goal-t').textContent);
          check(shown === game.objectiveInfo().text, fallen + ': 描画済みの目標も即更新');
          check(shown.includes('砕けた魂の修復'), fallen + ': 修復を教わる目標を明示');
          check(unphrase(document.querySelector('.hb-goal-s').textContent).includes(repair.name), fallen + ': 修復案内の補足');
          check(w.report === 'w03', fallen + ': 王への報告待ちを保持');
          check(!interrupted || G.tut.repairResume?.cur === 'trainSoul', fallen + ': 中断した案内を保持');
          checks.push(fallen + (interrupted ? '・強化中' : '・報告待ち') + ': 帰還直後の目標表示を更新');
        }
      }
      return checks;
    }'''))
    assert not errors, errors
    browser.close()

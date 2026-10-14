"""見識称号の表示・昇格・旧セーブ・戦闘中の保留を実画面で確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {playerNameCard} = await import('/src/ui/playername.js');
      const {INSIGHT_TITLES, INSIGHT_JOB, INSIGHT_EVENT} = await import('/src/insight.js');
      const {SOUL_CLASSES} = await import('/src/souls.js');
      const {MONSTERS} = await import('/src/sprites.js');
      const {EVENT_MAP} = await import('/src/events.js');
      const {rarityKey} = await import('/src/rarity.js');
      const {G, autosave} = __game;
      const out = [], check = (ok, msg) => { if (!ok) throw Error(msg); out.push(msg); };
      const tick = () => new Promise(r => setTimeout(r, 40));
      const clean = e => e.textContent.replaceAll('\\u200b', '');
      const alerts = () => [...document.querySelectorAll('.ui-sheet')].filter(e => clean(e).includes('操霊師の見識'));
      sheet.closeAll(); G.souls = []; G.testUnlock = []; G.state = 'town';
      const entries = [
        ...Object.entries(SOUL_CLASSES).map(([id,j]) => ({weight:INSIGHT_JOB[j.rarity]*5, type:'job', id, value:{rank:5}})),
        ...Object.keys(MONSTERS).filter(id => !id.startsWith('ev_')).map(id => ({weight:6,type:'mon',id,value:{kills:10}})),
        ...Object.entries(__game.equipLv.ITEMS).map(([id,i]) => ({weight:rarityKey(i)==='lr'?5:1,type:'item',id,value:true})),
        ...Object.entries(EVENT_MAP).map(([id,e]) => ({weight:INSIGHT_EVENT[e.tier],type:'ev',id,value:1})),
      ].sort((a,b) => b.weight-a.weight);
      function score(total) {
        G.codex = {mon:{},item:{},job:{},met:{},fresh:{mon:{},item:{},job:{}}};
        G.named.seen = {}; G.events.seen = {};
        let left = total;
        for(const e of entries) if(e.weight <= left) {
          (e.type === 'ev' ? G.events.seen : G.codex[e.type])[e.id] = e.value;
          left -= e.weight;
        }
        if(left || game.insightSummary().total !== total) throw Error('検証用ポイントを作れない: '+total);
      }
      delete G.world.cleared.w02; delete G.world.reported.w02;
      score(100); G.insightNotified=null; autosave(true); await tick();
      check(playerNameCard().querySelector('.player-name-insight').hidden && !alerts().length, '解放前は称号も通知も非表示');
      G.world.cleared.w02=1; autosave(true); await tick();
      check(!alerts().length, '旧記録の初回評価は昇格通知を出さない');
      for(const rank of INSIGHT_TITLES) {
        score(rank.min);
        check(clean(playerNameCard().querySelector('.player-name-title'))===rank.title, rank.min+'Ptの称号表示');
      }
      async function baseline(total) {
        sheet.closeAll(); await new Promise(r=>setTimeout(r,250)); G.state='town'; score(total); G.insightNotified=total; autosave(true); await tick();
      }
      await baseline(99); score(100); autosave(true); await tick();
      check(alerts().length===1 && clean(alerts()[0]).includes('称号ランクアップ') && clean(alerts()[0]).includes('修練の操霊師'), '100Ptで昇格ポップアップ');
      alerts()[0].querySelector('.ui-sheet-foot button').click();
      await new Promise(r=>setTimeout(r,250)); autosave(true); await tick();
      check(!alerts().length, '確認後に再保存しても重複通知しない');
      await baseline(100); score(101); autosave(true); await tick();
      check(alerts().length===1 && !clean(alerts()[0]).includes('称号ランクアップ') && clean(alerts()[0]).includes('見識 ＋1'), '同じ称号内では通常の見識通知');
      await baseline(299); score(300); autosave(true); score(1500); autosave(true); await tick();
      check(alerts().length===1 && clean(alerts()[0]).includes('修練の操霊師') && clean(alerts()[0]).includes('魂の探究者') && clean(alerts()[0]).includes('見識 ＋1201'), '複数段の昇格を最終称号へまとめる: '+alerts().map(clean).join(' / '));
      await baseline(99); G.state='combat'; score(100); autosave(true); await tick();
      check(!alerts().length, '戦闘中の昇格通知を保留');
      score(600); autosave(true); G.state='board'; autosave(true); await tick();
      check(alerts().length===1 && clean(alerts()[0]).includes('熟練の操霊師'), '戦闘後に到達した称号で一度だけ通知');
      await baseline(10999); score(11000); autosave(true); await tick();
      check(alerts().length===1 && clean(alerts()[0]).includes('伝説の大操霊師'), '11000Ptで伝説の大操霊師へ昇格');
      sheet.closeAll(); await new Promise(r=>setTimeout(r,250)); G.state='town'; UI.openSettings();
      check(clean(document.querySelector('.player-name-title'))==='伝説の大操霊師', '街の設定で名前の下に称号を表示');
      const points=document.querySelector('.player-name-points').getBoundingClientRect();
      const title=document.querySelector('.player-name-title').getBoundingClientRect();
      check(title.x>points.x && Math.abs(title.y-points.y)<3, '390px画面で見識ポイントの右側に表示');
      sheet.closeAll(); await new Promise(r=>setTimeout(r,250)); G.state='board'; UI.openDungeonMenu();
      check(clean(document.querySelector('.player-name-title'))==='伝説の大操霊師', '探索中の手帳にも称号を表示');
      return out;
    }'''))
    page.screenshot(path='/tmp/insight-title-mobile.png')
    for width in [320, 744]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert page.evaluate('''() => {
          const card=document.querySelector('.player-name-card').getBoundingClientRect();
          const title=document.querySelector('.player-name-title').getBoundingClientRect();
          return title.right <= card.right && title.left >= card.left;
        }'''), f'{width}pxで称号がはみ出す'
    assert not errors, errors
    browser.close()

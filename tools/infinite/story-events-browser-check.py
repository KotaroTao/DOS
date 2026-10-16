"""推奨Lvの実際の対応・階生成・極の取得と帰還後の保存を確認（localhost:8000）。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testInf=1&testInfLv=10')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {EVENTS, eligibleEvents, runEvent, onceKey, permanentEventStats} = await import('/src/events.js');
      const {dungeonLevelRaw} = await import('/src/dungeons/world.js');
      const {infLevel} = await import('/src/abyss.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {refDeserialize} = await import('/src/savegraph.js');
      const {G, inf, evApi:A} = __game;
      const check = (ok, msg) => {if (!ok) throw Error(msg);};
      const st = lv => ({abyss:true, dungeonId:'abyss', layer:inf.infSpotInfo(lv).layer,
        lv, floor:G.floor, floors:9999, sources:inf.infSpotInfo(lv).eventSources,
        runEv:G.run.ev || {}, onceDone:e=>!!G.events.once[onceKey(e, e.layer)]});
      for (const e of EVENTS.filter(e=>e.tier==='mythic')) {
        const d = inf.DUNGEONS.find(d=>d.id===e.dungeonId);
        check(eligibleEvents(st(dungeonLevelRaw(d, 1)), A).includes(e), e.id+': 対応Lvで極が候補');
        let reachable = false;
        for (let f=1; f<=1200; f++) {
          if (eligibleEvents(st(infLevel(f)), A).includes(e)) {reachable=true;break;}
        }
        check(reachable, e.id+': 実際の無限迷宮の階から到達可能');
      }
      let story = false, exclusive = false;
      for (let n=0; n<70 && !(story && exclusive); n++) {
        inf.newFloor();
        for (const cell of G.board.cells.flat().filter(c=>c.type==='event')) {
          const event=EVENTS.find(e=>e.id===cell.evId);
          if (event.inf) exclusive=true; else story=true;
        }
      }
      check(story && exclusive, '実際の階生成で本編・専用の両方が出る');
      sheet.closeAll();G.prompt=false;
      const event = EVENTS.find(e=>e.tier==='mythic' && !G.events.once[e.id]);
      const cell={type:'event',evId:event.id};
      const before=permanentEventStats(G.events.once);
      runEvent(A,cell);
      check(G.events.once[event.id] && G.events.seen[event.id], '極の取得を共通記録へ保存');
      check(JSON.stringify(permanentEventStats(G.events.once))!==JSON.stringify(before), '永続強化が増える');
      check(!eligibleEvents(st(dungeonLevelRaw(inf.DUNGEONS.find(d=>d.id===event.dungeonId),1)), A).includes(event), '取得直後から再抽選しない');
      sheet.closeAll();G.prompt=false;
      inf.returnToTown('return');
      const saved=refDeserialize(JSON.parse(inf.saveJSON()));
      check(!G.abyss?.started && saved.events.once[event.id] && saved.events.seen[event.id], '帰還・保存後も本編に取得記録が残る');
      return '全75極が実際の階から到達可能・本編/専用の階生成・極の取得/強化/帰還/保存 OK';
    }'''))
    assert not errors, errors
    browser.close()

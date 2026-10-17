"""風化した死体の職業の魂と残火: 保証・層境界・倍増・無限迷宮・保存・再調査。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=dungeon&testUnlock=infinite')
    page.wait_for_function('window.__game?.G.party.length > 0 && __game.G.board')
    print('\n'.join(page.evaluate('''async () => {
      const {G,inf,affix}=__game;
      const {sheet}=await import('/src/ui/kit.js');
      const {reseedRng,random}=await import('/src/rng.js');
      const {emberMul}=await import('/src/levelcurve.js');
      const {STORY_CELLS}=await import('/src/story.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const out=[],check=(ok,msg)=>{if(!ok)throw Error(msg);out.push('OK '+msg)};
      // 独立した残火抽選の当たり/外れ双方で職業の魂を得る種を使う。
      const seedFor=predicate=>{
        for(let seed=1;seed<100000;seed++) {
          reseedRng(seed);const r=[random(),random(),random()];
          if(predicate(r))return seed;
        }
        throw Error('検査用の種がない');
      };
      const soulMiss=seedFor(r=>r[0]>=.5&&r[1]<.2);
      const soulHit=seedFor(r=>r[0]<.5&&r[1]<.2);
      const goldMiss=seedFor(r=>r[0]>=.5&&r[1]>=.5&&r[1]<.8);
      const goldHit=seedFor(r=>r[0]<.5&&r[1]>=.5&&r[1]<.8);
      const echoMiss=seedFor(r=>r[0]>=.5&&r[1]<.2&&r[2]<.1);
      const echoHit=seedFor(r=>r[0]<.5&&r[1]<.1&&r[2]<.2);
      const echoKey=Object.keys(STORY_CELLS).find(k=>STORY_CELLS[k].boon?.kind==='emberEcho');
      function investigate(seed,expected,soul=true) {
        sheet.closeAll();G.state='board';G.prompt=false;
        const cell=G.board.cells[G.py][G.px];
        Object.assign(cell,{type:'corpse',corpseWarm:false,corpseGreat:false,corpseClass:'fighter',cleared:false});
        const before=G.embers||0,runBefore=G.run.embers||0,foundBefore=G.stats.soulsFound||0;
        reseedRng(seed);affix.resolveCell(cell);
        check((G.embers||0)-before===expected,'残火の増加数 '+expected);
        check((G.run.embers||0)-runBefore===expected,'出撃の残火記録も同数');
        check((G.stats.soulsFound||0)-foundBefore===(soul?1:0),'職業の魂の入手を記録');
        if(soul) {
          const text=document.body.innerText.replaceAll('\\u200b','');
          check(text.includes('魂の残火を '+expected+'つ 手に入れた'),'魂の入手札に残火を併記');
          const saved=refDeserialize(JSON.parse(inf.saveJSON()));
          check(saved.embers===G.embers&&saved.run.embers===G.run.embers,'魂と残火の受け取りを演出前に保存');
        }
        sheet.closeAll();affix.resolveCell(cell);
        check((G.embers||0)-before===expected,'同じ死体を再調査しても増えない');
      }
      G.world.found={};
      for(const [id,n] of [['w02',1],['w37',1],['w38',2],['w49',2]]) {
        G.dungeonIdx=inf.DUNGEONS.findIndex(d=>d.id===id);G.floor=1;
        investigate(soulMiss,n);investigate(soulHit,n);
        out.push('層境界 '+id+': 職業の魂は必ず残火'+n+'、抽選当選時も二重加算なし');
      }
      investigate(goldMiss,0,false);investigate(goldHit,2,false);
      G.world.found[echoKey]=true;
      investigate(echoMiss,4);investigate(echoHit,4);
      out.push('職業の魂以外は従来の50%・極光の書きつけの倍増を維持');
      sheet.closeAll();G.state='town';G.prompt=false;G.party.forEach(d=>d.stability=100);
      check(inf.enterAbyss(['fighter','knight','thief','priest','mage','bishop']),'無限迷宮へ入る');
      for(const depth of [1,1000]) {
        G.abyss.depth=depth;G.floor=depth;G.state='board';
        const n=emberMul(__game.activeCfg().layer);
        investigate(soulMiss,n);investigate(soulHit,n);
        out.push('無限迷宮'+depth+'階: 対応する本編の層で残火'+n);
      }
      return out;
    }''')))
    assert not errors, errors
    browser.close()

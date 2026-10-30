"""広告進行の全員20回復・通常消費・上限・回復時計と、自然回復の表示更新を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

VALUES = [0, 3, 19, 20, 80, 100]
ENTRY = [0, 3, 19, 20, 80, 80]
FLOOR = [10, 13, 29, 30, 90, 90]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def setup():
        page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town&testUnlock=infinite,rematch')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async(values)=>{
          window.ctx=await import('/src/ui/ctx.js');
          window.partyUI=await import('/src/ui/party.js');
          const G=__game.G;G.dungeonBriefed=true;G.stabilityBriefed=true;G.redSoul=0;
          window.check=(ok,msg)=>{if(!ok)throw Error(msg);};
          window.setValues=ds=>ds.forEach((d,i)=>{d.stability=values[i];d.stabilityAt=Date.now()-120000;});
          setValues(G.party);window.before=G.party.map(d=>({...d}));
        }''', VALUES)

    def advertisement():
        page.get_by_role('button', name='広告視聴で全員20回復して進む', exact=True).last.evaluate('b=>b.click()')

    # 残量が混在する隊も全員20回復し100で止まる。回復直後にも入場20・階移動10を消費する。
    setup()
    page.evaluate("ctx.game.departNow({idx:__game.world.DUNGEONS.findIndex(d=>d.id==='w03')})")
    advertisement()
    page.wait_for_function('__game.G.state === "board"')
    assert page.evaluate('__game.G.party.map(d=>d.stability)') == ENTRY
    assert page.evaluate('__game.G.party.slice(0,4).every((d,i)=>d.stabilityAt===before[i].stabilityAt)')
    assert page.evaluate('__game.G.party[4].stabilityAt>before[4].stabilityAt')
    page.evaluate('setValues(__game.G.party);__game.G.floor=5;__game.inf.descend()')
    assert page.evaluate('__game.G.floor') == 5
    advertisement()
    assert page.evaluate('__game.G.floor') == 6
    assert page.evaluate('__game.G.party.map(d=>d.stability)') == FLOOR
    page.evaluate('__game.G.floor=10;__game.inf.descend()')
    assert page.evaluate('__game.G.floor') == 11
    assert page.evaluate('__game.G.party.map(d=>d.stability)') == [v-10 for v in FLOOR]
    assert page.evaluate('__game.G.redSoul') == 0
    page.evaluate('setValues(__game.G.party);__game.G.floor=15;__game.inf.descend()')
    assert page.evaluate('__game.G.floor') == 15
    page.get_by_role('button', name='回復を待つ', exact=True).last.evaluate('b=>b.click()')
    print('本編: 広告で20回復後に入場20・階移動10を消費、100上限、次回も10消費・不足時は再確認')

    # 開いたままの隊シートが、5秒ごとの自然回復処理で表示も更新する。
    page.evaluate('''()=>{
      const d=__game.G.party[0];d.stability=3;d.stabilityAt=Date.now();partyUI.openSheet(d);
      d.stabilityAt-=180000;
    }''')
    page.wait_for_function('__game.G.party[0].stability===4', timeout=7000)
    page.wait_for_function('document.querySelector(".pt-stability")?.innerText.includes("4/100")')
    print('隊シート: 開いたまま自然回復3→4が表示に反映')

    # 実際に保存した記録を通常起動で再開。オフライン分を回復する。
    page.evaluate('''()=>{
      partyUI.closeSheet();for(const d of __game.G.party){d.stability=3;d.stabilityAt=Date.now()-480000;}
      localStorage.setItem('dos-save-v7',__game.inf.saveJSON());
    }''')
    page.goto('http://localhost:8000/')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('__game.world.resumeFromState()')
    assert page.evaluate('__game.G.party.every(d=>d.stability===5)')
    print('保存再開: 回復時計を保ち、オフライン8分相当で3→5')

    # 回復シートの残量だけでなく満タン回復の費用も更新する。
    setup()
    page.evaluate('''()=>{
      const d=__game.G.party[0];d.stability=94;d.stabilityAt=Date.now();__game.G.redSoul=10;
      partyUI.openStability(d);d.stabilityAt-=180000;
    }''')
    page.wait_for_function('__game.G.party[0].stability===95', timeout=7000)
    page.wait_for_function('document.querySelector(".ui-sheet-title")?.innerText.includes("95/100")')
    assert page.get_by_role('button', name='満タンまで回復 (+5)', exact=True).is_visible()
    assert page.get_by_role('button', name='満タンまで回復 (+5)', exact=True).locator('.ui-cost').inner_text() == '1'
    print('回復シート: 自然回復94→95で残量・満タン回復費用を更新')

    # 出撃画面に不足時の回復ボタンがあり、自然回復で残量も更新する。
    setup()
    page.evaluate('ctx.UI.openDeparture()')
    assert page.get_by_role('button', name='回復', exact=True).count() == 3
    page.evaluate('__game.G.party[0].stabilityAt=Date.now()-180000')
    page.wait_for_function('__game.G.party[0].stability===1', timeout=7000)
    page.wait_for_function('document.querySelector(".dp-stability-row")?.innerText.includes(" 1 →")')
    print('出撃画面: 不足時の回復ボタン・自然回復表示を確認')

    # 無限迷宮: 元の人業3体と名のない器3体の両方を20回復。
    setup()
    page.evaluate('''async()=>{
      const G=__game.G;G.party=G.party.slice(0,3);G.reserve=[];
      ctx.game.stabilityStatus(true);
      const ds=[...G.party,...G.stats.inf.stability.filter(Boolean)];setValues(ds);window.before=ds.map(d=>({...d}));
      const {rollStartSouls}=await import('/src/abyss.js');const used=new Set(),picks=[];
      for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];picks.push(k);used.add(k);}
      __game.inf.enterAbyss(picks);
    }''')
    advertisement()
    assert page.evaluate('ctx.game.stabilityStatus().map(d=>d.value)') == ENTRY
    assert page.evaluate('__game.G.party.map(d=>d.stability)') == ENTRY
    assert page.evaluate('[...__game.G.abyss.home.party,...__game.G.stats.inf.stability.filter(Boolean)].slice(0,4).every((d,i)=>d.stabilityAt===before[i].stabilityAt)')
    page.evaluate('''()=>{
      setValues([...__game.G.abyss.home.party,...__game.G.stats.inf.stability.filter(Boolean)]);
      ctx.game.refreshStability();__game.G.floor=5;__game.inf.descend();
    }''')
    assert page.evaluate('__game.G.floor') == 5
    advertisement()
    assert page.evaluate('__game.G.floor') == 6
    assert page.evaluate('ctx.game.stabilityStatus().map(d=>d.value)') == FLOOR
    page.evaluate('__game.G.floor=10;__game.inf.descend()')
    assert page.evaluate('__game.G.floor') == 11
    assert page.evaluate('ctx.game.stabilityStatus().map(d=>d.value)') == [v-10 for v in FLOOR]
    page.evaluate('''()=>{
      setValues([...__game.G.abyss.home.party,...__game.G.stats.inf.stability.filter(Boolean)]);
      ctx.game.refreshStability();__game.G.floor=15;__game.inf.descend();
    }''')
    assert page.evaluate('__game.G.floor') == 15
    page.get_by_role('button', name='回復を待つ', exact=True).last.evaluate('b=>b.click()')
    print('無限迷宮: 元の人業・名のない器を20回復後に入場20・階移動10を消費')

    # 宿敵の再戦にも同じ回復と通常消費を適用する。
    setup()
    page.evaluate('''()=>{
      const d=__game.world.DUNGEONS.find(d=>d.id==='w03');__game.G.stats.bossIds[d.boss]=true;
      const target=ctx.game.rematchList().find(t=>t.key===d.boss);check(!!target,'再戦相手');ctx.game.departRematch(target.key);
    }''')
    advertisement()
    page.wait_for_function('!!__game.G.rematch')
    assert page.evaluate('__game.G.party.map(d=>d.stability)') == ENTRY
    assert page.evaluate('__game.G.party.slice(0,4).every((d,i)=>d.stabilityAt===before[i].stabilityAt)')
    print('宿敵の再戦: 広告で全員20回復後に入場20消費・上限100・満タン未満の時計を保持')
    assert not errors, errors
    browser.close()

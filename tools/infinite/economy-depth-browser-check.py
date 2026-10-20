"""無限迷宮の通貨持ち帰り・倍率なし伝習・深度制限・記憶・旧セーブを実処理で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':844}, reduced_motion='reduce', service_workers='block')
    page.set_default_timeout(60000)
    page.route('https://**/*', lambda route: route.abort())
    errors=[]
    page.on('pageerror', lambda e:errors.append(str(e)))

    def visit(dungeon='w34'):
        page.goto(f'http://localhost:8000/?testDungeon={dungeon}&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length > 0 && !document.body.classList.contains("booting")')

    for outcome in ['return','saved','wipe']:
        visit()
        result=page.evaluate('''async outcome=>{
          const {game}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const g=__game,G=g.G,api=g.infiniteEconomy;
          sheet.closeAll();G.prompt=false;
          const gold=G.gold,soul=G.soulPts;
          if(!g.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']))throw Error('出撃できない');
          const out1={},out2={};
          G.floor=5;G.abyss.depth=5;api.runGainSoulPts(1000,'b',null,1,out1);
          G.floor=50;G.abyss.depth=50;api.runGainSoulPts(2000,'ev',null,1,out2);
          const boosted=G.soulPts;
          if(boosted<=out1.home+out2.home)throw Error('迷宮内では育成倍率を維持');
          g.evApi.paySoul(boosted/2);
          const expected=Math.floor((out1.home+out2.home)/2+1e-9);
          api.runGainGold(1000,'b',null,1);G.gold-=100;
          const currency=api.infReturnCurrency();
          if(currency.soulPts!==expected)throw Error('階ごとの倍率と支出を換算');
          const summary=api.infCloseRun(outcome);
          const values={gold:G.gold-gold,soul:G.soulPts-soul};
          if(api.infCloseRun(outcome)!==null)throw Error('二重持ち帰り');
          return {values,expected,gold:currency.gold,kept:summary.keep};
        }''', outcome)
        keep=outcome!='wipe'
        assert result['kept']==keep
        assert result['values']=={'gold':result['gold'] if keep else 0,'soul':result['expected'] if keep else 0}, result

    # 実際の勝利処理では、仮の器は倍率つきで育ち、館の結社へは倍率なしで伝習する。
    visit('w42')
    assert page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const w=__game.worldState();delete w.reported.w41;w.beats.mem_w41=1;w.report='w41';
      const original=UI.playStoryChain;let pages=[];
      try {UI.playStoryChain=p=>{pages=p;};game.reportMainQuest();}
      finally {UI.playStoryChain=original;w.reported.w41=1;w.report=null;}
      return pages.some(p=>p.title==='無限迷宮 ── 深まる道'&&p.lines[0].includes('B150F'));
    }'''), '王への報告で深度拡張を案内'
    page.evaluate('''async()=>{
      const {sheet}=await import('/src/ui/kit.js');
      const g=__game,G=g.G;sheet.closeAll();G.prompt=false;
      window.benched=g.inf.addSoulInstance('monk');G.order={picks:[benched.uid]};
      g.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']);
      G.floor=5;G.abyss.depth=5;G._evOpening='preempt';
      g.startBattle(g.spawnCardEnemies('bs_drainrat',1),null);
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    result=page.evaluate('''async()=>{
      const {trainCost}=await import('/src/levelcurve.js');
      const g=__game,G=g.G;
      G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;});
      G.battle.result='win';G.battle.rewards=()=>({soul:1000,gold:0});g.rematch.endBattle();
      const currency=g.infiniteEconomy.infReturnCurrency();
      let exp=benched.exp;for(let lv=1;lv<benched.level;lv++)exp+=trainCost(lv);
      return {boosted:G.soulPts,normal:currency.soulPts,exp};
    }''')
    assert result['boosted']>result['normal']>0, result
    assert result['exp']==int(result['normal']*.15), result

    # 上限での停止は安定度・乱数を消費せず、飛び降りも上限を越えない。
    visit()
    result=page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const g=__game,G=g.G,api=g.infiniteEconomy,w=g.worldState();
      const check=(ok,msg)=>{if(!ok)throw Error(msg);};
      check(api.infDepthLimit()===100,'第八章100階');
      w.cleared.w41=1;check(api.infDepthLimit()===100,'踏破のみでは拡張しない');
      w.reported.w41=1;check(api.infDepthLimit()===150,'第十章150階');
      w.reported.w49=1;check(api.infDepthLimit()===200,'第十二章200階');
      delete w.reported.w41;delete w.reported.w49;
      sheet.closeAll();G.prompt=false;
      g.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']);
      G.floor=99;G.abyss.depth=99;g.inf.descend({skip:4,stabilityAd:true});
      check(G.floor===100,'飛び降りも100階で止まる');
      const before=JSON.stringify({rng:G.rng,stability:G.stats.inf?.stability,party:G.party.map(d=>d.stability)});
      g.inf.descend({stabilityAd:true});check(G.floor===100,'100階から降りられない');
      check(JSON.stringify({rng:G.rng,stability:G.stats.inf?.stability,party:G.party.map(d=>d.stability)})===before,'停止時に資源を消費しない');
      G.abyss.guardFloor=100;G.bossDown=true;
      check(game.infSaveMemory(),'上限階でも記憶は保存できる');
      UI.openInfRest({floor:100,guardDown:true,onContinue:()=>{throw Error('上限を越えた');}});
      return {raw:g.inf.saveJSON()};
    }''')
    button=page.get_by_role('button',name='続ける ― B101Fへ',exact=False)
    assert button.is_disabled()
    assert 'B100F' in page.locator('.inf-depth-limit').last.inner_text()
    page.evaluate('''async()=>{
      const {UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');
      sheet.closeAll();UI.openInfMemories();
    }''')
    page.get_by_role('button',name='B100F の記憶',exact=False).click()
    assert page.get_by_role('button',name='B101F から始める',exact=False).is_disabled()

    # 通常記録への読み込みで換算台帳も復元。旧版で上限を越えた出撃は保全して帰還。
    visit('w42')
    raw=page.evaluate('''()=>{
      const g=__game,G=g.G;G.prompt=false;
      g.inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']);
      G.floor=151;G.abyss.depth=151;g.infiniteEconomy.runGainSoulPts(1000,'b',null,1);
      G.gold=123;return g.inf.saveJSON();
    }''')
    loaded=browser.new_page(service_workers='block',reduced_motion='reduce')
    loaded.on('pageerror',lambda e:errors.append(str(e)))
    loaded.route('https://**/*', lambda route: route.abort())
    loaded.set_default_timeout(60000)
    loaded.goto('http://localhost:8000/',wait_until='domcontentloaded')
    loaded.wait_for_function('!!window.__game?.loadGame')
    result=loaded.evaluate('''async raw=>{
      const {game}=await import('/src/ui/ctx.js');
      const g=__game,G=g.G;
      localStorage.setItem('dos-save-v7',raw);if(!g.loadGame())throw Error('読み込めない');
      const home=G.abyss.home,baseGold=home.gold,baseSoul=home.soulPts;
      const expected=g.infiniteEconomy.infReturnCurrency();
      if(!g.infiniteEconomy.enforceInfDepthLimit())throw Error('旧出撃の制限');
      return {town:G.state==='town'&&!G.abyss,gold:G.gold-baseGold,soul:G.soulPts-baseSoul,expected};
    }''',raw)
    assert result['town'] and result['gold']==123 and result['soul']==result['expected']['soulPts'],result
    assert not errors,errors
    print('OK: 混合倍率/支出/帰還/保護/全滅・実戦の倍率なし伝習・深度制限・記憶・保存復元・旧出撃の保全')
    browser.close()

"""戦果・逃走・全滅と、320px〜PCでの内訳の見やすさ・手帳再表示を検査する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
source=(root/'src/game.js').read_text().replace('window.__game = { G,','window.__game = { reportTest: { endBattle, showPendingResults }, G,',1)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':800},service_workers='block',reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.route('https://**',lambda r:r.abort())
    page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://localhost:8000/?testDungeon=w02',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    page.wait_for_function("!document.body.classList.contains('booting') && !document.body.classList.contains('screen-loading')")
    page.evaluate('''async()=>{
      const kit=await import('/src/ui/kit.js'); window.reportKit=kit;
      window.reportUI=await import('/src/ui/results.js');
      window.report={outcome:'win',rounds:12,members:__game.G.party.map((m,i)=>({uid:m.uid,name:m.name,jobKey:m.jobKey,damage:i*1205,taken:100+i*105,healing:i===2?4300:0}))};
      window.checkReport=()=>{
        const card=[...document.querySelectorAll('.ui-sheet.has-performance')].find(n=>!n.closest('.closing'));
        if(!card) throw Error('内訳がない');
        const details=card.querySelector('details.bp');
        if(!details || details.open)throw Error('内訳の初期状態は閉じる');
        details.querySelector('summary').click();
        if(!details.open)throw Error('クリックで開く');
        const body=card.querySelector('.ui-sheet-body'), foot=card.querySelector('.ui-sheet-foot');
        const rect=card.getBoundingClientRect();
        if(rect.left < -1 || rect.right>innerWidth+1 || rect.top < -1 || rect.bottom>innerHeight+1) throw Error('画面外 '+JSON.stringify(rect));
        if(body.scrollWidth>body.clientWidth+1) throw Error('横スクロール');
        for(const n of card.querySelectorAll('.bp-number,.bp-name,.bp-metric')) {
          if(n.scrollWidth>n.clientWidth+1) throw Error('文字の欠け '+n.textContent);
        }
        if(card.querySelectorAll('.bp-member').length!==6) throw Error('人数');
        if(card.querySelectorAll('.bp-number').length!==18) throw Error('項目数');
        // 入手品までが初期表示に入り、内訳は報酬と成長情報の後に続く。
        for (const selector of ['.rs-gain', '.rs-item']) {
          const r=card.querySelector(selector).getBoundingClientRect(), visible=body.getBoundingClientRect();
          if(r.top<visible.top-1 || r.bottom>visible.bottom+1) throw Error('報酬が初期表示にない '+selector);
        }
        if(card.querySelector('.rs-chest').compareDocumentPosition(card.querySelector('.rs-list'))!==Node.DOCUMENT_POSITION_FOLLOWING) throw Error('品より先に成長情報');
        if(card.querySelector('.rs-list').compareDocumentPosition(card.querySelector('.bp'))!==Node.DOCUMENT_POSITION_FOLLOWING) throw Error('内訳が報酬より前');
        body.scrollTop=body.scrollHeight;
        const b=card.querySelector('.ui-sheet-foot button').getBoundingClientRect();
        if(b.bottom>innerHeight || b.top<0) throw Error('操作ボタンが画面外');
        body.scrollTop=0;
      };
    }''')
    for w,h in [(320,550),(390,844),(768,1024),(1024,768),(1280,800),(1440,900)]:
        page.set_viewport_size({'width':w,'height':h})
        for edge in [False,True]:
            page.evaluate('''edge=>{
              reportKit.sheet.closeAll();
              const r=structuredClone(report);
              if(edge) r.members.forEach((m,i)=>{m.name='夜明けの町から旅を続ける同じ名前の人業';m.damage=i?999999999999:0;m.healing=0;m.taken=0;});
              const chest={state:'done',name:'宝箱',outputs:[{kind:'loot',item:{id:'potion'},who:null}]};
              reportUI.openResults({performance:r,gold:1234,soul:567,chest,levels:r.members.map(m=>({name:m.name,from:1,to:2})),skills:[],souls:[]});

            }''',edge)
            page.wait_for_timeout(160)
            page.evaluate('checkReport()')
            if not edge and w in [390,768,1280]: page.screenshot(path=f'/tmp/dos-report-{w}.png')
    # 実際の戦闘終了の入口を通す。演出の時間だけ省く。
    page.evaluate('''()=>{reportKit.sheet.closeAll();__game.G.prompt=false;__game.G.autoCombat=false;__game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);}''')
    page.wait_for_function("__game.G.state==='combat' && __game.G.battle && !__game.G.anim")
    page.evaluate('''()=>{
      const g=__game.G,b=g.battle,a=b.party[0],e=b.enemies[0];
      const before=e.hp;window.expectedDamage=before;e.hp=b._reportHp(a,e,0); e.alive=false;b.result='win';
      b._checkEnd(); __game.reportTest.endBattle();
    }''')
    page.wait_for_function('__game.G.pendingResults?.performance')
    page.evaluate('''()=>{
      const g=__game.G, before=window.expectedDamage;
      if(g.lastBattleReport.members[0].damage!==before) throw Error('実戦集計');
      if(g.pendingResults.performance.members[0].damage!==before) throw Error('戦果の保存');
      if(!document.querySelector('.bp-member')) throw Error('勝利時の表示');
    }''')
    # 戦果の保存と復帰で表示内容を維持し、戦闘後の回復を混ぜない。
    page.evaluate('''async()=>{
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const g=__game.G, before=JSON.stringify(g.lastBattleReport);
      g.pendingResults=refDeserialize(refSerialize(g.pendingResults));
      reportKit.sheet.closeAll();g.prompt=false;__game.reportTest.showPendingResults();
      if(JSON.stringify(g.pendingResults.performance)!==before) throw Error('保存復帰');
      reportKit.sheet.closeAll();g.prompt=false;g.pendingResults=null;
      const {UI}=await import('/src/ui/ctx.js');UI.openDungeonMenu();
    }''')
    page.get_by_text('直前の戦闘',exact=True).click()
    page.wait_for_selector('.ui-sheet.has-performance .bp-member',state='attached')
    assert not page.locator('details.bp').get_attribute('open')
    page.locator('details.bp > summary').click()
    assert page.locator('.bp-member').first.is_visible()
    page.locator('details.bp > summary').click()
    assert not page.locator('.bp-member').first.is_visible()
    page.get_by_role('button',name='閉じる',exact=True).last.click()
    for outcome in ['flee','lose','escaped']:
        page.evaluate('''()=>{reportKit.sheet.closeAll();const g=__game.G;g.prompt=false;g.state='board';__game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);}''')
        page.wait_for_function("__game.G.state==='combat' && __game.G.battle && !__game.G.anim")
        page.evaluate('''outcome=>{
          const g=__game.G,b=g.battle;b.result=outcome;__game.reportTest.endBattle();__game.reportTest.endBattle();
          if([...document.querySelectorAll('.ui-sheet.has-performance')].filter(n=>!n.closest('.closing')).length!==1) throw Error('重複表示');
          if(g.lastBattleReport.outcome!==outcome) throw Error('終了理由');
        }''',outcome)
        page.get_by_role('button',name='次へ',exact=True).last.click()
        page.wait_for_function("__game.G.state!=='combat'")
    page.evaluate('''()=>{reportKit.sheet.closeAll();const g=__game.G;g.prompt=false;g.state='board';__game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);}''')
    page.wait_for_function("__game.G.state==='combat' && __game.G.battle && !__game.G.anim")
    page.evaluate('''()=>{
      const g=__game.G,b=g.battle;
      g.rematch={kind:'elite',key:'bs_drainrat',lv:5,snap:[],savedIdx:g.dungeonIdx,savedFloor:1};
      b.result='win';__game.reportTest.endBattle();
    }''')
    page.wait_for_selector('.ui-sheet.k-rematch')
    page.evaluate('''()=>{
      const cards=[...document.querySelectorAll('.ui-sheet.has-performance')].filter(n=>!n.closest('.closing'));
      if(cards.length!==1 || !cards[0].classList.contains('k-rematch')) throw Error('再戦は戦果と一枚にする');
    }''')
    assert not errors, errors
    print('6画面幅×通常/長い名前/大きな数値/ゼロ: 横はみ出しなし・18項目・スクロール・操作欄、実戦勝利・保存復帰・手帳・逃走/全滅/敵全逃走の重複防止・再戦勝利の同居: OK',flush=True)
    browser.close()

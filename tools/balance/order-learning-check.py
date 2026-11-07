"""結社の伝習を実際の戦闘勝利経路で確認。解禁・保存・手ほどきは order-insight-browser.py。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.set_default_timeout(60000)
    page.route('https://**/*', lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def visit(query):
        page.goto('http://localhost:8000/' + query, wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length > 0 && !document.body.classList.contains("booting")')

    # 実際の勝利処理: 見識解禁・旧記録引き継ぎと共通の割合を使う。
    for dungeon, rate in [("w30", .05), ("w30", .10), ("w42", .15), ("w42", .20)]:
        visit(f'?testDungeon={dungeon}&testPlace=board')
        page.evaluate('''async rate=>{
          const {sheet}=await import('/src/ui/kit.js');
          const g=__game,G=g.G;sheet.closeAll();G.prompt=false;G._evOpening='preempt';
          const s=g.inf.addSoulInstance('monk');G.testUnlock=[];G.order={picks:[s.uid],insightVersion:1,legacySeats:1,legacyRate:rate};window.seated=s;
          window.purse=G.soulPts;
          g.startBattle(g.spawnCardEnemies('bs_drainrat',1),null);
        }''', rate)
        page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
        page.evaluate('''async()=>{
          const g=__game,G=g.G;
          G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;});
          G.battle.result='win';G.battle.rewards=()=>({soul:1000,gold:0});g.ev.endBattle();
        }''')
        page.wait_for_function('__game.G.soulPts > purse')
        result=page.evaluate('''async()=>{
          const {trainCost}=await import('/src/levelcurve.js');
          const G=__game.G;
          let exp=seated.exp;for(let lv=1;lv<seated.level;lv++)exp+=trainCost(lv);
          return {got:G.soulPts-purse,exp};
        }''')
        assert result['got'] > 0 and result['exp'] == int(result['got']*rate), result

    assert not errors, errors
    print('PASS: 実戦の獲得✦Soulから各席へ5/10/15/20%を追加')
    browser.close()

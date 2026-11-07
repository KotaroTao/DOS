"""結社の伝習から無限迷宮の成長倍率だけを除く実戦回帰確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.set_default_timeout(60000)
    page.route('https://**/*', lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for rate in [.1, .15, .2]:
        for floor, reward, over in [(f, 10000, False) for f in [0, 1, 6, 50, 200, 250]] + [(6, 3, False), (1, 10000, True)]:
            page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town', wait_until='domcontentloaded')
            page.wait_for_function('window.__game?.G.party.length > 0 && !document.body.classList.contains("booting")')
            page.evaluate('''async ({rate,floor,over}) => {
              const {sheet}=await import('/src/ui/kit.js');
              const {rollStartSouls}=await import('/src/abyss.js');
              const g=__game,G=g.G;
              sheet.closeAll();G.prompt=false;
              G.testUnlock=['infinite','order','orderLearning'];
              if(rate>=.15)G.testUnlock.push('orderLearning2');
              if(rate>=.2)G.testUnlock.push('orderLearning3');
              const s=g.inf.addSoulInstance('monk');G.order={picks:[s.uid]};window.seated=s;
              if(floor){
                const used=new Set(),picks=[];
                for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];picks.push(k);used.add(k);}
                if(!g.inf.enterAbyss(picks))throw Error('無限迷宮へ入れない');
                G.floor=floor;G.abyss.depth=floor;
              }else{G.state='board';G.floor=1;}
              g.inf.newFloor();sheet.closeAll();G.prompt=false;
              if(over){
                for(const d of G.party)g.rusui.soulByUid(d.primary).level=50;
                g.inf.recalcAllDolls();
              }
              // 他の報酬補正（魂の奔流1.5倍）と、格下狩りのLv差補正も保つ。
              G.specialFloor='soulTide';G.mutator=null;
              window.purse=G.soulPts;G._evOpening='preempt';
              g.startBattle(g.spawnCardEnemies('bs_drainrat',1),null);
            }''', {'rate': rate, 'floor': floor, 'over': over})
            page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
            result = page.evaluate('''async (reward) => {
              const {trainCost}=await import('/src/levelcurve.js');
              const {infGrowthMul}=await import('/src/abyss.js');
              const g=__game,G=g.G;
              G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;});
              G.battle.result='win';G.battle.rewards=()=>({soul:reward,gold:0});
              const gm=G.abyss?.started?infGrowthMul(G.floor):1;
              g.rematch.endBattle();
              await new Promise(resolve=>setTimeout(resolve,1200));
              let exp=seated.exp;for(let lv=1;lv<seated.level;lv++)exp+=trainCost(lv);
              return {got:G.soulPts-purse,gm,exp,rate:g.orderLearning.orderLearningRate()};
            }''', reward)
            # 本編w02の序盤報酬2倍・魂の奔流1.5倍を保つ。格下狩りは下限の20%。
            base = reward * (1.5 if floor else 3) * (.2 if over else 1)
            expected = int(int(base + .5) * rate)
            assert result['got'] == int(base * result['gm'] + .5), result
            assert result['rate'] == rate and result['exp'] == expected, result
            assert result['got'] > 0 and (not floor or result['gm'] > 1), result
            print(f'OK: {rate:.0%} / {"本編" if not floor else f"B{floor}F"} / 戦果{reward} / 格下狩り{over} {result}', flush=True)
    assert not errors, errors
    browser.close()

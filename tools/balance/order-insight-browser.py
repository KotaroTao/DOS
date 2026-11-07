"""見識による結社解禁・館の手ほどき・伝習・保存を実画面で確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for width in [390, 1280]:
        context = browser.new_context(viewport={'width': width, 'height': 900}, service_workers='block', reduced_motion='reduce')
        context.route('https://**/*', lambda r: r.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w29&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0 && !document.body.classList.contains("booting")')
        page.wait_for_timeout(1200)
        print(page.evaluate('''async () => {
          const {game, UI} = await import('/src/ui/ctx.js');
          const {testTutorials} = await import('/src/ui/tutorial.js');
          const {ITEMS} = await import('/src/items.js');
          const {MONSTERS} = await import('/src/sprites.js');
          const {SOUL_CLASSES, soulLevelCapOf} = await import('/src/souls.js');
          const {EVENT_MAP} = await import('/src/events.js');
          const {insightTotals} = await import('/src/insight.js');
          const {ORDER_MILESTONES} = await import('/src/order.js');
          const {sheet} = await import('/src/ui/kit.js');
          const G=game.G, api=__game.orderLearning, checks=[];
          const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
          G.testStoryFlow=true; G.testUnlock=[]; G.prompt=false; G.irene.greeted=true;
          G.world.beats=Object.fromEntries((await import('/src/story.js')).IRENE_BEATS.map(b=>[b.id,true]));
          G.tut={midUnlockVersion:1,earlySoulVersion:1,done:Object.fromEntries(testTutorials.map(t=>[t.id.slice(9),true]))};
          G.order={picks:[],insightVersion:1};
          const regs={monsters:MONSTERS,items:ITEMS,jobs:SOUL_CLASSES,events:EVENT_MAP};
          // 実在IDの図鑑記録で指定の見識を作る。最後は1点の品で調整する。
          const units=[];
          for(const [kind,registry] of [['mon',MONSTERS],['job',SOUL_CLASSES],['ev',EVENT_MAP],['item',ITEMS]]) {
            for(const id of Object.keys(registry)) {
              const state={codex:{mon:{},job:{},item:{}},events:{seen:{}}};
              if(kind==='ev')state.events.seen[id]=true;
              else state.codex[kind][id]=kind==='mon'?{kills:999999}:kind==='job'?{rank:5}:true;
              const value=insightTotals(state,regs).total;
              if(value)units.push({kind,id,value});
            }
          }
          units.sort((a,b)=>b.value-a.value);
          window.scoreTo=n=>{
            G.codex={mon:{},met:{},item:{},job:{},fresh:{}}; G.events.seen={};
            let left=n;
            for(const u of units)if(u.value<=left) {
              if(u.kind==='ev')G.events.seen[u.id]=true;
              else G.codex[u.kind][u.id]=u.kind==='mon'?{kills:999999}:u.kind==='job'?{rank:5}:true;
              left-=u.value;
            }
            check(game.insightSummary().total===n,'図鑑の見識 '+n);G.insightNotified=n;
          };
          scoreTo(999);
          check(!game.featureUnlocked('order'),'報告済みでも見識999では未解禁');
          G.insightNotified=999999;check(!game.featureUnlocked('order'),'通知済み値を解禁条件にしない');
          let seats=0,rate=0;
          for(const m of ORDER_MILESTONES){scoreTo(m.insight);seats=m.seats||seats;rate=m.rate||rate;
            check(game.orderSeats()===seats && game.orderLearningRate()===rate,'解禁 '+m.insight);}
          const a=__game.inf.addSoulInstance('monk'),b=__game.inf.addSoulInstance('hunter');
          G.order.picks=[a.uid,b.uid];scoreTo(2000);a.exp=b.exp=0;
          const purse=G.soulPts;api.distributeOrderLearning(109);
          check(a.exp===5&&b.exp===5&&G.soulPts===purse,'5%を各席へ、切捨て、隊の取り分維持');
          scoreTo(6500);a.level=soulLevelCapOf(a);a.exp=0;api.distributeOrderLearning(109);
          check(a.exp===21,'20%と上限での蓄積');
          const before=a.exp;G.rematch={};api.distributeOrderLearning(100);G.rematch=null;
          check(a.exp===before,'再戦は対象外');
          const home={party:G.party,souls:G.souls};G.abyss={started:true,home};G.party=[];G.souls=[{...a,exp:0}];
          api.distributeOrderLearning(100);
          check(a.exp===before+20&&G.souls[0].exp===0&&api.orderSeatedUids().length===0,'無限迷宮は館の魂のみ育成');
          G.party=home.party;G.souls=home.souls;G.abyss=null;
          scoreTo(1000);G.order.picks=[];delete G.tut.done.order;
          const worn=new Set(G.party.flatMap(d=>[d.primary,...(d.subs||[]).filter(Boolean).map(s=>s.uid)]));
          G.souls=G.souls.filter(s=>worn.has(s.uid));
          (await import('/src/souls.js')).setSharedSouls(G.souls);
          check(UI.tutorialPending()?.key==='order','見識到達で初回手ほどきが待機');
          sheet.closeAll();UI.shell.setTab('hub');
          check(!document.querySelector('.iv-scene:not(.out)'),'館外では会話を開始しない');
          UI.shell.setTab('party');UI.tutorialResume();
          window.UI=UI;window.game=game;window.sheet=sheet;
          return `${checks.length}項目を確認`;
        }'''))
        # 会話を読み進め、実操作へ。
        def read_until(predicate):
            for _ in range(70):
                if page.evaluate('sheet.top()?.kind === "celebrate"'):
                    page.locator('.ui-sheet-foot .ui-btn.k-primary').last.click(force=True)
                    page.wait_for_timeout(180)
                    continue
                if page.evaluate(predicate):
                    page.wait_for_timeout(350)
                    return
                if page.locator('.iv-scene').count():
                    page.keyboard.press('Enter')
                elif page.locator('.tut-next').count():
                    page.locator('.tut-next').click(force=True)
                page.wait_for_timeout(180)
            raise AssertionError(page.locator('body').inner_text()[-2500:])
        read_until("game.G.tut.cur==='order' && !document.querySelector('.iv-scene:not(.out)')")
        page.locator('.pt-order').click(force=True)
        page.wait_for_selector('.sp-orow button')
        assert not page.evaluate('!!game.G.tut.done.order'), '開いただけでは手ほどきを完了しない'
        page.locator('.sp-orow button').first.click(force=True)
        page.evaluate('sheet.closeAll()')
        read_until('!!game.G.tut.done.order && !document.querySelector(".iv-scene:not(.out)")')
        assert page.evaluate('game.G.order.picks.length>0 && game.G.tut.orderBrief.seats===1')
        # 伝習の初回説明を受け、各席5%の表示を実際に確認する。
        page.evaluate("scoreTo(2000);delete game.G.tut.done.orderLearning;UI.shell.setTab('party');UI.tutorialResume()")
        read_until("game.G.tut.cur==='orderLearning' && !document.querySelector('.iv-scene:not(.out)')")
        page.locator('.pt-order').click(force=True)
        page.wait_for_selector('.sp-order-learning')
        assert '5%' in page.locator('.sp-order-learning').inner_text()
        page.locator('.tut-next').click(force=True)
        read_until("game.G.tut.done.orderLearning && !document.querySelector('.iv-scene:not(.out)')")
        # 追加の節目をまとめて説明し、出撃は妨げない。
        page.evaluate("scoreTo(6000);game.G.tut.done.orderLearning=true;UI.shell.setTab('hub')")
        assert page.evaluate("UI.tutorialPending()?.key==='orderProgress' && !game.blockForTutorial()")
        page.evaluate("UI.shell.setTab('party');UI.tutorialResume()")
        read_until("game.G.tut.orderBrief?.seats===8 && !game.G.tut.cur && !document.querySelector('.iv-scene:not(.out)')")
        assert page.evaluate('game.G.tut.orderBrief.rate===.15 && !UI.tutorialPending()')
        # もう一度条件に達した時にも反復案内できる。
        page.evaluate("scoreTo(6500);UI.shell.setTab('party');UI.tutorialResume()")
        read_until("game.G.tut.orderBrief?.rate===.20 && !game.G.tut.cur && !document.querySelector('.iv-scene:not(.out)')")
        # 案内済み・席・見識の保存後に通常の読み込み経路から復元する。
        before=page.evaluate("({seats:game.orderSeats(),rate:game.orderLearningRate(),picks:game.G.order.picks,brief:game.G.tut.orderBrief})")
        page.evaluate('localStorage.setItem("dos-save-v7",__game.inf.saveJSON())')
        page.goto('http://localhost:8000/', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0 && !document.body.classList.contains("booting")')
        after=page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return {seats:game.orderSeats(),rate:game.orderLearningRate(),picks:game.G.order.picks,brief:game.G.tut.orderBrief}}')
        assert after==before, (before,after)
        # 旧形式の記録を実際の読込経路へ渡し、解禁済み状態を保護する。
        page.evaluate('''async()=>{
          const {game}=await import('/src/ui/ctx.js');const {CHAPTERS}=await import('/src/story.js');
          game.G.order={picks:game.G.order.picks};
          for(const c of CHAPTERS)for(const id of c.dungeons)game.G.world.reported[id]=true;
          game.G.codex={mon:{},met:{},item:{},job:{},fresh:{}};game.G.events.seen={};
          localStorage.setItem('dos-save-v7',__game.inf.saveJSON());
        }''')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0 && !document.body.classList.contains("booting")')
        assert page.evaluate('__game.G.order.insightVersion===1 && __game.G.order.legacySeats===6 && __game.G.order.legacyRate===.20')
        assert not errors, errors
        page.screenshot(path=f'/tmp/order-insight-{width}.png')
        print(f'PASS {width}px: 着席の実操作・一括案内・反復案内')
        context.close()
    browser.close()

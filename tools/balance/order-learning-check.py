"""結社の伝習: 解放、実戦の獲得額、席の検証、上限・保存、無限迷宮、手ほどき。localhost:8000。"""
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

    visit('?testDungeon=w29&testPlace=town')
    result = page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {soulLevelCapOf} = await import('/src/souls.js');
      const {trainCost} = await import('/src/levelcurve.js');
      const g=__game, G=g.G, api=g.orderLearning;
      const check=(ok, msg)=>{if(!ok) throw Error(msg);};
      const w=g.worldState(); G.testUnlock=[];
      const a=g.inf.addSoulInstance('monk'), b=g.inf.addSoulInstance('hunter');
      G.order={picks:[a.uid,b.uid]};
      delete w.reported.w29; w.cleared.w29=1;
      check(!api.featureUnlocked('orderLearning'), '踏破だけでは未解放');
      api.distributeOrderLearning(100); check(a.exp===0, '解放前に付与しない');
      w.reported.w29=true;
      check(api.featureUnlocked('orderLearning'), '第七章の結びの報告で解放');
      const purse=G.soulPts;
      api.distributeOrderLearning(109);
      check(a.exp===10 && b.exp===10, '各席に10%、端数切捨て、人数割りなし');
      check(G.soulPts===purse, '隊の所持Soulを減らさない');
      const main=game.soulByUid(G.party[0].primary), before=main.exp;
      const sub=g.inf.addSoulInstance('shadow'); G.party[0].subs=[{uid:sub.uid,picks:[]}];
      G.order.picks=[main.uid,sub.uid,a.uid,a.uid,999999,b.uid];
      api.distributeOrderLearning(100);
      check(main.exp===before && sub.exp===0 && a.exp===20 && b.exp===20, '編成中・消失・重複の席を除外');
      G.order.picks=[a.uid,b.uid];
      a.level=soulLevelCapOf(a); a.exp=0;
      api.distributeOrderLearning(1000); check(a.exp===100, '上限でも蓄積');
      a.capBonus=(a.capBonus||0)+1; a.exp=trainCost(a.level);
      const old=a.level; api.settleSoulExp(a); check(a.level===old+1, '上限拡張後に蓄積を成長へ注ぐ');
      a.level=1; a.exp=trainCost(1)-10;
      const levels=api.distributeOrderLearning(100);
      check(a.level===2 && levels[0].order && levels[0].soul===a, 'Lv上昇と祝祭の情報');
      const prev=a.exp; G.order.picks=[]; api.distributeOrderLearning(100);
      check(a.exp===prev, '空席には加算しない'); G.order.picks=[a.uid,b.uid];
      G.rematch={}; api.distributeOrderLearning(100); G.rematch=null;
      check(a.exp===prev, '宿敵の再戦は対象外');
      // 無限迷宮の魂と本編の魂のuidが重なっても、館に退けた魂だけを育てる。
      const home={party:G.party,reserve:G.reserve,souls:G.souls};
      G.abyss={started:true,home}; G.party=[]; G.souls=[{...a,exp:0}];
      const fake=G.souls[0]; a.level=1; a.exp=trainCost(1)-10;
      const infLevels=api.distributeOrderLearning(100);
      check(a.level===2 && fake.exp===0, '無限迷宮では本編の席の魂へ付与');
      check(api.orderSeatedUids().length===0, '仮の器へ能力を加算しない');
      UI.celebrateLevelUp(infLevels);
      window.restore=()=>{G.party=home.party;G.reserve=home.reserve;G.souls=home.souls;G.abyss=null;};
      return {level:a.level};
    }''')
    assert result['level'] == 2
    text = page.locator('.sp-cel-lu').inner_text().replace('\u200b', '')
    assert '武僧' in text or '武闘家' in text or '結社' in text
    assert '結社の伝習' in text and '岩砕き' in text, text
    page.evaluate('restore()')
    before = page.evaluate("""async()=>{
      const g=__game, G=g.G;
      const {testTutorials}=await import('/src/ui/tutorial.js');
      G.tut.done=Object.fromEntries(testTutorials.filter(t=>t.id!=='tutorial:orderLearning').map(t=>[t.id.slice(9),true]));
      G.tut.cur=null;
      localStorage.setItem('dos-save-v7',g.inf.saveJSON());
      return G.souls.find(s=>s.uid===G.order.picks[0]).exp;
    }""")
    visit('')
    assert page.evaluate("""()=>{
      const g=__game, G=g.G;
      return {open:g.orderLearning.featureUnlocked('orderLearning'),exp:G.souls.find(s=>s.uid===G.order.picks[0]).exp};
    }""") == {'open': True, 'exp': before}
    assert page.evaluate('async()=>{const {UI}=await import("/src/ui/ctx.js");return UI.tutorialPending()?.key}') == 'orderLearning'


    # 実際の勝利処理: 戦果画面に表示される獲得Soulの10%になる。
    visit('?testDungeon=w30&testPlace=board')
    page.evaluate('''async()=>{
      const {sheet}=await import('/src/ui/kit.js');
      const g=__game,G=g.G;sheet.closeAll();G.prompt=false;G._evOpening='preempt';
      const s=g.inf.addSoulInstance('monk');G.order={picks:[s.uid]};window.seated=s;
      window.purse=G.soulPts;
      g.startBattle(g.spawnCardEnemies('bs_drainrat',1),null);
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    result=page.evaluate('''async()=>{
      const {trainCost}=await import('/src/levelcurve.js');
      const g=__game,G=g.G;
      G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;});
      G.battle.result='win';G.battle.rewards=()=>({soul:1000,gold:0});g.rematch.endBattle();
      let exp=seated.exp;for(let lv=1;lv<seated.level;lv++)exp+=trainCost(lv);
      return {got:G.soulPts-purse,exp};
    }''')
    assert result['got'] > 0 and result['exp'] == int(result['got']*.1), result

    # 手ほどきは結社を開く実操作で完了し、受講状態は保存対象に残る。
    visit('?testScene=tutorial:orderLearning')
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    page.locator('.ui-tab[data-key="party"].tut-glow').click()
    page.wait_for_selector('.iv-scene')
    pages=[]
    for _ in range(4):
        pages.append(page.locator('.iv-scene .pt-kp-text').inner_text().replace('\u200b',''))
        page.keyboard.press('Enter')
    assert '10%' in ''.join(pages) and '無限迷宮' in ''.join(pages)
    page.wait_for_selector('.iv-scene', state='detached')
    page.locator('.pt-order.tut-glow').click()
    assert '10%' in page.locator('.sp-order-learning').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'スマホの幅に収まる'
    page.locator('.tut-next').click()
    page.wait_for_function('__game.G.tut.done.orderLearning === true')
    page.evaluate('localStorage.setItem("dos-save-v7", __game.inf.saveJSON())')
    visit('')
    assert page.evaluate('__game.G.tut.done.orderLearning === true'), '受講済みを保存・復元'
    assert not errors, errors
    print('OK: 第七章報告前後・各席10%・無効席/重複除外・上限蓄積・無限迷宮・実戦の獲得額・祝祭・手ほどき完了')
    browser.close()

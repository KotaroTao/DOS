"""広告による保護帰還・安定度補充の回帰確認。localhost:8000、Playwright と Chromium を使用。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block', reduced_motion='reduce')
    page.set_default_timeout(60000)
    page.route('https://**/*', lambda route: route.abort())
    def game_route(route):
        r=route.fetch()
        route.fulfill(response=r,body=r.text()+'\nwindow.adTest={G,gameOver,descend,departNow,consumeEntryStability,stabilityReady,DUNGEONS,closePrompt};')
    page.route('**/src/game.js*',game_route)
    page.add_init_script("const later=window.setTimeout;window.setTimeout=(f,t,...a)=>later(f,String(f).includes('起動がタイムアウト')?120000:t,...a);window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout")
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    def visit(d='w03', town=False):
        page.goto('http://localhost:8000/?testDungeon='+d+('&testPlace=town' if town else ''),wait_until='domcontentloaded')
        page.wait_for_function('window.adTest && !document.body.classList.contains("booting") && !adTest.G.prompt')
    def button(text):
        return page.get_by_role('button',name=text,exact=False)
    def wipe(red):
        return page.evaluate('''red=>{const g=adTest.G;g.redSoul=red;g.run.gold=123;g.gold+=123;g.party.forEach(d=>{d.hp=0;d.alive=false});const snap={gold:g.gold,soulPts:g.soulPts,inventory:JSON.stringify(g.inventory),souls:JSON.stringify(g.souls)};adTest.gameOver();return snap;}''',red)
    for mode,red in [('ad',0),('ad',0),('red',20)]:
        visit();before=wipe(red)
        button('広告視聴で全てを守って帰還' if mode=='ad' else '赤い魂 20 で全てを守る').click()
        page.wait_for_function('adTest.G.state === "town"')
        after=page.evaluate('''()=>{const g=adTest.G;return {gold:g.gold,soulPts:g.soulPts,inventory:JSON.stringify(g.inventory),souls:JSON.stringify(g.souls)}}''')
        assert before==after,(before,after)
        assert page.evaluate('adTest.G.redSoul===0 && adTest.G.party.every(d=>d.alive && d.hp===1)')
        print('全滅の保護帰還・戦利品保持:',mode,flush=True)
    for d in ['w00_forest','w01','w02']:
        visit(d);wipe(0)
        assert button('広告視聴で全てを守って帰還').count()==0
        button('無料で全てを守って帰還').click()
        page.wait_for_function('adTest.G.state === "town"')
        assert page.evaluate('adTest.G.redSoul===0 && adTest.G.party.every(d=>d.alive && d.hp===1)')
        assert page.evaluate('''()=>{const g=adTest.G;g.party.forEach(d=>{d.stability=0;d.stabilityAt=Date.now()});return adTest.consumeEntryStability(adTest.DUNGEONS[g.dungeonIdx].id)&&g.party.every(d=>d.stability===0)}''')
        print('無料迷宮・広告非表示・安定度消費なし:',d,flush=True)
    visit(town=True)
    page.evaluate('''()=>{const g=adTest.G;g.redSoul=0;g.party.forEach((d,i)=>{d.stability=i?0:70;d.stabilityAt=Date.now()});adTest.departNow()}''')
    button('広告視聴で1回分進む').click()
    page.wait_for_function('adTest.G.state === "board" && !adTest.G.prompt')
    assert page.evaluate('adTest.G.redSoul===0 && adTest.G.party[0].stability===40 && adTest.G.party.slice(1).every(d=>d.stability===0)')
    print('入場: 不足分だけ広告補充、通常消費、赤い魂0',flush=True)
    for floor in [5,10]:
        page.evaluate('''floor=>{const g=adTest.G;g.floor=floor;g.party.forEach(d=>{d.stability=0;d.stabilityAt=Date.now()});adTest.descend()}''',floor)
        assert page.evaluate('adTest.G.floor')==floor
        button('広告視聴で1回分進む').click()
        page.wait_for_function('(floor)=>adTest.G.floor===floor+1 && !adTest.G.prompt',arg=floor)
        assert page.evaluate('adTest.G.redSoul===0 && adTest.G.party.every(d=>d.stability===0)')
        print('連続広告で進行:',floor,'→',floor+1,flush=True)
    for red in [0,20]:
        page.goto('http://localhost:8000/?testInf=15',wait_until='domcontentloaded')
        page.wait_for_function('window.adTest && adTest.G.abyss && adTest.G.state === "board" && !adTest.G.prompt')
        before=page.evaluate('red=>{const g=adTest.G;g.redSoul=red;g.party.forEach(d=>{d.hp=0;d.alive=false});adTest.gameOver();return g.abyss.home.gold}',red)
        button('広告視聴で持ち帰る' if red==0 else '赤い魂 20 で持ち帰る').click()
        page.wait_for_function('adTest.G.state === "town" && !adTest.G.abyss')
        assert page.evaluate('adTest.G.redSoul')==0
        assert page.evaluate('adTest.G.gold')==before
        assert page.evaluate('__game.inf.abyssRecords().recent[0].outcome')=='saved'
        print('無限迷宮: 保護帰還',red,flush=True)
    visit(town=True)
    page.evaluate("()=>{const g=adTest.G;g.redSoul=999;g.party.forEach(d=>{d.stability=0;d.stabilityAt=Date.now()});adTest.departNow()}")
    count=page.evaluate('adTest.G.party.length')
    button('で不足分を購入して進む').click()
    page.wait_for_function('adTest.G.state === "board" && !adTest.G.prompt')
    assert page.evaluate('adTest.G.redSoul')==999-count*30
    print('既存の赤い魂による安定度購入も正常',flush=True)
    assert not errors,errors
    browser.close()
    print('すべて成功。ブラウザー例外なし。')

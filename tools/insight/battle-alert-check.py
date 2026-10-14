"""戦闘中と戦果確認中は見識を保留し、品の初発見を合算する。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(service_workers='block'); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=board&testUnlock=insight')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async()=>{
    const {game}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');
    const g=__game,G=g.G;sheet.closeAll();G.prompt=false;G._evOpening='preempt';
    G.codex.mon.bs_drainrat={kills:4,main:4};G.insightNotified=null;g.autosave(true);
    window.before=game.insightSummary().total;
    g.startBattle(g.spawnCardEnemies('bs_drainrat',1),null);
    return {state:G.state,total:before};}''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    page.evaluate('''async()=>{
    const {game}=await import('/src/ui/ctx.js');
    const g=__game,G=g.G;
    window.al=()=>[...document.querySelectorAll('.ui-sheet')].filter(e=>e.textContent.replaceAll('\\u200b','').includes('✦ 操霊師の見識 ✦'));
    G.codex.mon.bs_drainrat={kills:5,main:5};G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;e._codexKill=true});
    g.autosave(true);await new Promise(r=>setTimeout(r,50));if(al().length)throw Error('戦闘中に通知');
    G.battle.result='win';G.battle.rewards=()=>({soul:0,gold:0});g.rematch.endBattle();
    await new Promise(r=>setTimeout(r,50));if(al().length)throw Error('宝箱確認前に通知');
    const item=Object.keys(g.equipLv.ITEMS).find(k=>!G.codex.item[k]);game.codexSeeItem(item);g.autosave(true);
    await new Promise(r=>setTimeout(r,50));if(al().length)throw Error('品の発見で別通知');
    window.expected=game.insightSummary().total-before;
    return {expected,results:document.querySelector('.rs-sheet')?.textContent};}''')
    page.locator('.rs-sheet .ui-sheet-foot button').last.evaluate('(e)=>e.click()')
    # 魂の祝祭などがあれば閉じる
    for _ in range(12):
        page.wait_for_timeout(300)
        if page.evaluate('al().length'):break
        btn=page.locator('.ui-sheet-foot button').last
        if btn.count():btn.evaluate('(e)=>e.click()')
    result=page.evaluate('({alerts:al().map(e=>e.textContent.replaceAll("\\u200b","")),expected})')
    assert result['expected'] == 3, result
    assert len(result['alerts']) == 1, result
    assert f"見識 ＋{result['expected']}" in result['alerts'][0], result
    page.evaluate('__game.autosave(true)')
    page.wait_for_timeout(100)
    assert page.evaluate('al().length') == 1
    print('討伐の開示 + 品の初発見を、戦果確認後に1回だけ通知 OK')
    assert not errors, errors
    b.close()

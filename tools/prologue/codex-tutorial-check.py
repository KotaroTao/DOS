"""オルデンの会話・専用絵・王宮の図鑑操作・記録保持・途中再開を確認。"""
from playwright.sync_api import sync_playwright, TimeoutError
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [390,1280]:
  for recorded in [False,True]:
   page=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block')
   page.route('https://**/*',lambda r:r.abort())
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://localhost:8000/?testScene=tutorial:insight')
   page.wait_for_function('window.__game?.G.testTutorial')
   page.locator('#studio-splash').wait_for(state='detached')
   page.add_style_tag(content='.test-play-banner{display:none!important}')
   page.evaluate('''async known=>{const {game,UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');const G=game.G;
    G.world.cleared.w02=1; G.codex.mon=known?{bs_dustroach:{kills:3,main:3,dungeons:{0:true}}}:{};
    G.insightNotified=game.insightSummary().total;game.renderTown(); if(game.featureUnlocked('codex'))throw Error('開始前に図鑑が見える');
    UI.settingsSheet();if(document.querySelector('.stg-codex'))throw Error('設定に図鑑が残る');sheet.closeAll();
   }''',recorded)
   page.locator('.ui-tab[data-key="palace"]').click()
   page.wait_for_selector('.sc-kicker')
   assert 'オルデン' in page.locator('.sc-kicker').inner_text()
   page.wait_for_function('document.body.innerText.includes("ようこそ")')
   page.wait_for_function('document.querySelector(".sc-photo")?.naturalWidth > 0')
   assert page.locator('.sc-photo').get_attribute('src').endswith('/art/tutorial/olden.webp')
   assert page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return __game.G.insightNotified===game.insightSummary().total}'),'練習用記録では見識通知を会話に挟まない'
   page.wait_for_selector('.sc-scene.revealed')
   page.wait_for_timeout(1200)
   if not recorded:page.screenshot(path=f'/tmp/olden-tutorial-{width}.png')
   resumed=False;conversations=0
   for n in range(100):
    page.wait_for_timeout(180)
    if page.evaluate('!!__game.G.tut.done.insight'):break
    scene=page.locator('.sc-scene:not(.out)')
    if scene.count():
     assert 'オルデン' in scene.locator('.sc-kicker').inner_text()
     assert '解放前' not in scene.inner_text() and '設定' not in scene.inner_text()
     conversations+=1
     ok=scene.locator('.sc-okb:visible')
     if ok.count():ok.click()
     else:scene.locator('.sc-lines').click()
     page.wait_for_timeout(200);continue
    if not resumed and page.evaluate('__game.G.tut.step===1 && !__game.G.tut.ev.codexMonViewed'):
     page.evaluate('''async()=>{const {UI}=await import('/src/ui/ctx.js');UI.openPalace('decree');UI.tutorialResume();}''')
     page.locator('.pl-body.s-codex').wait_for();resumed=True
    glow=page.locator('.tut-glow:visible')
    if glow.count():
     try:glow.first.click(timeout=1500)
     except TimeoutError:continue
   else:raise AssertionError(page.evaluate('({t:__game.G.tut,text:document.body.innerText.slice(-1800)})'))
   page.wait_for_selector('.sc-scene:not(.out) .sc-okb')
   assert '操霊師の' in page.locator('.sc-scene:not(.out) .sc-lines').inner_text()
   page.locator('.sc-scene:not(.out) .sc-okb').click()
   assert conversations>=2,'挨拶と敵の情報を読む案内を会話で実施'
   assert page.evaluate('__game.G.codex.mon.bs_dustroach.kills')==(3 if recorded else 1)
   assert resumed,'魔物の札を読む手順を再開できる'
   assert not page.locator('.stg-codex').count()
   assert page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const {tutState}=await import('/src/ui/tutorial.js');const {sheet}=await import('/src/ui/kit.js');
    UI.settingsSheet();const absent=!document.querySelector('.stg-codex');sheet.closeAll();
    const saved=game.G.tut;game.G.tut={cur:'insight',step:1,ev:{codexOpened:true},done:{}};const old=tutState();const restarted=old.cur===null&&old.step===0;
    game.G.tut={done:{insight:true}};const complete=tutState().done.insight;game.G.tut=saved;return absent&&restarted&&complete;
   }'''),'設定からの途中記録は挨拶から再開し、完了記録は保持する'
   assert not errors,errors
   print(f'{width}px / 既存討伐{recorded}: オルデンの挨拶・専用絵→王宮の図鑑→魔物詳細・再開 OK',flush=True)
   page.close()
 b.close()

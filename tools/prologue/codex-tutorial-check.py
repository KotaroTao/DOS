"""図鑑開始前の非表示・討伐保持・空記録の補完と設定からの実操作。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [390,1280]:
  for recorded in [False,True]:
   page=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block')
   page.route('https://**/*',lambda r:r.abort())
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://localhost:8000/?testScene=tutorial:insight')
   page.wait_for_function('window.__game?.G.testTutorial')
   page.add_style_tag(content='.test-play-banner{display:none!important}')
   page.evaluate('''async known=>{const {game}=await import('/src/ui/ctx.js');const G=game.G;
    G.world.cleared.w02=1; G.codex.mon=known?{bs_dustroach:{kills:3,main:3,dungeons:{0:true}}}:{};
    game.renderTown(); if(game.featureUnlocked('codex'))throw Error('開始前に図鑑が見える');
   }''',recorded)
   resumed=False
   for n in range(90):
    page.wait_for_timeout(180)
    if page.evaluate('!!__game.G.tut.done.insight'):break
    if not resumed and page.evaluate('__game.G.tut.step===1 && !__game.G.tut.ev.codexMonViewed'):
     page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');const {UI}=await import('/src/ui/ctx.js');sheet.closeAll();UI.tutorialResume();}''')
     page.locator('.cx-sheet').last.wait_for();page.wait_for_timeout(300);resumed=True
    skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
    if skip.count():skip.first.click();continue
    glow=page.locator('.tut-glow:visible')
    if glow.count():glow.first.click()
   else:raise AssertionError(page.evaluate('({t:__game.G.tut,text:document.body.innerText.slice(-1800)})'))
   assert page.evaluate('__game.G.codex.mon.bs_dustroach.kills')==(3 if recorded else 1)
   assert page.evaluate('!!__game.G.tut.done.insight')
   assert not errors,errors
   print(f'{width}px / 既存討伐{recorded}: 設定→図鑑→魔物詳細→完了 OK',flush=True)
   page.close()
 b.close()

"""面影の語りを実際に閉じた直後、館の見出しから写せることを確認。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [390,1280]:
  page=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce',service_workers='block')
  page.route('https://**/*',lambda r:r.abort())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testDungeon=w09&testPlace=town',wait_until='domcontentloaded')
  page.wait_for_function('window.__game?.G.party.length>0')
  page.locator('#studio-splash').wait_for(state='detached')
  page.add_style_tag(content='.test-play-banner{display:none!important}')
  page.evaluate('''async()=>{
   const {game,UI}=await import('/src/ui/ctx.js');const {IRENE_BEATS}=await import('/src/story.js');const {_TUTS}=await import('/src/ui/tutorial.js');
   const G=game.G;G.testStoryFlow=true;G.msq.prologue={phase:'done'};G.msq.n=1;G.irene.greeted=true;G.stats.runs=0;
   G.tut={done:Object.fromEntries(_TUTS.map(t=>[t.key,true]))};G.world.beats=Object.fromEntries(IRENE_BEATS.filter(b=>b.id!=='irene_omokage').map(b=>[b.id,1]));
   game.codexSweepJobs();UI.shell.setTab('hub');game.renderTown();
   if(game.omokageUnlocked())throw Error('語りの前に解放されている');
  }''')
  page.locator('.ui-tab[data-key="party"]').click()
  page.wait_for_selector('.sc-title')
  assert page.locator('.sc-title').inner_text().replace('\u200b','')=='彫られた顔'
  assert not page.locator('.pt-face-on').count(),'語りを聞く前は入口を出さない'
  for _ in range(45):
   if page.evaluate('!!__game.G.world.beats.irene_omokage'):break
   scene=page.locator('.sc-scene:not(.out)');ok=scene.locator('.sc-okb:visible')
   if ok.count():ok.click()
   else:scene.locator('.sc-lines').click()
   page.wait_for_timeout(180)
  assert page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return game.omokageUnlocked()}')
  face=page.locator('.pt-mansion-head .pt-face-on, .pc-mansion-head .pt-face-on')
  face.wait_for(timeout=3000)
  face.click();page.locator('.pt-om-sheet').wait_for()
  tile=page.locator('.pt-om-sheet button.pt-om-t').last
  tile.click()
  assert page.evaluate('!!__game.G.party[0].face'),'会話直後に面影を写せる'
  assert not errors,errors
  print(f'{width}px: 語り完了直後に解放・入口表示・面影の選択 OK',flush=True)
  page.close()
 b.close()

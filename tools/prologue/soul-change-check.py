"""新職業の魂の手ほどき・旧案内の移行を実画面で確認する。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844}); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testScene=tutorial:soulChange');page.wait_for_function('window.__game?.G.testTutorial');page.add_style_tag(content='.test-play-banner{display:none!important}')
 assert page.evaluate('__game.G.town.tab')=='hub'
 assert not page.evaluate('__game.G.tut.cur')
 for n in range(50):
  page.wait_for_timeout(300)
  if page.evaluate('__game.G.tut.done.soulChange'):break
  skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
  if skip.count():skip.first.click(timeout=3000);page.wait_for_timeout(600);continue
  confirm=page.locator('.sp-eqc-sheet:visible')
  if confirm.count():confirm.locator('.ui-sheet-foot .k-ghost').click();continue
  picker=page.locator('.sp-pick-sheet:visible')
  if picker.count() and page.evaluate('!!__game.G.tut.ev.soulPreviewed'):picker.locator('.ui-sheet-foot .ui-btn').last.click();continue
  glow=page.locator('.tut-glow:visible')
  if glow.count():glow.first.click()
 assert page.evaluate('__game.G.tut.done.soulChange'),page.evaluate('document.body.innerText.slice(-1200)')
 assert page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');return game.featureUnlocked('soulChange')}")
 assert page.evaluate('__game.G.party.length')==6
 print('館への実クリック、一覧確認、完了・解放、人数維持: OK')
 result=page.evaluate('''async()=>{
 const {game}=await import('/src/ui/ctx.js');const {_TUTS,tutState}=await import('/src/ui/tutorial.js');
 const G=game.G,def=_TUTS.find(d=>d.key==='soulChange');
 G.testStoryFlow=true;G.msq.prologue=null;G.msq.n=1;G.tut={done:{},cur:null,jobVisit:false};
 const before=!def.open();G.tut.jobVisit=true;const after=def.open();
 const souls=G.souls;G.souls=G.souls.filter(s=>['fighter','priest','thief','knight','mage','bishop'].includes(s.clsKey));const initialOnly=!def.open();G.souls=souls;
 G.tut.cur='newJobParty';G.tut.step=2;G.tut.ev={newJobSoulPickerOpened:true};
 const migrated=tutState().cur==='soulChange'&&G.tut.step===0&&!G.tut.ev.newJobSoulPickerOpened;
 G.tut.done.soulChange=true;const unlocked=game.featureUnlocked('soulChange');
 return {before,after,initialOnly,migrated,unlocked};}''')
 assert all(result.values()),result
 print('新職業/訪問の発火条件、旧案内の移行、既存解放の維持:',result)
 assert not errors,errors
 b.close()

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page()
 page.goto('http://localhost:8000/?testScene=prologue:abbey');page.wait_for_function('window.__game?.G.msq')
 result=page.evaluate('''async()=>{const {UI,game}=await import('/src/ui/ctx.js');const {STORY_CELLS}=await import('/src/story.js');const G=game.G,w=game.worldState();G.msq.prologue.phase='abbeyQuest';w.report='w02';w.reported={w01:1};w.cleared.w02=1;w.beats.mem_w02=1;for(const k of Object.keys(STORY_CELLS))w.found[k]=1;
 let pages=[];UI.playStoryChain=(ps)=>{pages.push(...ps);for(const p of ps)p.leave?.();};game.reportMainQuest();return {titles:pages.map(p=>p.title),explanations:pages.filter(p=>p.kicker==='秘技の伝授'&&!['操霊師の見識','図鑑と操霊師の見識'].includes(p.title)).length,reported:w.reported.w02,phase:G.msq.prologue.phase};}''')
 assert result['reported'] and result['phase']=='abbey' and result['explanations']==0,result
 print('回廊報告から修道院へ、王の魂付け替え・融合の説明なし:',result)
 b.close()

# 閉じるだけの経路に加え、操作制限が掛かった実画面で魂を選び、確認を戻ってから宿す。
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile in [False, True]:
  page=b.new_page(viewport={'width':390,'height':600 if mobile else 844},is_mobile=mobile,has_touch=mobile)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testScene=tutorial:soulChange')
  page.wait_for_function('window.__game?.G.testTutorial')
  page.add_style_tag(content='.test-play-banner{display:none!important}')
  original=page.evaluate('__game.G.party[0].primary')
  page.locator('.ui-tab[data-key="party"]').click()
  for _ in range(50):
   page.wait_for_timeout(300)
   if page.locator('.sp-pick-sheet .sp-srow[data-job="monk"]').count():break
   skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
   if skip.count():skip.first.click();page.wait_for_timeout(600);continue
   glow=page.locator('.tut-glow:visible')
   if glow.count():glow.first.click()
  assert page.evaluate('__game.G.tut.cur')=='soulChange'
  assert not page.evaluate('__game.G.tut.done.soulChange')
  soul=page.locator('.sp-pick-sheet .sp-srow[data-job="monk"] .sp-srow-main')
  soul.tap() if mobile else soul.click()
  confirm=page.locator('.sp-eqc-sheet')
  confirm.wait_for()
  confirm.locator('.ui-sheet-foot .k-ghost').click()
  confirm.wait_for(state='detached')
  assert page.evaluate('__game.G.party[0].primary')==original
  assert not page.evaluate('__game.G.tut.done.soulChange')
  soul.tap() if mobile else soul.click()
  confirm.locator('.ui-sheet-foot .k-primary').click()
  # 装備が使えなくなる場合の追加確認も通常の操作で通す。
  for _ in range(50):
   page.wait_for_timeout(300)
   if page.evaluate('__game.G.tut.done.soulChange'):break
   glow=page.locator('.tut-glow:visible')
   if glow.count():glow.first.click()
  assert page.evaluate('__game.G.tut.done.soulChange')
  assert page.evaluate('async()=>{const {soulByUid}=await import("/src/souls.js");return soulByUid(__game.G.party[0].primary).clsKey}')=='monk'
  assert page.evaluate('(uid)=>__game.G.souls.some(s=>s.uid===uid)',original)
  assert page.evaluate('__game.G.party.length')==6
  assert not errors,errors
  print(('タッチ画面' if mobile else '通常画面')+': 持ち帰った修道士を選択、確認を取消、再選択して宿す、完了・元の魂保持: OK',flush=True)
  page.close()
 b.close()

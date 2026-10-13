"""序章の全手ほどきを、光る操作対象のクリックで完了まで確認する。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for key,goal in [('createThree',3),('createFourth',4),('createFifth',5),('prologueFormation',5),('createSixth',6),('prologueAppraise',6),('buyEquipment',4),('shopAppraise',6)]:
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testScene=tutorial:'+key);page.wait_for_function('window.__game?.G.msq');page.add_style_tag(content='.test-play-banner{display:none!important}')
  for n in range(60):
   page.wait_for_timeout(450)
   if page.evaluate('(key)=>!!__game.G.tut.done[key]',key):break
   skip=page.locator('.iv-skip:visible,.sc-skip:visible')
   if skip.count():skip.first.click(timeout=3000);continue
   glow=page.locator('.tut-glow:visible')
   if glow.count():
    glow.first.click(timeout=3000)
   else:
    print('WAIT',key,n,page.evaluate('document.body.innerText.slice(-200)'))
  print(key,page.evaluate('(key)=>({done:__game.G.tut.done[key],party:__game.G.party.length,phase:__game.G.msq.prologue?.phase})',key),errors)
  assert page.evaluate('(key)=>!!__game.G.tut.done[key]',key),key
  assert page.evaluate('__game.G.party.length')==goal
  if key=='prologueFormation':
   assert page.evaluate("async()=>{const {soulByUid}=await import('/src/souls.js');return __game.G.party.map(d=>soulByUid(d.primary).clsKey).join(',')}")=='fighter,knight,thief,mage,priest'
  if key=='buyEquipment':
   assert page.evaluate('__game.G.gold < 500'), '実際に金貨を払って購入する'
  assert not errors, errors
  page.close()
 b.close()

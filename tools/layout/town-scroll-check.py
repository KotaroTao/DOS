"""酒場の再描画の位置保持と館の縦スクロール制限を確認。localhost:8000が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':820,'height':1180},has_touch=True)
 page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
 page.wait_for_function('window.__game?.G.party.length > 0')
 print(page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const G=game.G;G.testUnlock=['tavern'];G.tut={done:{tavern:true,rumor:true}};UI.openTavern('board');}'''))
 page.wait_for_timeout(1500)
 print(page.evaluate('''()=>{const a=document.querySelector('.fc-qarea');a.scrollTop=400;return [a.scrollTop,a.scrollHeight,a.clientHeight]}'''))
 page.wait_for_timeout(100)
 print(page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');game.acceptQuest(game.questLists().offers.find(q=>q.type!=='deliver').uid);return document.querySelector('.fc-qarea').scrollTop}'''))
 page.wait_for_timeout(500)
 assert page.evaluate("document.querySelector('.fc-qarea').scrollTop") == 400
 for width,height in [(390,844),(820,1180),(1180,820),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height})
  page.evaluate("async()=>{const {UI}=await import('/src/ui/ctx.js');UI.shell.setTab('party')}")
  page.wait_for_timeout(800)
  print(width,page.evaluate("""()=>{const a=document.querySelector('.pt-body')||document.querySelector('.pc-mansion-section');if(!a)throw Error('館の本文がない');const css=getComputedStyle(a);if(css.overflowX!=='hidden'||css.touchAction!=='pan-y')throw Error('横操作の制限なし');a.scrollTop=100;return {vertical:a.scrollTop,overflowX:css.overflowX,touch:css.touchAction}}"""))
 page.close()
 page=b.new_page(viewport={'width':1440,'height':900},has_touch=False)
 page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
 page.wait_for_function('window.__game?.G.party.length > 0')
 page.evaluate("async()=>{const {UI,game}=await import('/src/ui/ctx.js');game.G.prologue=null;UI.enterMansion()}")
 page.wait_for_selector('.pc-mansion-section')
 assert page.evaluate("[...document.querySelectorAll('.pc-mansion-section')].every(a=>getComputedStyle(a).overflowX==='hidden')")
 print('PC専用配置: OK')
 b.close()

"""試遊専用の図鑑全件表示・記録保護・通常時の制限。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844},service_workers='block')
 page.route('https://**/*', lambda r:r.abort())
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
 page.wait_for_function('window.__game?.G.testPlay && !document.body.classList.contains("booting")')
 page.evaluate('localStorage.setItem("dos-save-v7","unchanged")')
 before=page.evaluate('JSON.stringify({codex:__game.G.codex,events:__game.G.events,world:__game.G.world})')
 page.get_by_role('button',name='図鑑・全データ',exact=True).click()
 page.wait_for_selector('.cx-sheet')
 assert page.locator('.cx-sheet .pl-mon-select option').count()>60
 assert page.locator('.cx-sheet .pl-card.unknown').count()==0
 page.evaluate('''async()=>{
 const {UI}=await import('/src/ui/ctx.js');
 const {MONSTERS}=await import('/src/sprites.js');
 const key=Object.keys(MONSTERS).find(k=>!__game.G.codex.mon[k] && MONSTERS[k].boss);
 UI.codexMonSheet(key);
 }''')
 assert page.locator('.pl-detail-sheet').last.locator('.pt-stats').count()>0
 assert '体倒すと' not in page.locator('.pl-detail-sheet').last.inner_text()
 page.locator('.pl-detail-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
 page.locator('.cx-sheet .pl-codex-seg button').nth(2).click()
 assert page.locator('.cx-sheet .pl-card').count()>=36
 page.locator('.cx-sheet .pl-card').last.click()
 assert page.locator('.pl-job-ranks button').count()==5
 assert '？？？' not in page.locator('.pl-detail-sheet').last.inner_text()
 page.locator('.pl-detail-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
 page.locator('.cx-sheet .pl-codex-seg button').nth(3).click()
 assert page.locator('.cx-sheet .pl-card.unknown').count()==0
 page.locator('.cx-sheet .pl-card').first.click()
 page.locator('.pl-detail-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
 page.locator('.cx-sheet .pl-codex-seg button').nth(1).click()
 assert page.locator('.cx-sheet .pl-card').count()>0
 page.locator('.cx-sheet .pl-card').first.click()
 page.get_by_role('button',name='閉じる',exact=True).last.click()
 assert before==page.evaluate('JSON.stringify({codex:__game.G.codex,events:__game.G.events,world:__game.G.world})')
 page.locator('.cx-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
 page.evaluate('__game.UI.openCodexSheet()')
 assert page.locator('.cx-sheet .pl-card.unknown').count()>0
 assert page.evaluate('localStorage.getItem("dos-save-v7")')=='unchanged'
 page.locator('.cx-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
 page.evaluate('__game.G.testPlay=false; __game.UI.openCodexSheet({all:true})')
 assert page.locator('.cx-sheet .pl-card.unknown').count()>0
 assert not page.locator('.cx-sheet .pl-mon-select option[value="-3"]').count()
 assert page.locator('.test-play-banner').bounding_box()['height']==38
 assert not errors,errors
 print('OK: 全迷宮・未討伐の主の能力・全職業/R1〜R5/技・見聞録・アイテム、記録不変、通常表示への復帰、保存保護（390px）')
 b.close()

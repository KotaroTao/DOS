"""武魂合成の手ほどきを導入から実操作まで確認。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testScene=tutorial:bukonFusion&testDungeon=w18&testPlace=town')
 page.wait_for_function('window.__game?.G.party.length>0')
 for i in range(24):
  if page.evaluate('!!__game.G.tut.bukonFusionGift'):break
  btn=page.locator('button.tut-next, .tut-glow').filter(visible=True).first
  if btn.count():btn.click(timeout=3000)
  page.wait_for_timeout(250)
 for i in range(12):
  btn=page.locator('button.tut-next, button.tut-glow').filter(visible=True).first
  if page.locator('.ui-story').count()==0 and not page.get_by_role('button',name='心得た',exact=True).count(): break
  if btn.count():btn.click()
  page.wait_for_timeout(250)
 page.get_by_role('button',name=__import__('re').compile('保管中')).click()
 page.locator('.bk-panel .ec-afx-row').filter(has_text='HP+10').get_by_role('button',name='合成',exact=True).click()
 page.get_by_role('button',name='内容を確認して合成',exact=True).click()
 page.get_by_role('button',name='無料で合成',exact=True).click()
 page.wait_for_function('__game.G.tut.done.bukonFusion')
 print('OK 武魂合成チュートリアル実操作完了')
 assert not errors, errors

 b.close()

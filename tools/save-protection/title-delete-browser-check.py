import asyncio
import base64
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  c=await b.new_context(service_workers='block',reduced_motion='reduce')
  await c.add_init_script("window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),80);window.cancelAnimationFrame=clearTimeout;")
  await c.route('https://**/*',lambda r:r.abort())
  # 保存処理の検査では大きな画像の取得を省き、正常な画像で応答する。
  pixel=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF3sAAAAASUVORK5CYII=")
  await c.route("**/art/**",lambda r:r.fulfill(content_type="image/png",body=pixel))
  page=await c.new_page()
  await page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
  await page.wait_for_function('window.__game?.G.party.length>0 && !document.body.classList.contains("booting")', timeout=30000)
  seed=await page.evaluate('__game.inf.saveJSON()')
  await page.evaluate('(s)=>{localStorage.setItem("dos-save-v7",s);localStorage.setItem("dos-prefs","{\\"volume\\":42}")}',seed)
  await page.goto('http://localhost:8000/',wait_until='domcontentloaded')
  delete=page.get_by_role('button',name='データ削除',exact=True)
  await delete.click()
  dialog=page.get_by_role('alertdialog',name='データ削除の確認')
  await dialog.wait_for(state='visible')
  await page.get_by_role('button',name='やめる',exact=True).click()
  assert await page.evaluate('localStorage.getItem("dos-save-v7")')==seed
  await delete.click()
  async with page.expect_navigation(wait_until='domcontentloaded'):
   await page.get_by_role('button',name='消して始める',exact=True).click()
  await page.wait_for_function('window.__game && localStorage.getItem("dos-save-v7")===null')
  await page.wait_for_function("document.querySelector('.ttl-overlay:not(.ttl-out) .ttl-btn-t')?.textContent === 'さいしょから'")
  assert await page.get_by_role('button',name='つづきから',exact=False).count()==0
  await page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
  await page.get_by_role('dialog',name='弟子の名前').get_by_role('textbox').fill('新たな弟子')
  await page.get_by_role('button',name='旅を始める',exact=True).click()
  await page.wait_for_function('__game.G.apprenticeName === "新たな弟子"')
  assert await page.evaluate('__game.G.gold')==0
  assert await page.evaluate('__game.G.party.length')==0
  assert await page.evaluate('localStorage.getItem("dos-prefs")')=='{"volume":42}'
  print('タイトルの確認表示・取消時の記録保持・承認後の削除・新規開始・設定保持: OK')
  await b.close()
asyncio.run(main())

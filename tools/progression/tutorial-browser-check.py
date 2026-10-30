"""武魂合成の手ほどきと、説明どおりの素材・金貨・結果を実操作で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [390,937]:
  page=b.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce');errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testScene=tutorial:bukonFusion&testDungeon=w18&testPlace=town')
  page.wait_for_function('window.__game?.G.party.length>0')
  page.locator('#studio-splash').wait_for(state='detached')
  page.locator('.ui-tab[data-key="shop"]').click()
  lines=[]
  for i in range(100):
   scene=page.locator('.sc-scene:not(.out)')
   if scene.count():
    lines.append(scene.inner_text().replace('\u200b',''))
    ok=scene.locator('.sc-okb:visible')
    if ok.count():ok.click()
    else:scene.locator('.sc-lines').click()
   elif page.evaluate('!!__game.G.tut.bukonFusionGift') and page.locator('.bk-panel').count():break
   page.wait_for_timeout(200)
  else:raise AssertionError('合成の導入が終わらない')
  text=''.join(lines)
  for expected in ['同じ武魂を3つ合成すると、より強い武魂に生まれ変わる','保管中の武魂','内容を確認して合成','金貨を払って合成']:
   assert expected in text,expected
  assert not __import__('re').search(r'HP加算|Lv\d|金貨\d|[+＋]\d|二倍|2倍',text)
  page.get_by_role('button',name='保管中の武魂',exact=True).click()
  row=page.locator('.bk-panel .bk-stock-row').filter(has=page.get_by_role('button',name='HP加算 +10',exact=True)).first
  assert 'HP加算 +10' in row.text_content().replace('\u200b','')
  row.get_by_role('button',name='合成',exact=True).click()
  assert 'HP加算 +20' in page.locator('.ec-sheet select option:checked').inner_text().replace('\u200b','')
  before=page.evaluate('({gold:__game.G.gold,count:Number(__game.G.bukonStock["flat_hp:1"])})')
  page.get_by_role('button',name='内容を確認して合成',exact=True).click()
  page.get_by_role('button',name='金貨を払って合成',exact=True).click()
  page.wait_for_function('__game.G.tut.done.bukonFusion')
  after=page.evaluate('({gold:__game.G.gold,count:Number(__game.G.bukonStock["flat_hp:1"]||0),result:__game.G.bukonStock["flat_hp:2"]})')
  assert before['gold']-after['gold']==100
  assert before['count']-after['count']==3
  assert after['result']=='1'
  assert not errors,errors
  print(width,'OK 具体的な効果量・費用を出さない案内・素材と金貨の消費・手ほどき完了')
  page.close()
 b.close()

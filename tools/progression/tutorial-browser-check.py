"""武魂の着脱・合成の練習、途中再開、絞り込みからの復帰、実物不変を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,390,937]:
  for key in ['enchant','bukonFusion']:
   page=b.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce');errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://localhost:8000/?testScene=tutorial:{key}&testDungeon=w18&testPlace=town')
   page.wait_for_function('window.__game?.G.party.length>0')
   page.locator('#studio-splash').wait_for(state='detached')
   # 素材も金貨もなく、装備に空き枠がない記録でも練習できる。
   page.evaluate('''async()=>{const {ITEMS,SLOTS}=await import('/src/items.js');const G=__game.G;G.gold=0;G.bukonStock={};G.bukonGift=true;for(const d of G.party)for(const slot of SLOTS){const type=slot.startsWith('acc')?'acc':slot;d.equip[slot]={...Object.values(ITEMS).find(it=>it.slot===type),rar:'lr',locked:true,cursed:true,bukon:[{k:'flat_hp',lv:1},{k:'flat_atk',lv:1},{k:'flat_mp',lv:1}]};}}''')
   page.locator('.ui-tab[data-key="shop"]').click()
   lines=[]
   for i in range(100):
    scene=page.locator('.sc-scene:not(.out)')
    if scene.count():
     lines.append(scene.inner_text().replace('\u200b',''))
     ok=scene.locator('.sc-okb:visible')
     if ok.count():ok.click()
     else:scene.locator('.sc-lines').click()
    elif page.locator('.bk-practice').count():break
    page.wait_for_timeout(150)
   else:raise AssertionError('導入が終わらない')
   if key=='bukonFusion':assert '同じ武魂を3つ合成すると、より強い武魂に生まれ変わる' in ''.join(lines)
   snapshot='''()=>{const G=__game.G;return JSON.stringify({gold:G.gold,stock:G.bukonStock,protected:G.bukonProtected,inventory:G.inventory,equipment:G.party.map(d=>d.equip)});}'''
   before=page.evaluate(snapshot)
   practice=page.locator('.bk-practice')
   if key=='bukonFusion':assert practice.locator('.bk-stock-row').count()==3,'練習でも同じ武魂を個数分表示'
   practice.locator('.bk-practice-next').click()
   practice.get_by_role('button',name='閉じる',exact=True).click()
   page.locator('.bk-panel').get_by_role('button',name='絞り込み・並び替え',exact=True).click()
   filters=page.locator('.bk-filter-sheet')
   assert filters.locator('input,textarea').count()==0,'自由記入を置かない'
   filters.get_by_label('部位',exact=True).select_option('feet')
   filters.get_by_label('効果の種類',exact=True).select_option('elementDefense')
   filters.get_by_label('効果',exact=True).select_option('elem_def_water')
   filters.get_by_label('並び順',exact=True).select_option('power-desc')
   # 以前はここで閉じるボタンが操作制限に阻まれていた。
   filters.get_by_role('button',name='閉じる',exact=True).click()
   page.get_by_role('button',name='武魂の練習を再開',exact=True).click()
   practice=page.locator('.bk-practice')
   for i in range(6):
    if page.evaluate(f'!!__game.G.tut.done.{key}'):break
    practice.locator('.bk-practice-next').click()
    page.wait_for_timeout(150)
   page.wait_for_function(f'__game.G.tut.done.{key}')
   assert page.evaluate(snapshot)==before,'練習で実物の装備・武魂・金貨を変更しない'
   assert not errors,errors
   print(width,key,'OK 練習完了・閉じる・絞り込み・途中再開・実物不変')
   page.close()
 # 旧版で絞り込みを開いたまま・古い手順番号の記録からも復帰できる。
 for key in ['enchant','bukonFusion']:
  page=b.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
  page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town')
  page.wait_for_function('window.__game?.G.party.length>0');page.locator('#studio-splash').wait_for(state='detached')
  page.evaluate("async()=>{const {game,UI}=await import('/src/ui/ctx.js');game.G.testUnlock=['enchant','bukonFusion'];UI.openShop('enchant');}")
  page.locator('.bk-panel').get_by_role('button',name='絞り込み・並び替え',exact=True).click()
  page.evaluate("""async key=>{const {game,UI}=await import('/src/ui/ctx.js');game.G.testTutorial=key;game.G.tut={cur:key,step:7,done:{},ev:{},base:{}};UI.tutorialResume();}""",key)
  page.locator('.bk-practice').wait_for();page.locator('.bk-filter-sheet').wait_for(state='detached')
  assert page.evaluate('__game.G.tut.bukonPracticeVersion===1&&__game.G.tut.step===0')
  page.locator('.bk-practice .bk-practice-next').click()
  if key=='enchant':page.screenshot(path='/tmp/bukon-practice-attach.png')
  for i in range(5):
   if page.evaluate(f'!!__game.G.tut.done.{key}'):break
   page.locator('.bk-practice .bk-practice-next').click();page.wait_for_timeout(150)
  page.wait_for_function(f'__game.G.tut.done.{key}')
  print(key,'OK 旧版の途中記録と開いた絞り込みから復帰')
  page.close()
 b.close()

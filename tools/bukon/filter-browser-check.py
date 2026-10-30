"""武魂の選択式フィルター・並び替え・空の保管時の装備部位を実画面で確認。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,390,937]:
  page=b.new_page(viewport={'width':width,'height':900},service_workers='block',reduced_motion='reduce');errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town')
  page.wait_for_function('window.__game?.G.party.length>0');page.locator('#studio-splash').wait_for(state='detached')
  page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const {stockAdd}=await import('/src/bukon.js');const {ITEMS,SLOTS}=await import('/src/items.js');const G=game.G;G.testTutorial=null;G.tut={done:{enchant:1,bukonFusion:1}};G.testUnlock=['enchant','bukonFusion'];G.bukonGift=true;G.bukonStock={};G.bukonProtected={'flat_atk:1':true};
   for(const lv of [1,2,3])stockAdd(G,{k:'flat_hp',lv});for(const lv of [1,3])stockAdd(G,{k:'elem_def_water',lv});stockAdd(G,{k:'elem_def_fire',lv:2});stockAdd(G,{k:'flat_atk',lv:1});
   for(const d of G.party)for(const slot of SLOTS){const type=slot.startsWith('acc')?'acc':slot;d.equip[slot]={...Object.values(ITEMS).find(it=>it.slot===type),rar:'r',bukon:[]};}UI.openShop('enchant');}''')
  panel=page.locator('.bk-panel')
  panel.get_by_role('button',name='保管中の武魂',exact=True).click()
  def open_filter():
   panel.get_by_role('button',name='絞り込み・並び替え',exact=True).click()
   return page.locator('.ui-sheet-wrap:not(.closing) .bk-filter-sheet')
  def names():return panel.locator('.bk-stock-main').evaluate_all("nodes=>nodes.map(x=>x.textContent.replaceAll('\\u200b',''))")
  f=open_filter();assert f.locator('input,textarea').count()==0
  f.get_by_label('部位',exact=True).select_option('feet')
  f.get_by_label('効果の種類',exact=True).select_option('elementDefense')
  f.get_by_label('効果',exact=True).select_option('elem_def_water')
  f.get_by_label('武魂の色',exact=True).select_option('2')
  f.get_by_label('保護',exact=True).select_option('unprotected')
  f.get_by_label('並び順',exact=True).select_option('power-desc')
  if width==390:page.screenshot(path='/tmp/bukon-select-filters.png')
  f.get_by_role('button',name='閉じる',exact=True).click()
  assert names()==['水属性ダメージ軽減 15%','水属性ダメージ軽減 5%'],names()
  f=open_filter();f.get_by_role('button',name='条件を解除',exact=True).click()
  f.get_by_label('効果の種類',exact=True).select_option('flat')
  f.get_by_label('効果',exact=True).select_option('flat_hp')
  f.get_by_label('並び順',exact=True).select_option('power-asc')
  f.get_by_role('button',name='閉じる',exact=True).click()
  assert names()==['HP加算 +10','HP加算 +20','HP加算 +30'],names()
  f=open_filter();f.get_by_role('button',name='条件を解除',exact=True).click()
  f.get_by_label('保護',exact=True).select_option('protected');f.get_by_role('button',name='閉じる',exact=True).click()
  assert names()==['STR加算 +1'],names()
  f=open_filter();f.get_by_role('button',name='条件を解除',exact=True).click();f.get_by_role('button',name='閉じる',exact=True).click();assert len(names())==7
  page.evaluate('__game.G.bukonStock={}')
  panel.get_by_role('button',name='装備に宿す・外す',exact=True).click()
  f=open_filter();f.get_by_label('部位',exact=True).select_option('body');f.get_by_role('button',name='閉じる',exact=True).click()
  assert panel.locator('.pt-slot').count()==1
  assert panel.locator('.pt-slot').get_attribute('data-slot')=='body'
  assert not errors,errors
  print(width,'OK 選択式フィルター・効果量の高低順・保護・解除・空の保管でも部位表示')
  page.close()
 b.close()

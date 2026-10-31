"""売却一覧・装備詳細の武魂枠、詳細クリック、同じ武魂の個別表示を実画面で確認。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,390,937]:
  page=b.new_page(viewport={'width':width,'height':1000},service_workers='block',reduced_motion='reduce');errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town')
  page.wait_for_function('window.__game?.G.party.length>0');page.locator('#studio-splash').wait_for(state='detached')
  page.evaluate('''async()=>{const {game,UI,ops}=await import('/src/ui/ctx.js');const {ITEMS}=await import('/src/items.js');const G=game.G;G.testTutorial=null;G.testUnlock=['enchant','bukonFusion'];G.tut={done:{enchant:1,bukonFusion:1}};G.bukonGift=true;
   const stock=['c','uc','r','sr','lr'].map(rar=>{const it=game.cloneItem(Object.values(ITEMS).find(x=>x.slot==='head').id,50);it.rar=rar;it.bukon=[{k:'flat_hp',lv:1}];it.eDef={kind:'defense',reductions:{dark:.1}};return it;});
   G.inventory.splice(0,G.inventory.length,...stock);ops.junkList=()=>stock.map(item=>({doll:G.party[0],item,price:100}));
   window.bukonSlotsTest={stock,unlocked:game.featureUnlocked,gold:G.gold};}''')
  for unlocked in [False,True]:
   page.evaluate('''async enabled=>{const {game,UI}=await import('/src/ui/ctx.js');game.featureUnlocked=key=>key==='enchant'?enabled:bukonSlotsTest.unlocked(key);UI.confirmSellJunk();}''',unlocked)
   bulk=page.locator('.ui-sheet-wrap:not(.closing) .wpc-confirm')
   toggle=bulk.locator('.wpc-toggle')
   if toggle.count():toggle.click()
   rows=bulk.locator('.wpc-selllist .wpc-prow');assert rows.count()==5
   for i,count in enumerate([1,1,2,2,3]):
    row=rows.nth(i)
    assert row.locator('.bk-socket').count()==(count if unlocked else 0)
    assert row.evaluate('(x)=>x.getBoundingClientRect().right<=innerWidth'),width
    if unlocked:assert row.evaluate('(x)=>x.querySelector(".bk-sockets").getBoundingClientRect().top>=x.querySelector(".wpc-srow-ic").getBoundingClientRect().bottom'),"アイコンの下に枠"
   if width==390 and unlocked:page.screenshot(path='/tmp/dos-bulk-bukon-slots.png')
   rows.nth(2).locator('.wpc-prow-main').click()
   detail=page.locator('.ui-sheet-wrap:not(.closing) .wpc-isheet')
   assert detail.locator('.wpc-is-bukon .bk-socket').count()==(2 if unlocked else 0)
   if unlocked:
    panel=detail.locator('.wpc-is-bukon')
    assert panel.evaluate('(x)=>!!(x.previousElementSibling?.classList.contains("wpc-is-fx"))')
    assert 'HP加算' not in detail.locator('.wpc-is-fx').text_content().replace('\u200b','')
    if width==390:page.screenshot(path='/tmp/dos-item-bukon-slots.png')
    panel.get_by_role('button',name='HP加算 +10の詳細',exact=True).click()
    soul=page.locator('.ui-sheet-wrap:not(.closing) .bk-detail')
    text=soul.text_content().replace('\u200b','');assert 'HPが10上昇' in text
    assert 'Lv' not in text and '個数' not in text
    soul.get_by_role('button',name='閉じる',exact=True).click()
    assert page.evaluate('__game.G.gold===bukonSlotsTest.gold&&bukonSlotsTest.stock.every(x=>x.bukon.length===1)')
   page.evaluate('async()=>{const {sheet}=await import("/src/ui/kit.js");sheet.closeAll();}')
   page.locator('.wpc-isheet').wait_for(state='detached')
  page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const {stockAdd}=await import('/src/bukon.js');game.G.bukonStock={};game.G.bukonProtected={};stockAdd(game.G,{k:'flat_hp',lv:1},3);stockAdd(game.G,{k:'flat_hp',lv:2},2);stockAdd(game.G,{k:'elem_def_water',lv:1});UI.prepareEnchantTutorial();UI.openShop('enchant');}''')
  panel=page.locator('.bk-panel');panel.get_by_role('button',name='保管中の武魂',exact=True).click()
  assert panel.locator('.bk-stock-row').count()==6
  assert panel.get_by_role('button',name='HP加算 +10',exact=True).count()==3
  assert panel.get_by_role('button',name='HP加算 +20',exact=True).count()==2
  assert panel.locator('.wpc-lhead-t').text_content().replace('\u200b','')=='武魂 6点'
  assert panel.locator('.bk-stock-row').evaluate_all('nodes=>new Set(nodes.map(x=>x.dataset.copy)).size')==6
  page.evaluate('''async()=>{const {game,UI}=await import('/src/ui/ctx.js');const {ITEMS}=await import('/src/items.js');const selected=game.allDolls().find(d=>String(d.uid)===document.querySelector('.wpc-character.selected').dataset.dollUid);const it=game.cloneItem(Object.values(ITEMS).find(x=>x.slot==='head').id,50);it.bukon=[];it.rar='r';selected.equip.head=it;window.bukonSlotsTest.target=it;}''')
  panel.get_by_role('button',name='装備に宿す・外す',exact=True).click()
  panel.locator('[data-slot="head"]').click()
  candidates=page.locator('.ui-sheet-wrap:not(.closing) .bk-sheet')
  assert candidates.get_by_role('button',name='HP加算 +10',exact=True).count()==3
  candidates.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button',name='HP加算 +10',exact=True)).first.get_by_role('button',name='宿す',exact=True).click()
  assert page.evaluate('__game.G.bukonStock["flat_hp:1"]==="2"&&bukonSlotsTest.target.bukon.length===1')
  candidates.get_by_role('button',name='外す',exact=True).click()
  assert page.evaluate('__game.G.bukonStock["flat_hp:1"]==="3"')
  candidates.get_by_role('button',name='閉じる',exact=True).click()
  # 巨大な保存個数を配列へ展開せず、スクロールした分だけ一つずつ足す。
  page.evaluate('async()=>{const {UI}=await import("/src/ui/ctx.js");__game.G.bukonStock={"flat_hp:1":"100000000000000000000"};UI.openShop("enchant");}')
  panel.get_by_role('button',name='保管中の武魂',exact=True).click()
  assert 64<=panel.locator('.bk-stock-row').count()<=128
  panel.locator('.bk-stock-list').evaluate('(x)=>x.scrollTop=x.scrollHeight')
  page.wait_for_function('document.querySelectorAll(".bk-stock-row").length>=128')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print(width,'OK 解放前後の売却・詳細の枠、武魂クリック、個数分の表示、着脱、大量保管')
  page.close()
 b.close()

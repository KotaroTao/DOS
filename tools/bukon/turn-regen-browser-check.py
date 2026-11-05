"""新しい毎ターン回復の色・表示・絞り込み・効果量順・装備への着脱を確認。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.abort())
    page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.locator('#studio-splash').wait_for(state='detached')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'),b=await import('/src/bukon.js'),{ITEMS}=await import('/src/items.js');
      const G=game.G;G.testTutorial=null;G.testUnlock=['enchant','bukonFusion'];G.tut={done:{enchant:1,bukonFusion:1}};G.bukonGift=true;G.bukonStock={};G.bukonProtected={};G.gold=100000;
      for(let lv=1;lv<=10;lv++)for(const k of ['turn_mp_regen','turn_hp_regen'])b.stockAdd(G,{k,lv});
      const d=game.allDolls()[0];d.equip.weapon={...Object.values(ITEMS).find(it=>it.slot==='weapon'&&!it.cursed),rar:'lr',bukon:[],locked:true};
      UI.prepareEnchantTutorial();UI.openShop('enchant');UI.openBukonList({doll:d});window.t={game,UI,b,d};
    }''')
    active='.ui-sheet-wrap:not(.closing) '
    listing=page.locator(active+'.bk-list-sheet')
    for prefix,values in [('毎ターンMP回復',[1,1.5,2,2.5,3,3.5,4,4.5,5,6]),('毎ターンHP回復',[5,7.5,10,12.5,15,17.5,20,22.5,25,30])]:
        for value in values:
            button=listing.get_by_role('button',name=f'{prefix} {value:g}%',exact=True)
            assert button.count()==1
            assert button.evaluate('(el)=>getComputedStyle(el).color')=='rgb(255, 154, 74)'
    listing.get_by_role('button',name='絞り込み・並び替え',exact=True).click()
    filters=page.locator(active+'.bk-filter-sheet')
    filters.get_by_label('効果の種類',exact=True).select_option('regen')
    assert filters.get_by_label('効果',exact=True).locator('option').evaluate_all('ns=>ns.map(n=>n.value).sort()')==['all','turn_hp_regen','turn_mp_regen']
    filters.get_by_label('並び順',exact=True).select_option('power-desc')
    filters.get_by_role('button',name='閉じる',exact=True).first.click()
    values=listing.locator('.bk-name-value').evaluate_all('ns=>ns.map(n=>parseFloat(n.textContent))')
    assert values==sorted(values,reverse=True),values
    row=listing.locator('.bk-stock-row').filter(has=page.get_by_role('button',name='毎ターンMP回復 6%',exact=True))
    row.get_by_role('button',name='宿す',exact=True).click()
    picker=page.locator(active+'.bk-equip-sheet');picker.locator('[data-slot="weapon"]').click()
    gear=page.locator(active+'.bk-sheet:not(.bk-equip-sheet):not(.bk-list-sheet)')
    gear.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button',name='毎ターンMP回復 6%',exact=True)).get_by_role('button',name='宿す',exact=True).click()
    assert page.evaluate('t.d.eff.mpRegen===.06')
    gear.get_by_role('button',name='毎ターンMP回復 6%',exact=True).click()
    detail=page.locator(active+'.bk-detail')
    assert detail.get_by_text('最大MPの6%',exact=False).count()>0
    detail.get_by_role('button',name='閉じる',exact=True).first.click()
    gear.get_by_role('button',name='外す',exact=True).first.click()
    assert page.evaluate('!t.d.eff?.mpRegen&&t.d.equip.weapon.locked')
    assert not errors,errors
    print('回復武魂20段階の橙色・名前・所持効果の絞り込み・実効果量順・Lv10着脱と詳細・装備ロック維持: OK')
    browser.close()

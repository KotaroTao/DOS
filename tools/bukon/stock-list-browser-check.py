"""武魂一覧から人業・装備選択、着脱、合成・ロック・所持分の絞り込みを実操作する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    engine=os.environ.get('DOS_TEST_BROWSER','chromium')
    browser=p.webkit.launch() if engine=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce',has_touch=engine=='webkit')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.abort())
    page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.locator('#studio-splash').wait_for(state='detached')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'),{ITEMS,SLOTS}=await import('/src/items.js'),b=await import('/src/bukon.js'),kit=await import('/src/ui/kit.js');
      const G=game.G;G.testTutorial=null;G.testUnlock=['enchant','bukonFusion'];G.tut={done:{enchant:1,bukonFusion:1}};G.bukonGift=true;G.inventory=[];G.gold=100000;
      for(const d of game.allDolls())for(const slot of SLOTS){const type=slot.startsWith('acc')?'acc':slot;
        const base=Object.values(ITEMS).find(it=>it.slot===type&&!it.cursed);d.equip[slot]=base?{...base,rar:'lr',bukon:[],locked:true}:null;}
      G.party[0].equip.body.bukon=[{k:'elem_def_water',lv:1}];
      G.bukonStock={};G.bukonProtected={};b.stockAdd(G,{k:'flat_hp',lv:1},9);b.stockAdd(G,{k:'flat_mp',lv:1},3);b.stockAdd(G,{k:'flat_atk',lv:1});
      G.bukonProtected['flat_atk:1']=true;
      UI.prepareEnchantTutorial();UI.openShop('enchant');window.t={game,UI,b,kit};
    }''')
    active='.ui-sheet-wrap:not(.closing) '
    def sheet(cls): return page.locator(active+cls)
    def listed():return sheet('.bk-list-sheet')
    def hp():return listed().locator('.bk-stock-row').filter(has=page.get_by_role('button',name='HP加算 +10',exact=True)).first
    page.locator('.bk-panel').get_by_role('button',name='武魂一覧',exact=True).click()
    for width,height in [(320,568),(390,844),(820,1180),(1280,900)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(300)
        if width in [390,820]: page.screenshot(path=f'/tmp/dos-bukon-list-{engine}-{width}.png')
        listed().evaluate('''card=>{
          const r=card.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1)throw Error('一覧が画面外');
          const body=card.querySelector('.ui-sheet-body');if(body.scrollWidth>body.clientWidth+1)throw Error('横はみ出し');
          for(const row of card.querySelectorAll('.bk-stock-row')){
            const buttons=[...row.querySelectorAll(':scope > button')];
            if(buttons.slice(1).map(b=>b.innerText).join(',')!=='宿す,合成,ロック')throw Error('3操作の順序');
            const rects=buttons.map(b=>b.getBoundingClientRect());
            if(rects.some(r=>Math.abs(r.top-rects[0].top)>1))throw Error('操作の途中で改行');
            if(Math.abs(rects.at(-1).right-row.getBoundingClientRect().right)>2)throw Error('右揃え');
          }
        }''')
    # 保管中と装備中の効果だけを候補にし、種類による候補の絞り込みも維持する。
    listed().get_by_role('button',name='絞り込み・並び替え',exact=True).click()
    filters=sheet('.bk-filter-sheet')
    options=filters.get_by_label('効果',exact=True).locator('option').evaluate_all('ns=>ns.map(n=>n.value).sort()')
    assert options==sorted(['all','flat_hp','flat_mp','flat_atk','elem_def_water']),options
    filters.get_by_label('効果の種類',exact=True).select_option('elementDefense')
    assert filters.get_by_label('効果',exact=True).locator('option').evaluate_all('ns=>ns.map(n=>n.value)')==['all','elem_def_water']
    filters.get_by_role('button',name='条件を解除',exact=True).click()
    filters.get_by_role('button',name='閉じる',exact=True).first.click()
    hp().get_by_role('button',name='ロック',exact=True).click()
    assert hp().get_by_role('button',name='ロック',exact=True).get_attribute('aria-pressed')=='true'
    assert hp().get_by_role('button',name='合成',exact=True).is_disabled()
    hp().get_by_role('button',name='ロック',exact=True).click()
    # 「宿す」から商会と同じ人業・装備欄を使い、別の人業のロック装備へ着脱。
    hp().get_by_role('button',name='宿す',exact=True).click()
    picker=sheet('.bk-equip-sheet')
    assert picker.locator('.wpc-character').count()==page.locator('.wpc-characters').first.locator('.wpc-character').count()
    target=picker.locator('.wpc-character').nth(1).get_attribute('data-doll-uid')
    picker.locator('.wpc-character').nth(1).click()
    picker.locator('[data-slot="weapon"]').click()
    gear=sheet('.bk-sheet:not(.bk-list-sheet):not(.bk-equip-sheet)')
    gear.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button',name='HP加算 +10',exact=True)).first.get_by_role('button',name='宿す',exact=True).click()
    assert page.evaluate('''uid=>t.game.allDolls().find(d=>String(d.uid)===uid).equip.weapon.bukon.some(b=>b.k==='flat_hp')''',target)
    gear.get_by_role('button',name='外す',exact=True).first.click()
    assert page.evaluate('''uid=>t.game.allDolls().find(d=>String(d.uid)===uid).equip.weapon.locked&&!t.game.allDolls().find(d=>String(d.uid)===uid).equip.weapon.bukon.length''',target)
    gear.get_by_role('button',name='閉じる',exact=True).first.click();picker.get_by_role('button',name='閉じる',exact=True).first.click()
    # 個別合成の取消と確定。
    before=page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.gold])')
    hp().get_by_role('button',name='合成',exact=True).click()
    sheet('.ui-confirm').get_by_role('button',name='やめる',exact=True).click()
    assert page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.gold])')==before
    hp().get_by_role('button',name='合成',exact=True).click()
    sheet('.ui-confirm').get_by_role('button',name='合成する',exact=True).click()
    page.wait_for_function("t.game.G.bukonStock['flat_hp:2']==='1'")
    # 確認後に素材が変わったら、一括合成を実行しない。
    listed().get_by_role('button',name='一括合成',exact=True).click()
    page.evaluate("t.b.stockAdd(t.game.G,{k:'flat_hp',lv:1})")
    before=page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.gold])')
    sheet('.ui-confirm').get_by_role('button',name='一括合成する',exact=True).click()
    page.wait_for_timeout(200)
    assert page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.gold])')==before
    # 一括合成の結果は既存の計画と一致し、装備中・保管中のロックを守る。
    expected=page.evaluate('''()=>{const g=structuredClone(t.game.G),items=t.game.bukonTargets().map(it=>structuredClone(it));t.b.applySnapshotFusion(g,items);return JSON.stringify([g.bukonStock,g.gold]);}''')
    listed().get_by_role('button',name='一括合成',exact=True).click()
    sheet('.ui-confirm').get_by_role('button',name='一括合成する',exact=True).click()
    page.wait_for_timeout(200)
    assert page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.gold])')==expected
    assert page.evaluate("t.game.G.bukonStock['flat_atk:1']==='1'&&t.game.G.party[0].equip.body.bukon[0].k==='elem_def_water'")
    page.evaluate('''()=>{t.kit.sheet.closeAll();t.game.G.gold=0;t.UI.openBukonList();}''')
    assert listed().get_by_role('button',name='一括合成',exact=True).is_disabled()
    page.evaluate('''()=>{t.kit.sheet.closeAll();t.game.G.gold=100000;t.game.G.bukonStock={'flat_hp:1':'100000000000000000000000'};t.UI.openBukonList();}''')
    assert listed().locator('.bk-stock-row').count()<200
    page.evaluate('''()=>{t.kit.sheet.closeAll();t.game.G.testUnlock=['enchant'];t.game.G.world.reported={};t.UI.openBukonList();}''')
    assert listed().get_by_role('button',name='一括合成',exact=True).count()==0
    assert listed().get_by_role('button',name='合成',exact=True).first.is_disabled()
    assert not errors,errors
    print('一覧の4画面幅・右揃え3操作・所持効果のみ・人業選択/ロック装備の着脱・個別/一括合成・取消/再確認・保護・金貨不足・大量在庫・解放前: OK')
    browser.close()

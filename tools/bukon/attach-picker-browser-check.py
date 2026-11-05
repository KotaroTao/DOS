"""武魂の宿し先選択で肖像画像と装備の有効・無効を確認する。"""
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
      for(const d of game.allDolls())d.equip.weapon.bukon=[{k:'elem_atk_fire',lv:2},{k:'flat_hp',lv:1},{k:'flat_mp',lv:1}];
      G.party[0].equip.shield.cursed=true;
      G.party[0].equip.head.unidentified=true;
      G.party[0].equip.feet.soulMemory=true;
      G.bukonStock={};G.bukonProtected={};b.stockAdd(G,{k:'flat_hp',lv:1},9);b.stockAdd(G,{k:'flat_mp',lv:1},3);b.stockAdd(G,{k:'elem_atk_fire',lv:1});
      G.bukonProtected['flat_atk:1']=true;
      UI.prepareEnchantTutorial();UI.openShop('enchant');window.t={game,UI,b,kit};
    }''')
    active='.ui-sheet-wrap:not(.closing) '
    def sheet(cls): return page.locator(active+cls)
    def listed():return sheet('.bk-list-sheet')
    def hp():return listed().locator('.bk-stock-row').filter(has=page.get_by_role('button',name='HP加算 +10',exact=True)).first
    page.locator('.bk-panel').get_by_role('button',name='武魂一覧',exact=True).click()

    listed().locator('.bk-stock-row').filter(has=page.get_by_role('button',name='火属性攻撃力上昇 20%',exact=True)).get_by_role('button',name='宿す',exact=True).click()
    picker=sheet('.bk-equip-sheet')
    for width,height in [(320,568),(390,844),(820,1180),(1280,900)]:
        page.set_viewport_size({'width':width,'height':height})
        for index in [0,1]:
            picker.locator('.wpc-character').nth(index).click()
            page.wait_for_function("""()=>[...document.querySelectorAll('.bk-equip-sheet .wpc-character img')].length>0&&[...document.querySelectorAll('.bk-equip-sheet .wpc-character img')].every(i=>i.complete&&i.naturalWidth>0)""")
            assert picker.locator('.wpc-character img').evaluate_all("ns=>ns.every(i=>i.getBoundingClientRect().height>0&&i.getBoundingClientRect().width>0)")
            assert page.evaluate("""()=>{const b={k:'elem_atk_fire',lv:1};const selected=document.querySelector('.bk-equip-sheet .wpc-character.selected').dataset.dollUid;const d=t.game.allDolls().find(d=>String(d.uid)===selected);return import('/src/bukon.js').then(m=>[...document.querySelectorAll('.bk-equip-sheet .pt-slot')].every(c=>c.disabled===!!m.attachBlock(d.equip[c.dataset.slot]?{...d.equip[c.dataset.slot],bukon:[]}:null,b)));}""")
            assert picker.locator('.pt-slot:disabled').count()>0
            assert picker.locator('.pt-slot:enabled').count()>0
            assert picker.locator('.pt-slot:disabled').first.evaluate("c=>getComputedStyle(c).filter.includes('brightness(0.4)')")
        page.screenshot(path=f'/tmp/dos-bukon-picker-{width}.png')
        print(width,'OK 肖像画像・人業切替・対応部位の装備を有効・対象外を暗転')
    # 枠が埋まり、同じ効果が宿るロック装備も選び、外してから付け替えられる。
    picker.locator('.wpc-character').first.click()
    weapon=picker.locator('[data-slot="weapon"]')
    assert weapon.is_enabled()
    before=page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.party[0].equip.weapon.bukon])')
    weapon.click()
    gear=sheet('.bk-sheet:not(.bk-list-sheet):not(.bk-equip-sheet)')
    assert page.evaluate('JSON.stringify([t.game.G.bukonStock,t.game.G.party[0].equip.weapon.bukon])')==before
    assert gear.locator('.bk-copy-rows .bk-stock-row').count()==0
    gear.get_by_role('button',name='外す',exact=True).first.click()
    gear.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button',name='火属性攻撃力上昇 20%',exact=True)).get_by_role('button',name='宿す',exact=True).click()
    assert page.evaluate("t.game.G.party[0].equip.weapon.bukon.some(b=>b.k==='elem_atk_fire'&&b.lv===1)&&t.game.G.party[0].equip.weapon.bukon.length===3&&t.game.G.party[0].equip.weapon.locked&&t.game.G.bukonStock['elem_atk_fire:2']==='1'")
    gear.get_by_role('button',name='閉じる',exact=True).first.click()
    picker.get_by_role('button',name='閉じる',exact=True).first.click()
    # 全部位向けの武魂でも、呪い・未鑑定・記憶品は選べない。
    hp().get_by_role('button',name='宿す',exact=True).click()
    picker=sheet('.bk-equip-sheet')
    picker.locator('.wpc-character').first.click()
    for slot in ['shield','head','feet']:
        assert picker.locator(f'[data-slot="{slot}"]').is_disabled()
    assert picker.locator('[data-slot="weapon"]').is_enabled()
    picker.get_by_role('button',name='閉じる',exact=True).first.click()
    # 一覧で選んだ武魂自身の宿し先も開き、外す操作ができる。
    listed().locator('.bk-stock-row').filter(has=page.get_by_role('button',name='火属性攻撃力上昇 20%',exact=True)).filter(has=page.locator('.bk-installed-note')).first.get_by_role('button',name='宿す',exact=True).click()
    picker=sheet('.bk-equip-sheet')
    picker.locator('.wpc-character').first.click()
    picker.locator('[data-slot="weapon"]').click()
    gear=sheet('.bk-sheet:not(.bk-list-sheet):not(.bk-equip-sheet)')
    gear.get_by_role('button',name='外す',exact=True).last.click()
    assert page.evaluate("!t.game.G.party[0].equip.weapon.bukon.some(b=>b.k==='elem_atk_fire')&&t.game.G.bukonStock['elem_atk_fire:1']==='1'")
    print(engine,'OK 満杯・同効果・装着先自身を選択、取り外し後の付け替え・保管回収、呪い/未鑑定/記憶の制限')
    assert not errors,errors
    browser.close()

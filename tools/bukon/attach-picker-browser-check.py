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
            assert page.evaluate("""()=>{const b={k:'elem_atk_fire',lv:1};const selected=document.querySelector('.bk-equip-sheet .wpc-character.selected').dataset.dollUid;const d=t.game.allDolls().find(d=>String(d.uid)===selected);return import('/src/bukon.js').then(m=>[...document.querySelectorAll('.bk-equip-sheet .pt-slot')].every(c=>c.disabled===!!m.attachBlock(d.equip[c.dataset.slot],b)));}""")
            assert picker.locator('.pt-slot:disabled').count()>0
            assert picker.locator('.pt-slot:enabled').count()>0
            assert picker.locator('.pt-slot:disabled').first.evaluate("c=>getComputedStyle(c).filter.includes('brightness(0.4)')")
        page.screenshot(path=f'/tmp/dos-bukon-picker-{width}.png')
        print(width,'OK 肖像画像・人業切替・宿せる装備のみ有効・暗転')
    assert not errors,errors
    browser.close()

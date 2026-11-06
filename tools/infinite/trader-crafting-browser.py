"""回収人と商会の共通鍛え直し・武魂UI、操作制限と金貨更新を実画面で検証。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r:r.abort())
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testInf=5&testInfLv=6',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.locator('#studio-splash').wait_for(state='detached')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'),{sheet}=await import('/src/ui/kit.js'),b=await import('/src/bukon.js');
      const g=game.G;sheet.closeAll();g.testUnlock=['infinite','forge','enchant','bukonFusion'];g.tut={done:{enchant:true,bukonFusion:true}};
      g.prompt=false;g.gold=1000000;g.bukonGift=true;g.bukonStock={};g.bukonProtected={};
      b.stockAdd(g,{k:'flat_hp',lv:1},9);
      for(const d of g.party){d.equip={weapon:{...game.cloneItem('dagger'),rar:'lr',bukon:[]}};}
      const memory={...game.cloneItem('dagger'),soulMemory:true,bukon:[]};g.inventory.push(memory);
      window.t={game,UI,sheet,b,memory,home:JSON.stringify(g.abyss.home)};
      __game.inf.openInfRest();
    }''')
    page.get_by_text('回収人 (商会の者)',exact=True).click()
    active='.ui-sheet-wrap:not(.closing) '
    trader=page.locator(active+'.inf-sheet').last
    def tab(label):trader.locator('.ui-seg-b').get_by_text(label,exact=True).click()
    tab('鍛え直し')
    for width,height in [(320,568),(390,844),(844,390),(820,1180),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        assert trader.locator('.wpc-character').count()==6
        assert trader.locator('.bk-equipment [data-slot]').count()==8
        assert trader.locator('.bk-equipment .bk-quality').count()>0 or '品質' in trader.locator('.bk-equipment').inner_text()
        trader.evaluate('''card=>{const body=card.querySelector('.ui-sheet-body');if(body.scrollWidth>body.clientWidth+1)throw Error('横はみ出し');const list=body.querySelector('.bk-equipment');if(getComputedStyle(list).gridTemplateColumns.split(' ').length!==2)throw Error('装備欄が2列ではない');}''')
        if width==390:page.screenshot(path='/tmp/dos-inf-trader-forge.png')
    page.set_viewport_size({'width':390,'height':844})
    trader.locator('.wpc-character').nth(1).click()
    before=page.evaluate('t.game.G.gold')
    trader.locator('[data-slot="weapon"]').click()
    forge=page.locator(active+'.rf-sheet')
    assert page.evaluate('t.game.G.gold')==before
    forge.get_by_role('button',name='鍛え直す',exact=False).click()
    page.wait_for_function('t.game.G.gold<1000000')
    assert str(page.evaluate('t.game.G.gold')) in trader.locator('.inf-cur').first.inner_text()
    forge.get_by_role('button',name='結果を見る',exact=False).click()
    forge.get_by_role('button',name='元のまま',exact=False).click()
    forge.get_by_role('button',name='閉じる',exact=True).click()
    tab('武魂')
    trader.locator('.wpc-character').nth(2).click()
    uid=trader.locator('.wpc-character.selected').get_attribute('data-doll-uid')
    trader.locator('[data-slot="weapon"]').click()
    gear=page.locator(active+'.bk-sheet:not(.bk-list-sheet):not(.bk-equip-sheet)')
    gear.locator('.bk-copy-rows .bk-stock-row').first.get_by_role('button',name='宿す',exact=True).click()
    assert page.evaluate('uid=>t.game.G.party.find(d=>String(d.uid)===uid).equip.weapon.bukon.length===1',uid)
    gear.get_by_role('button',name='外す',exact=True).first.click()
    assert page.evaluate('uid=>!t.game.G.party.find(d=>String(d.uid)===uid).equip.weapon.bukon.length',uid)
    gear.get_by_role('button',name='閉じる',exact=True).click()
    trader.get_by_role('button',name='武魂一覧',exact=True).click()
    listing=page.locator(active+'.bk-list-sheet')
    listing.locator('.bk-stock-row').first.get_by_role('button',name='合成',exact=True).click()
    page.locator(active+'.ui-confirm').get_by_role('button',name='合成する',exact=True).click()
    assert page.evaluate("t.game.G.bukonStock['flat_hp:2']==='1'")
    assert str(page.evaluate('t.game.G.gold')) in trader.locator('.inf-cur').first.inner_text()
    listing.get_by_role('button',name='閉じる',exact=True).click()
    page.evaluate('''()=>{
      const g=t.game.G,check=(v,m)=>{if(!v)throw Error(m)};
      check(!!t.game.reforgeBlock(null,t.memory),'記憶の鍛え直しを拒否');
      check(!t.game.bukonTargets().includes(t.memory),'記憶の武魂変更を拒否');
      check(!t.game.bukonTargets().some(it=>g.abyss.home.inventory.includes(it)),'本編の品を対象に含めない');
      check(JSON.stringify(g.abyss.home)===t.home,'本編の装備と通貨を変えない');
      const it=g.party[0].equip.weapon;g.floor=6;
      const before=JSON.stringify([g.gold,g.bukonStock,it]);
      check(!!t.game.bukonClosed()&&!t.game.bukonAction('attach',it,{k:'flat_hp',lv:1}),'風だまり以外で操作を拒否');
      check(JSON.stringify([g.gold,g.bukonStock,it])===before,'拒否で品と通貨を変えない');
      g.floor=5;g.testUnlock=['infinite','forge'];g.world.reported={};
      check(!!t.game.bukonClosed(),'解放前の武魂操作を拒否');
    }''')
    page.evaluate("t.game.G.testUnlock=['infinite','forge','enchant'];t.game.G.floor=5;t.sheet.closeAll();window.bagGear=t.game.cloneItem('dagger');t.game.G.inventory.push(bagGear);t.UI.itemSheet(bagGear,{owner:t.game.G.party[0],context:'dungeon'});")
    page.locator(active+'.wpc-isheet').get_by_role('button',name='鍛え直し',exact=False).click()
    assert page.locator(active+'.rf-sheet').count()==1
    assert not errors,errors
    print('回収人: 共通人業選択・2列装備・5画面幅・鍛え直し・武魂着脱/合成・金貨更新・対象/場所/解放制限 OK')
    browser.close()

"""極を棚に残さない時だけ警告し、取消では売却・特性破棄を行わない。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
    page.route('https://**/*',lambda r:r.abort())
    page.set_default_timeout(30000)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const {sellOne}=await import('/src/ui/loot.js');
      const g=game.G;g.shopStock={dagger:1};g.shopAfx={dagger:[{k:'A03',v:30}]};g.shopAfxPending=[];g.inventory.length=0;
      const it=game.cloneItem('dagger');it.afx=[{k:'X30',v:1}];it.unidentified=false;g.inventory.push(it);
      window.saleItem=it;window.goldBefore=g.gold;window.sellDone=false;
      sellOne(g.party[0],it).then(r=>{window.sellDone=r;});
    }''')
    sell=page.get_by_role('button',name='売って、選んだ方を棚に置く',exact=True)
    sell.click()
    page.get_by_text('極特性を保存せずに進めますか？',exact=True).wait_for()
    assert page.evaluate('__game.G.inventory.includes(saleItem)&&__game.G.gold===goldBefore')
    page.get_by_role('button',name='戻って選び直す',exact=True).click()
    page.locator('.inf-afx-opt').last.click()
    sell.click()
    page.wait_for_function('window.sellDone===true')
    assert page.evaluate('__game.G.shopAfx.dagger[0].k==="X30"&&!__game.G.inventory.includes(saleItem)')
    print('単品: 極を失う場合の警告・取消・極を保存する売却を確認',flush=True)
    # 一括売却などで積まれた棚の比較も、確定前に同じ警告を出す。
    page.evaluate('''async()=>{
      const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      const {openAfxConflicts}=await import('/src/ui/infinite.js');
      const g=__game.G;g.shopAfx={dagger:[{k:'X30',v:1}]};g.shopAfxPending=[{id:'dagger',afx:[{k:'A03',v:40}]}];
      openAfxConflicts();
    }''')
    page.get_by_role('button',name='選んだ方を棚に置いておく',exact=True).click()
    page.get_by_role('button',name='戻って選び直す',exact=True).click()
    assert page.evaluate('__game.G.shopAfx.dagger[0].k==="X30"&&__game.G.shopAfxPending.length===1')
    page.get_by_role('button',name='選んだ方を棚に置いておく',exact=True).click()
    page.get_by_role('button',name='保存せずに続ける',exact=True).click()
    page.wait_for_function('__game.G.shopAfx.dagger[0].k==="A03"&&!__game.G.shopAfxPending.length')
    print('棚の比較: 既存の極を失う場合も警告し、承認後だけ破棄',flush=True)
    # 回収人の一括売却は、確認取消時に金貨・袋・棚を全く変えない。
    page.goto('http://localhost:8000/?testInf=5&testInfLv=6',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.abyss?.started')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      const g=game.G;g.inventory.length=0;g.shopAfx={dagger:[{k:'A03',v:40}]};g.shopStock={dagger:1};g.shopAfxPending=[];
      const it=game.cloneItem('dagger');it.afx=[{k:'X30',v:1}];it.unidentified=false;g.inventory.push(it);window.saleItem=it;window.goldBefore=g.gold;
      UI.openInfRest({floor:5,guardDown:true,onContinue:()=>{}});
    }''')
    page.get_by_text('回収人 (商会の者)',exact=True).click()
    page.get_by_role('button',name='売る',exact=True).first.click()
    page.get_by_role('button',name='一括売却',exact=False).first.click()
    page.get_by_role('button',name='選んだほうを残して一括売却',exact=True).click()
    page.get_by_role('button',name='戻って選び直す',exact=True).click()
    assert page.evaluate('__game.G.inventory.includes(saleItem)&&__game.G.gold===goldBefore&&__game.G.shopAfx.dagger[0].k==="A03"')
    page.get_by_role('button',name='選んだほうを残して一括売却',exact=True).click()
    page.get_by_role('button',name='保存せずに続ける',exact=True).click()
    page.wait_for_function('!__game.G.inventory.includes(saleItem)')
    print('回収人の一括売却: 警告・取消で不変、承認後に売却',flush=True)
    assert not errors,errors
    browser.close()

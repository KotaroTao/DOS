"""商会の購入ボタンの下から、購入と同時に巻物へ写し取る実操作。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def active(selector):
        return page.locator('.ui-sheet-wrap:not(.closing) ' + selector)

    def setup():
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async()=>{
          const {UI,game}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          sheet.closeAll();
          const G=__game.G; G.tut.cur=null; G.tut.done.enchant=true; G.gold=1e8;
          G.shopStock={shortSword:2};
          G.shopAfx={shortSword:[{k:'A03',v:5},{k:'I01',v:.12}]};
          G.shopAfxDepth={shortSword:250};
          G.afxPages=[];
          window.shelfSrc=game.shopAfxItem('shortSword');
          window.scrollPrice=game.buyPrice(shelfSrc);
          window.shopBefore=()=>JSON.stringify({gold:G.gold,stock:G.shopStock,afx:G.shopAfx,depth:G.shopAfxDepth,pages:G.afxPages,bag:G.inventory});
          window.redrawShop=()=>UI.openShop('buy',{cat:'weapon'});
          redrawShop();
        }''')

    setup()
    for width in [320, 390, 768, 1200]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.evaluate('redrawShop()')
        buy, scroll = page.wait_for_function('''()=>{
          const el=document.querySelector('.wpc-srow.afx');if(!el)return false;
          const rs=['.wpc-buy-main','[data-act="buy-extract"]'].map(s=>el.querySelector(s)?.getBoundingClientRect());
          return rs.every(r=>r?.width>0) ? rs.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})) : false;
        }''').json_value()
        assert scroll['y'] >= buy['y'] + buy['height'], (width, buy, scroll)
        assert abs(scroll['x'] - buy['x']) < 1 and scroll['x'] + scroll['width'] <= width
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('redrawShop()')
    assert page.locator('.wpc-srow:not(.afx) [data-act="buy-extract"]').is_disabled()
    page.evaluate('async()=>{__game.G.tut.done.enchant=false;redrawShop();}')
    assert page.locator('[data-act="buy-extract"]').count() == 0
    page.evaluate('async()=>{__game.G.tut.done.enchant=true;redrawShop();}')

    # 袋が満杯でも、その場で巻物にする購入はできる。取消では何も変わらない。
    page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');
      const bag=__game.G.inventory; bag.splice(0,bag.length,...Array.from({length:50},()=>game.cloneItem('shortSword',50)));
      redrawShop(); window.beforeCancel=shopBefore();
    }''')
    row = page.locator('.wpc-srow.afx')
    assert row.locator('.wpc-buy-main').is_disabled()
    assert row.locator('[data-act="buy-extract"]').is_enabled()
    row.locator('[data-act="buy-extract"]').click()
    active('.ec-extract').last.click()
    assert str(page.evaluate('scrollPrice')) in active('.ui-confirm').inner_text().replace(',', '')
    active('.ui-confirm .ui-btn.k-ghost').click()
    assert page.evaluate('shopBefore()===beforeCancel')
    active('.ec-extract').last.click()
    active('.ui-confirm .ui-btn.k-danger').click()
    page.wait_for_function('__game.G.afxPages.length===1')
    assert page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const G=__game.G, saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      if(G.gold!==1e8-scrollPrice || G.shopStock.shortSword!==1 || G.shopAfx.shortSword || G.shopAfxDepth.shortSword) return false;
      if(G.inventory.length!==50 || G.afxPages[0].k!=='I01' || G.afxPages[0].depth!==250 || saved.afxPages[0].k!=='I01') return false;
      const before=shopBefore();
      return !game.extractAffix({it:shelfSrc,shelf:true},0) && shopBefore()===before;
    }''')
    assert page.locator('.wpc-srow.afx').count() == 0
    assert page.locator('.wpc-srow:not(.afx) .wpc-srow-count').inner_text() == '×1'

    setup()
    page.evaluate('async()=>{__game.G.gold=0;redrawShop();window.beforeCancel=shopBefore();}')
    assert page.locator('.wpc-srow.afx [data-act="buy-extract"]').is_disabled()
    assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');return !game.extractAffix({it:shelfSrc,shelf:true},0)&&shopBefore()===beforeCancel;}''')
    # 確認中に棚の特性が入れ替わっていたら、新しい品を古い特性として購入しない。
    page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');
      const G=__game.G;G.gold=1e8;G.shopAfx.shortSword=[{k:'A04',v:5}];const before=shopBefore();
      if(game.extractAffix({it:shelfSrc,shelf:true},0)||shopBefore()!==before)throw Error('入れ替わった棚から写した');
    }''')
    assert not errors, errors
    print('OK: 320/390/768/1200pxで買うの下・特性選択/取消・購入費1回・通常在庫を維持・袋満杯・保存・金貨不足/売切れ/棚の入替を拒否')
    browser.close()

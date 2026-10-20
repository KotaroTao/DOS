"""付呪の用途/場所・書き込み先・不足表示・破壊前の確認と小画面の操作を検査。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(844,390),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},service_workers='block',reduced_motion='reduce')
        page.route('https://**/*',lambda r:r.abort())
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant',wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');
          const {applyAffixes}=await import('/src/infaffix.js');const {setPref}=await import('/src/ui/prefs.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');Object.assign(window,{api:game,ui:UI,sheets:sheet});
          sheet.closeAll();const g=game.G;g.tut.cur=null;_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.irene.greeted=true;g.insightNotified=Number.MAX_SAFE_INTEGER;g.gold=1234567;g.inventory.length=0;
          for(const d of game.allDolls())d.equip={};
          const make=(afx)=>{const it=game.cloneItem('shortSword',50);if(afx){it.afx=afx;applyAffixes(it)}return it;};
          window.target=make();window.source=make([{k:'A03',v:5},{k:'I01',v:.12}]);
          window.locked=make([{k:'A03',v:2}]);locked.locked=true;
          g.inventory.push(target,source,locked);
          const hidden=make([{k:'A03',v:1}]);hidden.unidentified=true;g.inventory.push(hidden);
          g.party[0].equip.weapon=make([{k:'A03',v:3}]);
          g.shopStock={shortSword:1};g.shopAfx={shortSword:[{k:'A03',v:4}]};
          g.afxPages=Array.from({length:20},(_,i)=>({k:i%2?'A07':'A03',r:.15,lv:1}));
          setPref('enchantFilter',{});UI.openShop('enchant');
          // 5秒ごとの総プレイ時間の加算だけを比較から除く。付呪実績は比較する。
          window.signature=()=>JSON.stringify({gold:g.gold,inventory:g.inventory,equip:g.party.map(d=>d.equip),stock:g.shopStock,afx:g.shopAfx,pages:g.afxPages,rng:g.rng,stats:{...g.stats,playMs:0}});
          window.before=signature();
        }''')
        page.wait_for_function("document.querySelectorAll('.ec-srcs .ec-row').length===4")
        rows=page.locator('.ec-srcs .ec-row')
        page.get_by_label('一覧',exact=True).select_option('sources')
        assert page.locator('.ec-pages').count()==0 and rows.count()==4
        page.get_by_label('品の場所',exact=True).select_option('bag')
        assert rows.count()==2
        assert rows.filter(has_text='ロック').count()==1
        page.screenshot(path=f'/tmp/enchant-sources-{width}.png')
        page.get_by_label('品の場所',exact=True).select_option('equipped')
        assert rows.count()==1 and '外してから' in rows.inner_text().replace('\u200b','')
        page.get_by_label('品の場所',exact=True).select_option('shelf')
        assert rows.count()==1
        page.get_by_label('一覧',exact=True).select_option('pages')
        assert page.locator('.ec-prow').count()==20
        assert page.get_by_label('品の場所',exact=True).is_disabled()
        assert page.evaluate('signature()===before'), '一覧の閲覧で所持品/金貨/乱数が変わった'
        page.locator('.ec-prow .wpc-buy-main').first.click()
        panel=page.locator('.ui-sheet-wrap:not(.closing) .ec-write-sheet')
        assert panel.locator('.ec-target-list .ec-row').count()==4  # 装備1＋鑑定済みの袋3
        page.get_by_label('書き込み先',exact=True).select_option('bag')
        assert panel.locator('.ec-row').count()==3
        page.get_by_label('書き込める品だけ',exact=True).check()
        assert panel.locator('.ec-row').count()==3  # 同じ特性なら満杯でも上書きできる。
        page.get_by_label('書き込める品だけ',exact=True).uncheck()
        page.get_by_label('書き込み先',exact=True).select_option('doll:'+str(page.evaluate('api.G.party[0].uid')))
        assert panel.locator('.ec-row').count()==1
        assert panel.locator('.ec-before').count()==1
        assert panel.locator('.ec-lower').count()==1
        assert panel.locator('.ec-why').filter(has_text='低下').count()==1
        page.screenshot(path=f'/tmp/enchant-overwrite-{width}.png')
        # 候補をスクロールしても、巻物・対象選択・閉じるを画面内に保つ。
        page.get_by_label('書き込み先',exact=True).select_option('all')
        panel.locator('.ec-target-list').evaluate('(e)=>e.scrollTop=e.scrollHeight')
        for selector in ['.ec-page-head','.ec-target-controls','.ui-sheet-foot']:
            assert panel.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}')
        assert panel.locator('.ec-target-list').evaluate('(e)=>e.clientHeight>=80 && e.scrollWidth<=e.clientWidth')
        assert page.evaluate('signature()===before'), '書き込み先の閲覧で資源が変わった'
        panel.locator('.ec-write').filter(has_text='上書きする').first.click()
        dialog=page.locator('.ui-sheet-wrap:not(.closing) .ui-confirm')
        assert '変更前:' in dialog.inner_text().replace('\u200b','')
        dialog.get_by_role('button',name='やめる',exact=True).click()
        assert page.evaluate('signature()===before'), '上書きをやめて資源が変わった'
        page.evaluate('sheets.closeAll()')
        page.wait_for_timeout(500)
        # 金貨不足では実行できる品を0件にし、理由と0件解除の入口を残す。
        page.evaluate('''()=>{api.G.gold=0;ui.openShop('enchant')}''')
        page.locator('.ec-prow .wpc-buy-main').first.click()
        assert '書き込める品 0点' in panel.locator('.ec-target-count').inner_text().replace('\u200b','')
        assert panel.locator('.ec-write:enabled').count()==0
        assert panel.locator('.ec-why').filter(has_text='金貨が足りない').count()==4
        page.get_by_label('書き込める品だけ',exact=True).check()
        assert panel.locator('.wpc-empty').count()==1
        page.get_by_label('書き込める品だけ',exact=True).uncheck()
        page.evaluate('sheets.closeAll()')
        page.wait_for_timeout(500)
        page.evaluate('''()=>{api.G.gold=1234567;ui.openShop('enchant');window.before=signature()}''')
        page.get_by_label('一覧',exact=True).select_option('sources')
        page.get_by_label('品の場所',exact=True).select_option('bag')
        rows.first.locator('.wpc-buy-main').click()
        src=page.locator('.ui-sheet-wrap:not(.closing) .ec-source-sheet')
        assert src.locator('.ec-warning').is_visible()
        assert src.locator('.ec-warning').evaluate('(e)=>e.getBoundingClientRect().bottom<innerHeight')
        assert src.locator('.ui-art').count()==0
        page.screenshot(path=f'/tmp/enchant-extract-{width}.png')
        src.locator('.ec-extract').first.click()
        dialog.get_by_role('button',name='やめる',exact=True).click()
        assert page.evaluate('signature()===before'), '写し取りをやめて資源が変わった'
        src.locator('.ec-extract').first.click()
        dialog.get_by_role('button',name='写し取る',exact=True).click()
        page.wait_for_function('!api.G.inventory.includes(source)')
        assert page.evaluate('api.G.gold===1234567 && api.G.afxPages.length===21')
        page.wait_for_function("document.querySelectorAll('.ec-srcs .ec-row').length===1")
        assert page.get_by_label('一覧',exact=True).input_value()=='sources'
        assert page.get_by_label('品の場所',exact=True).input_value()=='bag'
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(f'{width}x{height}: 用途/場所・未鑑定保護・書き込み先・低下比較・閲覧/取消の資源不変・不足/0件・候補内スクロール・写し取り/条件維持 OK',flush=True)
        page.close()
    browser.close()

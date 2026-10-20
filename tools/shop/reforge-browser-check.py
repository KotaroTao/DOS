"""鍛え直しの共有袋・絞り込み・採用/保留/再抽選の課金と画面幅を実操作で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(320,568), (390,844), (844,390), (768,1024), (1440,900)]:
        page = browser.new_page(viewport={'width':width,'height':height}, service_workers='block', reduced_motion='reduce')
        page.route('https://**/*', lambda r:r.abort())
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          const {SLOTS}=await import('/src/items.js');
          Object.assign(window,{api:game,ui:UI,sheets:sheet});
          sheet.closeAll(); const g=game.G;g.tut.cur=null;
          _TUTS.forEach(t=>g.tut.done[t.key]=true);g.irene.greeted=true;g.insightNotified=Number.MAX_SAFE_INTEGER;
          g.gold=1234567;g.inventory.length=0;g.reserve.push(g.party.pop());
          for(const d of game.allDolls()) {for(const k of SLOTS)d.equip[k]=null;d.equip.weapon=game.cloneItem('shortSword',45);}
          window.bagItem=game.cloneItem('dagger',20);
          window.high=game.cloneItem('dagger',80);
          const hidden=game.cloneItem('dagger',1);hidden.unidentified=true;
          const memory=game.cloneItem('dagger',30);memory.soulMemory=true;
          g.inventory.push(bagItem,high,hidden,memory);
          window.signature=()=>JSON.stringify({gold:g.gold,rng:g.rng,stats:g.stats,inventory:g.inventory});
          window.before=signature();UI.openShop('forge');
        }''')
        page.wait_for_function('''()=>document.querySelector('.seg-forge .wpc-lhead-s')?.textContent.replace(/\u200b/g,'').includes('1,234,567')''')
        rows = page.locator('.rf-row')
        assert rows.count() == 9, (width,rows.count())  # 装備6＋袋3、未鑑定品は伏せる。
        assert page.locator('.rf-grp.reserve').count() == 1
        assert '1,234,567' in page.locator('.seg-forge .wpc-lhead-s').inner_text().replace('\u200b','')
        assert not page.locator('.rf-guide').evaluate('(e)=>e.open')
        page.get_by_label('対象',exact=True).select_option('bag')
        assert rows.count() == 3
        assert page.locator('.rf-q').all_inner_texts() == ['品質 20','品質 30','品質 80']
        page.get_by_label('並び順',exact=True).select_option('high')
        assert page.locator('.rf-q').all_inner_texts() == ['品質 80','品質 30','品質 20']
        page.get_by_label('並び順',exact=True).select_option('name')
        page.get_by_label('対象',exact=True).select_option('equipped')
        assert rows.count() == 6
        uid = page.evaluate('api.G.reserve[0].uid')
        page.get_by_label('対象',exact=True).select_option('doll:'+str(uid))
        assert rows.count() == 1
        page.get_by_label('対象',exact=True).select_option('bag')
        page.get_by_label('並び順',exact=True).select_option('low')
        assert page.evaluate('before===signature()'), '閲覧・絞り込みで金貨/乱数/品が変わった'
        page.locator('.rf-guide summary').click()
        assert page.locator('.rf-guide').evaluate('(e)=>e.open')
        page.locator('.rf-guide summary').click()
        # 一覧だけをスクロールでき、操作欄を画面内に保つ。低い横向きは商会全体のスクロール。
        if height > 500:
            assert page.locator('.rf-list').evaluate('(e)=>e.clientHeight>=100')
        page.screenshot(path=f'/tmp/reforge-list-{width}.png')
        rows.first.locator('.wpc-buy-main').click()
        panel = page.locator('.ui-sheet-wrap:not(.closing) .rf-sheet')
        assert '共有の袋' in panel.locator('.rf-where').inner_text().replace('\u200b','')
        assert page.evaluate('before===signature()'), '確認を開くだけで課金された'
        # 本物の課金処理を使い、品質だけ固定して採用/保留を両方検証する。
        page.evaluate('''()=>{window.originalRoll=api.rollReforge;window.draws=[90,10,70,60,90];
          api.rollReforge=(...args)=>{const r=originalRoll(...args);return r.ok?{...r,q:draws.shift()}:r};
          window.cost=api.reforgeCost(bagItem);window.goldBefore=api.G.gold;window.countBefore=api.G.stats.reforged||0;
        }''')
        panel.get_by_role('button',name='鍛え直す',exact=False).click()
        panel.locator('.rf-forge').click()
        assert page.evaluate('api.G.gold===goldBefore-cost && bagItem.q===20')
        assert [s.replace('\u200b','') for s in panel.locator('.rf-quality').all_inner_texts()] == ['元の品質\n品質 20','引いた品質\n品質 90']
        page.screenshot(path=f'/tmp/reforge-result-{width}.png')
        buttons=panel.locator('.ui-sheet-foot > button')
        rects=buttons.evaluate_all('(es)=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}})')
        assert len(rects)==3 and all(r['height']>=44 and r['x']>=0 and r['right']<=width+1 and r['bottom']<=height+1 for r in rects),rects
        assert rects[2]['y']>=rects[0]['bottom'] and rects[2]['y']>=rects[1]['bottom'],rects
        panel.get_by_role('button',name='もう一度鍛える',exact=False).click()
        panel.locator('.rf-forge').click()
        assert page.evaluate('api.G.gold===goldBefore-2*cost && bagItem.q===20')
        assert '10' in panel.locator('.rf-quality').last.inner_text()
        panel.get_by_role('button',name='元のまま',exact=False).click()
        assert page.evaluate('api.G.gold===goldBefore-2*cost && bagItem.q===20')
        panel.get_by_role('button',name='鍛え直す',exact=False).click()
        panel.locator('.rf-forge').click()
        panel.get_by_role('button',name='新しい品質にする',exact=False).click()
        assert page.evaluate('bagItem.q===70 && api.G.gold===goldBefore-3*cost && api.G.stats.reforged===countBefore+3')
        assert '70' in page.locator('.rf-row .rf-q').all_inner_texts()[-2]
        panel.locator('.ui-sheet-foot').get_by_role('button',name='閉じる',exact=True).click()
        page.wait_for_timeout(700)
        assert page.get_by_label('対象',exact=True).input_value()=='bag'
        assert '共有の袋' in page.locator('.rf-list').inner_text().replace('\u200b','')
        # 使えない理由・不足時は採用/元のままを妨げない。
        page.evaluate('''()=>{api.G.gold=cost;ui.openShop('forge')}''')
        page.locator('.rf-row').filter(has_text='品質 70').locator('.wpc-srow-info').click()
        panel.get_by_role('button',name='鍛え直す',exact=False).click()
        panel.locator('.rf-forge').click()
        assert panel.get_by_role('button',name='もう一度鍛える',exact=False).is_disabled()
        assert panel.get_by_role('button',name='新しい品質にする',exact=False).is_enabled()
        page.evaluate('sheets.closeAll()')
        page.wait_for_timeout(700)
        assert page.evaluate('bagItem.q===70 && api.G.gold===0'), '閉じた候補を採用/返金してしまった'
        assert page.locator('.rf-row-block').filter(has_text='金貨が足りない').count() > 0
        # 装備者の検出と能力差を維持する。
        page.evaluate('''()=>{api.G.gold=1234567;ui.openShop('forge')}''')
        page.get_by_label('対象',exact=True).select_option('equipped')
        rows.first.locator('.wpc-srow-info').click()
        assert '装備中' in panel.locator('.rf-where').inner_text().replace('\u200b','')
        panel.get_by_role('button',name='鍛え直す',exact=False).click()
        panel.locator('.rf-forge').click()
        assert panel.locator('.rf-doll').count()==1
        # 候補を見た後に再抽選が失敗しても、候補と所持金は保つ。
        candidate = panel.locator('.rf-quality').last.inner_text()
        page.evaluate('''()=>{window.failedBefore=signature();api.rollReforge=()=>({ok:false})}''')
        panel.get_by_role('button',name='もう一度鍛える',exact=False).click()
        assert panel.locator('.rf-quality').last.inner_text()==candidate
        assert page.evaluate('signature()===failedBefore')
        page.evaluate('sheets.closeAll()')
        page.wait_for_timeout(700)
        # 人業がいなくても共有の袋は閲覧でき、0件から対象を戻せる。
        page.evaluate('''()=>{api.G.party.length=0;api.G.reserve.length=0;ui.openShop('forge')}''')
        assert page.locator('.rf-list .wpc-empty').count()==1
        page.get_by_label('対象',exact=True).select_option('bag')
        assert rows.count()==3
        # 深い装備の長い費用でも確認ボタンを画面内に収める。
        page.evaluate('''()=>{api.reforgeCost=()=>1234567890123;ui.openShop('forge')}''')
        rows.first.locator('.wpc-srow-info').click()
        assert panel.evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        assert panel.locator('.ui-cost').inner_text().replace('\u200b','')=='1234567890123'
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(f'{width}x{height}: 共有袋の一意表示・未鑑定保護・対象/順序・閲覧無課金・再抽選/保留/採用・不足/閉じる・操作位置 OK',flush=True)
        page.close()
    browser.close()

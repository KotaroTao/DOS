"""商会の個別比較・追加品・購入と館の属性/効果検索を実操作で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(390,844), (320,568), (844,390), (1024,768)]:
        page = browser.new_page(viewport={'width':width,'height':height}, service_workers='block')
        page.route('https://fonts.googleapis.com/**',lambda route:route.fulfill(content_type='text/css',body=''))
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        print(page.evaluate('''async()=>{
          const {UI,game}=await import('/src/ui/ctx.js');
          const {setPref}=await import('/src/ui/prefs.js');
          const {ITEMS,recalc}=await import('/src/items.js');
          const {applyAffixes}=await import('/src/infaffix.js');
          window.api=game;window.ui=UI;
          const g=game.G;
          g.irene.greeted=true;g.tut.cur=null;g.gold=10000000;g.insightNotified=Number.MAX_SAFE_INTEGER;
          const {_TUTS}=await import('/src/ui/tutorial.js');
          _TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.msq.prologue={phase:'done',gifts:{}};
          Object.assign(g.tut.done,{prologueFormation:true,soulChange:true});
          setPref('gearFilter',{});
          window.first=g.party[0];window.second=g.party[1];
          g.party.forEach(d=>{d.jobLv=200;});
          first.equip.weapon=__game.equipLv.cloneItem('dagger',50);
          first.equip.weapon.eff={multistrike:2};recalc(first);
          second.equip.weapon=null;recalc(second);
          g.shopStock={shortSword:3,dagger:2};g.shopAfx={shortSword:[{k:'A03',v:5}]};
          setPref('shopDollUid',first.uid);
          UI.openShop('buy',{cat:'weapon'});
          return {names:g.party.map(d=>d.name), ids:g.party.map(d=>d.uid)};
        }'''),flush=True)
        assert page.locator('.wpc-srow.afx .wpc-comparison').count()==1
        assert page.locator('.wpc-character').count()==6
        assert page.locator('.wpc-character[aria-pressed="true"]').count()==1
        assert page.locator('.wpc-effect.lost').count()>0
        before=page.locator('.wpc-list.buy').inner_text()
        uid=page.evaluate('second.uid')
        page.screenshot(path=f'/tmp/shop-before-{width}.png')
        page.locator(f'.wpc-character[data-doll-uid="{uid}"]').click()
        assert page.locator('.wpc-list.buy').inner_text()!=before
        assert page.locator('.wpc-current').filter(has_text='未装備').count()>0
        assert page.evaluate("JSON.parse(localStorage.getItem('dos-ui')).shopDollUid===second.uid")
        # 詳細を開いても他の者へ比較を広げない。
        page.locator('.wpc-srow:not(.afx) .wpc-srow-info').first.click()
        assert page.locator('.pt-chc').count()==1
        page.evaluate("async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll()}")
        page.wait_for_timeout(650)
        # 魂なしの器を選んでも他の者のおすすめを出さない。
        print(page.evaluate('''async()=>{
          const {setPref}=await import('/src/ui/prefs.js');
          const g=api.G; window.soul=second.primary;second.primary=null;
          ui.openShop('buy',{cat:'rec'});
          if(document.querySelectorAll('.wpc-srow').length)throw Error('別の者のおすすめが混入');
          second.primary=soul;
          ui.openShop('buy',{cat:'weapon'});
          return '魂なしの個別おすすめは空';
        }'''),flush=True)
        # 選択者に買って装備する。
        page.locator('.wpc-buy-main.eq').first.click()
        page.wait_for_timeout(350)
        # equipPick は確認画面を挟むことがあるため、窓口の購入も確認。
        print(page.evaluate('''async()=>{
          const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
          const {shopBuy}=await import('/src/ui/shop.js');
          const gold=api.G.gold;
          if(!shopBuy('shortSword',second,{equip:true}))throw Error('購入失敗');
          if(second.equip.weapon?.id!=='shortSword'||api.G.gold>=gold)throw Error('購入先不一致');
          ui.enterMansion();return '選択者へ購入・装備';
        }'''),flush=True)
        assert page.locator('.pt-form > .gf-open').count()==0
        assert page.locator('.pt-mansion-links .pt-mansion-manage').count()==1
        # 保存編成入口が残る。
        page.locator('.pt-mansion-manage').click()
        assert page.locator('.pt-preset').count()==10
        page.locator('.pt-formation-sheet').get_by_role('button',name='閉じる',exact=True).click()
        page.wait_for_timeout(650)
        print(page.evaluate('''async()=>{
          const {applyAffixes}=await import('/src/infaffix.js');
          const {matchesGearFilter,gearEffectOptions}=await import('/src/ui/gearfilter.js');
          const g=api.G;g.inventory.length=0;
          const make=()=>__game.equipLv.cloneItem('dagger',50);
          window.a=make(); a.eAtk={el:'fire',lv:1};a.eff={lifesteal:0.1};
          window.b=make(); b.eAtk={el:'water',lv:1};b.eff={lifesteal:0.2,regen:0.03};
          window.c=make();c.unidentified=true;c.eAtk={el:'fire',lv:2};c.eff={lifesteal:0.3};
          window.d=make();d.afx=[{k:'A03',v:2}];applyAffixes(d);
          g.inventory.push(a,b,c,d);
          const f={elements:[],effects:['eff:lifesteal'],allEffects:false};
          if(!matchesGearFilter(a,f)||!matchesGearFilter(b,f)||matchesGearFilter(c,f))throw Error('効果量集約・未鑑定保護');
          if(!matchesGearFilter(a,{...f,elements:['eAtk:fire']})||matchesGearFilter(b,{...f,elements:['eAtk:fire']}))throw Error('属性AND');
          if(matchesGearFilter(a,{...f,effects:['eff:lifesteal','eff:regen'],allEffects:true})||!matchesGearFilter(b,{...f,effects:['eff:lifesteal','eff:regen'],allEffects:true}))throw Error('複数効果AND');
          if(!gearEffectOptions(d).some(o=>o.key==='afx:A03'))throw Error('追加特性の台帳ID');
          ui.enterMansion();return '属性・効果量集約・未鑑定・複数AND・追加特性';
        }'''),flush=True)
        page.evaluate("ui.openParty(null,{seg:'equip'})")
        page.locator('.pt-bagwrap > .gf-open').click()
        panel=page.locator('.gf-sheet')
        search=panel.locator('.gf-search')
        search.fill('吸血')
        assert panel.locator('[data-filter-key="eff:lifesteal"]').count()==1
        assert search.evaluate('(e)=>document.activeElement===e')
        panel.locator('[data-filter-key="eff:lifesteal"]').click()
        panel.get_by_role('button',name='2点を表示',exact=True).click()
        page.wait_for_timeout(650)
        assert page.locator('.pt-bag .pt-bcell').count()==2
        assert '絞り込み' in page.locator('.pt-bagwrap > .gf-open').inner_text()
        page.locator('.pt-bagwrap > .gf-open').click()
        panel=page.locator('.gf-sheet')
        panel.locator('[data-filter-key="eAtk:fire"]').click()
        panel.get_by_role('button',name='1点を表示',exact=True).click()
        page.wait_for_timeout(650)
        assert page.locator('.pt-bag .pt-bcell').count()==1
        # 部位候補にも同じ条件が効き、現在装備は比較用に残る。
        page.locator('.pt-slot[data-slot="weapon"]').click()
        candidate=page.locator('.pt-cand-sheet')
        assert candidate.locator('.pt-cur').count()==1
        assert candidate.locator('.pt-cand:not(.worn)').count()==1
        page.evaluate("async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll()}")
        page.wait_for_timeout(650)
        # 追加条件で0件になっても、条件と解除の入口を残す。
        page.locator('.pt-bagwrap > .gf-open').click()
        panel=page.locator('.gf-sheet')
        panel.locator('.gf-search').fill('再生')
        panel.locator('[data-filter-key="eff:regen"]').click()
        panel.locator('.gf-mode input').check()
        panel.get_by_role('button',name='0点を表示',exact=True).click()
        page.wait_for_timeout(650)
        assert page.locator('.pt-bag .pt-bcell').count()==0
        assert page.locator('.gf-summary').get_by_role('button',name='すべて解除',exact=True).is_visible()
        page.locator('.gf-summary').get_by_role('button',name='すべて解除',exact=True).click()
        assert page.locator('.pt-bag .pt-bcell').count()==4
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(f'{width}x{height}: 個別比較・購入・編成・絞り込み・解除 OK',flush=True)
        page.screenshot(path=f'/tmp/shop-filter-{width}.png')
        page.close()
    browser.close()

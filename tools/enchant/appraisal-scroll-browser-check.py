"""技・商会の鑑定結果からの巻物化と、端末幅ごとの操作・スクロールを確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def active(selector):
        return page.locator('.ui-sheet-wrap:not(.closing) ' + selector)

    def setup(skill=False, unlocked=True):
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async({skill,unlocked})=>{
          const {UI,game}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const {applyAffixes}=await import('/src/infaffix.js');
          sheet.closeAll();
          const G=__game.G; G.tut.cur=null; G.tut.done.enchant=unlocked; G.gold=1e8;
          G.inventory.splice(0); G.afxPages=[]; G.insightNotified=1e9;
          for(let i=0;i<16;i++) {
            const it=game.cloneItem('shortSword',50);
            if(i!==1) {it.afx=[{k:'A03',v:5},{k:'I01',v:.12}];applyAffixes(it);}
            if(i===0)it.name="眠らずの星々の王のとても長い名を持つショートソード";
            it.unidentified=true;
            if(i===2)it.locked=true;
            if(i===3)it.soulMemory=true;
            G.inventory.push(it);
          }
          window.scrollIt=G.inventory[0];
          if(skill) {
            // 結果の分岐を固定し、結果画面からの操作は実際の処理を通す。
            G.party[0].passiveMap.kantei=4;
            game.doIdentifySkill=(m,it)=>{if(it===G.inventory[15])return false;delete it.unidentified;return true;};
            UI.openTryIdentifyAll();
          } else UI.identifyAllAndReveal();
        }''', {'skill': skill, 'unlocked': unlocked})
        if skill:
            active('.ap-sheet').get_by_role('button', name='早送り').click()
        active('.wpc-reveal-actions').first.wait_for(state='visible')

    for skill in [False, True]:
        setup(skill)
        assert active('.wpc-reveal-actions').nth(1).locator('[data-act="extract"]').count() == 0
        assert active('.wpc-reveal-actions').nth(2).locator('[data-act="extract"]').is_disabled()
        assert active('.wpc-reveal-actions').nth(3).locator('[data-act="extract"]').is_disabled()
        if skill:
            assert active('.ap-sum-fail').count() == 1
        print('鑑定経路:', '技' if skill else '商会', flush=True)
        for width, height in [(320,568),(390,844),(600,800),(768,1024),(1024,768),(1440,900),(844,390)]:
            page.set_viewport_size({'width':width,'height':height})
            row=active('.wpc-reveal-actions').first
            sell=row.locator('[data-act="sell"]')
            extract=row.locator('[data-act="extract"]')
            a,b=sell.bounding_box(),extract.bounding_box()
            assert b['x']>=a['x']+a['width'] and abs(a['y']-b['y'])<1,(width,a,b)
            assert b['height']>=44 and b['x']+b['width']<=width,(width,b)
            assert page.evaluate('''()=>[...document.querySelectorAll('.wpc-prow-main,.wpc-reveal-actions,.wpc-reveal,.ap-sum')]
              .every(e=>e.scrollWidth<=e.clientWidth+1)'''), width
            main=row.locator('..').locator('.wpc-prow-main').bounding_box()
            if width<=767:
                assert a['y']>=main['y']+main['height']-1,(width,main,a)
            if width in [390,768,1440] and not skill:
                page.screenshot(path=f'/tmp/dos-appraisal-{width}.png')
            foot=active('.ui-sheet-foot').first
            assert foot.is_visible()
        page.set_viewport_size({'width':390,'height':844})
        # 下の行まで内側をスクロールしても、閉じる操作は常に残る。
        active('.ui-sheet-body').first.evaluate('(e)=>e.scrollTop=e.scrollHeight')
        assert active('.wpc-reveal-actions').last.locator('[data-act="sell"]').is_visible()
        active('.wpc-reveal-actions').first.locator('[data-act="extract"]').click()
        assert active('.ec-extract').count()==2
        page.evaluate('window.beforeExtract={gold:__game.G.gold,bag:__game.G.inventory.length,pages:__game.G.afxPages.length}')
        active('.ec-extract').first.click()
        active('.ui-confirm .ui-btn.k-ghost').click()
        assert page.evaluate('''()=>__game.G.gold===beforeExtract.gold && __game.G.inventory.includes(scrollIt)
          && __game.G.afxPages.length===beforeExtract.pages''')
        active('.ec-extract').last.click()
        active('.ui-confirm .ui-btn.k-danger').click()
        page.wait_for_function('!__game.G.inventory.includes(scrollIt)')
        assert page.evaluate('''async()=>{
          const {refDeserialize}=await import('/src/savegraph.js');
          const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
          return __game.G.gold===beforeExtract.gold && __game.G.inventory.length===beforeExtract.bag-1
            && __game.G.afxPages.length===beforeExtract.pages+1 && saved.afxPages.at(-1).k==='I01';
        }''')
        assert '売却・巻物化した品 1点' in active('.ap-sum-worn').inner_text().replace('\u200b','')
        # 一括売却の集計は消費済みの品を含めずに更新する。
        assert active('.ui-sheet-foot').first.get_by_role('button',name='残りをまとめて売る').count()==1
        assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');
          return !!game.extractBlock({it:scrollIt,shelf:false});}''')
        setup(skill, unlocked=False)
        assert active('.wpc-reveal-actions [data-act="extract"]').count()==0
    assert not errors,errors
    page.screenshot(path='/tmp/dos-appraisal-mobile.png')
    print('OK: 技/商会の鑑定・7画面サイズ・保護/解放条件・取消・巻物保存・二重消費拒否・一覧更新')
    browser.close()

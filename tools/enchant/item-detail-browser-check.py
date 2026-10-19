"""品の詳細から街・迷宮で写し取る。解放条件・未鑑定・取消・保護・配置も確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def active(selector):
        return page.locator(".ui-sheet-wrap:not(.closing) " + selector)

    def setup(town=True):
        page.goto('http://localhost:8000/?testDungeon=w45&testUnlock=enchant,infinite' + ('&testPlace=town' if town else ''))
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async () => {
          const {UI,game}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const {applyAffixes}=await import('/src/infaffix.js');
          const G=__game.G;
          sheet.closeAll(); G.tut.cur=null; G.tut.done.enchant=true;
          const it=game.cloneItem('shortSword',50);
          it.afx=[{k:'A03',v:5},{k:'I01',v:.12}]; applyAffixes(it);
          G.inventory.push(it); window.scrollIt=it;
          window.showScrollItem=async(custom=false)=>{
            sheet.closeAll();
            if(custom) {
              const {openItem}=await import('/src/ui/party.js'); openItem(it,G.party[0]);
            } else UI.itemSheet(it,{owner:G.party[0],context:'bag'});
          };
          await showScrollItem();
          window.beforeScroll={gold:G.gold,pages:game.afxPagesState().length};
        }''')

    setup()
    # 直接開く経路・隊の独自操作を渡す経路のどちらも「売る」の右隣。
    for width in [320, 390, 768]:
        page.set_viewport_size({'width': width, 'height': 844})
        for custom in [False, True]:
            page.evaluate('(custom)=>showScrollItem(custom)', custom)
            sell = active('.wpc-isheet [data-act="sell"]')
            scroll = active('.wpc-isheet [data-act="extract"]')
            sell.wait_for(state="visible"); scroll.wait_for(state="visible")
            assert sell.count() == scroll.count() == 1
            a, b = sell.bounding_box(), scroll.bounding_box()
            assert b['x'] >= a['x'] + a['width'] and abs(a['y'] - b['y']) < 1, (width, a, b)
            assert b['x'] + b['width'] <= width, (width, b)

    # 手ほどき前には出さない。未鑑定品はUI・直接処理の両方から拒否。
    page.evaluate('async()=>{__game.G.tut.done.enchant=false;await showScrollItem();}')
    assert active('[data-act="extract"]').count() == 0
    page.evaluate('async()=>{__game.G.tut.done.enchant=true;scrollIt.unidentified=true;await showScrollItem();}')
    assert active('[data-act="extract"]').count() == 0
    assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');
      const before=game.afxPagesState().length;
      const result=game.extractAffix({it:scrollIt,shelf:false},0);
      return !result && __game.G.inventory.includes(scrollIt) && game.afxPagesState().length===before;
    }''')
    page.evaluate('async()=>{delete scrollIt.unidentified;scrollIt.locked=true;await showScrollItem();}')
    assert active('[data-act="extract"]').is_disabled()
    page.evaluate('async()=>{delete scrollIt.locked;scrollIt.formationNames=["保存編成"];await showScrollItem();}')
    assert active('[data-act="extract"]').is_disabled()
    page.evaluate('''async()=>{
      delete scrollIt.formationNames;
      __game.G.inventory.splice(__game.G.inventory.indexOf(scrollIt),1);
      __game.G.party[0].equip.weapon=scrollIt;await showScrollItem();
    }''')
    assert active('[data-act="extract"]').is_disabled()
    # 引数のkeyを偽っても、装備中の品を写し取れない。
    assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');return !!game.extractBlock({it:scrollIt,key:null,shelf:false});}''')

    for town in [True, False]:
        setup(town)
        active('[data-act="extract"]').click()
        assert active('.ec-sheet .ec-extract').count() == 2
        assert active('.ec-sheet').get_by_role('button', name='消す', exact=True).count() == 0
        active('.ec-extract').first.click()
        active('.ui-confirm .ui-btn.k-ghost').click()
        assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');
          return __game.G.inventory.includes(scrollIt) && __game.G.gold===beforeScroll.gold && game.afxPagesState().length===beforeScroll.pages;
        }''')
        assert active('.wpc-isheet').count() == 1
        (active('.ec-extract').last if town else active('.ec-extract').first).click()
        active('.ui-confirm .ui-btn.k-danger').click()
        page.wait_for_function('!__game.G.inventory.includes(scrollIt)')
        assert active('.wpc-isheet').count() == 0
        expected = 'I01' if town else 'A03'
        assert page.evaluate('''async(expected)=>{
          const {game}=await import('/src/ui/ctx.js');
          const {refDeserialize}=await import('/src/savegraph.js');
          const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
          return game.afxPagesState().length===beforeScroll.pages+1 && saved.afxPages.at(-1).k===expected;
        }''', expected)
        if not town:
            assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');return !!game.enchantClosed();}'''), '書込・消去の場所制限を維持'
        # 消費済みの品から二重に作れない。
        assert page.evaluate('''async()=>{const {game}=await import('/src/ui/ctx.js');return !!game.extractBlock({it:scrollIt,shelf:false});}''')

    setup()
    page.evaluate('''async()=>{
      const {SOUL_KEYS}=await import('/src/souls.js');
      __game.inf.enterAbyss(SOUL_KEYS.slice(0,6));
      const {game}=await import('/src/ui/ctx.js');
      __game.G.tut.done.enchant=true; __game.G.inventory.push(scrollIt);await showScrollItem();
    }''')
    assert active('[data-act="extract"]').is_enabled()
    active('[data-act="extract"]').click()
    active('.ec-extract').first.click()
    active('.ui-confirm .ui-btn.k-danger').click()
    page.wait_for_function('!__game.G.inventory.includes(scrollIt)')
    assert not errors, errors
    print('OK: 街/迷宮/無限迷宮で写し取り・手ほどき前/未鑑定/保護/装備中の拒否・確認取消・二重消費防止・320/390/768pxで売るの右隣')
    browser.close()

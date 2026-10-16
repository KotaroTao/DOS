"""localhost:8000でPC専用の操作・検索・購入・情報表示・画面幅切替を実操作で確かめる。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('DOS_TEST_URL','http://localhost:8000')
OUT=Path('work/pc-controls');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':720},service_workers='block')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(content_type='text/css',body=''))
    def boot(route):
        response=route.fetch();route.fulfill(response=response,body=response.text().replace('}, 5000);','}, 60000);'))
    page.route(BASE+'/?testDungeon=*',boot)
    page.goto(BASE+'/?testDungeon=w05&testPlace=town&testUnlock=infinite,forge,enchant,sub1,sub2',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function('window.__game?.G.party.length===6')
    page.evaluate('''async()=>{
      const {UI,game}=await import('/src/ui/ctx.js');window.UI=UI;window.api=game;
      window.kit=await import('/src/ui/kit.js');window.items=await import('/src/items.js');
      const g=game.G;g.irene.greeted=true;g.tut.cur=null;g.gold=9999999;g.prompt=false;
      g.insightNotified=Number.MAX_SAFE_INTEGER;
      const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>g.tut.done[t.key]=true);
      g.msq.prologue={phase:'done',gifts:{}};
      window.useItem=Object.values(items.ITEMS).find(i=>i.slot==='use' && !i.unidentified);
      g.shopStock={shortSword:4,dagger:3,[useItem.id]:3};
      window.snapshot=()=>JSON.stringify({gold:g.gold,bag:g.inventory,party:g.party.map(d=>({uid:d.uid,equip:d.equip})),rng:g.rng});
      UI.shell.setTab('hub');
    }''')
    page.add_style_tag(content='*,*::before,*::after{animation:none!important;transition:none!important}')
    page.wait_for_load_state('networkidle',timeout=90000)
    def close():
        page.evaluate('kit.sheet.closeAll()');page.wait_for_timeout(650)
    def settle():page.wait_for_timeout(500)
    def fits():
        page.evaluate('''()=>{
          const root=document.querySelector('.ui-sheet:not(.closing)')||document.getElementById('town-screen');
          const r=root.getBoundingClientRect();
          if(r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1)throw Error('PC画面が窓の外');
          for(const e of root.querySelectorAll('.pc-master,.pc-detail,.pc-settings,.pc-mansion-columns,.pc-dashboard'))
            if(e.scrollWidth>e.clientWidth+1)throw Error('横にはみ出す '+e.className);
        }''')
    for width,height in [(1100,600),(1280,720),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height});settle()
        page.evaluate("UI.shell.setTab('hub')");settle()
        assert page.locator('.pc-summary-cell').count()==4
        assert page.locator('.pc-party-card').count()==6
        fits()
        if width==1280:page.screenshot(path=str(OUT/'dashboard.png'))
        page.locator('.pc-party-card').nth(1).click();settle()
        assert page.locator('.pc-mansion').is_visible()
        assert page.locator('.pc-roster-row').count()==6
        page.get_by_role('button',name='イレーヌの助言',exact=True).click();settle()
        assert page.locator('.iv-scene').is_visible()
        page.locator('.iv-skip').click();settle()
        assert page.locator('.iv-scene').count()==0
        before=page.evaluate('snapshot()')
        page.locator('.pc-roster-row').nth(2).click();settle()
        assert page.locator('.pc-roster-row').nth(2).get_attribute('aria-pressed')=='true'
        assert page.evaluate('snapshot()')==before,'人業を選んだだけで装備や乱数が変わった'
        page.evaluate("document.querySelector('[data-section=equip]').scrollTop=100")
        position=page.locator('[data-section=equip]').evaluate('(e)=>e.scrollTop')
        page.locator('.pc-roster-row').nth(1).click();settle()
        assert abs(page.locator('[data-section=equip]').evaluate('(e)=>e.scrollTop')-position)<1
        fits()
        if width==1280:page.screenshot(path=str(OUT/'mansion.png'))
        page.get_by_role('button',name='隊列・保存編成',exact=True).click();settle()
        assert page.locator('.pt-preset').count()==10
        close()
        page.evaluate("UI.openShop('buy',{cat:'weapon'})");settle()
        assert page.locator('.pc-shop-browser .pc-list-row').count()>=2
        before=page.evaluate('snapshot()')
        page.locator('.pc-shop-browser .pc-list-row').last.click()
        assert page.evaluate('snapshot()')==before,'一覧を選んだだけで購入された'
        search=page.locator('.pc-shop-browser .pc-search')
        search.fill('この名前の品はない')
        assert page.locator('.pc-shop-browser .pc-list-row').count()==0
        assert page.locator('.pc-shop-browser .pc-detail .wpc-buy-main').count()==0
        search.fill(page.evaluate('items.ITEMS.dagger.name'));settle()
        assert page.locator('.pc-shop-browser .pc-list-row').count()==1
        assert page.evaluate('snapshot()')==before
        search.fill('');settle()
        page.locator('.pc-shop-browser .pc-list-row').first.focus()
        page.keyboard.press('End')
        assert page.locator('.pc-shop-browser .pc-list-row').last.get_attribute('aria-pressed')=='true'
        fits()
        if width==1280:page.screenshot(path=str(OUT/'shop.png'))
        page.evaluate("UI.openShop('buy',{cat:'use'})");settle()
        gold=page.evaluate('api.G.gold')
        page.locator('.pc-shop-browser .wpc-buy-main').first.click();settle()
        assert page.evaluate('api.G.gold')<gold,'購入ボタンが既存の購入処理につながらない'
        page.evaluate('UI.openStoryArchive()');settle()
        assert page.locator('.pc-reader-sheet .pc-list-row').count()>0
        assert page.locator('.pc-reader-sheet .jr-line').count()>0
        page.locator('.pc-reader-sheet .pc-search').fill('見つからない記録')
        assert page.locator('.pc-reader-sheet .pc-list-row').count()==0
        page.locator('.pc-reader-sheet .pc-search').fill('');settle()
        page.locator('.pc-reader-sheet .pc-list-row').last.click()
        assert page.locator('.ui-sheet:not(.closing)').count()==1,'本文を別の窓へ重ねている'
        fits()
        if width==1280:page.screenshot(path=str(OUT/'reader.png'))
        close()
        page.evaluate('UI.settingsSheet({})');settle()
        page.locator('.pc-settings-nav').get_by_role('button',name='装い',exact=True).click()
        assert page.locator('.stg-wk-prev').is_visible()
        page.locator('.pc-settings-nav').get_by_role('button',name='自動化・データ',exact=True).click()
        assert page.locator('.stg-danger').count()>0
        fits()
        if width==1280:page.screenshot(path=str(OUT/'settings.png'))
        close()
        page.evaluate("UI.openPalace('decree')");settle()
        page.locator('.pc-palace-nav').get_by_role('button',name='職業の図鑑',exact=True).click();settle()
        assert page.locator('.pc-palace-nav').get_by_role('button',name='職業の図鑑',exact=True).get_attribute('aria-pressed')=='true'
        assert page.locator('.s-codex').is_visible()
        fits()
        if width==1280:page.screenshot(path=str(OUT/'palace.png'))
        print(f'{width}x{height}: 情報・選択・検索・購入・設定・王宮の実操作 OK',flush=True)
    # 広さの切り替えで選択と実体が変わらず、狭い窓では元の画面へ戻る。
    page.evaluate('UI.enterMansion()');settle()
    page.locator('.pc-roster-row').nth(3).click();settle()
    name=page.locator('.pc-mansion-head h1').inner_text()
    before=page.evaluate('snapshot()')
    page.set_viewport_size({'width':900,'height':720});settle()
    assert page.locator('.pc-mansion').count()==0
    assert page.locator('.pt-overview').is_visible()
    page.set_viewport_size({'width':1280,'height':720});settle()
    assert page.locator('.pc-mansion-head h1').inner_text()==name
    assert page.evaluate('snapshot()')==before
    # 開いている本文は、狭い窓にしても読み続けられる。
    page.evaluate('UI.openStoryArchive()');settle()
    page.locator('.pc-reader-sheet .pc-list-row').last.click()
    selected=page.locator('.pc-reader-sheet .pc-detail h2').inner_text()
    page.set_viewport_size({'width':900,'height':600});settle();fits()
    assert page.locator('.pc-reader-sheet .pc-detail h2').inner_text()==selected
    close()
    page.set_viewport_size({'width':1280,'height':720});settle()
    page.evaluate('__game.ev.enterDungeon(null,1)')
    page.wait_for_function('__game.G.state === "board" && document.querySelector("#pc-explore-tools")')
    assert page.locator('#pc-explore-tools button').count()==6
    page.locator('#pc-explore-tools').get_by_role('button',name='探索記録',exact=True).click();settle()
    assert page.locator('.dg-logsheet').is_visible()
    close()
    page.evaluate('__game.startBattle(__game.spawnCardEnemies("bs_drainrat",1),null)')
    page.wait_for_timeout(1500)
    assert page.locator('#pc-explore-tools').count()==0
    assert not errors,errors
    print('画面幅の切替・選択と実体の維持・探索の操作帯・戦闘への移行 OK',flush=True)
    browser.close()

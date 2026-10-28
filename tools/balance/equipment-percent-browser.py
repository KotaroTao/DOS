"""実物の装備・専門耐性・武魂の表示と装備比較を狭い画面で確認する。"""
from playwright.sync_api import sync_playwright
import base64
PIXEL=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [320,390,768]:
        page=browser.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce')
        page.route('**/art/**',lambda r:r.fulfill(body=PIXEL,content_type='image/png'))
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w26&testPlace=town',wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),{ITEMS,itemAtQuality,recalc}=await import('/src/items.js');
          const {previewStats,statsDelta}=await import('/src/autoequip.js'),{gearScore}=await import('/src/ui/itemview.js');
          game.G.tut.cur=null;const d=game.G.party[0];
          const body=itemAtQuality({...ITEMS.a_sr1_wardenmail,q:50,bukon:[{k:'res_poison',lv:7},{k:'crit',lv:7}]});
          if(body.eDef.el!=='dark')throw Error('墓守の守り');
          d.equip.body=body;recalc(d);UI.openParty(0,{inPlace:true,seg:'stats'});
          if(!Number.isFinite(gearScore(d,statsDelta(previewStats(d,d.equip),previewStats(d,{...d.equip,body:ITEMS.lr_l1_shroudofstillness})))))throw Error('装備比較');
          window.gearRetune={UI,ITEMS,body};
        }''')
        page.wait_for_function('document.body.innerText.replaceAll("\\u200b", "").includes("闇耐性力50%／33.3%軽減")')
        assert not page.evaluate('document.scrollingElement.scrollWidth > innerWidth+1')
        page.evaluate('gearRetune.sheet=gearRetune.UI.itemSheet(gearRetune.ITEMS.lr_l1_shroudofstillness,{context:"view"})')
        page.wait_for_function('document.body.innerText.replaceAll("\\u200b", "").includes("あらゆる毒を防ぐ布ではない")')
        text=page.locator('body').inner_text().replace('\u200b','')
        assert '60' in text and '万能耐性' not in text
        assert not page.evaluate('document.scrollingElement.scrollWidth > innerWidth+1')
        if width==320:page.screenshot(path='/tmp/equipment-retune-320.png')
        assert not errors,errors
        page.close()
    browser.close()
print('OK 実ブラウザ：320/390/768px・実装備の防御対象/軽減率・専門耐性の説明・武魂装着中の比較・例外なし')

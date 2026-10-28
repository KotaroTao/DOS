"""百分率の装備表示・ヘルプ・狭い画面での配置を実ブラウザで確認。"""
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
        result=page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),{recalc}=await import('/src/items.js');
          const {elemDetailLines,skillDetailLines,showSkillPopup}=await import('/src/ui/itemview.js');
          const {HELP_TOPICS}=await import('/src/journal.js');
          const G=game.G,d=G.party[0];G.tut.cur=null;
          d.equip.body={id:'pct_browser',name:'耐性の検査鎧',slot:'body',rar:'lr',eDef:{values:{fire:200,water:400,wind:100}},eAtk:{el:'fire',pct:50},resists:{poison:95,physResist:80}};
          recalc(d);UI.openParty(0,{inPlace:true,seg:'stats'});
          if(!elemDetailLines('防御',d.equip.body.eDef).some(s=>s.includes('66.7%')))throw Error('軽減率');
          if(!skillDetailLines({kind:'phys',acc:2,para:3}).some(s=>s.includes('命中力+200%')))throw Error('命中力');
          const help=HELP_TOPICS.find(t=>t.id==='combatPercent');if(!help?.lines.some(s=>s.includes('300%')))throw Error('ヘルプ');
          return {fire:d.elemAtk.values.fire,resistance:d.elemDef.values.fire};
        }''')
        assert result=={'fire':50,'resistance':200}
        page.wait_for_function('document.body.innerText.replaceAll("\\u200b", "").includes("火耐性力200%／66.7%軽減")')
        text=page.locator('body').inner_text().replace('\u200b','')
        assert '火150%' in text
        assert '水耐性力400%／80%軽減' in text
        assert not page.evaluate('document.scrollingElement.scrollWidth > innerWidth+1')
        assert not errors,errors
        page.close()
    browser.close()
print('OK 実ブラウザ：320/390/768px・多属性の百分率/実軽減率・命中力200%・ヘルプ・例外なし')

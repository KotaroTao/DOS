"""技・パッシブの新しい効果説明を実画面で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,768]:
        page=browser.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w54&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length>0')
        print(width,page.evaluate('''async()=>{
          const {showSkillPopup,showPassivePopup}=await import('/src/ui/itemview.js');
          const check=(v,m)=>{if(!v)throw Error(m)};
          const text=()=>document.body.textContent.replaceAll('\\u200b','');
          for(const [key,expected]of [['HANGEKI','攻撃力×2'],['GONOSEN','攻撃力×1.8'],['FUDOUJIN','攻撃力×3'],['SEAL','120%'],['GENWAKU','110%']]){
            const h=showSkillPopup(key);check(text().includes(expected),key+'表示');h.close();
          }
          for(const [key,lv,expected]of [['samuraiIchibun',3,'会心ダメージ+30%'],['samuraiNukimi',3,'会心ダメージ+40%'],['shadowIchishi',3,'HP90%以上'],['arcanistShinen',4,'会心ダメージ+30%'],['spellCrit',3,'会心ダメージ+30%'],['guardianHoufuku',3,'VIT×15'],['reflect',1,'INT×8']]){
            const h=showPassivePopup(key,lv);check(text().includes(expected),key+'表示');h.close();
          }
          return '反撃・会心威力・条件・付与力の新表示 OK';
        }'''))
        assert not errors,errors
        page.close()
    browser.close()

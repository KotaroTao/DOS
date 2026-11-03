"""会心倍率と能力タブの順序・六属性を実ブラウザで確認（localhost:8000）。"""
from playwright.sync_api import sync_playwright
import base64
PIXEL=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,390,768,1280]:
  page=browser.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce')
  page.route('**/art/**',lambda r:r.fulfill(body=PIXEL,content_type='image/png'))
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testDungeon=w26&testPlace=town',wait_until='domcontentloaded')
  page.wait_for_function('window.__game?.G.party.length === 6')
  for bonus in [0,1]:
   result=page.evaluate('''async bonus=>{
    const {game,UI}=await import('/src/ui/ctx.js');
    game.G.tut.cur=null;const d=game.G.party[0];
    d.critDamageBonus=bonus;d.spellCritDamageBonus=bonus;d.elemAtk=bonus?{values:{fire:50}}:null;d.elemDef=bonus?{values:{fire:100},reductions:{water:.2}}:null;
    UI.openParty(0,{inPlace:true,seg:'stats'});
    const rows=[...document.querySelectorAll('.pt-info .pt-fact')];
    return rows.map(r=>[r.querySelector('.pt-fact-k').textContent,r.querySelector('.pt-fact-v').textContent,r.querySelector('.pt-fact-v').children.length]);
   }''',bonus)
   result=[[r[0].replace('\u200b',''),r[1],r[2]] for r in result]
   facts={r[0]:r[1] for r in result}
   assert [r[0] for r in result][:3]==['HP','MP','状態'],result
   assert '参照' not in facts and '会心補正' not in facts and '魔法会心補正' not in facts
   assert facts['会心ダメージ']==('150%' if bonus==0 else '300%'),facts
   assert facts['魔法会心ダメージ']==facts['会心ダメージ']
   for element in ['火','水','風','土','光','闇']:
    assert facts[element+'属攻']==('150%' if bonus and element=='火' else '100%'),facts
    expected=('50%軽減' if element=='火' else '20%軽減' if element=='水' else '0%軽減') if bonus else '0%軽減'
    assert facts[element+'属防']==expected,facts
   sections=page.locator('.pt-stat-section').all_text_contents()
   assert sections==['属性攻撃','属性防御','状態異常耐性'],sections
   assert page.evaluate("()=>[...document.querySelectorAll('.pt-stat-section')].every(e=>parseFloat(getComputedStyle(e).marginTop)>=8)")
   assert not page.evaluate('document.scrollingElement.scrollWidth > innerWidth+1')
   assert not page.evaluate('''()=>[...document.querySelectorAll('.pt-fact')].some(e=>e.scrollWidth>e.clientWidth+1)''')
   assert not errors,errors
  page.close()
 browser.close()
print('OK: 320/390/768/1280px、順序・名称・無補正/100%補正の倍率・六属性・はみ出し・例外なし')

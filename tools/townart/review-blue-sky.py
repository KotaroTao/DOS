import json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/art/town/blue-sky-review'
OUT.mkdir(exist_ok=True)
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 for width,height in [(390,844),(744,1000)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8000/?testDungeon=w33&testPlace=town')
  page.wait_for_function("document.querySelector('.hb-stage .town-scene')?.dataset.art==='painted'")
  assert page.locator('.hb-stage .town-scene').get_attribute('data-sky')=='night'
  page.locator('.hb-hero').screenshot(path=str(OUT/f'night-{width}.png'))
  page.evaluate("() => { window.__game.G.world.reported.w33 = 1; window.__game.renderTown(); }")
  page.wait_for_function("document.querySelector('.hb-stage .town-scene')?.dataset.sky==='day' && document.querySelector('.hb-stage .town-scene')?.dataset.art==='painted'")
  page.wait_for_timeout(400)
  page.screenshot(path=str(OUT/f'town-{width}.png'))
  page.locator('.hb-hero').screenshot(path=str(OUT/f'hero-{width}.png'))
  geometry=page.evaluate("""async () => {const {townSpots}=await import('/src/townart.js');const c=document.querySelector('.hb-stage .town-scene');const rect=e=>e.getBoundingClientRect().toJSON();return {sky:c.dataset.sky,size:[c.width,c.height],points:townSpots(true),spots:[...document.querySelectorAll('.hb-spot')].map(b=>({key:b.className.match(/hb-spot-(\\w+)/)[1],box:rect(b.firstChild),at:[parseFloat(b.style.left)/100,parseFloat(b.style.top)/100]}))};}""")
  for i,a in enumerate(geometry['spots']):
   assert abs(a['at'][0]-geometry['points'][a['key']]['x']) < .0001 and abs(a['at'][1]-geometry['points'][a['key']]['y']) < .0001
   for b in geometry['spots'][i+1:]:
    x,y=a['box'],b['box'];assert min(x['right'],y['right'])<=max(x['left'],y['left']) or min(x['bottom'],y['bottom'])<=max(x['top'],y['top']),(width,a,b)
  # 施設から戻っても昼景を保持する。
  page.locator('.hb-spot-palace .hb-spot-l').click();page.wait_for_timeout(150)
  page.evaluate("() => {window.__game.G.town.tab='hub'; window.__game.G.town.page=null;window.__game.renderTown();}")
  assert page.locator('.hb-stage .town-scene').get_attribute('data-sky')=='day'
  # 報告済みの進行状態から開いても昼景になる。
  page.goto('http://localhost:8000/?testDungeon=w34&testPlace=town')
  page.wait_for_function("document.querySelector('.hb-stage .town-scene')?.dataset.sky==='day' && document.querySelector('.hb-stage .town-scene')?.dataset.art==='painted'")
  facilities=[]
  for key in ('palace','mansion','tavern','inn','shop','crypt','shrine'):
   page.goto('http://localhost:8000/?testDungeon=w34&testPlace=town')
   page.wait_for_function("document.querySelector('.hb-stage .town-scene')?.dataset.art==='painted'")
   page.locator(f'.hb-spot-{key} .hb-spot-l').click();page.wait_for_timeout(100)
   town=page.evaluate('async () => (await import("/src/ui/ctx.js")).game.G.town')
   if key in ('palace','mansion','shop'):
    assert town['tab']=={'palace':'palace','mansion':'party','shop':'shop'}[key],town
   elif key in ('tavern','shrine'):
    assert town['page']==key,town
   else:
    texts=page.locator('.ui-sheet-banner').all_text_contents()
    assert any(('白狼' if key=='inn' else '出撃') in t.replace('\u200b','').replace(' ','') for t in texts),texts
   facilities.append(key)
  assert not errors,errors
  checks.append({'viewport':[width,height],'geometry':geometry,'errors':errors,'switch':True,'return':True,'progressLoad':True,'facilities':facilities});page.close()
 # 昼景が読めなくても青空の代替表示を使い、夜景の失敗とは独立する。
 page=browser.new_page(viewport={'width':390,'height':844})
 page.route('**/art/town/panoramaDay.webp',lambda route:route.abort())
 page.goto('http://localhost:8000/?testDungeon=w34&testPlace=town')
 page.wait_for_function("document.querySelector('.hb-stage .town-scene')?.dataset.sky==='day' && document.querySelector('.hb-stage .town-scene')?.width===240")
 page.locator('.hb-hero').screenshot(path=str(OUT/'fallback-day.png'))
 checks.append({'fallback':'day','passed':True});page.close()
 browser.close()
(OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
print('切り替え・再表示・進行済みの表示・全施設の操作・札の位置と重なり・昼景の代替表示 OK')

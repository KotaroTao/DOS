"""同じ推奨Lvで無限迷宮の通算階数だけを変え、罠の二重増幅を確認する。"""
import pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2]
source=(root/'src/game.js').read_text()+'\nwindow.__trapCheck={trapBaseDmg};\n'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(service_workers='block')
 ctx.route('**/src/game.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=source))
 page=ctx.new_page();page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=infinite')
 page.wait_for_function('window.__game?.G.party.length>0 && window.__trapCheck')
 print(page.evaluate('''async()=>{
  const {reseedRng}=await import('/src/rng.js');
  const G=__game.G,I=__game.inf;
  I.enterAbyss(['fighter','knight','samurai','priest','mage','thief']);
  G.abyss.depth=100;
  const at=f=>{G.floor=f;reseedRng(4321);return __trapCheck.trapBaseDmg();};
  const fifth=at(5),hundredth=at(100),thousandth=at(1000);
  if(fifth!==hundredth||fifth!==thousandth)throw Error('同じLvで通算階数により罠が増幅した');
  G.abyss.depth=50;const shallow=at(50);
  if(!(hundredth>shallow))throw Error('推奨Lvによる罠の成長が失われた');
  G.abyss=null;const normal5=at(5),normal10=at(10);
  if(!(normal10>normal5))throw Error('本編の階数による罠の成長が失われた');
  return {無限迷宮の同じLv:[fifth,hundredth,thousandth],推奨Lvで成長:[shallow,hundredth],本編は従来どおり:[normal5,normal10]};
 }'''))
 browser.close()

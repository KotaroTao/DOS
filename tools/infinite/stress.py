"""固定編成で10階連戦し、補給3個と無制限を比較。通しプレイの到達率ではない。"""
import argparse,json,pathlib,time
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--samples',type=int,default=20);a.add_argument('--out',default='/tmp/dos-infinite-stress.json');args=a.parse_args()
source=(root/'src/game.js').read_text()
anchor='  _maskEnemies = null;\n  G.fx = null;'
assert source.count(anchor)==1
source=source.replace(anchor,'  if (window.__stressMode) return G.battle;\n'+anchor)
source+='''\nwindow.__stress = {newRun, applyVictoryPassives, quiet() {
  log=()=>{};showToast=()=>{};renderBoard=()=>{};renderCombat=()=>{};renderParty=()=>{};renderStatus=()=>{};updateTopbar=()=>{};autosave=()=>{};flashScreen=()=>{};shakeScreen=()=>{};
  for(const k of Object.keys(SFX)) if(typeof SFX[k]==='function')SFX[k]=()=>{};
}};\n'''
rows=[];started=time.monotonic()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pages={}
 for limit in [3,100]:
  context=browser.new_context(service_workers='block')
  context.route('**/src/game.js',lambda route:route.fulfill(status=200,content_type='application/javascript',body=source))
  page=context.new_page();page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=infinite')
  page.wait_for_function('window.__game?.G.party.length > 0 && window.__stress')
  page.evaluate('window.__stressMode=true;window.__stress.quiet()')
  page.add_script_tag(content=(root/'tools/infinite/stress.js').read_text())
  pages[limit]=page
 for end in [50,100]:
  for seed in range(1,args.samples+1):
   for limit in [3,100]:
    row=pages[limit].evaluate('x=>runInfStress(x)',{'seed':10000+seed,'endFloor':end,'rank':3,'limit':limit});rows.append(row)
   if seed%5==0 or seed==args.samples:
    sub=[r for r in rows if r['endFloor']==end]
    print(f'B{end-9}〜{end}F {seed}種: '+ ' / '.join(f"補給{cap}:完走{sum(r['result']=='complete' for r in sub if r['limit']==cap)}/{seed}" for cap in [3,100]),flush=True)
   pathlib.Path(args.out).write_text(json.dumps({'conditions':'固定6職・R3・区間末の推奨Lv・入口の落とし物50点から最適装備・サブ魂なし・永続強化なし・金貨十分・初期MP道具3個・1階3戦と5階ごとの主。戦闘/奇襲/風の掟/勝利後回復/個別購入と使用は実処理。探索・出来事・育成・装備更新・戦闘中の道具手動使用なし。100は1回の補給の安全上限。通しの到達率ではない。','rows':rows},ensure_ascii=False))
 browser.close()
print(f'{len(rows)}区間試行 / {time.monotonic()-started:.1f}秒 → {args.out}',flush=True)

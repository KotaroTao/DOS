"""実処理による1階からの仮想通し試験。演出と操作の選択をブラウザー内で差し替える。"""
import argparse,json,pathlib,time,subprocess
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--samples',type=int,default=10);p.add_argument('--seed',type=int,default=20001);p.add_argument('--end',type=int,default=100);p.add_argument('--out',default='/tmp/dos-fullrun.json');p.add_argument('--power',default='game');p.add_argument('--profile',choices=['chapter8','none','all'],default='chapter8');a=p.parse_args()
source=(root/'src/game.js').read_text()
def patch(old,new):
 global source
 assert source.count(old)==1,old
 source=source.replace(old,new)
if a.power != 'game':
 patch('power: { 1: info.coef * infEnemyMul(d) }, wall: 1,','power: { 1: info.coef * window.__fullPower(d) }, wall: 1,')
patch('  _maskEnemies = null;\n  G.fx = null;','  if(window.__fullMode)return G.battle;\n  _maskEnemies = null;\n  G.fx = null;')
patch('  uiDungeonHud.floorTransition({','  (window.__fullMode ? (s)=>{s.onSwap();s.onDone();} : uiDungeonHud.floorTransition)({')
patch('    uiResults.openResults({','    (window.__fullMode ? window.__fullResults : uiResults.openResults)({')
patch('      setTimeout(() => { G.anim = null; if (G.state === "board" && inDungeon()) descend({ fall: true }); }, 420);','      if(window.__fullMode){G.anim=null;descend({fall:true});}else setTimeout(() => { G.anim = null; if (G.state === "board" && inDungeon()) descend({ fall: true }); }, 420);')
source+='''
window.__full={findPath,cleanseStepHeal,tickPoison,healAll,raiseSoulCap,soulByUid,soulLevelCapOf,
 step(x,y){const c=G.board.cells[y][x];G.prevPos={x:G.px,y:G.py};G.px=x;G.py=y;if(!c.revealed){c.revealed=true;cleanseStepHeal();}if(c.type!=="stairs")resolveCell(c);if(G.state==="board"&&!G.prompt)tickPoison();},
 quiet(){
 planHealAllDP=()=>null;log=()=>{};logEcho=()=>{};showToast=()=>{};renderBoard=()=>{};renderCombat=()=>{};renderParty=()=>{};renderStatus=()=>{};renderTown=()=>{};updateTopbar=()=>{};autosave=()=>{};flashScreen=()=>{};shakeScreen=()=>{};flashPartyCards=()=>{};
 for(const k of Object.keys(SFX))if(typeof SFX[k]==="function")SFX[k]=()=>{};
 showChoice=(title,opts)=>window.__fullQueue.push(()=>window.__fullChoose(title,opts));
 showEvent=({onClose})=>{if(onClose)window.__fullQueue.push(onClose);};
 celebrateSoul=(s,next)=>{if(next)window.__fullQueue.push(next);};
 openInfRest=()=>{};
 gameOver=()=>{G.state="simLost";};
 UI.loot=(it,who,opts,next)=>{if(next)window.__fullQueue.push(next);};
 UI.celebrateLevelUp=(x,next)=>{if(next)window.__fullQueue.push(next);};
 askRoomFor=(it,cb,members=G.party)=>cb(members.find(d=>d.items.length<MAX_ITEMS)||null);
 }
};
'''
# 条件と自動プレイヤーは実行開始時に固定する。
script=(root/'tools/infinite/fullrun.js').read_text()
from concurrent.futures import ThreadPoolExecutor,as_completed
import hashlib
rows=[];started=time.monotonic()
def trial(seed):
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(service_workers='block');ctx.route('**/art/**',lambda r:r.abort());ctx.route('**/audio/**',lambda r:r.abort());ctx.route('**/src/game.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=source))
  page=ctx.new_page();page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=infinite')
  page.wait_for_function('window.__game?.G.party.length>0 && window.__full')
  page.evaluate('v=>{window.__fullMode=true;window.__fullQueue=[];window.__full.quiet();window.__fullPower=f=>{const t=[[1,v[0]],[20,v[1]],[50,v[2]],[100,v[3]]];for(let i=1;i<t.length;i++){if(f<=t[i][0])return t[i-1][1]+(t[i][1]-t[i-1][1])*(f-t[i-1][0])/(t[i][0]-t[i-1][0]);}return v[3];};}',[float(x) for x in a.power.split(',')] if a.power != 'game' else [1,1,1,1])
  page.add_script_tag(content=script)
  row=page.evaluate('x=>runFull(x)',{'seed':seed,'end':a.end,'profile':a.profile})
  ctx.unroute_all(behavior='wait')  # 読み込み中の画像の中断を片付けてから閉じる。
  browser.close();return row
with ThreadPoolExecutor(max_workers=4) as pool:
 for fut in as_completed([pool.submit(trial,seed) for seed in range(a.seed,a.seed+a.samples)]):
  row=fut.result();rows.append(row)
  pathlib.Path(a.out).write_text(json.dumps({'profile':a.profile,'power':a.power,'gameSha256':hashlib.sha256(source.encode()).hexdigest(),'botSha256':hashlib.sha256(script.encode()).hexdigest(),'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'rows':sorted(rows,key=lambda r:r['seed'])},ensure_ascii=False))
  if len(rows)%10==0 or len(rows)==a.samples:print(f'{len(rows)}出撃 / 50階 {sum(r["reached"]>=50 for r in rows)} / 100階 {sum(r["reached"]>=100 for r in rows)} / {time.monotonic()-started:.1f}秒',flush=True)

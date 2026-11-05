"""カードの各更新経路と、装備判定に入れた停止を診断JSONで照合。"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(service_workers='block',viewport={'width':744,'height':1001},device_scale_factor=2)
 page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
 page.route('**/src/game.js',lambda r:r.fulfill(content_type='text/javascript',body=(ROOT/'src/game.js').read_text()+'\nwindow.testPartyRender=renderParty;'))
 page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
 page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
 result=page.evaluate('''async()=>{
 const {G}=__game,{UI}=await import('/src/ui/ctx.js'),{partyRenderTrace}=await import('/src/party-render-trace.js');
 G.state='combat';testPartyRender();
 const cards=[...document.querySelectorAll('#party .pc')];
 const last=()=>partyRenderTrace().recent.at(-1);
 testPartyRender();const unchanged=last();
 if(unchanged.paths[0].kind!=='unchanged')throw Error('全体の変更なし');
 G.party[0].hp--;testPartyRender();const vitals=last();
 if(vitals.paths[0].kind!=='vitals'||cards[0]!==document.querySelector('#party .pc'))throw Error('HPのみ更新');
 G.party[0].name+='検査';testPartyRender();const rebuild=last();
 if(rebuild.paths[0].kind!=='rebuild'||cards[0]===document.querySelector('#party .pc'))throw Error('再生成');
 if(!rebuild.stages.some(s=>s.name==='portrait')||!rebuild.stages.some(s=>s.name==='domAttach'))throw Error('再生成の内訳');
 const original=UI.hasBetterGear;
 UI.hasBetterGear=d=>{if(d===G.party[0]){const until=performance.now()+90;while(performance.now()<until){}}return original(d);};
 testPartyRender();const delayed=last();UI.hasBetterGear=original;
 if(!delayed.stages.some(s=>s.name==='gearCheck'&&s.slot===1&&s.durationMs>=85))throw Error('停止の内訳');
 if(delayed.paths[0].kind!=='unchanged')throw Error('更新なしでも計測');
 for(let i=0;i<20;i++)testPartyRender();
 const saved=partyRenderTrace();
 if(saved.recent.length>4||saved.slowest.length>8||!saved.slowest.some(s=>s.call===delayed.call))throw Error('保持上限');
 G.state='town';UI.settingsSheet({});
 return {call:delayed.call,ms:delayed.durationMs};
 }''')
 page.get_by_role('button',name='音声の診断情報を表示',exact=True).click()
 info=json.loads(page.get_by_role('textbox',name='音声の診断情報',exact=True).input_value())
 entry=next(e for e in info['partyRender']['slowest'] if e['call']==result['call'])
 assert any(e['name']=='party.gearCheck' and e.get('detail',{}).get('call')==entry['call'] for e in info['timeline']['recent'])
 assert '検査' not in json.dumps(info['partyRender'],ensure_ascii=False)
 print({'call':entry['call'],'durationMs':entry['durationMs'],'paths':entry['paths'],'stages':entry['stages']})
 b.close()

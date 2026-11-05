"""装備通知のWorker一致・参照置換・戦闘中止・同期計算禁止を実画面で検査。"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(service_workers='block')
 page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
 page.route('**/src/game.js',lambda r:r.fulfill(content_type='text/javascript',body=(ROOT/'src/game.js').read_text()+'\nwindow.testPartyRender=renderParty;'))
 page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
 page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
 result=page.evaluate('''async()=>{
 const {UI,game}=await import('/src/ui/ctx.js'),{gearHintStats,gearHintKey}=await import('/src/gear-hints.js');
 const {battleTrace}=await import('/src/battle-trace.js');
 const {G}=__game;const wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('待機上限');};
 const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
 const {SLOTS,recalc}=await import('/src/items.js');
 G.inventory.length=0;for(const d of G.party){for(const k of SLOTS)d.equip[k]=null;recalc(d);}
 G.inventory.push(game.cloneItem('cap'),game.cloneItem('robe'));
 const pool=game.allDolls();
 const key=gearHintKey(pool,G.party),clone=refDeserialize(refSerialize({pool,targets:G.party}));
 if(gearHintKey(clone.pool,clone.targets)!==key){const k2=gearHintKey(clone.pool,clone.targets);let i=0;while(key[i]===k2[i]&&i<key.length)i++;throw Error('参照置換: '+i+' '+key.slice(i-50,i+150)+' / '+k2.slice(i-50,i+150));}
 const completed=gearHintStats.completed;
 G.party.forEach(UI.cachedGearHint);await wait(()=>gearHintStats.completed>completed);
 const expected=G.party.map(d=>UI.hasBetterGear(d));
 if(!expected.some(Boolean))throw Error('改善候補がない検査');
 if(G.party.some((d,i)=>UI.cachedGearHint(d)!==expected[i]))throw Error('従来の装備計画と不一致');
 for(let i=0;i<1000;i++)G.inventory.push({slot:'use',name:'検査用道具'});
 G.state='combat';G.party.forEach(UI.cachedGearHint);
 const before=battleTrace().summary['sync:party.gear.plan']?.count||0;
 const requests=gearHintStats.requests;
 for(let i=0;i<20;i++){
  const clone=refDeserialize(refSerialize(G.party));G.party=clone;
  testPartyRender();
 }
 await new Promise(r=>setTimeout(r,500));
 if((battleTrace().summary['sync:party.gear.plan']?.count||0)!==before)throw Error('描画で同期装備計算');
 if(gearHintStats.requests!==requests)throw Error('戦闘中にWorker要求');
 // 候補をすべてロックし、前の判定を適用しないこと。
 G.state='town';G.inventory.splice(2);for(const d of G.party)d.items=G.inventory;for(const it of G.inventory)it.locked=true;
 const done=gearHintStats.completed;G.party.forEach(UI.cachedGearHint);await wait(()=>gearHintStats.completed>done);
 if(G.party.some(d=>UI.cachedGearHint(d)||UI.hasBetterGear(d)))throw Error('ロック変更の再判定');
 return {...gearHintStats,expected,syncPlansDuringCombat:0};
 }''')
 print(result)
 b.close()

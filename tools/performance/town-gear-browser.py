"""街の肖像・装備欄の同期計算と、最適装備後の提案残留を検査。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 for width in [390,1100]:
  page=b.new_page(service_workers='block',viewport={'width':width,'height':900})
  page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
  page.route('**/src/ui/party.js',lambda r:r.fulfill(content_type='text/javascript',body=(ROOT/'src/ui/party.js').read_text()+'\nexport {portraitEl as testPortrait,slotInfo as testSlotInfo};'))
  page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
  page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
  print(page.evaluate('''async()=>{
   const {UI,game}=await import('/src/ui/ctx.js'),party=await import('/src/ui/party.js');
   const {SLOTS,recalc}=await import('/src/items.js'),{gearHintStats}=await import('/src/gear-hints.js');
   const {battleTrace}=await import('/src/battle-trace.js'),{sheet}=await import('/src/ui/kit.js');
   const G=__game.G;sheet.closeAll();G.inventory.length=0;
   for(const d of G.party){for(const k of SLOTS)d.equip[k]=null;recalc(d);}
   G.inventory.push(game.cloneItem('cap'),game.cloneItem('robe'));
   const reserve=structuredClone(G.party[0]);reserve.uid=987654;reserve.items=G.inventory;G.reserve.push(reserve);
   const host=document.createElement('div');document.body.appendChild(host);
   const before=battleTrace().summary['sync:party.gear.plan']?.count||0;
   for(const d of [...G.party,reserve])host.appendChild(party.testPortrait(d));
   for(const k of SLOTS)host.appendChild(party.slotCell(reserve,k));
   const after=battleTrace().summary['sync:party.gear.plan']?.count||0;if(after!==before)throw Error('街表示で同期装備計算');
   const wait=async f=>{for(let i=0;i<400;i++){if(f())return;await new Promise(r=>setTimeout(r,30));}throw Error('通知待機上限');};
   await wait(()=>host.querySelector('.gear-upgrade-dot')&&host.querySelector('.pt-slot.better'));
   for(const k of SLOTS){const exact=party.testSlotInfo(reserve,k),node=host.querySelector('[data-slot="'+k+'"]');if(node.classList.contains('better')!==exact.better)throw Error('部位通知の不一致 '+k);}
   if(!UI.cachedGearHint(reserve))throw Error('控えの通知がない');
   // 実際の提案ボタンを使い、追加した要素は表示用の枠だけに限る。
   const box=document.createElement('div');box.dataset.gearSuggestions=innerWidth<600?'mobile':'desktop';document.body.appendChild(box);
   
   UI.refreshGearSuggestions();
   // 上位の他の用事で省略される場合も、公開 suggestions の状態は検査する。
   if(!UI.suggestions(100).some(x=>x.key==='autoEquip'))throw Error('装備前に提案がない');
   const start=box.querySelector('[data-suggestion="autoEquip"]');if(!start)throw Error('街の提案ボタンなし');start.click();
   const buttons=[...document.querySelectorAll('.pt-ae-action button')];
   for(const button of buttons)if(button.textContent.includes('承認'))button.click();
   if(UI.suggestions(100).some(x=>x.key==='autoEquip'))throw Error('全承認後の提案残留');
   if(box.querySelector('[data-suggestion="autoEquip"]'))throw Error('街の提案DOM残留');
   // 取り消した直後にも提案が戻る。
   const undo=[...document.querySelectorAll('.pt-ae-action button')].find(x=>x.textContent.includes('戻す'));if(!undo)throw Error('取消なし');undo.click();
   if(!UI.suggestions(100).some(x=>x.key==='autoEquip'))throw Error('取消後の提案欠落');
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const all=[...document.querySelectorAll('button')].find(x=>x.textContent.replaceAll('\u200b','').includes('すべて承認'));if(!all)throw Error('全承認なし '+JSON.stringify([...document.querySelectorAll('.ui-sheet-foot button')].map(x=>x.textContent)));all.click();
   await new Promise(r=>setTimeout(r,1000));
   if(UI.suggestions(100).some(x=>x.key==='autoEquip')||document.querySelector('[data-gear-suggestions] [data-suggestion="autoEquip"]'))throw Error('全承認で街に戻った後の提案残留');
   sheet.closeAll();host.remove();box.remove();return {width:innerWidth,syncPlansDuringTownDisplay:after-before,worker:gearHintStats.completed};
  }'''))
  page.close()
 b.close()

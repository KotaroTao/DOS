import { fusionRows, sortFusionRows, snapshotFusionPlan } from "../bukon.js";
import { openBukonDetail } from "./bukonview.js";
// 武魂の装着・取り外し・合成。実物の所有確認と変更はgameの窓口で行う。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, confirm as askConfirm, toast } from "./kit.js";
import { itemName, SLOTS, ITEMS } from "../items.js";
import { bukonText as fullBukonText, bukonName, bukonSlots, bukonDef, attachBlock, fusionPlan, BUKON_RARITIES, BUKON, bukonFits, stockAdd, stockRows, attachBukon, detachBukon, fuseBukon } from "../bukon.js";
import { rarityKey, RARITIES } from "../rarity.js";
import { slotCell } from "./party.js";
const bukonText = b => fullBukonText(b, { showRarity: false });
export const ENCHANT_NOTE = "武魂は装備を使った者の魂が宿ったもの。対応部位だけに無料で宿し、外せる。珍しい装備ほど多くの武魂を宿せる。同効果は1装備に1つ。売却・廃棄・素材化で商会へ戻る。加算系はLv上限なし、他はLv10まで。借用枠追加・持続延長・能力低下反転はレベルなし。特殊効果は人業ごとに同種の最高Lvだけが働く。";
export const enchantPracticeState = () => null;
export function prepareEnchantTutorial() { resetFilters(); mode="gear"; }
// 旧付呪の破壊的な写し取り窓口は公開しない。
export function openAffixExtract() { return false; }
export function openShelfAffixExtract() { return false; }
const confirm = async ({onOk, ...options}) => { if (await askConfirm(options)) onOk?.(); };
let mode = "gear", part = "all", effect = "all", group = "all", rarity = "all", protection = "all", order = "original";
const GROUPS = {flat:"能力の加算",pct:"能力の割合上昇",rate:"会心・回避",res:"耐性",elementAttack:"属性攻撃",elementDefense:"属性軽減",status:"状態異常付与",race:"種族への効果",condition:"条件つきの効果",special:"特殊効果"};
const groupOf = d => d.kind!=="legacy"?d.kind:d.id.startsWith("F")?"status":/^[GH]/.test(d.id)?"race":"condition";
const SORTS = [["original","合成向けの順"],["name","名前順"],["power-desc","効果量が高い順"],["power-asc","効果量が低い順"],["rarity","格が高い順"],["part","部位順"]];
const resetFilters = () => { part=effect=group=rarity=protection="all";order="original"; };
const filtered = () => [part,effect,group,rarity,protection].some(x=>x!=="all");
const matchesSoul = b => {
  const d=bukonDef(b.k);
  return (part==="all"||d.slots.includes(part))&&(group==="all"||groupOf(d)===group)&&(effect==="all"||b.k===effect)&&(rarity==="all"||d.rarity===Number(rarity))&&(protection==="all"||!!b.protected===(protection==="protected"));
};
const power = b => BigInt(Math.round(bukonDef(b.k).base*100))*BigInt(b.lv);
const comparePower = (a,b) => power(a)>power(b)?1:power(a)<power(b)?-1:0;
function sortSouls(rows) {
  if(order==="original")return sortFusionRows(rows);
  return rows.slice().sort((a,b)=>order==="name"?bukonDef(a.k).name.localeCompare(bukonDef(b.k).name,"ja")||comparePower(b,a):order==="power-desc"?comparePower(b,a):order==="power-asc"?comparePower(a,b):order==="rarity"?bukonDef(b.k).rarity-bukonDef(a.k).rarity:order==="part"?Object.keys(PARTS).indexOf(bukonDef(a.k).slots[0])-Object.keys(PARTS).indexOf(bukonDef(b.k).slots[0]):0);
}
function openFilters(done) {
  let h;
  const field=(body,label,options,value,change)=>{const wrap=el("label","bk-filter-field");wrap.append(el("span","",label),picker(label,options,value,v=>{change(v);done();if(label==="効果の種類")h.update({});}));body.append(wrap);};
  h=sheet.open({title:"武魂の絞り込み・並び替え",className:"bk-filter-sheet",body:body=>{
    field(body,"部位",[["all","すべての部位"],...Object.entries(PARTS)],part,v=>part=v);
    field(body,"効果の種類",[["all","すべての種類"],...Object.entries(GROUPS)],group,v=>{group=v;effect="all";});
    field(body,"効果",[["all","すべての効果"],...BUKON.filter(d=>!d.retired&&(group==="all"||groupOf(d)===group)).sort((a,b)=>a.name.localeCompare(b.name,"ja")).map(d=>[d.id,d.name])],effect,v=>effect=v);
    field(body,"武魂の色",[["all","すべての色"],...["白","緑","青","橙","赤"].map((name,i)=>[String(i),name])],rarity,v=>rarity=v);
    field(body,"保護",[["all","すべて"],["protected","保護中"],["unprotected","保護なし"]],protection,v=>protection=v);
    field(body,"並び順",SORTS,order,v=>order=v);
    body.append(el("p","rf-note","装備の効果条件は、装着中またはその部位に宿せる武魂を基準に表示する。"));
  },footer:[{label:"条件を解除",kind:"ghost",onTap:()=>{resetFilters();done();h.update({});}},{label:"閉じる",kind:"primary",onTap:()=>h.close()}]});
}
const PARTS = {weapon:"武器",shield:"盾",body:"胴",head:"頭",hands:"手",feet:"足",acc:"装飾"};
const ownerOf = it => game.allDolls().find(d => Object.values(d.equip || {}).includes(it));
const locationOf = it => ownerOf(it)?.name || "共有の袋";
function picker(label, options, value, change) {
  const select=el("select","rf-select");select.setAttribute("aria-label",label);
  for(const [key,text] of options){const option=el("option","",text);option.value=key;select.append(option);}
  select.value=value;select.onchange=()=>change(select.value);return select;
}
const G = () => game.G;
function action(type,it,b,done) {
  if (!game.bukonAction(type,it,b)) { toast("操作できません。条件と所持数を確認してください。"); return; }
  done?.();
}
function stockRow(b, done, { it = null, installed = null, onAttach = null, onDetach = null, management = true } = {}) {
  const def=bukonDef(b.k),row=el("div","bk-stock-row");
  const main=button({label:bukonName(b),kind:"ghost",onTap:()=>openBukonDetail(b)});
  main.classList.add("bk-stock-main");
  const name=bukonName(b);
  main.querySelector(".ui-btn-l").replaceChildren(el("span","bk-name-label",def.name),el("span","bk-name-value",name.slice(def.name.length)));
  const gem=el("i","bk-gem");gem.setAttribute("aria-hidden","true");main.prepend(gem);main.style.color=BUKON_RARITIES[def.rarity].color;row.append(main);
  if(installed!==null){row.append(button({label:"外す",kind:"ghost",disabled:!!(it.locked||it.cursed),onTap:()=>onDetach?onDetach():action("detach",it,installed,done)}));return row;}
  if(it)row.append(button({label:"宿す",kind:"primary",onTap:()=>onAttach?onAttach():action("attach",it,b,done)}));
  if(!management)return row;
  if(def.max!==1 && game.featureUnlocked("bukonFusion")){const fuse=button({label:"合成",kind:"primary",disabled:!snapshotFusionPlan(G(),game.bukonTargets(),b),onTap:()=>openFusion(b,done)});fuse.classList.add("bukon-tutorial-fuse");row.append(fuse);}
  if(b.it){row.classList.add("bk-installed-row");row.append(el("span","bk-installed-note",`宿し先：${itemName(b.it)}`));}
  const protect=button({label:b.protected?"保護中":"保護",kind:"ghost",onTap:()=>action(b.it?"fusionLock":"protect",b.it||null,b,done)});
  protect.title=b.it?"ロックを解除すると合成素材になり、素材として使うと装備から外れる":"同じ効果・強さの武魂をまとめて保護する・解除する";
  protect.setAttribute("aria-pressed",String(!!b.protected));row.append(protect);return row;
}
const soulCount = rows => rows.reduce((n,b)=>n+BigInt(b.count),0n);
// 保存は大きな個数を正確に保持し、一覧だけを一つずつ描く。続きは縦スクロールで足す。
function appendSoulCopies(list, rows, makeRow) {
  let groupIndex=0,copy=0n;
  const sentinel=el("div","bk-copy-more","続きを表示");
  let observer;
  const more=()=>{
    for(let n=0;n<64&&groupIndex<rows.length;n++){
      const b=rows[groupIndex],node=makeRow({...b,count:"1"});node.dataset.copy=`${b.k}:${b.lv}:${copy}`;
      list.insertBefore(node,sentinel);copy++;
      if(copy>=BigInt(b.count)){groupIndex++;copy=0n;}
    }
    if(groupIndex>=rows.length){observer?.disconnect();sentinel.remove();}
  };
  list.append(sentinel);more();
  if(groupIndex>=rows.length)return;
  const root=list.closest(".ui-sheet-body")||list;
  if(typeof IntersectionObserver==="function"){
    observer=new IntersectionObserver(entries=>{
      if(!list.isConnected){observer.disconnect();return;}
      if(entries.some(x=>x.isIntersecting))more();
    },{root,rootMargin:"200px"});observer.observe(sentinel);
  }else{
    const scroll=()=>{if(!list.isConnected||groupIndex>=rows.length){root.removeEventListener("scroll",scroll);return;}if(root.scrollHeight-root.scrollTop-root.clientHeight<300)more();};
    root.addEventListener("scroll",scroll,{passive:true});
  }
}
function openGear(it, done) {
  let h;
  const refresh = () => { const top=h.body.scrollTop; h.update({}); h.body.scrollTop=top; done(); };
  const fill = body => {
    body.append(el("p","bk-meta",`${locationOf(it)} · ${PARTS[it.slot]}`));
    if(it.locked || it.cursed)body.append(el("p","rf-note","保護中・呪いの装備は変更できない。装備の保護を解除してから操作しよう。"));
    body.append(el("p","rf-note",`${(it.bukon || []).length}/${bukonSlots(it)}枠。装備固有の効果とも重複する。取り外し・装着は無料。`));
    for (const [i,b] of (it.bukon || []).entries())body.append(stockRow(b,refresh,{it,installed:i}));
    const choices=sortSouls(game.bukonRows().filter(b=>!attachBlock(it,b)&&matchesSoul(b)));
    const head=el("div","wpc-lhead");head.append(el("h3","",`宿すことができる武魂 ${soulCount(choices).toLocaleString()}点`),button({label:"絞り込み・並び替え",size:"sm",kind:"ghost",onTap:()=>openFilters(refresh)}));body.append(head);
    const candidates=el("div","bk-copy-rows");body.append(candidates);appendSoulCopies(candidates,choices,b=>stockRow(b,refresh,{it}));
    const sources=game.bukonTargets().filter(x=>x!==it && x.bukon?.length && !x.locked && !x.cursed);
    if(sources.length && !it.locked && !it.cursed) {
      const transfer=el("select","rf-select");transfer.setAttribute("aria-label","武魂の移植元");
      for(const [i,source] of sources.entries()){const option=el("option","",`${itemName(source)} ${(source.bukon || []).map(bukonText).join("／")}`);option.value=i;transfer.append(option);}
      body.append(el("h3","","別の装備から一括移植"),transfer,button({label:"武魂を一括移植",kind:"ghost",onTap:()=>{
        const source=sources[Number(transfer.value)];
        confirm({title:"武魂を移植する？",lines:[`${itemName(source)} → ${itemName(it)}`,"元の装備の武魂をすべて外し、入るものを宿す。同効果や枠不足で入らない分は商会に保管する。装備本体は残る。無料。"],okLabel:"移植する",onOk:()=>action("transfer",it,{source},refresh)});
      }}));
    }
    if(!choices.length)body.append(el("p","rf-note","宿せる武魂がない。枠・同効果・装備の保護状態を確認しよう。"));
  };
  h=sheet.open({title:itemName(it),className:"ec-sheet bk-sheet",body:fill,footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
}
function openFusion(b,done) {
  const plan=snapshotFusionPlan(G(),game.bukonTargets(),b);if(!plan)return;
  confirm({title:"武魂を合成する？",lines:[`${bukonName(b)} → ${bukonName(plan.upgrades[0])}`,...plan.rows.filter(r=>r.left<BigInt(r.count)).map(r=>`使用：${bukonName(r)} ×${BigInt(r.count)-r.left}${r.it?`（${itemName(r.it)}）`:""}`),`金貨${plan.cost.toLocaleString()}`,"同じ効果の武魂を素材に使う。保護中は素材にしない。解除済みの装備中の素材は自動で外れる。",...(b.it?["合成する武魂は装備に宿したまま強くなる。"]:[])],okLabel:"合成する",onOk:()=>action("upgrade",null,b,done)});
}
function openBulkFusion(done){
  const plan=snapshotFusionPlan(G(),game.bukonTargets());if(!plan)return;
  confirm({title:"一括合成する？",lines:[...plan.upgrades.map(b=>`${bukonName(b)} ×${b.count}`),`金貨${plan.cost.toLocaleString()}`,"今ある武魂だけで一段ずつ合成する。合成でできた武魂は今回は使わない。保護中は素材にせず、解除済みの装備中の素材は自動で外れる。"],okLabel:"一括合成する",onOk:()=>action("batch",null,null,done)});
}
export function renderEnchantList(parent, { doll = null } = {}) {
  const wrap=el("div","bk-panel");parent.append(wrap);
  const draw=()=>{
    wrap.replaceChildren();
    const why=game.enchantClosed?.();if(why){wrap.append(el("p","rf-note",why));return;}
    const rows=game.bukonRows();
    const selected=doll || game.allDolls().find(d=>!d.isEmpty);
    const equipment=SLOTS.map(k=>selected?.equip?.[k]).filter(Boolean);
    const soulFiltered=[effect,group,rarity,protection].some(x=>x!=="all");
    const matches=it=>(part==="all"||it.slot===part)&&(!soulFiltered||[...(it.bukon||[]),...rows.filter(b=>bukonFits(it,b))].some(matchesSoul));
    const stock=sortSouls(fusionRows(G(),game.bukonTargets()).filter(matchesSoul));
    const head=el("div","wpc-lhead");
    head.append(el("span","wpc-lhead-t",`武魂 ${mode==="gear"?equipment.filter(matches).length:soulCount(stock).toLocaleString()}点`),button({label:"絞り込み・並び替え",kind:"ghost",size:"sm",onTap:()=>openFilters(draw)}));
    if(game.featureUnlocked("bukonFusion"))head.append(button({label:"一括合成",kind:"primary",size:"sm",disabled:!snapshotFusionPlan(G(),game.bukonTargets()),onTap:()=>openBulkFusion(draw)}));
    wrap.append(head);
    if(filtered())wrap.append(el("p","bk-meta","絞り込み中。条件を解除するには「絞り込み・並び替え」を開こう。"));
    const tutorial=G().tut?.cur;
    if(["enchant","bukonFusion"].includes(tutorial)&&!G().tut.done?.[tutorial]){
      const resume=button({label:"武魂の練習を再開",kind:"primary",onTap:()=>openBukonPractice(tutorial)});resume.classList.add("bk-practice-start");wrap.append(resume);
    }
    const tabs=el("div","ec-afx-acts");
    for(const [key,label] of [["gear","装備に宿す・外す"],["stock","武魂の合成・保護"]]){const tab=button({label,kind:mode===key?"primary":"ghost",onTap:()=>{mode=key;draw();}});tab.setAttribute("aria-pressed",String(mode===key));tabs.append(tab);}wrap.append(tabs);
    if(mode==="gear"){
      const list=el("div","pt-slots bk-equipment");
      const keys=SLOTS.slice();
      if(selected&&order!=="original")keys.sort((a,b)=>{
        const x=selected.equip?.[a],y=selected.equip?.[b];if(!x||!y)return Number(!!y)-Number(!!x);
        if(order==="name")return itemName(x).localeCompare(itemName(y),"ja");
        if(order==="rarity")return (RARITIES[rarityKey(y)]?.order||0)-(RARITIES[rarityKey(x)]?.order||0);
        if(order.startsWith("power")){
          const best=it=>(it.bukon||[]).reduce((v,b)=>power(b)>v?power(b):v,0n),u=best(x),v=best(y);
          return (u>v?1:u<v?-1:0)*(order==="power-desc"?-1:1);
        }
        return Object.keys(PARTS).indexOf(x.slot)-Object.keys(PARTS).indexOf(y.slot);
      });
      if(selected)for(const k of keys){
        const it=selected.equip?.[k];if(it&&!matches(it)||!it&&filtered())continue;
        const cell=slotCell(selected,k,{onPick:it=>{if(it)openGear(it,draw);}});
        cell.disabled=!it;
        list.append(cell);
      }
      wrap.append(list);return;
    }
    const list=el("div","ec-list wpc-list bk-stock-list");
    appendSoulCopies(list,stock,b=>stockRow(b,draw));
    if(!stock.length)list.append(el("p","rf-note",filtered()?"条件に合う武魂はない。絞り込みの条件を解除してみよう。":"保管中の武魂はない。"));
    if(!game.featureUnlocked("bukonFusion"))list.append(el("p","rf-note","武魂合成は第四章の本筋2か所を王に報告すると開く。"));
    wrap.append(list);
  };draw();return draw;
}
let practiceHandle=null;
const practices=new Map();
export function openBukonPractice(key) {
  if(!["enchant","bukonFusion"].includes(key))return;
  if(practiceHandle&&!practiceHandle.closed&&practiceHandle.el?.isConnected)return practiceHandle;
  // 途中記録で開きっぱなしの絞り込みなども閉じ、必ず練習の入口に戻れるようにする。
  sheet.closeAll();
  let state=practices.get(key);
  if(!state){
    const item={...Object.values(ITEMS).find(it=>it.slot==="weapon"&&!it.cursed),rar:"r",bukon:[],locked:false,unidentified:false,soulMemory:false};
    state={step:0,item,stock:{gold:1000,bukonStock:{}}};stockAdd(state.stock,{k:"flat_hp",lv:1},key==="bukonFusion"?3:1);practices.set(key,state);
  }
  const next=(label,run)=>{const b=button({label,kind:"primary",onTap:run});b.classList.add("bk-practice-next");return b;};
  let h;
  const draw=()=>h.update({});
  const finish=()=>{h.close();practices.delete(key);UI.tutorialEvent?.(key==="enchant"?"bukonPracticeDone":"bukonFusionPracticeDone");};
  h=sheet.open({title:key==="enchant"?"武魂の練習 — 宿す・外す":"武魂の練習 — 合成",className:"ec-sheet bk-sheet bk-practice",body:body=>{
    body.append(el("p","rf-note","練習用の装備・武魂・金貨を使う。あなたの所持品や金貨は変わらない。閉じても「武魂の練習を再開」から続けられる。"));
    const completed=key==="enchant"?state.step===3:state.step===2;
    const messages=key==="enchant"?["装備を選ぼう。アイコンの下の丸い穴が、武魂を宿す枠だ。","宿すことができる武魂が並ぶ。「宿す」を押そう。","穴に宝石が入った。次は「外す」を押して、武魂を保管へ戻そう。","着脱の練習ができた。普段は商会の上に並ぶ顔で人業を選び、その者の装備を押して操作する。"]:["同じ武魂を3つ合成すると、より強い武魂に生まれ変わる。「合成」を押そう。","消費する武魂と生まれ変わる武魂を確かめ、「合成する（練習）」を押そう。","合成の練習ができた。普段は「保管中の武魂」の行で「合成」を選ぶ。実際の合成には金貨が必要だ。"];
    const note=el("p","tut-step-note",messages[state.step]);note.setAttribute("aria-live","polite");body.append(note);
    if(key==="enchant"){
      const doll=game.allDolls().find(d=>!d.isEmpty);
      const grid=el("div","pt-slots");
      const cell=slotCell({...doll,equip:{...doll?.equip,weapon:state.item}},"weapon",{onPick:()=>{if(state.step===0){state.step=1;draw();}}});
      if(state.step===0)cell.classList.add("bk-practice-next");grid.append(cell);body.append(grid);
      if(state.step===1){const b=stockRows(state.stock)[0];const row=stockRow(b,draw,{it:state.item,management:false,onAttach:()=>{if(attachBukon(state.stock,state.item,b)){state.step=2;draw();}}});row.lastElementChild.classList.add("bk-practice-next");body.append(row);}
      if(state.step===2){const row=stockRow(state.item.bukon[0],draw,{it:state.item,installed:0,management:false,onDetach:()=>{if(detachBukon(state.stock,state.item,0)){state.step=3;draw();}}});row.lastElementChild.classList.add("bk-practice-next");body.append(row);}
    } else {
      if(state.step===0){
        const list=el("div","bk-copy-rows");body.append(list);let first=true;
        appendSoulCopies(list,stockRows(state.stock),b=>{const row=stockRow(b,draw,{management:false}),fuse=next("合成",()=>{state.step=1;draw();});if(!first)fuse.classList.remove("bk-practice-next");first=false;row.append(fuse);return row;});
      }
      if(state.step===1){
        const plan=fusionPlan(state.stock,"flat_hp",2);
        body.append(el("p","rf-note",`使う武魂：${plan.consume.map(b=>`${bukonName(b)} ×${b.count}`).join("、")}`),el("p","rf-note",`生まれ変わる武魂：${bukonName(plan)}`),el("p","rf-note","素材にした武魂はなくなる。この練習では、実際の金貨は減らない。"),next("合成する（練習）",()=>{if(fuseBukon(state.stock,"flat_hp",2)){state.step=2;draw();}}));
      }
      if(state.step===2)body.append(stockRow(stockRows(state.stock)[0],draw,{management:false}));
    }
    if(completed)body.append(next("練習を終える",finish));
  },footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}],onClose:()=>{if(practiceHandle===h)practiceHandle=null;}});
  practiceHandle=h;return h;
}
export function install() { registerUI({renderEnchantList,prepareEnchantTutorial,enchantPracticeState,openBukonPractice,openAffixExtract,openShelfAffixExtract}); }

// 武魂の装着・取り外し・合成。実物の所有確認と変更はgameの窓口で行う。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, confirm as askConfirm, toast } from "./kit.js";
import { itemName, SLOTS } from "../items.js";
import { bukonText as fullBukonText, bukonSlots, bukonDef, attachBlock, fusionPlan, fusionGold, bulkFusionPlan, maxFusionLevel, BUKON_RARITIES } from "../bukon.js";
import { slotCell } from "./party.js";
const bukonText = b => fullBukonText(b, { showRarity: false });
export const ENCHANT_NOTE = "武魂は装備を使った者の魂が宿ったもの。対応部位だけに無料で宿し、外せる。珍しい装備ほど多くの武魂を宿せる。同効果は1装備に1つ。売却・廃棄・素材化で商会へ戻る。加算系はLv上限なし、他はLv10まで。借用枠追加・持続延長・能力低下反転はレベルなし。特殊効果は人業ごとに同種の最高Lvだけが働く。";
export const enchantPracticeState = () => null;
export function prepareEnchantTutorial() {}
// 旧付呪の破壊的な写し取り窓口は公開しない。
export function openAffixExtract() { return false; }
export function openShelfAffixExtract() { return false; }
const confirm = async ({onOk, ...options}) => { if (await askConfirm(options)) onOk?.(); };
let mode = "gear", query = "", part = "all";
const PARTS = {weapon:"武器",shield:"盾",body:"胴",head:"頭",hands:"手",feet:"足",acc:"装飾"};
const ownerOf = it => game.allDolls().find(d => Object.values(d.equip || {}).includes(it));
const locationOf = it => ownerOf(it)?.name || "共有の袋";
const affordable = plan => !!plan && Number.isSafeInteger(G().gold) && G().gold >= 0 && BigInt(G().gold) >= plan.cost;
function picker(label, options, value, change) {
  const select=el("select","rf-select");select.setAttribute("aria-label",label);
  for(const [key,text] of options){const option=el("option","",text);option.value=key;select.append(option);}
  select.value=value;select.onchange=()=>change(select.value);return select;
}
const G = () => game.G;
const norm = x => x.toLowerCase().replaceAll("\u200b", "");
function action(type,it,b,done) {
  if (!game.bukonAction(type,it,b)) { toast("操作できません。条件と所持数を確認してください。"); return; }
  done?.();
}
function bukonLabel(b){const node=el("span","",bukonText(b));node.style.color=BUKON_RARITIES[bukonDef(b.k)?.rarity||0].color;return node;}
function openStockDetail(b) {
  const def=bukonDef(b.k);
  let h;
  h=sheet.open({title:def.name,className:"ec-sheet bk-sheet",body:body=>{
    body.append(bukonLabel(b),el("p","bk-meta",`個数：${BigInt(b.count).toLocaleString()} · 対応：${def.slots.map(x=>PARTS[x]).join("・")}`),el("p","rf-note",b.protected?"合成保護中":"合成保護なし"));
    if(def.max===1)body.append(el("p","rf-note","レベルなし・合成対象外。同じ機能は重複しない。"));
  },footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
}
function stockRow(b, done, { it = null, installed = null } = {}) {
  const def=bukonDef(b.k),row=el("div","bk-stock-row");
  const main=button({label:def.name,kind:"ghost",onTap:()=>openStockDetail({...b,count:b.count||1})});
  main.classList.add("bk-stock-main");
  const gem=el("i","bk-gem");gem.setAttribute("aria-hidden","true");main.prepend(gem);main.style.color=BUKON_RARITIES[def.rarity].color;row.append(main);
  if(installed!==null){row.append(button({label:"外す",kind:"ghost",disabled:!!(it.locked||it.cursed),onTap:()=>action("detach",it,installed,done)}));return row;}
  if(it)row.append(button({label:"宿す",kind:"primary",onTap:()=>action("attach",it,b,done)}));
  if(def.max!==1 && game.featureUnlocked("bukonFusion")){const fuse=button({label:"合成",kind:"primary",onTap:()=>openFusion(b.k,done)});fuse.classList.add("bukon-tutorial-fuse");row.append(fuse);}
  const protect=button({label:b.protected?"保護中":"保護",kind:"ghost",onTap:()=>action("protect",null,b,done)});
  protect.setAttribute("aria-pressed",String(!!b.protected));row.append(protect);return row;
}
function openGear(it, done) {
  let h;
  const refresh = () => { const top=h.body.scrollTop; h.update({}); h.body.scrollTop=top; done(); };
  const fill = body => {
    body.append(el("p","bk-meta",`${locationOf(it)} · ${PARTS[it.slot]}`));
    if(it.locked || it.cursed)body.append(el("p","rf-note","保護中・呪いの装備は変更できない。装備の保護を解除してから操作しよう。"));
    body.append(el("p","rf-note",`${(it.bukon || []).length}/${bukonSlots(it)}枠。装備固有の効果とも重複する。取り外し・装着は無料。`));
    for (const [i,b] of (it.bukon || []).entries())body.append(stockRow(b,refresh,{it,installed:i}));
    body.append(el("h3","","宿すことができる武魂"));
    const choices=game.bukonRows().filter(b=>!attachBlock(it,b));
    for(const b of choices)body.append(stockRow(b,refresh,{it}));
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
function openFusion(k,done) {
  const def=bukonDef(k);
  const max=Math.max(2,maxFusionLevel(G(),k));
  let h;
  h=sheet.open({title:`${def.name}の武魂合成`,className:"ec-sheet bk-sheet",body:body=>{
    body.append(el("p","rf-note","同じ効果を合成する。Lv1換算の価値は1・3・9…。異なるLvも混ぜられる。素材は必要分だけ消費し、成功率100%。金貨はLv1→2が100、加算系は次から1.1倍、他は2倍。保護中の素材は使わない。"));
    const select=el("select","rf-select");select.setAttribute("aria-label","作る武魂のレベル");
    for(let lv=2;lv<=max;lv++) {const option=el("option","",`${bukonText({k,lv})}（金貨${fusionGold(k,lv).toLocaleString()}）`);option.value=lv;select.append(option);}
    const preview=el("p","rf-note");
    let fuseButton;
    const update=()=>{const plan=fusionPlan(G(),k,Number(select.value));preview.textContent=plan?`消費：${plan.consume.map(b=>`${bukonText(b)} ×${b.count}`).join("、")} → ${bukonText(plan)} ×1。金貨${plan.cost.toLocaleString()}（所持${G().gold.toLocaleString()}）` : "素材が足りないか、保護されている。";if(plan&&!affordable(plan))preview.textContent+="。金貨が足りない。";if(fuseButton)fuseButton.disabled=!affordable(plan);};
    select.onchange=update;update();body.append(select,preview);
    fuseButton=button({label:"内容を確認して合成",kind:"primary",onTap:()=>{
      const lv=Number(select.value),plan=fusionPlan(G(),k,lv);if(!affordable(plan)){toast("素材か金貨が足りません。");return;}
      confirm({title:"武魂を合成する？",lines:[preview.textContent,"素材は消費される。分解はできない。"],okLabel:"金貨を払って合成",onOk:()=>action("fuse",null,{k,lv},()=>{h.close();done();})});
    }});body.append(fuseButton);update();
    const keep=el("input","rf-select");keep.type="number";keep.min="0";keep.step="1";keep.value="1";keep.setAttribute("aria-label","各レベルに残す個数");
    body.append(el("p","rf-note","一括合成で各レベルに残す個数（保護中は全数残す）"),keep);
    const bulkPreview=el("p","rf-note");bulkPreview.setAttribute("aria-live","polite");
    const bulkButton=button({label:"余剰分を一括合成",kind:"ghost",onTap:()=>{
      if(!/^\d+$/.test(keep.value))return;
      const plan=bulkFusionPlan(G(),k,keep.value);if(!affordable(plan)){toast("合成できる素材か金貨が足りません。");return;}
      confirm({title:"余剰分を合成する？",lines:[bulkPreview.textContent,`各レベルを${keep.value}個ずつ残し、三つを一つへまとめる。合成した武魂は分解できない。`],okLabel:"一括合成",onOk:()=>action("bulk",null,{k,keep:keep.value},()=>{h.close();done();})});
    }});
    const updateBulk=()=>{
      const plan=bulkFusionPlan(G(),k,keep.value);
      bulkButton.disabled=!affordable(plan);
      bulkPreview.textContent=plan?`合成後：${Object.entries(plan.stock).filter(([key,n])=>key.startsWith(k+":")&&BigInt(n)>0n).map(([key,n])=>`Lv${key.split(":")[1]} ×${n}`).join("、")}。金貨${plan.cost.toLocaleString()}（所持${G().gold.toLocaleString()}）${affordable(plan)?"":"。金貨が足りない。"}`:"合成できる余剰分がない。保護中の武魂はすべて残す。";
    };keep.oninput=updateBulk;updateBulk();body.append(bulkPreview,bulkButton);
  },footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
}
export function renderEnchantList(parent, { doll = null } = {}) {
  const wrap=el("div","bk-panel");parent.append(wrap);
  const draw=()=>{
    wrap.replaceChildren();
    const why=game.enchantClosed?.();if(why){wrap.append(el("p","rf-note",why));return;}
    const rows=game.bukonRows();
    const selected=doll || game.allDolls().find(d=>!d.isEmpty);
    const equipment=SLOTS.map(k=>selected?.equip?.[k]).filter(Boolean);
    const matches=it=>(part==="all"||it.slot===part)&&norm(itemName(it)+(it.bukon||[]).map(bukonText).join(" ")).includes(norm(query));
    const stock=rows.filter(b=>(part==="all"||bukonDef(b.k).slots.includes(part))&&norm(bukonText(b)).includes(norm(query)));
    const head=el("div","wpc-lhead");
    head.append(el("span","wpc-lhead-t",`武魂 ${mode==="gear"?equipment.filter(matches).length:stock.length}点`),button({label:"絞り込み",kind:"ghost",size:"sm",onTap:()=>{
      let h;h=sheet.open({title:"武魂の絞り込み",body:body=>{
        const search=el("input","rf-select");search.type="search";search.placeholder="装備名・武魂の効果で検索";search.setAttribute("aria-label","武魂の検索");search.value=query;search.oninput=()=>{query=search.value;draw();};
        body.append(search,picker("対応部位",[["all","すべての部位"],...Object.entries(PARTS)],part,v=>{part=v;draw();}));
      },footer:[{label:"解除",kind:"ghost",onTap:()=>{query="";part="all";h.close();draw();}},{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
    }}));wrap.append(head);
    const tabs=el("div","ec-afx-acts");
    for(const [key,label] of [["gear","装備に宿す・外す"],["stock","保管中の武魂"]]){const tab=button({label,kind:mode===key?"primary":"ghost",onTap:()=>{mode=key;draw();}});tab.setAttribute("aria-pressed",String(mode===key));tabs.append(tab);}wrap.append(tabs);
    if(mode==="gear"){
      const list=el("div","pt-slots bk-equipment");
      if(selected)for(const k of SLOTS){
        const it=selected.equip?.[k];if(it&&!matches(it)||!it&&(query||part!=="all"))continue;
        const cell=slotCell(selected,k,{onPick:it=>{if(it)openGear(it,draw);}});
        cell.disabled=!it;
        if(it){
          const icon=cell.querySelector(".pt-slot-ic"),column=el("span","bk-slot-icon"),sockets=el("span","bk-sockets");
          sockets.setAttribute("aria-label",`武魂 ${(it.bukon||[]).length}/${bukonSlots(it)}枠`);
          for(let i=0;i<bukonSlots(it);i++){
            const b=it.bukon?.[i],socket=el("i",b?"bk-socket bk-gem":"bk-socket");
            if(b)socket.style.color=BUKON_RARITIES[bukonDef(b.k).rarity].color;
            sockets.append(socket);
          }
          icon.replaceWith(column);column.append(icon,sockets);
        }
        list.append(cell);
      }
      wrap.append(list);return;
    }
    const list=el("div","ec-list wpc-list bk-stock-list");
    for(const b of stock)list.append(stockRow(b,draw));
    if(!stock.length)list.append(el("p","rf-note","該当する武魂はない。"));
    if(!game.featureUnlocked("bukonFusion"))list.append(el("p","rf-note","武魂合成は第四章の本筋2か所を王に報告すると開く。"));
    wrap.append(list);
  };draw();return draw;
}
export function install() { registerUI({renderEnchantList,prepareEnchantTutorial,enchantPracticeState,openAffixExtract,openShelfAffixExtract}); }

// 武魂の装着・取り外し・合成。実物の所有確認と変更はgameの窓口で行う。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, confirm as askConfirm, toast } from "./kit.js";
import { itemName, recalc } from "../items.js";
import { bukonText as fullBukonText, bukonSlots, bukonDef, bukonItem, attachBlock, fusionPlan, fusionGold, bulkFusionPlan, maxFusionLevel, BUKON_RARITIES } from "../bukon.js";
const bukonText = b => fullBukonText(b, { showRarity: false });
export const ENCHANT_NOTE = "武魂は装備を使った者の魂が宿ったもの。対応部位だけに無料で宿し、外せる。珍しい装備ほど多くの武魂を宿せる。同効果は1装備に1つ。売却・廃棄・素材化で商会へ戻る。加算系はLv上限なし、他はLv10まで。借用枠追加・持続延長・能力低下反転はレベルなし。特殊効果は人業ごとに同種の最高Lvだけが働く。";
export const enchantPracticeState = () => null;
export function prepareEnchantTutorial() {}
// 旧付呪の破壊的な写し取り窓口は公開しない。
export function openAffixExtract() { return false; }
export function openShelfAffixExtract() { return false; }
const confirm = async ({onOk, ...options}) => { if (await askConfirm(options)) onOk?.(); };
let mode = "gear", query = "", place = "all", part = "all";
const PARTS = {weapon:"武器",shield:"盾",body:"胴",head:"頭",hands:"手",feet:"足",acc:"装飾"};
const ownerOf = it => game.allDolls().find(d => Object.values(d.equip || {}).includes(it));
const locationOf = it => ownerOf(it)?.name || "共有の袋";
const affordable = plan => !!plan && Number.isSafeInteger(G().gold) && G().gold >= 0 && BigInt(G().gold) >= plan.cost;
function matchesPlace(it) {
  const owner=ownerOf(it);
  if(place==="all")return true;
  if(place==="bag")return !owner;
  if(place==="equipped")return !!owner;
  return /^\d+$/.test(place) && !!owner && owner===game.allDolls()[Number(place)];
}
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
function gearBukonLabels(it) {
  const labels=el("div","rf-note");
  for(const b of it.bukon || []){const line=el("div","");line.append(bukonLabel(b));labels.append(line);}
  if(!it.bukon?.length)labels.textContent="武魂なし";
  return labels;
}
function openGear(it, done) {
  let h;
  const refresh = () => { const top=h.body.scrollTop; h.update({}); h.body.scrollTop=top; done(); };
  const fill = body => {
    body.append(el("p","bk-meta",`${locationOf(it)} · ${PARTS[it.slot]}`));
    if(it.locked || it.cursed)body.append(el("p","rf-note","保護中・呪いの装備は変更できない。装備の保護を解除してから操作しよう。"));
    body.append(el("p","rf-note",`${(it.bukon || []).length}/${bukonSlots(it)}枠。装備固有の効果とも重複する。取り外し・装着は無料。`));
    for (const [i,b] of (it.bukon || []).entries()) {
      const row=el("div","ec-afx-row"); row.append(bukonLabel(b));
      row.append(button({label:"外して保管",kind:"ghost",disabled:!!(it.locked || it.cursed),onTap:()=>{ action("detach",it,i,refresh); }})); body.append(row);
    }
    body.append(el("h3","","宿す武魂"));
    const select=el("select","rf-select");select.setAttribute("aria-label","宿す武魂");
    const rows=game.bukonRows();
    const choices=rows.filter(b=>!attachBlock(it,b));
    for(const [i,b] of choices.entries()) { const op=el("option","",`${bukonText(b)} ×${b.count}`);op.value=String(i);op.style.color=BUKON_RARITIES[bukonDef(b.k).rarity].color;select.append(op); }
    const preview=el("p","rf-note");
    const updatePreview=()=>{
      const b=choices[Number(select.value)];
      const owners=game.allDolls().filter(d=>Object.values(d.equip || {}).includes(it));
      if(!b || !owners.length){preview.textContent="装備中の品は、装着後の能力と耐性の合計を表示する。";return;}
      const owner=owners[0],fake={...owner,equip:{...owner.equip}};
      const after={...it,bukon:[...(it.bukon || []),b]};
      for(const slot of Object.keys(fake.equip))if(fake.equip[slot]===it)fake.equip[slot]=after;
      recalc(fake);
      const raw=Object.values(fake.equip).reduce((r,x)=>{const v=bukonItem(x);return r+(v?.resists?.physResist || 0);},0);
      preview.textContent=`${owner.name}：HP ${owner.maxhp.toLocaleString()} → ${fake.maxhp.toLocaleString()}、MP ${owner.maxmp.toLocaleString()} → ${fake.maxmp.toLocaleString()}。物理耐性 ${fake.physResist}%、魔法耐性 ${fake.magResist}%。${raw>80?`物理耐性は装備合計${raw}%のうち${raw-80}ポイントが上限を超える。`:""} 会心補正 ${Math.round(fake.critBonus*100)}%（最終会心率80%まで）。`;
    };
    select.onchange=updatePreview;updatePreview();body.append(select,preview);
    body.append(button({label:"選んだ武魂を宿す（無料）",kind:"primary",disabled:!choices.length,onTap:()=>{
      const b=choices[Number(select.value)]; if(!b)return;
      action("attach",it,b,refresh);
    }}));
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
export function renderEnchantList(parent) {
  const wrap=el("div","bk-panel");parent.append(wrap);
  const draw=()=>{
    wrap.replaceChildren();
    const why=game.enchantClosed?.(); if(why){wrap.append(el("p","rf-note",why));return;}
    const rows=game.bukonRows();
    const details=el("details","rf-intro");details.append(el("summary","","武魂の手引き"),el("p","rf-note",ENCHANT_NOTE),el("p","rf-note","第三章の結びで解放。第四章以降の迷宮の青・橙・赤い名の新しい装備から武魂が一つ見つかる。対応部位が合わない場合は商会に保管する。ドロップLvは拾った階の推奨Lvで決まり、装備のレア度には依存しない。武魂の格は白80%・緑12.5%・青5%・橙2%・赤0.5%。物理・魔法耐性は合計80%、各状態異常耐性95%、会心率・回避率80%まで。加算系だけLv上限なし。属性軽減は同属性合計80%。復活は毎回判定、確率50%まで、HP10%で戻る。"));wrap.append(details);
    wrap.append(el("p","bk-meta",`着脱は無料 · 保管 ${rows.reduce((n,b)=>n+BigInt(b.count),0n).toLocaleString()}個 · 所持金貨 ${G().gold.toLocaleString()}`));
    const tabs=el("div","ec-afx-acts");
    for(const [key,label] of [["gear","装備に宿す・外す"],["stock","保管中の武魂"]]){const tab=button({label,kind:mode===key?"primary":"ghost",onTap:()=>{mode=key;draw();}});tab.setAttribute("aria-pressed",String(mode===key));tabs.append(tab);}wrap.append(tabs);
    const search=el("input","rf-select");search.type="search";search.placeholder="装備名・武魂の効果で検索";search.setAttribute("aria-label","武魂の検索");search.value=query;wrap.append(search);
    const filters=el("div","bk-filters");
    filters.append(picker("対応部位",[["all","すべての部位"],...Object.entries(PARTS)],part,v=>{part=v;fill();}));
    if(mode==="gear")filters.append(picker("装備の場所",[["all","すべての場所"],["equipped","装備中"],["bag","共有の袋"],...game.allDolls().map((d,i)=>[String(i),d.name])],place,v=>{place=v;fill();}));
    const count=el("p","bk-meta");count.setAttribute("aria-live","polite");wrap.append(filters,count);
    const list=el("div","ec-list wpc-list"+(mode==="stock"?" bk-stock-list":""));wrap.append(list);
    const fill=()=>{
      list.replaceChildren();const q=norm(query);
      if(mode==="gear")for(const it of game.bukonTargets().filter(it=>(part==="all"||it.slot===part)&&matchesPlace(it)&&norm(itemName(it)+locationOf(it)+(it.bukon || []).map(bukonText).join(" ")).includes(q))) {
        const row=el("div","ec-afx-row");row.append(el("p","bk-meta",`${locationOf(it)} · ${PARTS[it.slot]}${it.locked?" · 保護中":""}${it.cursed?" · 呪い":""}`),el("div","bk-title",`${itemName(it)} ${(it.bukon || []).length}/${bukonSlots(it)}枠`),gearBukonLabels(it),button({label:"宿す・外す",kind:"ghost",onTap:()=>openGear(it,draw)}));list.append(row);
      }
      if(mode==="stock")for(const b of rows.filter(b=>(part==="all"||bukonDef(b.k).slots.includes(part))&&norm(bukonText(b)).includes(q))) {
        const def=bukonDef(b.k),row=el("div","bk-stock-row");
        const main=button({label:def.name,kind:"ghost",className:"bk-stock-main",onTap:()=>openStockDetail(b)});
        main.classList.add("bk-stock-main");
        const gem=el("i","bk-gem");gem.setAttribute("aria-hidden","true");main.prepend(gem);main.style.color=BUKON_RARITIES[def.rarity].color;
        row.append(main);
        if(def.max!==1 && game.featureUnlocked("bukonFusion")){const fuse=button({label:"合成",kind:"primary",onTap:()=>openFusion(b.k,draw)});fuse.classList.add("bukon-tutorial-fuse");row.append(fuse);}
        const protect=button({label:b.protected?"保護中":"保護",kind:"ghost",onTap:()=>action("protect",null,b,draw)});
        protect.setAttribute("aria-pressed",String(!!b.protected));row.append(protect);
        list.append(row);
      }
      count.textContent=`${list.children.length}件${query||part!=="all"||mode==="gear"&&place!=="all"?"（絞り込み中）":""}`;
      if(!list.children.length)list.append(el("p","rf-note","該当する品はない。"));
      if(mode==="stock"&&!game.featureUnlocked("bukonFusion"))list.append(el("p","rf-note","武魂合成は第四章の本筋2か所を王に報告すると開く。"));
    };
    search.oninput=()=>{query=search.value;fill();};fill();
  };draw();return draw;
}
export function install() { registerUI({renderEnchantList,prepareEnchantTutorial,enchantPracticeState,openAffixExtract,openShelfAffixExtract}); }

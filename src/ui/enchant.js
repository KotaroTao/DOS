// 武魂の装着・取り外し・合成。実物の所有確認と変更はgameの窓口で行う。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, confirm as askConfirm, toast } from "./kit.js";
import { itemName, recalc } from "../items.js";
import { bukonText, bukonSlots, bukonDef, bukonItem, attachBlock, fusionPlan, fusionGold, bulkFusionPlan, maxFusionLevel, BUKON_RARITIES } from "../bukon.js";
export const ENCHANT_NOTE = "武魂は装備を使った者の魂が宿ったもの。対応部位だけに無料で宿し、外せる。枠はコモン・アンコモン1、レア・SR2、LR3。同効果は1装備に1つ。売却・廃棄・素材化で商会へ戻る。加算系はLv上限なし、他はLv10まで。借用枠追加・持続延長・能力低下反転はレベルなし。特殊効果は人業ごとに同種の最高Lvだけが働く。";
export const enchantPracticeState = () => null;
export function prepareEnchantTutorial() {}
// 旧付呪の破壊的な写し取り窓口は公開しない。
export function openAffixExtract() { return false; }
export function openShelfAffixExtract() { return false; }
const confirm = async ({onOk, ...options}) => { if (await askConfirm(options)) onOk?.(); };
let mode = "gear", query = "";
const G = () => game.G;
const norm = x => x.toLowerCase().replaceAll("\u200b", "");
function action(type,it,b,done) {
  if (!game.bukonAction(type,it,b)) { toast("操作できません。条件と所持数を確認してください。"); return; }
  done?.();
}
function bukonLabel(b){const node=el("span","",bukonText(b));node.style.color=BUKON_RARITIES[bukonDef(b.k)?.rarity||0].color;return node;}
function openGear(it, done) {
  let h;
  const fill = body => {
    body.append(el("p","rf-note",`${(it.bukon || []).length}/${bukonSlots(it)}枠。装備固有の効果とも重複する。取り外し・装着は無料。`));
    for (const [i,b] of (it.bukon || []).entries()) {
      const row=el("div","ec-afx-row"); row.append(bukonLabel(b));
      row.append(button({label:"外して保管",kind:"ghost",disabled:!!(it.locked || it.cursed),onTap:()=>{ action("detach",it,i,()=>{h.close();openGear(it,done);done();}); }})); body.append(row);
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
      confirm({title:"武魂を宿す",lines:[bukonText(b),`${itemName(it)}：${it.bukon?.length || 0} → ${(it.bukon?.length || 0)+1}/${bukonSlots(it)}枠。無料で外して回収できる。`],okLabel:"宿す",onOk:()=>action("attach",it,b,()=>{h.close();openGear(it,done);done();})});
    }}));
    const sources=game.bukonTargets().filter(x=>x!==it && x.bukon?.length && !x.locked && !x.cursed);
    if(sources.length && !it.locked && !it.cursed) {
      const transfer=el("select","rf-select");transfer.setAttribute("aria-label","武魂の移植元");
      for(const [i,source] of sources.entries()){const option=el("option","",`${itemName(source)} ${(source.bukon || []).map(bukonText).join("／")}`);option.value=i;transfer.append(option);}
      body.append(el("h3","","別の装備から一括移植"),transfer,button({label:"武魂を一括移植",kind:"ghost",onTap:()=>{
        const source=sources[Number(transfer.value)];
        confirm({title:"武魂を移植する？",lines:[`${itemName(source)} → ${itemName(it)}`,"元の装備の武魂をすべて外し、入るものを宿す。同効果や枠不足で入らない分は商会に保管する。装備本体は残る。無料。"],okLabel:"移植する",onOk:()=>action("transfer",it,{source},()=>{h.close();openGear(it,done);done();})});
      }}));
    }
    if(!choices.length)body.append(el("p","rf-note","宿せる武魂がない。枠・同効果・装備の保護状態を確認しよう。"));
  };
  h=sheet.open({title:itemName(it),className:"ec-sheet",body:fill,footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
}
function openFusion(k,done) {
  const def=bukonDef(k), rows=game.bukonRows().filter(b=>b.k===k);
  const max=Math.max(2,maxFusionLevel(G(),k));
  let h;
  h=sheet.open({title:`${def.name}の武魂合成`,className:"ec-sheet",body:body=>{
    body.append(el("p","rf-note","同じ効果を合成する。Lv1換算の価値は1・3・9…。異なるLvも混ぜられる。素材は必要分だけ消費し、成功率100%。金貨はLv1→2が100、加算系は次から1.1倍、他は2倍。保護中の素材は使わない。"));
    const select=el("select","rf-select");select.setAttribute("aria-label","作る武魂のレベル");
    for(let lv=2;lv<=max;lv++) {const option=el("option","",`${bukonText({k,lv})}（金貨${fusionGold(k,lv).toLocaleString()}）`);option.value=lv;select.append(option);}
    const preview=el("p","rf-note");
    const update=()=>{const plan=fusionPlan(G(),k,Number(select.value));preview.textContent=plan?`消費：${plan.consume.map(b=>`${bukonText(b)} ×${b.count}`).join("、")} → ${bukonText(plan)} ×1。金貨${plan.cost.toLocaleString()}（所持${G().gold.toLocaleString()}）` : "素材が足りないか、保護されている。";};
    select.onchange=update;update();body.append(select,preview);
    body.append(button({label:"内容を確認して合成",kind:"primary",onTap:()=>{
      const lv=Number(select.value),plan=fusionPlan(G(),k,lv);if(!plan){toast("素材が足りません。");return;}
      confirm({title:"武魂を合成する？",lines:[preview.textContent,"素材は消費される。分解はできない。"],okLabel:"金貨を払って合成",onOk:()=>action("fuse",null,{k,lv},()=>{h.close();done();})});
    }}));
    const keep=el("input","rf-select");keep.type="number";keep.min="0";keep.step="1";keep.value="1";keep.setAttribute("aria-label","各レベルに残す個数");
    body.append(el("p","rf-note","一括合成で各レベルに残す個数（保護中は全数残す）"),keep);
    body.append(button({label:"余剰分を一括合成",kind:"ghost",onTap:()=>{
      if(!/^\d+$/.test(keep.value))return;
      const plan=bulkFusionPlan(G(),k,keep.value);if(!plan){toast("合成できる素材がありません。");return;}
      confirm({title:"余剰分を合成する？",lines:[`金貨${plan.cost.toLocaleString()}（所持${G().gold.toLocaleString()}）`,...[`各レベルを${keep.value}個ずつ残し、三つを一つへまとめる。合成した武魂は分解できない。`]],okLabel:"一括合成",onOk:()=>action("bulk",null,{k,keep:keep.value},()=>{h.close();done();})});
    }}));
  },footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});
}
export function renderEnchantList(parent) {
  const wrap=el("div","bk-panel");parent.append(wrap);
  const draw=()=>{
    wrap.replaceChildren();
    const why=game.enchantClosed?.(); if(why){wrap.append(el("p","rf-note",why));return;}
    const rows=game.bukonRows();
    const details=el("details","rf-intro");details.append(el("summary","","武魂の手引き"),el("p","rf-note",ENCHANT_NOTE),el("p","rf-note","第三章の結びで解放。第四章以降の迷宮のレア以上の新しいドロップから武魂が一つ見つかる。対応部位が合わない場合は商会に保管する。SR・LRの装備ほど高Lvが出やすい。武魂の格は白80%・緑12.5%・青5%・橙2%・赤0.5%。物理・魔法耐性は合計80%、各状態異常耐性95%、会心率・回避率80%まで。加算系だけLv上限なし。属性軽減は同属性合計80%。復活は毎回判定、確率50%まで、HP10%で戻る。"));wrap.append(details);
    const tabs=el("div","ec-afx-acts");
    for(const [key,label] of [["gear","装備に宿す・外す"],["stock","保管中の武魂"]])tabs.append(button({label,kind:mode===key?"primary":"ghost",onTap:()=>{mode=key;draw();}}));wrap.append(tabs);
    const search=el("input","rf-select");search.type="search";search.placeholder="装備名・武魂の効果で検索";search.setAttribute("aria-label","武魂の検索");search.value=query;wrap.append(search);
    const list=el("div","ec-list wpc-list");wrap.append(list);
    const fill=()=>{
      list.replaceChildren();const q=norm(query);
      if(mode==="gear")for(const it of game.bukonTargets().filter(it=>norm(itemName(it)+JSON.stringify(it.bukon || [])+(it.bukon || []).map(bukonText).join(" ")).includes(q))) {
        const row=el("div","ec-afx-row");row.append(el("div","",`${itemName(it)} ${(it.bukon || []).length}/${bukonSlots(it)}枠`),el("p","rf-note",(it.bukon || []).map(bukonText).join(" ／ ") || "武魂なし"),button({label:"宿す・外す",kind:"ghost",onTap:()=>openGear(it,draw)}));list.append(row);
      }
      if(mode==="stock")for(const b of rows.filter(b=>norm(bukonText(b)).includes(q))) {
        const row=el("div","ec-afx-row");row.append(bukonLabel(b),el("span","",` ×${b.count}`),button({label:b.protected?"合成保護を解除":"合成素材から保護",kind:"ghost",onTap:()=>action("protect",null,b,draw)}));
        if(bukonDef(b.k).max === 1) row.append(el("p","rf-note","レベルなし・合成対象外。同じ機能は重複しない。"));
        else if(game.featureUnlocked("bukonFusion"))row.append(button({label:"合成",className:"bukon-tutorial-fuse",kind:"primary",onTap:()=>openFusion(b.k,draw)}));
        list.append(row);
      }
      if(!list.children.length)list.append(el("p","rf-note","該当する品はない。"));
      if(mode==="stock"&&!game.featureUnlocked("bukonFusion"))list.append(el("p","rf-note","武魂合成は第四章の本筋2か所を王に報告すると開く。"));
    };
    search.oninput=()=>{query=search.value;fill();};fill();
  };draw();return draw;
}
export function install() { registerUI({renderEnchantList,prepareEnchantTutorial,enchantPracticeState,openAffixExtract,openShelfAffixExtract}); }

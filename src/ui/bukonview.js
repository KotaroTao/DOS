// 武魂の丸い枠・詳細。商会・館・売却・装備詳細で同じ表示を使う。
import { game } from "./ctx.js";
import { el, button, sheet } from "./kit.js";
import { bukonSlots, bukonDef, bukonName, bukonDescription, BUKON_RARITIES } from "../bukon.js";
const PARTS={weapon:"武器",shield:"盾",body:"胴",head:"頭",hands:"手",feet:"足",acc:"装飾"};
const visible=it=>!!it&&Object.hasOwn(PARTS,it.slot)&&!!game.featureUnlocked?.("enchant");
export function openBukonDetail(b) {
  const def=bukonDef(b?.k);if(!def)return;
  let h;
  h=sheet.open({title:bukonName(b),className:"ec-sheet bk-sheet bk-detail",body:body=>{
    const effect=el("p","",bukonDescription(b));effect.style.color=BUKON_RARITIES[def.rarity].color;
    body.append(effect,el("p","bk-meta",`対応：${def.slots.map(x=>PARTS[x]).join("・")}`));
    if(b.protected!==undefined)body.append(el("p","rf-note",b.protected?"合成保護中":"合成保護なし"));
    if(def.max===1)body.append(el("p","rf-note","合成対象外。同じ機能は重複しない。"));
  },footer:[{label:"閉じる",kind:"ghost",onTap:()=>h.close()}]});return h;
}
export function bukonSockets(it,{interactive=false}={}) {
  if(!visible(it))return null;
  const sockets=el("span",interactive?"bk-sockets bk-detail-slots":"bk-sockets");
  sockets.setAttribute("aria-label",`武魂 ${(it.bukon||[]).length}/${bukonSlots(it)}枠`);
  for(let i=0;i<bukonSlots(it);i++){
    const b=it.unidentified?null:it.bukon?.[i],gem=el("i",b?"bk-socket bk-gem":"bk-socket");gem.setAttribute("aria-hidden","true");
    if(b)gem.style.color=BUKON_RARITIES[bukonDef(b.k)?.rarity||0].color;
    if(interactive){
      const node=b?button({label:bukonName(b),kind:"ghost",onTap:()=>openBukonDetail(b)}):el("span","bk-detail-empty");
      node.classList.add("bk-detail-slot");node.prepend(gem);
      if(!b)node.append(el("span","","空き枠"));
      if(b)node.setAttribute("aria-label",`${bukonName(b)}の詳細`);
      sockets.append(node);
    }else sockets.append(gem);
  }
  return sockets;
}
export function withBukonSockets(icon,it) {
  const sockets=bukonSockets(it);if(!sockets)return icon;
  const column=el("span","bk-slot-icon");column.append(icon,sockets);return column;
}
export function equipmentBukonPanel(it) {
  if(!visible(it)||it.unidentified)return null;
  const panel=el("section","wpc-is-bukon");panel.append(el("div","wpc-is-fxh","武魂"),bukonSockets(it,{interactive:true}));return panel;
}

import { slotKeysFor, trialEquip, previewStats, statsDelta, isAutoCandidate } from './autoequip.js';
import { SLOTS, canEquip, recalc, bagOwners, bagCount, isFormationItem, MAX_ITEMS } from './items.js';
import { gearScore } from './gear-score.js';
// 装備欄の通知専用。候補シートと同じ条件で数と改善の有無だけを返す。
export function gearSlotHints(d,pool){
 const out=Object.fromEntries(SLOTS.map(k=>[k,{count:0,better:false,bestGain:0}]));
 if(d.primary==null)return out;
 const base=previewStats(d,d.equip,recalc);
 for(const owner of bagOwners(pool))for(const it of owner.items||[]){
  if(!it||it.unidentified||!canEquip(d,it))continue;
  for(const k of slotKeysFor(it,d)){
   const tr=trialEquip(d.equip,it,k);if(!tr)continue;
   const gain=gearScore(d,statsDelta(base,previewStats(d,tr.equip,recalc)));
   const room=bagCount(d.items)-(owner.items===d.items&&!isFormationItem(it)?1:0)+bagCount(tr.displaced)<=MAX_ITEMS;
   const info=out[k];info.count++;
   if(room&&isAutoCandidate(it)&&gain>.05){info.better=true;info.bestGain=Math.max(info.bestGain,gain);}
  }
 }
 return out;
}

import { gearSlotHints } from './gear-slot-hints.js';
import { planBestEquip } from './autoequip.js';
import { gearScore } from './gear-score.js';
import { refDeserialize } from './savegraph.js';
import { registerEquipLevel } from './items.js';
import { equipLevelFor } from './equiplevel.js';
// 装備できるLv と世代の性能 (装備する人の Lv で出せる世代) を本体と同じ式で判定する
registerEquipLevel(equipLevelFor);
self.onmessage=({data})=>{
 try{
  const {pool,targets,slotTargets=[]}=refDeserialize(data.snapshot);
  const values=targets.map(d=>[d.uid,!!d.alive&&d.primary!=null&&planBestEquip([d],{pool,score:gearScore,maxMoves:1}).moves.length>0,slotTargets.includes(d.uid)?gearSlotHints(d,pool):null]);
  self.postMessage({id:data.id,values});
 }catch{self.postMessage({id:data.id,error:true});}
};

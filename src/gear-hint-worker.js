import { planBestEquip } from './autoequip.js';
import { gearScore } from './gear-score.js';
import { refDeserialize } from './savegraph.js';
self.onmessage=({data})=>{
 try{
  const {pool,targets}=refDeserialize(data.snapshot);
  const values=targets.map(d=>[d.uid,!!d.alive&&d.primary!=null&&planBestEquip([d],{pool,score:gearScore,maxMoves:1}).moves.length>0]);
  self.postMessage({id:data.id,values});
 }catch{self.postMessage({id:data.id,error:true});}
};

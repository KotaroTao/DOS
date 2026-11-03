// 本編と同じ生成口へ模擬の作用点を渡す。ゲーム状態・保存・ゲーム用乱数には触れない。
import { SPELLS } from './skilldefs.js';
import { emitSkillFx } from './skill-fx.js';
export function previewSkillFx(key, group = true) {
  const spell=SPELLS[key];if(!spell)return [];
  const ally=['ally','all-ally','self'].includes(spell.target),count=group&&['all-enemy','all-ally'].includes(spell.target)?6:1;
  const targets=Array.from({length:count},(_,i)=>({uid:i+1,side:ally?'party':'enemy',x:count===1?320:90+i*92,y:ally?250:155}));
  const hits=(spell.scatter?Array.from({length:spell.scatter},(_,i)=>targets[i%targets.length]):targets).flatMap(target=>Array.from({length:['phys','atk'].includes(spell.kind)?spell.scatter?1:spell.hits||1:1},()=>({target,lifesteal:spell.drain?10:undefined,heal:spell.kind==='heal'?60:undefined,cured:spell.kind==='cure',buff:spell.kind==='buff',dmg:['phys','atk'].includes(spell.kind)?40:undefined})));
  const list=[];emitSkillFx(list,key,spell,hits,t=>({x:t.x,y:t.y}),0,1,{source:{x:320,y:315}});return list;
}

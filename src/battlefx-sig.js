// 看板技は共通の技演出と職ごとの余韻を組み合わせる。剣・盾・手・腕の形は描かない。
import { registerFx } from './battlefx.js';
import { drawSkillScene } from './skill-fx.js';
import { SKILL_FX_CATALOG } from './skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from './skill-fx-signatures.js';
const draws={},durations={},signatures={};
for(const [key,signature] of Object.entries(SKILL_FX_SIGNATURES)){
  draws[signature.type]=(ctx,e,t,w,h,reduced)=>drawSkillScene(ctx,{
    ...e,design:SKILL_FX_CATALOG[key],signature,all:['field','party'].includes(signature.mode),
    pts:e.pts||[{x:e.x,y:e.y}],hitCount:1,w:e.w||90,
  },t,w,h,reduced);
  durations[signature.type]=320;
  signatures[key]={type:signature.type,mode:signature.mode};
}
registerFx(draws,durations,signatures);

import { drawMaterialSkill, drawSkillMark } from './skill-fx-materials.js';
import { registerFx, FX, statusFxKind } from './battlefx.js';
import { SKILL_FX_CATALOG } from './skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from './skill-fx-signatures.js';
import { SKILL_FX_ULTIMATES } from './skill-fx-ultimates.js';
import { CLEAVE_COLORS } from './cleave-fx.js';
import { FX_LIMITS, fxLite } from './skill-fx-budget.js';
const ELEMENT_FAMILIES=['ice','wave','gale','lightning','stone','quake'];
const MYSTIC_FAMILIES=['radiance','void','arcane','heal','revive','purify','ward'];
export const SKILL_FAMILIES = Object.freeze({cut:'斬撃',cleave:'なぎ払い',flurry:'連撃',impact:'重い打撃',pierce:'貫通',projectile:'射撃',fireball:'火球',firePillar:'火柱',blast:'爆発',ice:'氷の破片',wave:'水の波',gale:'風の流れ',lightning:'雷光',stone:'岩の隆起',quake:'地の衝撃',radiance:'聖光',void:'闇の収束',arcane:'魔力の波',heal:'回復',revive:'蘇生',purify:'治療',ward:'守り',mana:'魔力の譲渡',empower:'強化',charge:'力を溜める',weaken:'弱体',dispel:'解除',seal:'封印',paralyze:'麻痺',poison:'毒',illusion:'幻惑',sleep:'眠り',gravity:'重力',doom:'死の印',drain:'吸収',steal:'奪取',escape:'退避',survey:'探索'});
export function skillFxSound(family, tier = 1, spell = null) {
  // 守りや強化の絵を持つ回復技も、音は実際の救命効果に合わせる。
  if (spell?.kind==='heal') family=spell.revive?'revive':'heal';
  else if (spell?.kind==='cure') family='purify';
  else if (spell?.kind==='buff' && spell.regen) family='heal';
  if (MYSTIC_FAMILIES.includes(family)) return family+(tier>=3?'3':tier>=2?'2':'');
  if (['cut','cleave','flurry'].includes(family)) return 'slash';
  if (ELEMENT_FAMILIES.includes(family)||family==='fireball'||family==='blast')return family+(tier>=3?'3':tier>=2?'2':'');
  if (['impact','stone','quake'].includes(family)) return 'impact';
  if (['pierce','projectile'].includes(family)) return 'pierce';
  if (family==='mana') return 'mana';
  if (['ward','empower','charge','survey'].includes(family)) return 'ward';
  if (['paralyze','poison','illusion','sleep','seal','weaken','dispel','gravity','doom','drain','steal','escape','void'].includes(family)) return 'shade';
  return family === 'firePillar' ? tier >= 3 ? 'firePillar3' : tier >= 2 ? 'firePillar2' : 'firePillar' : family === 'fireball' ? 'fire' : family === 'lightning' ? 'spark' : 'magic';
}
export const extendedSkillFx=design=>!!design?.family;
export const physicalSkillFx=design=>design?.kind==='phys'||!design?.kind&&['cut','cleave','flurry','impact','pierce','projectile'].includes(design?.family);
// 物理は一撃65msの動きを保ち、85msごとの打撃枠と60msの余韻へ収める。
export function skillFxDuration(design, spd=1, options={}){
 const count=Math.max(1,design?.combo||design?.hits||1),rank=Math.min(3,Math.max(1,design?.tier||1));
 if(physicalSkillFx(design))return count*85+(options.auto?20:options.fast?35:60);
 return Math.round([0,400,700,1200][rank]*(options.auto?.6:options.fast?.8:1));
}
export { SLASH_FORMS } from './skill-fx-materials.js';
// 敵の術・ブレスも同じ画像描画へ通す。通常攻撃の描画は従来のまま。
export function enemySkillFxProfile(res){
 if(res?.side!=='enemy'||!['spell','breath'].includes(res.action))return null;
 if(SKILL_FX_CATALOG[res.spellKey])return SKILL_FX_CATALOG[res.spellKey];
 const kind=res.spellKind||'atk',element=res.spellElement||res.actor?.element;
 const family=kind==='heal'?'heal':kind==='cure'?'purify':kind==='buff'?'ward':kind==='phys'?'impact':{fire:'firePillar',water:'wave',wind:'gale',earth:'stone',light:'radiance',dark:'void'}[element]||'arcane';
 return {family,kind,tier:1,scale:.9,hits:1};
}
export function drawSkillScene(c,e,t,w,h,reduced){
 const lite=fxLite(reduced),physical=physicalSkillFx(e.design),fixed=reduced?.36:t;
 if(e.strikes?.length){
  const slots=Math.max(1,e.comboCount),position=physical?fixed*e.dur/85:fixed*slots;
  for(const point of e.strikes){
   const q=position-point.slot;if(!reduced&&(q<0||q>=1))continue;
   drawMaterialSkill(c,{...e,x:point.x,y:point.y,all:false,strikes:[],physical,strikeIndex:point.slot,strikeMs:physical?85:e.dur/slots,primaryPts:[point],design:{...e.design,tier:Math.min(3,e.design.tier)}},reduced?.36:q,w,h,lite,reduced);
  }
 }else drawMaterialSkill(c,{...e,physical},fixed,w,h,lite,reduced);
 // 対象の印も小さな材質の濃淡だけを使う。図形の記号は描かない。
 for(const p of (e.pts||[]).slice(0,FX_LIMITS.targets))drawSkillMark(c,p,fixed,lite,e.hasMpDrain);
 if(e.source&&(['mana','steal'].includes(e.design.family)||e.hasDrain)){
  const from=e.design.family==='mana'?e.source:{x:e.x,y:e.y},to=e.design.family==='mana'?{x:e.x,y:e.y}:e.source;
  for(let i=0;i<(lite?2:4);i++){
   const q=reduced?(i+1)/5:Math.max(0,Math.min(1,t*1.3-i*.12));
   drawSkillMark(c,{x:from.x+(to.x-from.x)*q,y:from.y+(to.y-from.y)*q,mark:e.hasMpDrain||e.design.family==='mana'?'mana':'heal'},fixed,lite,false);
  }
 }
}
// 最初の描画を起点に揃え、音の準備やDOM更新で短い演出の序盤を失わない。
export function beginSkillFxPresentation(fx,now){
 const scene=fx?.skill?.find(e=>e.type==='skillScene');if(!scene||fx.presentationAt!=null)return;
 const shift=Math.max(0,now-scene.t0);fx.presentationAt=now;
 for(const list of [fx.skill,fx.floats,fx.slashes,fx.deaths])for(const e of list||[])if(Number.isFinite(e.t0))e.t0+=shift;
 for(const e of Object.values(fx.flash||{}))if(Number.isFinite(e.t0))e.t0+=shift;
 if(Number.isFinite(fx.screen?.t0))fx.screen.t0+=shift;
 for(const event of fx.skillSounds||[])if(event.delay<=0)event.play();else setTimeout(event.play,event.delay);
 fx.skillSounds=[];
}
export function emitSkillFx(list,key,spell,hits,locate,now,spd=1,options={}){
 const baseDesign=options.design||SKILL_FX_CATALOG[key];if(!baseDesign)return false;
 const comboCount=Math.max(spell.hits||1,spell.scatter||1),combo=comboCount>1;
 const slotCounts=new Map();let scatterSlot=0;
 const strikes=[];
 const points=[],seen=new Map();let hitCount=0;
 for(const hit of hits||[]){
  if(!hit?.target)continue;
  const uidKey=hit.target.side+':'+hit.target.uid;
  let slot=0;
  if(combo&&(hit.dmg!=null||hit.miss||hit.immune)){
   slot=spell.scatter?scatterSlot++:(slotCounts.get(uidKey)||0);
   slotCounts.set(uidKey,slot+1);
  }
  if(hit.miss||hit.immune||hit.mpHeal===0&&hit.dmg==null&&!hit.buff&&hit.heal==null)continue;
  const impact=locate(hit.target);
  if(combo&&hit.dmg!=null&&impact&&slot<comboCount)strikes.push({x:impact.x,y:impact.y,slot});
  hitCount++;const uid=hit.target.side+':'+hit.target.uid;
  if(seen.has(uid)){const point=seen.get(uid);point.status ||= statusFxKind(hit.status);point.weak ||= !!hit.debuff;point.mark ||= hit.mpHeal>0?'mana':hit.heal>0?'heal':hit.cured?'purify':hit.buff?'ward':null;continue;}
  const p=locate(hit.target);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const point={x:p.x,y:p.y,side:hit.target.side,status:statusFxKind(hit.status),weak:!!hit.debuff,mark:hit.mpHeal>0?'mana':hit.heal!=null?(hit.revived?'revive':'heal'):hit.cured?'purify':hit.buff?'ward':null};
  seen.set(uid,point);points.push(point);
  if(points.length>=FX_LIMITS.targets)break;
 }
 if(!points.length)return true;
 const all=['all-enemy','all-ally'].includes(spell.target),enemy=['enemy','all-enemy'].includes(spell.target);
 const primary=points.filter(p=>(p.side==='enemy')===enemy), anchors=primary.length?primary:[points[0]],xs=anchors.map(p=>p.x),ys=anchors.map(p=>p.y);
 const x=all?(Math.min(...xs)+Math.max(...xs))/2:anchors[0].x,y=all?ys.reduce((a,b)=>a+b,0)/anchors.length:anchors[0].y;
 const design={...baseDesign,combo:comboCount>1?comboCount:0,ultimate:!!SKILL_FX_SIGNATURES[key]?.ultimate};
 list.unshift({type:'skillScene',strikes,comboCount,design,hasMpDrain:!!spell.mpDrain&&(hits||[]).some(h=>h.mpHeal>0),element:spell.element||null,ultimate:SKILL_FX_ULTIMATES[key]||null,source:options.source||null,hasDrain:!!(spell.drain||spell.mpDrain)&&(hits||[]).some(h=>h.lifesteal>0||h.mpHeal>0||h.heal>0),signature:SKILL_FX_SIGNATURES[key]||null,pts:points,primaryPts:anchors,col:spell.element?(baseDesign.family==='cleave'?CLEAVE_COLORS[spell.element]:{fire:'#ff4938',water:'#439fff',wind:'#89dfae',earth:'#ca9a65',light:'#ffe297',dark:'#a47bdd'}[spell.element]||FX.elCol(spell.element)[1]):null,all,marks:true,x,y,w:Math.max(...xs)-Math.min(...xs)+80,t0:now,dur:skillFxDuration(design,spd,options),seed:17,hitCount});



 if(list.length>FX_LIMITS.effects)list.length=FX_LIMITS.effects;
 return true;
}
registerFx({skillScene:drawSkillScene},{skillScene:300});

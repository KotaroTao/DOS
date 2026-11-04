import { CLEAVE_MOTION } from './cleave-fx.js';
export const SLASH_FORMS={fighter:[0,3,.2],knight:[1,4,.7],thief:[2,5,-.5],samurai:[0,2,0],berserker:[3,3,1.1],shadow:[0,6,-1.2],paladin:[1,8,1.57],spellblade:[2,7,.4],brigand:[3,5,-.8],arcthief:[2,4,2.1],crusader:[1,4,0],battlemage:[3,6,.8],darkknight:[3,8,-.4],templar:[1,3,1.2],exorcist:[0,7,.6],inquisitor:[0,4,1.57],ascetic:[2,8,.1],hero:[1,5,1.57],asura:[2,6,0],dragonknight:[3,7,-.9],chaplain:[1,6,-.6],sera:[2,3,-.3]};
// 材質のある主演出。18コマの濃淡と系統ごとの軌道で、発生・作用・余韻を描く。
// 一手の時間、対象、乱数、音、結果の確定は呼出し元が管理する。
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-(1-clamp(v))**3;
const families='cut cleave flurry impact pierce projectile firePillar fireball blast ice wave gale lightning stone quake radiance void arcane heal revive purify ward mana empower charge weaken dispel seal paralyze poison illusion sleep gravity doom drain steal escape survey'.split(' ');
export const MATERIAL_FAMILIES=Object.freeze(families);
const rows={ribbon:0,pressure:1,crystal:2,water:3,wind:4,shadow:5,light:6,life:7,venom:8,stone:9};
const image=typeof Image==='undefined'?null:new Image();
const physicalImage=typeof Image==='undefined'?null:new Image();
const tinted=new Map(),pending=new Set(); // 最大6面。着弾の描画中には画像処理しない。
const warmTones=['#ff4938','#439fff','#89dfae','#ca9a65','#ffe297','#a47bdd'];
function sourceFor(kind){
 if(kind==='ribbon'&&physicalImage?.complete&&physicalImage.naturalWidth)return {texture:physicalImage,sw:192,sh:96,row:0};
 return {texture:image,sw:96,sh:96,row:rows[kind]*3};
}
async function cacheTone(kind,tone){
 const source=sourceFor(kind);if(!source.texture?.naturalWidth)return;
 const width=source.sw*6,height=source.sh*3,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');ctx.drawImage(source.texture,0,source.row*source.sh,width,height,0,0,width,height);
 const pixels=ctx.getImageData(0,0,width,height),rgb=[1,3,5].map(i=>parseInt(tone.slice(i,i+2),16)/255);
 for(let start=0;start<pixels.data.length;start+=32768){
 for(let i=start;i<Math.min(start+32768,pixels.data.length);i+=4)for(let k=0;k<3;k++){
  // 暗い属性色でも明るい摩擦の面を失わない。
  const highlight=Math.max(0,(pixels.data[i+k]-195)/60)*.35;
  pixels.data[i+k]*=Math.min(1,.3+rgb[k]*.7+highlight);
 }
 await new Promise(resolve=>setTimeout(resolve,0));
 }
 // 変換の途中で高解像度素材が届いた場合、古い素材の結果は保持しない。
 if(source.texture!==sourceFor(kind).texture)return;
 ctx.putImageData(pixels,0,0);
 const key=kind+tone;if(tinted.size>=6)tinted.delete(tinted.keys().next().value);
 tinted.set(key,{texture:canvas,sw:source.sw,sh:source.sh,row:0});
}
function queueTone(kind,tone){
 if(kind!=='ribbon'||!tone||pending.has(kind+tone)||tinted.has(kind+tone))return;
 const key=kind+tone;pending.add(key);
 const build=()=>{cacheTone(kind,tone).finally(()=>pending.delete(key));};
 if(globalThis.requestIdleCallback)requestIdleCallback(build,{timeout:500});else setTimeout(build,0);
}
function colored(kind,tone){queueTone(kind,tone);return tinted.get(kind+tone)||sourceFor(kind);}
if(image)image.src=new URL('../art/effects/skill-materials.webp',import.meta.url).href;
if(physicalImage){
 physicalImage.onload=()=>{tinted.clear();for(const tone of warmTones)queueTone('ribbon',tone);};
 physicalImage.src=new URL('../art/effects/physical-materials.webp',import.meta.url).href;
}
function noise(i,seed=17){let x=Math.imul(i+seed,374761393);x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
// 代替表示も不規則な濃淡を持つ画像とし、図形の輪郭を描かない。
let fallback=null;
function fallbackImage(){
 if(fallback||typeof document==='undefined')return fallback;
 fallback=document.createElement('canvas');fallback.width=fallback.height=48;
 const ctx=fallback.getContext('2d'),data=ctx.createImageData(48,48);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  const i=(y*48+x)*4,dx=(x-24)/24,dy=(y-24)/24;
  const a=Math.max(0,1-(dx+(noise(y)-.5)*.3)**2-(dy+(noise(x)-.5)*.3)**2)*(noise(x+y*48)*.7+.3);
  data.data.set([182,198,209,Math.round(a*a*170)],i);
 }
 ctx.putImageData(data,0,0);return fallback;
}
function material(c,kind,x,y,w,h,angle,t,alpha,lite,tone=null){
 if(w<=0||h<=0||alpha<=0)return;
 c.save();c.translate(x,y);c.rotate(angle);
 if(image?.complete&&image.naturalWidth){
  const {texture,sw,sh,row}=colored(kind,tone);
  const frame=((t*17)%18+18)%18,first=Math.floor(frame),blend=frame-first;
  for(let k=0;k<(lite?1:2);k++){
   const index=(first+k)%18;c.globalAlpha=clamp(alpha)*(lite?1:k?blend:1-blend);
   c.drawImage(texture,index%6*sw,(row+Math.floor(index/6))*sh,sw,sh,-w/2,-h/2,w,h);
  }
 }else{const texture=fallbackImage();if(texture){c.globalAlpha=clamp(alpha);c.drawImage(texture,-w/2,-h/2,w,h);}}
 c.restore();
}
const fire=typeof Image==='undefined'?null:new Image();
if(fire)fire.src=new URL('../art/effects/fire-pillar.webp',import.meta.url).href;
function flame(c,x,y,w,h,t,a,lite,reduced){
 if(!fire?.complete||!fire.naturalWidth){material(c,'pressure',x,y,w,h,0,t,a,lite);return;}
 const frame=reduced?8:t*17%18,first=Math.floor(frame),blend=frame-first;
 for(let k=0;k<(lite?1:2);k++){
  const index=(first+k)%18;c.globalAlpha=clamp(a)*(lite?1:k?blend:1-blend);
  c.drawImage(fire,index%6*128,Math.floor(index/6)*192,128,192,x-w/2,y-h/2,w,h);
 }
}
// 表示されるものはすべて乱流・煙・屈折・炎の画像。輪郭線・円・星・多角形は使わない。
export function drawMaterialSkill(c,e,t,w,h,lite,reduced){
 const f=e.design.family;if(!families.includes(f))return false;
 const rank=Math.min(3,Math.max(1,e.design.tier)),detail=Math.min(5,e.design.tier),x=e.x;
 const physical=e.physical||e.design.kind==='phys',combo=!!e.design.combo;
 const q=reduced?.4:clamp(t),motion=physical?clamp(q*(e.strikeMs||e.dur||145)/65):clamp(q/.6),grow=ease(motion),tail=(1-clamp(t))**.7;
 const full=rank===3&&!physical&&['ice','wave','gale','lightning','stone','quake','firePillar','blast'].includes(f);
 const r=(full?Math.max(w,h)*.52:Math.max(e.all?Math.min(w*.44,Math.max(100,(e.w||80)*.55)):62,rank===3?100:rank===2?78:62))*(e.design.scale||1);
 const y=e.primaryPts?.some(p=>p.side==='party')?Math.min(e.y,h-r*.55):e.y;
 const tone=e.col||e.signature?.tone||null,n=combo?1:lite?rank+1:rank+3;
 c.save();c.globalCompositeOperation='lighter';
 if(['cut','cleave','flurry','pierce','projectile'].includes(f)){
  const form=f==='cleave'?CLEAVE_MOTION[e.design.variant]:null,slash=SLASH_FORMS[e.design.slashUltimate];
  const count=combo?1:form?form[0]:slash?slash[1]:f==='cut'?detail:f==='cleave'?rank+1:f==='flurry'?rank+2:rank;
  for(let i=0;i<count;i++){
   const u=(i-(count-1)/2),angle=combo&&['cut','cleave','flurry'].includes(f)?[-.65,.65,-1.15,1.15,0,Math.PI/2,-.3,.3][(e.strikeIndex||0)%8]:form?form[1]+(i%2?1:-1)*(i+1)*form[2]*.17:slash?slash[2]+(i%2?1:-1)*(i+1)*.13:['pierce','projectile'].includes(f)?-Math.PI/2:f==='cleave'?(i%2?-.15:Math.PI+.15):(i%2?.65:-.65);
   const offset=r*(-.8+grow*1.6);
   material(c,'ribbon',x+Math.cos(angle)*offset,y+Math.sin(angle)*offset+u*r*(form?form[3]:.12),r*1.9,r*(f==='cleave'?.75:.65),angle,(physical?clamp(q*(e.strikeMs||e.dur||145)/145):q)+i*.11+(e.strikeIndex||0)*.19,Math.min(1,tail*1.25),lite,tone);
   material(c,'pressure',x,y,r*.55,r*.25,angle,q,tail*.5,lite,tone);
  }
 }else if(f==='impact'){
  material(c,'pressure',x,y,r*(.65+grow*1.3),r*(.5+grow*.7),0,q,tail,lite,tone);
  material(c,'stone',x,y+r*.2,r*(.8+grow*1.2),r*.7,0,q,tail*.7,lite);
  if(detail>=4&&!combo)for(let i=0;i<detail-2;i++)material(c,'pressure',x+(i-1)*r*.2,y,r*(1+grow*.7),r*.5,i*.4,q+i*.17,tail*.45,lite,tone);
 }else if(['firePillar','fireball','blast'].includes(f)){
  const count=f==='firePillar'?(rank===3?(lite?8:16):rank===2?(lite?4:7):(lite?3:5)):n;
  for(let i=0;i<count;i++){
   const u=i/Math.max(1,count-1),a=u*TAU*2+(reduced?0:q*3);
   const xx=rank===3&&f==='firePillar'?w*.5+Math.cos(a)*w*.5*(.2+u):x+(u-.5)*r*1.2;
   const yy=rank===3&&f==='firePillar'?h*.5+Math.sin(a)*h*.5*(.2+u):y-r*.3*(f==='firePillar'?1:0);
   flame(c,xx,yy,r*(f==='firePillar'?.65:1.1),r*(f==='firePillar'?1.7:1),q+i*.17,tail*.85,lite,reduced);
  }
 }else if(f==='ice'||f==='stone'){
  for(let i=0;i<n+1;i++){
   const u=(i-(n/2))/Math.max(1,n/2),xx=x+u*r*.75,hh=r*(.8+noise(i)*.6)*Math.max(.12,grow);
   material(c,f==='ice'?'crystal':'stone',xx,y-hh*.25,r*.65,hh,(i/n-.5)*.4,q+i*.11,tail,lite);
  }
  material(c,f==='ice'?'water':'stone',x,y+r*.2,r*2.2,r*.65,0,q,tail*.5,lite);
 }else if(['wave','gale','quake','lightning','paralyze'].includes(f)){
  const kind={wave:'water',gale:'wind',quake:'stone',lightning:'light',paralyze:'light'}[f];
  for(let i=0;i<n;i++){
   const u=(i-(n-1)/2),a=f==='gale'?i*1.7+q*2:f==='lightning'?-Math.PI/2+u*.35:0;
   material(c,kind,x+(f==='wave'?(grow-1)*r:Math.cos(a)*r*.25),y+u*r*.12,r*(f==='quake'?2.2:1.65),r*(f==='lightning'?.25:.65),a,q+i*.13,tail*.85,lite);
  }
 }else if(['heal','revive','purify','ward','mana','empower','charge','radiance'].includes(f)){
  const kind={heal:'life',revive:'light',purify:'crystal',ward:'crystal',mana:'water',empower:'light',charge:'pressure',radiance:'light'}[f];
  for(let i=0;i<n;i++){
   const a=i*2.4+q*.7,inward=f==='charge'?1-grow*.75:.25+grow*.45;
   const xx=x+Math.cos(a)*r*inward,yy=y+Math.sin(a)*r*.15-(f==='revive'?q*r*.8:q*r*.3);
   material(c,kind,xx,yy,r*(f==='ward'?1.4:.9),r*(f==='radiance'?2.4:f==='revive'?1.7:1.15),f==='mana'?a:0,q+i*.15,tail*.8,lite,f==='mana'?'#79bfff':null);
  }
 }else{
  const kind={void:'shadow',gravity:'shadow',doom:'shadow',drain:'shadow',steal:'ribbon',arcane:'shadow',survey:'wind',poison:'venom',illusion:'shadow',sleep:'shadow',escape:'wind',weaken:'shadow',dispel:'crystal',seal:'shadow'}[f]||'shadow';
  c.globalCompositeOperation=['poison','sleep','escape','illusion'].includes(f)?'source-over':'lighter';
  for(let i=0;i<n;i++){
   const a=i*2.4+(reduced?0:q*(f==='gravity'?-1:2)),d=r*(f==='dispel'?.2+grow*.7:f==='drain'||f==='charge'?1-grow*.7:.45);
   material(c,kind,x+Math.cos(a)*d,y+Math.sin(a)*d*.5-q*r*.15,r*(f==='poison'?1.5:1.2),r*(f==='sleep'?.55:.85),a*.4,q+i*.17,tail*.65,lite);
  }
 }
 // 職業の奥義の差も画像の向きと濃淡で付ける。紋・記号は描かない。
 if(e.ultimate&&!combo)material(c,['cut','cleave'].includes(f)?'ribbon':'pressure',x,y,r*1.8,r*.6,e.ultimate.angle||0,q+.35,tail*.35,lite,tone);
 c.restore();return true;
}
export function drawSkillMark(c,p,t,lite,mp=false){
 const kind=p.mark==='heal'?'life':p.mark==='mana'||mp?'water':p.weak||p.status?'venom':p.mark==='ward'||p.mark==='purify'?'crystal':'pressure';
 c.save();c.globalCompositeOperation='lighter';material(c,kind,p.x,p.y,18,22,0,t,(1-clamp(t))*.65,lite);c.restore();
}

import { SKILL_FX_ULTIMATES } from './skill-fx-ultimates.js';
import { drawCleave, CLEAVE_COLORS } from './cleave-fx.js';
import { drawMysticFx, MYSTIC_FAMILIES } from './mystic-fx.js';
import { drawThermalFx } from './thermal-fx.js';
// 技の意味から組み立てる軽量Canvas演出。武器・人物は描かず、火柱だけ透過アトラスを使う。
import { registerFx, FX, statusFxKind } from './battlefx.js';
import { SKILL_FX_CATALOG } from './skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from './skill-fx-signatures.js';
import { FX_LIMITS, fxLite } from './skill-fx-budget.js';
const { r01, clamp01, easeOut, rgba, line, star4 } = FX, TAU = Math.PI*2;
export const SKILL_FAMILIES = Object.freeze({cut:'斬撃',cleave:'なぎ払い',flurry:'連撃',impact:'重い打撃',pierce:'貫通',projectile:'射撃',fireball:'火球',firePillar:'火柱',blast:'爆発',ice:'氷の破片',wave:'水の波',gale:'風の流れ',lightning:'雷光',stone:'岩の隆起',quake:'地の衝撃',radiance:'聖光',void:'闇の収束',arcane:'魔力の波',heal:'回復',revive:'蘇生',purify:'治療',ward:'守り',mana:'魔力の譲渡',empower:'強化',charge:'力を溜める',weaken:'弱体',dispel:'解除',seal:'封印',paralyze:'麻痺',poison:'毒',illusion:'幻惑',sleep:'眠り',gravity:'重力',doom:'死の印',drain:'吸収',steal:'奪取',escape:'退避',survey:'探索'});
const COLORS = {cut:'#daeaf4',cleave:'#daeaf4',flurry:'#daeaf4',impact:'#deb37a',pierce:'#e1eaff',projectile:'#c6e2ed',fireball:'#ff9b53',firePillar:'#ff9b53',blast:'#ffc786',ice:'#bceaff',wave:'#69c8ff',gale:'#91e5c1',lightning:'#f4e8ff',stone:'#d2b18a',quake:'#c6aa8b',radiance:'#ffe9aa',void:'#b999e5',heal:'#9be7bd',revive:'#f6e6b0',purify:'#b4edee',ward:'#b7d8f0',empower:'#f5d597',charge:'#e7c39b',poison:'#a8bd7a',drain:'#cf93bd',mana:'#92c9f8',gravity:'#ae92e8',doom:'#d68bae',steal:'#edce83',escape:'#9eaecb',survey:'#8cdae3',weaken:'#b49ad5',dispel:'#d6dff9',seal:'#cba5f1',illusion:'#d3a8df',sleep:'#aebcf1'};
export function skillFxSound(family, tier = 1) {
  if (MYSTIC_FAMILIES.includes(family)) return family+(tier>=3?'3':tier>=2?'2':'');
  if (['cut','cleave','flurry'].includes(family)) return 'slash';
  if (family==='fireball'||family==='blast')return family+(tier>=3?'3':tier>=2?'2':'');
  if (['impact','stone','quake'].includes(family)) return 'impact';
  if (['pierce','projectile'].includes(family)) return 'pierce';
  if (['heal','revive','purify','mana'].includes(family)) return 'restore';
  if (['ward','empower','charge','survey'].includes(family)) return 'ward';
  if (['paralyze','poison','illusion','sleep','seal','weaken','dispel','gravity','doom','drain','steal','escape','void'].includes(family)) return 'shade';
  return family === 'firePillar' ? tier >= 3 ? 'firePillar3' : tier >= 2 ? 'firePillar2' : 'firePillar' : family === 'fireball' ? 'fire' : family === 'lightning' ? 'spark' : 'magic';
}
// 火柱・火球・爆発は格ごとの見せる時間を持つ。画質・動き低減では尺を変えない。
export const extendedSkillFx=design=>(['impact','firePillar','fireball','blast',...MYSTIC_FAMILIES].includes(design?.family)||design?.combo||design?.ultimate);

export function skillFxDuration(design, spd=1, options={}){
 if(design?.family==='impact'&&!design.combo)return Math.round(([0,400,500,650,800,950][design.tier]||400)*(options.auto?.6:options.fast?.8:1));
 if(extendedSkillFx(design)){
  const base=design.combo?Math.max(400,design.combo*160):design.ultimate&&!['firePillar','fireball','blast'].includes(design.family)?1000:[0,400,700,1200][design.tier]||400;
  return Math.round(base*(options.auto?.6:options.fast?.8:1));
 }
 return Math.min(350,Math.max(220,300*spd));
}
const ring = (c,x,y,r,color,a,width=2) => { c.globalAlpha=clamp01(a);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.stroke(); };
function sparks(c,seed,n,x,y,r,t,color,lite) {
  if(lite)return;
  for(let i=0;i<Math.min(n,FX_LIMITS.particles);i++){
    const a=r01(i,seed)*TAU, d=(.3+t)*r*(.5+r01(i+19,seed));
    line(c,x+Math.cos(a)*d,y+Math.sin(a)*d,x+Math.cos(a)*(d+5),y+Math.sin(a)*(d+5),1.5,color,(1-t)*.7);
  }
}
function ray(c,x,y,r,a,color,alpha,width=2){line(c,x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2,x+Math.cos(a)*r,y+Math.sin(a)*r,width,color,alpha);}
function trace(c,x,y,r,t,color,angle=-.64,width=4){
 const q=Math.min(1,t/.22),dx=Math.cos(angle)*r,dy=Math.sin(angle)*r;
 line(c,x+dx,y+dy,x+dx*(1-2*q),y+dy*(1-2*q),width+3,color,(1-t)*.4);
 line(c,x+dx,y+dy,x+dx*(1-2*q),y+dy*(1-2*q),Math.max(1.5,width*.85),'#fff9ef',1-t);
}
// 小さな透過アトラスを起動時から読み、描画中の画像生成や全画面待ちは行わない。
const fireTexture = typeof Image === 'undefined' ? null : new Image();
let vortexTexture=null;
if(fireTexture){
 fireTexture.onload=()=>{
  // 渦で横向きに使う素材だけ、四辺を十分に透かす。基本の火柱の絵は変えない。
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;
  const ctx=canvas.getContext('2d');ctx.drawImage(fireTexture,0,0);ctx.globalCompositeOperation='destination-out';
  for(let frame=0;frame<18;frame++){
   const x=frame%6*128,y=Math.floor(frame/6)*192;
   for(const [x0,y0,x1,y1,rx,ry,rw,rh] of [[x,y,x,y+48,x,y,128,48],[x,y+192,x,y+144,x,y+144,128,48],[x,y,x+20,y,x,y,20,192],[x+128,y,x+108,y,x+108,y,20,192]]){
    const fade=ctx.createLinearGradient(x0,y0,x1,y1);fade.addColorStop(0,'#000');fade.addColorStop(1,'#0000');ctx.fillStyle=fade;ctx.fillRect(rx,ry,rw,rh);
   }
  }
  vortexTexture=canvas;
 };
 fireTexture.src=new URL('../art/effects/fire-pillar.webp',import.meta.url).href;
}
// 火柱は地際の熱から噴き上がる。種は演出専用で、時間から滑らかに揺らす。
function firePillar(c,x,y,r,t,lite,reduced,e) {
 const rise=reduced?1:easeOut(clamp01(t/.24));
 const fade=Math.pow(1-t, .85), motion=reduced?0:t;
 const rank=e.design?.tier||1;
 const base=y+r*.43, height=r*(.4+rise*1.22)*(rank===2?1.4:1);
 const spread=r*.67*(rank===2?1.12:1);
 // 炎の奥に薄い煤。大きなぼかしや画面全体の閃光は使わない。
 if(!lite){
  c.globalCompositeOperation='source-over';
  for(let i=0;i<3;i++){
   const xx=x+(i-1)*r*.32+Math.sin(motion*5+i)*r*.08;
   const yy=base-height*.65-motion*r*.45;
   const smoke=c.createRadialGradient(xx,yy,0,xx,yy,r*.35);
   smoke.addColorStop(0,rgba('#372b26',fade*.28));smoke.addColorStop(1,rgba('#372b26',0));
   c.globalAlpha=1;c.fillStyle=smoke;c.fillRect(xx-r*.35,yy-r*.35,r*.7,r*.7);
  }
 }
 c.globalCompositeOperation='lighter';
 // 根元の照り返しは横長に絞り、敵の輪郭を隠さない。
 c.save();c.translate(x,base);c.scale(1,.24);
 const heat=c.createRadialGradient(0,0,0,0,0,r*.95);
 heat.addColorStop(0,rgba('#ffb34d',fade*.55));heat.addColorStop(1,rgba('#d43c12',0));
 c.globalAlpha=1;c.fillStyle=heat;c.fillRect(-r,-r,r*2,r*2);c.restore();
 // 濃淡のある乱流テクスチャを少しずつずらして重ねる。輪郭の線や炎形の図形は描かない。
 const ready=fireTexture?.complete && fireTexture.naturalWidth>0, plumes=rank===2?(lite?4:7):(lite?3:5);
 c.imageSmoothingEnabled=true;
 for(let i=0;i<plumes;i++){
  const u=(i-(plumes-1)/2)/Math.max(1,(plumes-1)/2), xx=x+u*spread;
  const surge=rank===2&&!reduced?easeOut(clamp01((t-Math.abs(u)*.13)/.2)):1;
  const hh=height*(.82+r01(i,e.seed)*.24)*(rank===2?.45+surge*.55:1), ww=r*(lite?.8:.68)*(rank===2?1.15:1);
  if(ready){
   const frame=reduced?8:((rank===2?Math.max(0,t-Math.abs(u)*.13):t)*(rank===1?17:23)+i*3)%18, first=Math.floor(frame), blend=frame-first;
   for(let k=0;k<(lite?1:2);k++){
    const index=(first+k)%18;
    c.globalAlpha=fade*(lite?.9:.82)*(lite?1:k?blend:1-blend);
    c.drawImage(fireTexture,index%6*128,Math.floor(index/6)*192,128,192,xx-ww/2,base-hh,ww,hh);
   }
  }else{
   // 読込失敗時も、柔らかな縦の熱だけで作用を伝える。
   const glow=c.createRadialGradient(xx,base-hh*.3,0,xx,base-hh*.3,hh*.6);
   glow.addColorStop(0,rgba('#ffb64a',fade*.65));glow.addColorStop(1,rgba('#d43c12',0));
   c.globalAlpha=1;c.fillStyle=glow;c.fillRect(xx-hh*.6,base-hh*.9,hh*1.2,hh*1.2);
  }
 }
 // 火の粉は上向きの短い尾。低減表示では移動も粒子も省く。
 const particles=reduced?0:lite?(rank===1?3:5):rank===1?12:15;
 for(let i=0;i<particles;i++){
  const q=clamp01((t-r01(i+10,e.seed)*.15)/.85);
  const xx=x+(r01(i,e.seed)-.5)*(r*1.65)+Math.sin(q*4+i)*r*.06;
  const yy=base-q*(r*(1.1+r01(i+20,e.seed)*.8));
  line(c,xx,yy,xx-r*.015,yy+r*.06,1.3,i%3?'#ffb64a':'#ffe9ad',fade*Math.sin(Math.PI*q));
 }
}
// 最上位だけは柱ではなく、内側から外周まで炎が巻く二重の渦にする。
function fireVortex(c,e,t,w,h,lite,reduced){
 const fade=Math.pow(1-t,.85), phase=reduced?0:t*4.8;
 c.globalCompositeOperation='source-over';c.globalAlpha=1;
 const veil=c.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,Math.max(w,h)*.75);
 veil.addColorStop(0,rgba('#ffb44b',fade*.24));veil.addColorStop(.55,rgba('#ac300c',fade*.32));veil.addColorStop(1,rgba('#651407',fade*.22));
 c.fillStyle=veil;c.fillRect(0,0,w,h);
 const texture=vortexTexture||fireTexture, ready=fireTexture?.complete&&fireTexture.naturalWidth>0, count=lite?8:16;
 c.save();c.translate(w*.5,h*.48);c.scale(w*.5,h*.54);c.imageSmoothingEnabled=true;
 c.globalCompositeOperation='lighter';
 for(let i=0;i<count;i++){
  const u=i/(count-1), a=u*TAU*2+phase, radius=.18+u*1.05;
  c.save();c.translate(Math.cos(a)*radius,Math.sin(a)*radius);c.rotate(a+Math.PI*.92);
  c.globalAlpha=fade*(.7+u*.2);
  if(ready){
   const index=reduced?8:Math.floor((t*23+i*2)%18);
   c.drawImage(texture,index%6*128,Math.floor(index/6)*192,128,192,-.30,-.80,.60,1.25);
  }else{
   const heat=c.createRadialGradient(0,0,0,0,0,.65);heat.addColorStop(0,rgba('#ffad45',.55));heat.addColorStop(1,rgba('#d4350b',0));
   c.fillStyle=heat;c.fillRect(-.65,-.65,1.3,1.3);
  }
  c.restore();
 }
 c.restore();
 if(!reduced)for(let i=0;i<(lite?5:15);i++){
  const u=i/15, a=u*TAU*2+phase, radius=.15+u;
  const xx=w*.5+Math.cos(a)*w*.5*radius,yy=h*.48+Math.sin(a)*h*.54*radius;
  line(c,xx,yy,xx+Math.sin(a)*7,yy-Math.cos(a)*7,1.5,'#ffdb8e',fade);
 }
}
// 補助の術は格ごとに紋と流れを変える。画面の対象・乱数・行動の尺には触れない。
const SUPPORT_FAMILIES = new Set(['mana','empower','charge','weaken','dispel','seal','poison','illusion','sleep']);
function supportScene(c,f,x,y,r,t,color,lite,reduced,e){
 const rank=e.design.tier, fade=Math.pow(1-t,1.1), q=reduced?.55:easeOut(t), motion=reduced?0:t;
 const layers=rank, count=lite?3:6;
 c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
 if(f==='mana'){
  // 譲渡先に開く杯状の光。術者からの流れは共通の作用点描画でつなぐ。
  for(let k=0;k<layers;k++){
   const rr=r*(.22+k*.17), yy=y+r*.16-k*r*.12;
   c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(x,yy,rr,rr*.38,0,0,Math.PI);c.stroke();
   star4(c,x,yy-r*(.12+q*.25),4+k*2,'#ddf4ff',fade);
  }
 }else if(f==='empower'){
  for(let k=0;k<layers;k++){
   const yy=y+r*.45-k*r*.3-motion*r*.25, rr=r*(.22+k*.1);
   line(c,x-rr,yy,x,yy-rr*.65,2.5,color,fade);line(c,x,yy-rr*.65,x+rr,yy,2.5,color,fade);
  }
  if(rank>=2)ring(c,x,y+r*.45,r*(.35+q*.2),color,fade*.6,1.5);
  if(rank===3)for(let i=0;i<count;i++){const a=i*TAU/count;star4(c,x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7,4,'#fff2c8',fade);}
 }else if(f==='charge'){
  const rr=r*(.85-q*.55);
  for(let i=0;i<count;i++)ray(c,x,y,rr,i*TAU/count,color,fade,2);
  star4(c,x,y,r*(.08+q*.14),'#fff0ce',fade);
  if(rank>=2)for(let k=0;k<layers-1;k++)ring(c,x,y,rr+r*(.14+k*.14),color,fade*.7,2);
 }else if(f==='weaken'){
  for(let k=0;k<layers;k++){
   const yy=y-r*.35+k*r*.27+motion*r*.2, rr=r*(.2+k*.08);
   line(c,x-rr,yy,x,yy+rr*.6,2.5,color,fade);line(c,x,yy+rr*.6,x+rr,yy,2.5,color,fade);
  }
  if(rank>=2)for(let i=0;i<count;i++){const a=i*TAU/count;ray(c,x,y,r*(.5-q*.15),a,color,fade*.5,1);}
  if(rank===3)ring(c,x,y,r*(.7-q*.2),color,fade*.6,2);
 }else if(f==='dispel'){
  // 切れた環が外へほどける。上位では複数の環を同時に砕く。
  for(let k=0;k<layers;k++)for(let i=0;i<count;i++){
   const a=i*TAU/count+k*.3, rr=r*(.22+k*.15+q*.45);
   c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(x,y,rr,a+.1,a+TAU/count*.65);c.stroke();
   if(rank>=2)ray(c,x,y,rr+r*.12,a,color,fade*.5,1);
  }
 }else if(f==='seal'){
  for(let k=0;k<layers;k++){
   const rr=r*(.3+k*.17)*(reduced?1:1.2-q*.2), angle=k*Math.PI/4;
   c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=2;c.beginPath();
   for(let i=0;i<=4;i++){const a=angle+i*TAU/4; i?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.stroke();
  }
  line(c,x-r*.15,y-r*.15,x+r*.15,y+r*.15,2,'#ede2ff',fade);
  line(c,x+r*.15,y-r*.15,x-r*.15,y+r*.15,2,'#ede2ff',fade);
 }else if(f==='poison'){
  c.globalCompositeOperation='source-over';
  for(let i=0;i<(lite?3:6)+rank-1;i++){
   const xx=x+(r01(i,e.seed)-.5)*r*1.3, yy=y+r*.3-motion*r*(.3+r01(i+9,e.seed)*.5);
   const rr=r*(.1+(i%3)*.035);c.globalAlpha=fade*.24;c.fillStyle=color;c.beginPath();c.ellipse(xx,yy,rr*1.7,rr,0,0,TAU);c.fill();
   ring(c,xx,yy-r*.1,rr*.45,color,fade*.7,1);
  }
  if(rank>=2)ring(c,x,y+r*.3,r*(.35+q*.25),color,fade*.5,2);
  if(rank===3)for(let i=0;i<3;i++)line(c,x+(i-1)*r*.3,y+r*.2,x+(i-1)*r*.3,y-r*q*.6,1,color,fade*.5);
 }else if(f==='illusion'){
  for(let k=0;k<layers;k++){
   const xx=x+Math.sin(motion*5+k*2)*r*.2, yy=y+(k-(layers-1)/2)*r*.23;
   c.globalAlpha=fade*.8;c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(xx,yy,r*(.4+k*.1),r*.16,k%2?.4:-.4,0,TAU);c.stroke();
   star4(c,xx+Math.cos(motion*5+k)*r*.3,yy,4,color,fade);
  }
  if(rank===3)ring(c,x,y,r*(.6+q*.15),color,fade*.4,1);
 }else if(f==='sleep'){
  for(let k=0;k<layers;k++){
   const xx=x+(k-(layers-1)/2)*r*.38, yy=y-k*r*.15-motion*r*.25, rr=r*(.19+k*.03);
   // 月の細い弧と、静かに昇る小さな星。
   c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(xx,yy,rr,.3,Math.PI*1.65);c.stroke();
   star4(c,xx+rr*.6,yy-rr*.9,3,'#e5e3ff',fade);
  }
  if(rank>=2)for(let k=0;k<layers-1;k++){
   c.globalAlpha=fade*.35;c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.ellipse(x,y+r*(.3+k*.14),r*(.5+k*.15),r*.1,0,0,TAU);c.stroke();
  }
 }
}
// 六系統は格ごとに紋と流れを変える。低減時は作用を示す固定形にする。
function utilityCore(c,f,x,y,r,t,color,lite,reduced,e){
 const rank=e.design.tier, q=reduced?.55:easeOut(clamp01(t/.75)), fade=Math.pow(1-t,.8);
 const n=lite?3:6, phase=reduced?0:t*2;
 if(f==='gravity'){
  // 重い水平環が落ち、上位では縦の檻、最上位では中心へ潰れる軌道。
  for(let i=0;i<rank+1;i++){
   c.save();c.translate(x,y+r*(.5-q)+(i-rank/2)*r*.25);c.scale(1,.23);
   ring(c,0,0,r*(.8-q*.35),color,fade,2+rank);c.restore();
  }
  if(rank>=2)for(let i=0;i<4;i++){const dx=(i-1.5)*r*.32;line(c,x+dx,y-r*.8,x+dx*(1-q*.6),y+r*.45,1.5,color,fade*.65);}
  if(rank===3){ring(c,x,y,r*(1-q*.8),'#ede1ff',fade,3);star4(c,x,y,r*.18,'#e4d1ff',fade);}
 }else if(f==='doom'){
  ring(c,x,y,r*.58,color,fade,2);
  // 割れた刻印から、六角の封、二重の処刑紋へ。
  const count=rank===1?4:6;
  for(let i=0;i<count;i++){
   const a=i*TAU/count-Math.PI/2+phase*(rank===3?.4:0);
   ray(c,x,y,r*.62,a,color,fade,2);
   if(rank>=2){const b=a+TAU/count;line(c,x+Math.cos(a)*r*.75,y+Math.sin(a)*r*.75,x+Math.cos(b)*r*.75,y+Math.sin(b)*r*.75,1.5,color,fade);}
  }
  line(c,x-r*.22,y-r*.3,x+r*.22,y+r*.3,3,'#f0c5de',fade);
  line(c,x+r*.22,y-r*.3,x-r*.22,y+r*.3,3,'#f0c5de',fade);
  if(rank===3)ring(c,x,y,r*(.95-q*.12),'#da92bc',fade,3);
 }else if(f==='drain'){
  ring(c,x,y,r*(.65-q*.35),color,fade,2);
  for(let i=0;i<n;i++){
   const a=i*TAU/n+phase, d=r*(.9-q*.6);
   const xx=x+Math.cos(a)*d, yy=y+Math.sin(a)*d;
   line(c,xx,yy,x+Math.cos(a-.3)*d*.55,y+Math.sin(a-.3)*d*.55,rank,color,fade);
   if(rank>=2)star4(c,xx,yy,3+rank,color,fade);
  }
  if(rank===3){ring(c,x,y,r*.55,'#f6b8da',fade,3);ring(c,x,y,r*.8,color,fade*.6,1);}
 }else if(f==='steal'){
  // 引き抜かれる光片。上位では鉤形の軌跡、最上位では三重の引き抜き。
  for(let i=0;i<rank;i++){
   const yy=y+(i-(rank-1)/2)*r*.32, xx=x-r*.85*q;
   star4(c,xx,yy,6+rank,'#ffe4a0',fade);
   line(c,x+r*.4,yy-r*.15,xx,yy,2,color,fade*.7);
   if(rank>=2){line(c,x+r*.4,yy-r*.15,x+r*.55,yy-r*.35,2,color,fade);line(c,x+r*.55,yy-r*.35,x+r*.15,yy-r*.45,2,color,fade);}
  }
  if(rank===3)ring(c,x,y,r*(.4+q*.4),color,fade*.5,1.5);
 }else if(f==='escape'){
  for(let i=0;i<n;i++){
   const xx=x+(i-(n-1)/2)*r*.25-q*r*.4, yy=y+Math.sin(i*2)*r*.3;
   c.globalAlpha=fade*.3;c.fillStyle=color;c.beginPath();c.ellipse(xx,yy,r*(.18+q*.15),r*.13,0,0,TAU);c.fill();
  }
  if(rank>=2)for(let i=0;i<rank;i++)line(c,x+r*.4,y+(i-1)*r*.3,x-r*q,y+(i-1)*r*.3,2,color,fade);
  if(rank===3)ring(c,x,y,r*(.3+q*.7),color,fade*.5,2);
 }else if(f==='survey'){
  for(let i=0;i<rank;i++)ring(c,x,y,r*(.2+q*.65+i*.16),color,fade/(1+i*.4),1.5);
  star4(c,x,y,r*.2,'#dbffff',fade);
  if(rank>=2)for(let i=0;i<4;i++)ray(c,x,y,r*.65,i*TAU/4,color,fade,2);
  if(rank===3)for(let i=0;i<4;i++)star4(c,x+Math.cos(i*TAU/4)*r*.8,y+Math.sin(i*TAU/4)*r*.8,4,'#fff0b6',fade);
 }
}
// 五段階: 一閃、返し、三日月、交差、花状の斬域。最終斬撃は職の紋と専用軌道。
export const SLASH_FORMS={fighter:[0,3,.2],knight:[1,4,.7],thief:[2,5,-.5],samurai:[0,2,0],berserker:[3,3,1.1],shadow:[0,6,-1.2],paladin:[1,8,1.57],spellblade:[2,7,.4],brigand:[3,5,-.8],arcthief:[2,4,2.1],crusader:[1,4,0],battlemage:[3,6,.8],darkknight:[3,8,-.4],templar:[1,3,1.2],exorcist:[0,7,.6],inquisitor:[0,4,1.57],ascetic:[2,8,.1],hero:[1,5,1.57],asura:[2,6,0],dragonknight:[3,7,-.9],chaplain:[1,6,-.6],sera:[2,3,-.3]};
function slashScene(c,e,x,y,r,t,color,lite,reduced){
 const rank=e.design.slashRank||1, form=SLASH_FORMS[e.design.slashUltimate];
 const q=reduced?.72:clamp01(t/.7),fade=Math.pow(1-t,.8);
 c.globalCompositeOperation='lighter';c.lineCap='round';
 const arc=(angle,offset,size,delay=0)=>{
  const p=reduced?.85:clamp01((q-delay)/(1-delay));if(p<=0)return;
  c.save();c.translate(x,y);c.rotate(angle);
  c.globalAlpha=fade*.24;c.fillStyle=color;c.beginPath();
  c.ellipse(0,offset*r,r*size,r*size*.42,0,Math.PI*.12,Math.PI*(.12+1.45*p));
  c.ellipse(0,offset*r-r*.06,r*size,r*size*.34,0,Math.PI*(.12+1.45*p),Math.PI*.12,true);c.closePath();c.fill();
  for(const [width,tone,alpha]of [[10,color,.22],[4,color,.9],[1.3,'#ffffff',.9]]){
   c.globalAlpha=fade*alpha;c.strokeStyle=tone;c.lineWidth=width;
   c.beginPath();c.ellipse(0,offset*r,r*size,r*size*.42,0,Math.PI*.12,Math.PI*(.12+1.45*p));c.stroke();
  }c.restore();
 };
 if(form){
  const [style,points,angle]=form;
  // 職ごとに辺数・向き・斬り方を固定し、色違いだけにしない。
  c.globalAlpha=fade*.45;c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();
  for(let i=0;i<=points;i++){const a=i/points*TAU+angle,xx=x+Math.cos(a)*r*.8,yy=y+Math.sin(a)*r*.8;if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy);}c.stroke();
  if(style===0)trace(c,x,y,r*1.25,reduced?.7:t,color,angle,7);
  if(style===1){trace(c,x,y,r*1.15,reduced?.7:t,color,angle,5);trace(c,x,y,r,reduced?.7:t,color,angle+Math.PI/2,3);}
  if(style===2)for(let i=0;i<(lite?3:points);i++)arc(angle+i*TAU/points,0,1,i*.025);
  if(style===3){arc(angle,-.25,1.25);arc(angle+Math.PI,.25,.9,.12);trace(c,x,y,r,reduced?.7:t,color,angle+Math.PI/2,5);}
 }else if(rank===1)trace(c,x,y,r,reduced?.7:t,color,-.65,3);
 else if(rank===2){arc(-.6,0,1);arc(2.5,.1,.8,.18);}
 else if(rank===3){arc(-.3,0,1.2);arc(-.3,.22,.8,.1);}
 else if(rank===4){arc(-.7,0,1.1);arc(.9,0,1.1,.12);trace(c,x,y,r,reduced?.7:t,color,0,2);}
 else for(let i=0;i<(lite?3:5);i++)arc(i*TAU/5,0,1.05,i*.04);
 if(!reduced)sparks(c,e.seed,lite?0:Math.min(18,rank*3),x,y,r,t,color,lite);
}
// 重い打撃は圧縮から解放へ。五段階を大きさだけでなく衝撃の向きと回数で分ける。
function heavyImpact(c,e,x,y,r,t,color,lite,reduced){
 const rank=e.design.tier, q=reduced?.38:t, fade=(1-t)**1.2;
 const p=easeOut(clamp01(q/.35));
 c.globalCompositeOperation='lighter';
 star4(c,x,y,r*(.16+.18*(1-p)),'#fff4df',fade);
 if(rank===1){
  c.save();c.translate(x,y);c.scale(1,.48);ring(c,0,0,r*(.12+p*.65),color,fade,5*(1-t)+1);c.restore();
 }else if(rank===2){
  for(let i=0;i<(lite?3:6);i++){
   const a=i*TAU/6+.25, d=r*(.2+p*.7);
   line(c,x,y,x+Math.cos(a)*d*.45,y+Math.sin(a)*d*.45,3,color,fade);
   line(c,x+Math.cos(a)*d*.45,y+Math.sin(a)*d*.45,x+Math.cos(a+.2)*d,y+Math.sin(a+.2)*d,2,color,fade);
  }
 }else if(rank===3){
  for(const side of [-1,1]){
   const xx=x+side*r*(1-p)*.8;
   trace(c,xx,y,r*.55,q,color,side*.65,6);
  }
  ring(c,x,y,r*(.15+p*.65),color,fade,3);
 }else if(rank===4){
  for(let i=0;i<3;i++){
   const u=reduced?.4:clamp01((q-i*.15)/.5);
   if(u>0)ring(c,x,y,r*(.12+easeOut(u)*(.5+i*.2)),color,fade*(1-u),6-i);
  }
 }else{
  c.save();c.translate(x,y);c.scale(1,.4);
  for(let i=0;i<(lite?2:4);i++)ring(c,0,0,r*(.2+p*(.55+i*.22)),color,fade/(1+i*.3),4-i*.7);
  c.restore();
  for(let i=0;i<(lite?4:8);i++){
   const a=i*TAU/8, d=r*(.2+p*.75);
   line(c,x+Math.cos(a)*d*.5,y+Math.sin(a)*d*.5,x+Math.cos(a)*d,y+Math.sin(a)*d-r*.2*p,3,color,fade);
  }
 }
 if(!reduced)sparks(c,e.seed,rank*3,x,y,r*.65,q,color,lite);
}
// 最終技はその作用に沿う専用構図を重ねる。本数・角度の組は全職業で異なる。
function ultimate(c,e,t,x,y,r,color,lite,reduced){
 const u=e.ultimate;if(!u)return;
 const q=reduced?.4:t, p=easeOut(clamp01(q/.45)), fade=(1-t)**1.1;
 const n=lite?Math.min(4,u.count):u.count;
 c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){
  const a=u.angle+i*TAU/n, rr=r*(.55+p*.45);
  if(u.motif==='cut')trace(c,x,y+(i-(n-1)/2)*7,r*1.2,clamp01(q*2-i*.08),color,u.angle+i*.12,2);
  else if(u.motif==='fall')line(c,x+(i-(n-1)/2)*r*.18,y-r*1.3,x+(i-(n-1)/2)*r*.18,y-r*1.3+p*r*2.3,2,color,fade);
  else if(u.motif==='cross'){
   const xx=x+Math.cos(a)*r*.5, yy=y+Math.sin(a)*r*.5;
   line(c,xx-r*.14,yy,xx+r*.14,yy,2,color,fade);line(c,xx,yy-r*.28,xx,yy+r*.28,3,color,fade);
  }else if(u.motif==='bloom')star4(c,x+Math.cos(a)*rr,y+Math.sin(a)*rr,r*.09,color,fade);
  else if(u.motif==='fracture')ray(c,x,y,rr,a,color,fade,3);
  else if(u.motif==='collapse')ray(c,x,y,r*(1.3-p*.9),a,color,fade,2);
  else if(u.motif==='pulse'){
   c.save();c.translate(x,y);c.scale(1,.55);ring(c,0,0,r*(.2+p*.7+i*.07),color,fade/n*2,2);c.restore();
  }else{
   const b=a+TAU/n;
   line(c,x+Math.cos(a)*rr,y+Math.sin(a)*rr,x+Math.cos(b)*rr,y+Math.sin(b)*rr, u.motif==='ward'?3:1.5,color,fade);
   if(u.motif==='seal')ray(c,x,y,rr,a,color,fade*.5,1);
  }
 }
}


function drawCore(c,f,x,y,r,t,color,lite,reduced,e){
 const p=reduced?1:easeOut(clamp01(t/.32)), fade=Math.pow(1-t,1.3), drift=reduced?0:t;
 c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
 if(['fireball','blast','arcane','radiance','heal','revive','mana'].includes(f)&&!lite){
  const glow=c.createRadialGradient(x,y,0,x,y,r*.62);glow.addColorStop(0,rgba(color,fade*.35));glow.addColorStop(1,rgba(color,0));c.fillStyle=glow;c.fillRect(x-r*.62,y-r*.62,r*1.24,r*1.24);
 }
 if(SUPPORT_FAMILIES.has(f)){
  supportScene(c,f,x,y,r,t,color,lite,reduced,e);
 }else if(['gravity','doom','drain','steal','escape','survey'].includes(f)){
  utilityCore(c,f,x,y,r,t,color,lite,reduced,e);
 }else if(f==='cleave'){
  c.save();c.translate(x,y);drawCleave(c,e,t,r,color,lite,reduced);c.restore();
 }else if(['cut','flurry'].includes(f)){
  slashScene(c,e,x,y,r,t,color,lite,reduced);

 }else if(f==='impact'){
  heavyImpact(c,e,x,y,r,t,color,lite,reduced);
 }else if(['pierce','projectile'].includes(f)){
  const n=f==='projectile'&&e.all?3:1;
  for(let i=0;i<n;i++){const dx=(i-(n-1)/2)*12;line(c,x+dx+(f==='projectile'?r:0),y+r,x+dx*(1-p),y+r*(1-p),5,color,fade*.6);}
  star4(c,x,y,r*.23,'#fffdf4',fade);
 }else if(f==='firePillar'){
  firePillar(c,x,y,r,t,lite,reduced,e);
 }else if(f==='ice'){
  for(let i=0;i<(lite?3:7);i++){
   const a=-Math.PI/2+(i-3)*.31,dx=Math.cos(a)*r,dy=Math.sin(a)*r,xx=x+dx*(1-p),yy=y+dy*(1-p);
   line(c,x+dx,y+dy,xx,yy,2,color,fade*.6);
   c.globalAlpha=fade;c.fillStyle=i%2?color:'#edfaff';c.beginPath();c.moveTo(xx,yy-12);c.lineTo(xx+5,yy);c.lineTo(xx,yy+8);c.lineTo(xx-4,yy);c.closePath();c.fill();
  }
  star4(c,x,y,r*.3,'#f1fdff',fade);
 }else if(f==='wave'){
  for(let i=0;i<(lite?2:4);i++){
   c.globalAlpha=fade*(1-i*.16);c.strokeStyle=color;c.lineWidth=4-i*.6;c.beginPath();
   for(let j=0;j<=12;j++){const px=x-r+j*r/6,py=y+(i-1.5)*9+Math.sin(j*.7-drift*7)*r*.16*p;j?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();
  }
 }else if(f==='gale'){
  for(let i=0;i<(lite?3:6);i++){
   const dy=(i-2.5)*r*.16,front=x-r+2*r*p;c.globalAlpha=fade;c.strokeStyle=i%2?color:'#e2fff0';c.lineWidth=i%3?2:4;c.beginPath();c.moveTo(front-r*.8,y+dy+r*.2);c.bezierCurveTo(front-r*.25,y+dy-r*.5,front+r*.15,y+dy+r*.3,front+r*.5,y+dy-r*.1);c.stroke();
  }
 }else if(f==='lightning'){
  const n=lite?1:3;
  for(let k=0;k<n;k++){c.globalAlpha=fade;c.strokeStyle=k?'#fff9ff':color;c.lineWidth=k?1.5:5;c.beginPath();
   for(let i=0;i<7;i++){const xx=x+(i%2?1:-1)*r*.13+(k-1)*5,yy=y-r+i*r/5;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.stroke();}
 }else if(['stone','quake'].includes(f)){
  c.globalCompositeOperation='source-over';
  for(let i=0;i<(lite?3:6);i++){
   const xx=x+(i-2.5)*r*.28,h=r*(.3+r01(i,e.seed)*.5)*p;c.globalAlpha=fade;c.fillStyle=i%2?color:'#6b6058';c.beginPath();c.moveTo(xx-9,y+r*.3);c.lineTo(xx-5,y+r*.3-h);c.lineTo(xx+5,y+r*.3-h-8);c.lineTo(xx+11,y+r*.3);c.closePath();c.fill();
  }
  if(f==='quake')for(let i=0;i<4;i++)ray(c,x,y+r*.3,r,Math.PI*i/2+.2,'#e6cc9e',fade,2);
 }else if(f==='radiance'){
  for(let i=0;i<(lite?2:5);i++){const xx=x+(i-2)*r*.24;line(c,xx,y-r,xx,y+r*.4,3+i%2*3,color,fade*.65);}
  star4(c,x,y,r*.34,'#fffdf0',fade);
 }else if(['void','gravity','doom'].includes(f)){
  for(let i=0;i<(lite?2:4);i++)ring(c,x,y,r*(.2+(1-p)*.7+i*.12),color,fade,2);
  if(f==='doom'){line(c,x-r*.25,y-r*.3,x+r*.25,y+r*.3,2,color,fade);line(c,x+r*.25,y-r*.3,x-r*.25,y+r*.3,2,color,fade);}
  if(f==='gravity')for(let i=0;i<4;i++)ray(c,x,y,r*(1-p*.5),i*TAU/4,color,fade,3);
 }else if(['heal','revive','purify','mana'].includes(f)){
  const yy=y-drift*r*.35;
  if(f==='heal'||f==='revive'){line(c,x,yy-r*.17,x,yy+r*.17,4,color,fade);line(c,x-r*.17,yy,x+r*.17,yy,4,color,fade);}
  else star4(c,x,yy,r*.24,color,fade);
  ring(c,x,yy,r*(.28+p*.18),color,fade*.7,1.5);
  if(f==='revive')for(let i=0;i<(lite?3:7);i++)line(c,x+(i-3)*8,y+r*.4,x+(i-3)*8,y-r*p,1,color,fade*.6);
 }else if(['ward','empower','charge'].includes(f)){
  if(f==='ward')for(let k=0;k<2;k++){c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=2;c.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6-Math.PI/2,rr=r*(.4+k*.15);i?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}if(k===0){c.fillStyle=color;c.globalAlpha=fade*.1;c.fill();c.globalAlpha=fade;}c.stroke();}
  else for(let i=0;i<(lite?3:6);i++){const a=i*TAU/(lite?3:6);ray(c,x,y,r*(f==='charge'?.8-p*.4:.35+p*.35),a,color,fade,2);}
  if(f==='empower')for(let i=0;i<3;i++){const yy=y+r*.3-i*r*.28-drift*12;line(c,x-r*.16,yy,x,yy-r*.14,2.5,color,fade);line(c,x,yy-r*.14,x+r*.16,yy,2.5,color,fade);}
 }else if(['drain','steal'].includes(f)){
  for(let i=0;i<(lite?3:7);i++){const q=reduced?.5:clamp01(t*1.3-i*.035);const xx=x-r*.7*q,yy=y+r*.45*q;star4(c,xx,yy,(i%2?3:5),color,fade);}
  ring(c,x,y,r*.3,color,fade*.6,1.5);
 }else if(['poison','illusion','sleep','escape'].includes(f)){
  for(let i=0;i<(lite?3:7);i++){const xx=x+(r01(i,e.seed)-.5)*r,yy=y+(r01(i+9,e.seed)-.5)*r-drift*12;c.globalAlpha=fade*.25;c.fillStyle=color;c.beginPath();c.ellipse(xx,yy,10+i%3*4,5+i%2*4,0,0,TAU);c.fill();}
  if(f==='sleep')for(let i=0;i<3;i++)ring(c,x+(i-1)*10,y-r*.3-drift*16,r*.1,color,fade,1);
 }else if(f==='paralyze'){
  for(let k=0;k<(lite?2:4);k++){const a=k*TAU/4;ray(c,x,y,r*.65,a,'#e7dd94',fade,2);star4(c,x+Math.cos(a)*r*.5,y+Math.sin(a)*r*.5,5,'#fff4ba',fade);}
 }else if(['seal','weaken','dispel'].includes(f)){
  const d=r*.5*(f==='dispel'?1+p*.5:1);
  for(let i=0;i<4;i++){const a=i*TAU/4;ray(c,x,y,d,a+Math.PI/4,color,fade,2);}
  ring(c,x,y,r*.25,color,fade,1.3);
  if(f==='weaken')line(c,x,y-r*.25,x,y+r*.3,3,color,fade);
 }else if(f==='survey'){
  ring(c,x,y,r*(.2+p*.7),color,fade,1.5);star4(c,x,y,r*.2,'#d6f5f7',fade);
 }else{
  ring(c,x,y,r*(.2+p*.45),color,fade,2);star4(c,x,y,r*.3,'#eee6ff',fade);sparks(c,e.seed,8,x,y,r*.7,drift,color,lite);
 }
}
function accent(c,e,t,x,y,r,color,lite,reduced){
 const u=e.signature?.ultimate;
 if(u){
  const fade=Math.pow(1-t,1.2),p=reduced?.65:easeOut(t),n=u.count;
  c.save();c.translate(x,y);c.rotate(u.phase*Math.PI);
  for(let i=0;i<n;i++){
   const a=i*TAU/n,rr=r*(.3+p*.65);
   if(u.motif==='fort'||u.motif==='seal'){
    const xx=Math.cos(a)*rr,yy=Math.sin(a)*rr;
    line(c,xx,yy,Math.cos(a+TAU/n)*rr,Math.sin(a+TAU/n)*rr,2,color,fade);
    if(u.motif==='fort')line(c,xx,yy,xx,yy-r*.35,3,color,fade);
    else ray(c,0,0,rr,a,color,fade*.6,1);
   }else if(u.motif==='rays'||u.motif==='fall'){
    const xx=(i-(n-1)/2)*r*.16;line(c,xx,-r,xx,r*p,3,color,fade);
   }else if(u.motif==='horizon')line(c,-r,r*(i-.5)*.08,r,r*(i-.5)*.08,2,color,fade);
   else if(u.motif==='star')star4(c,Math.cos(a)*rr,Math.sin(a)*rr,r*.12,color,fade);
   else if(u.motif==='fracture')ray(c,0,0,rr,a,color,fade,3);
   else ring(c,Math.cos(a)*r*.25,Math.sin(a)*r*.25,r*(u.motif==='collapse'?.9-p*.7:.2+p*.5),color,fade,1.5);
  }
  c.restore();return;
 }
 const a=e.signature?.accent;if(!a)return;
 const fade=Math.pow(1-t,1.4), p=reduced?.5:easeOut(t), n=lite?3:6;
 if(['fall','rays','rain'].includes(a))for(let i=0;i<n;i++)line(c,x+(i-(n-1)/2)*r*.18,y-r,x+(i-(n-1)/2)*r*.18,y-r+(r*1.7)*clamp01(p*2-i*.05),1,color,fade*.65);
 else if(['cross','return','crescent'].includes(a)){
  trace(c,x,y,r*.85,clamp01(t*1.3),color,a==='cross'?.7:-.7,1.5);
  if(a!=='crescent')trace(c,x,y,r*.85,clamp01((t-.08)*1.5),color,.7,1.5);
 }else if(['seal','lattice'].includes(a)){
  c.globalAlpha=fade*.7;c.strokeStyle=color;c.lineWidth=1;c.beginPath();
  for(let i=0;i<=6;i++){const an=i*TAU/6,rr=r*.8;i?c.lineTo(x+Math.cos(an)*rr,y+Math.sin(an)*rr):c.moveTo(x+Math.cos(an)*rr,y+Math.sin(an)*rr);}c.stroke();
  if(!lite)for(let i=0;i<3;i++)ray(c,x,y,r*.8,i*TAU/3,color,fade*.5,1);
 }else if(a==='mist')sparks(c,e.seed,7,x,y,r*.8,reduced?.2:t,color,lite);
 else if(a==='fracture')for(let i=0;i<n;i++)ray(c,x,y,r*(.4+p*.5),i*TAU/n,color,fade,1.3);
 else if(a==='bloom')for(let i=0;i<n;i++)star4(c,x+Math.cos(i*TAU/n)*r*.6,y+Math.sin(i*TAU/n)*r*.6,3,color,fade);
 else for(let i=0;i<(lite?1:3);i++)ring(c,x,y,r*(a==='collapse'?.8-p*.5+i*.12:.35+p*.4+i*.12),color,fade*.6,1.2);
}
export function drawSkillScene(c,e,t,w,h,reduced){
 const lite=fxLite(reduced), pts=e.pts||[], f=e.design.family;
 const color=(f==='cleave'?e.col:null)||(e.design.slashRank&&e.element?({fire:'#ff493b',water:'#368cff',wind:'#73e8b2',earth:'#d4a15c',light:'#ffe797',dark:'#ac72ee'}[e.element]):null)||e.col||e.signature?.tone||COLORS[f]||'#c9b6ec', scale=e.design.scale||1, radius=(e.all?Math.min(100,Math.max(36,e.w*.34)):70)*scale;



 const x=e.x,y=e.y;
 c.save();
 const anchors=e.primaryPts||pts;
 if(f==='cut'&&!e.strikes?.length){
  c.save();if(e.all){c.translate(x,y);c.scale(Math.min(2.6,Math.max(1,e.w/(radius*2))),1);slashScene(c,e,0,0,radius,t,color,lite,reduced);}else slashScene(c,e,x,y,radius,t,color,lite,reduced);c.restore();
 }else if(MYSTIC_FAMILIES.includes(f)){
  drawMysticFx(c,e,t,w,h,lite,reduced);
 }else if(f==='fireball'||f==='blast'){
  drawThermalFx(c,e,t,w,h,lite,reduced);
 }else if(e.strikes?.length){
  // 各命中を独立した時間枠にする。軽量・動き低減でも打数を間引かない。
  const position=t*e.strikes.length,index=Math.min(e.strikes.length-1,Math.floor(position)),q=position-index;
  const point=e.strikes[index];
  if(f==='projectile')line(c,point.x+radius*(reduced?.25:1-q),point.y+radius*(reduced?.25:1-q),point.x,point.y,3,color,1-q);
  else trace(c,point.x,point.y,radius,reduced?.15:q,color,index%2?.65:-.65,3);
 }else if(f==='firePillar' && e.design.tier===3){
  fireVortex(c,e,t,w,h,lite,reduced);
 }else if((e.all&&f==='radiance')||(!e.all&&anchors.length>1&&['flurry','projectile'].includes(f))){
  for(let i=0;i<Math.min(anchors.length,lite?4:8);i++){
   const p=anchors[i];
   if(f==='flurry')trace(c,p.x,p.y,radius*.65,clamp01((t-i*.035)*1.2),color,i%2?.65:-.65,2.5);
   else if(f==='projectile')line(c,p.x+radius*.6,p.y+radius,p.x,p.y,2,color,1-t);
   else line(c,p.x,p.y+radius*.25,p.x,p.y-radius*(reduced?1:easeOut(clamp01(t/.3))),5,color,Math.pow(1-t,1.3));
  }
 }else{
  c.save();
  if(e.all){c.translate(x,y);c.scale(Math.min(2.6,Math.max(1,e.w/(radius*2))),1);drawCore(c,f,0,0,radius,t,color,lite,reduced,e);}
  else drawCore(c,f,x,y,radius,t,color,lite,reduced,e);
  c.restore();
 }
 if(!e.design.slashUltimate){
 if(e.ultimate&&!e.strikes?.length)ultimate(c,e,t,x,y,radius,color,lite,reduced);
 else if(!e.strikes?.length||e.signature?.ultimate)accent(c,e,t,x,y,radius,color,lite,reduced);

 }

 if(e.source && (['drain','steal','mana'].includes(f)||e.hasDrain)){
  const from=f==='mana'?e.source:{x,y},to=f==='mana'?{x,y}:e.source;
  for(let i=0;i<(lite?2:5);i++){
   const q=reduced?(i+1)/6:clamp01(t*1.5-i*.08),px=from.x+(to.x-from.x)*q,py=from.y+(to.y-from.y)*q;
   star4(c,px,py,3,e.hasDrain?'#dc9fbb':color,(1-t)*.8);
  }
 }
 // 全体技は大演出を一枚。対象ごとは小さな命中光・作用の印に抑える。
 if(e.all||e.marks)for(let i=0;i<Math.min(pts.length,FX_LIMITS.targets);i++){
  const p=pts[i],fade=1-t, rr=(e.all?6:4)*scale;
  if(p.mark==='heal'||p.mark==='revive'){line(c,p.x-rr,p.y,p.x+rr,p.y,2,'#a3edbf',fade);line(c,p.x,p.y-rr,p.x,p.y+rr,2,'#a3edbf',fade);}
  else if(p.mark==='ward')ring(c,p.x,p.y,rr+3,'#c6e7ff',fade,1.5);
  else if(p.mark==='purify')star4(c,p.x,p.y,rr+2,'#c6f4f6',fade);
  else star4(c,p.x,p.y,rr,color,fade*.8);
  if(p.weak){const yy=p.y+rr+8;line(c,p.x-5,yy,p.x,yy+5,1.5,'#ccb1e8',fade);line(c,p.x,yy+5,p.x+5,yy,1.5,'#ccb1e8',fade);}
  if(p.status){
   const yy=p.y-rr-9, tint=p.status==='poison'?'#a8bd7a':p.status==='para'?'#f1e6a4':'#cfb2ed';
   if(p.status==='para'){line(c,p.x-3,yy-4,p.x+3,yy,1.5,tint,fade);line(c,p.x+3,yy,p.x-2,yy+4,1.5,tint,fade);}
   else ring(c,p.x,yy,4,tint,fade,1.5);
  }
 }
 c.restore();
}
export function emitSkillFx(list,key,spell,hits,locate,now,spd=1,options={}){
 const baseDesign=SKILL_FX_CATALOG[key];if(!baseDesign)return false;
 const combo=Math.max(spell.hits||1,spell.scatter||1)>1;
 const strikes=[];
 const points=[],seen=new Map();let hitCount=0;
 for(const hit of hits||[]){
  if(!hit?.target||hit.miss||hit.immune)continue;
  const impact=locate(hit.target);
  if(combo&&hit.dmg!=null&&impact)strikes.push({x:impact.x,y:impact.y});
  hitCount++;const uid=hit.target.side+':'+hit.target.uid;
  if(seen.has(uid)){const point=seen.get(uid);point.status ||= statusFxKind(hit.status);point.weak ||= !!hit.debuff;continue;}
  const p=locate(hit.target);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const point={x:p.x,y:p.y,side:hit.target.side,status:statusFxKind(hit.status),weak:!!hit.debuff,mark:hit.heal!=null?(spell.revive?'revive':'heal'):hit.cured?'purify':hit.buff?'ward':null};
  seen.set(uid,point);points.push(point);
  if(points.length>=FX_LIMITS.targets)break;
 }
 if(!points.length)return true;
 const all=['all-enemy','all-ally'].includes(spell.target),enemy=['enemy','all-enemy'].includes(spell.target);
 const primary=points.filter(p=>(p.side==='enemy')===enemy), anchors=primary.length?primary:[points[0]],xs=anchors.map(p=>p.x),ys=anchors.map(p=>p.y);
 const x=all?(Math.min(...xs)+Math.max(...xs))/2:anchors[0].x,y=all?ys.reduce((a,b)=>a+b,0)/anchors.length:anchors[0].y;
 const design={...baseDesign,combo:strikes.length,ultimate:!!SKILL_FX_SIGNATURES[key]?.ultimate};
 list.unshift({type:'skillScene',strikes,design,element:spell.element||null,ultimate:SKILL_FX_ULTIMATES[key]||null,source:options.source||null,hasDrain:!!(spell.drain||spell.mpDrain)&&(hits||[]).some(h=>h.lifesteal>0||h.mpHeal>0||h.heal>0),signature:SKILL_FX_SIGNATURES[key]||null,pts:points,primaryPts:anchors,col:spell.element?(baseDesign.family==='cleave'?CLEAVE_COLORS[spell.element]:{fire:'#ff4938',water:'#439fff',wind:'#89dfae',earth:'#ca9a65',light:'#ffe297',dark:'#a47bdd'}[spell.element]||FX.elCol(spell.element)[1]):null,all,marks:true,x,y,w:Math.max(...xs)-Math.min(...xs)+80,t0:now,dur:skillFxDuration(design,spd,options),seed:17,hitCount});



 if(list.length>FX_LIMITS.effects)list.length=FX_LIMITS.effects;
 return true;
}
registerFx({skillScene:drawSkillScene},{skillScene:300});

// 材質のある主演出。18コマの濃淡と系統ごとの軌道で、発生・作用・余韻を描く。
// 一手の時間、対象、乱数、音、結果の確定は呼出し元が管理する。
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-(1-clamp(v))**3;
const families='cut cleave flurry impact pierce projectile fireball blast ice wave gale lightning stone quake radiance void arcane heal revive purify ward mana empower charge weaken dispel seal paralyze poison illusion sleep gravity doom drain steal escape survey'.split(' ');
export const MATERIAL_FAMILIES=Object.freeze(families);
const rows={ribbon:0,pressure:1,crystal:2,water:3,wind:4,shadow:5,light:6,life:7,venom:8,stone:9};
const image=typeof Image==='undefined'?null:new Image();
const tinted=new Map(); // 色付きの帯だけを最大12枚（約8MB）保持する。
function colored(kind,tone){
 if(!tone||!image?.complete||!image.naturalWidth)return null;
 const key=kind+tone;if(tinted.has(key))return tinted.get(key);
 const canvas=document.createElement('canvas');canvas.width=576;canvas.height=288;const ctx=canvas.getContext('2d');
 ctx.drawImage(image,0,rows[kind]*288,576,288,0,0,576,288);
 ctx.globalCompositeOperation='multiply';ctx.fillStyle=tone;ctx.fillRect(0,0,576,288);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,rows[kind]*288,576,288,0,0,576,288);
 if(tinted.size>=12)tinted.delete(tinted.keys().next().value);tinted.set(key,canvas);return canvas;
}
if(image)image.src=new URL('../art/effects/skill-materials.webp',import.meta.url).href;
function noise(i,seed=17){let x=Math.imul(i+seed,374761393);x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
function stroke(c,points,color,alpha,width=2){
 c.globalAlpha=clamp(alpha);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
 points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
function light(c,x,y,r,color,alpha){
 if(r<=0)return;c.globalAlpha=clamp(alpha);const g=c.createRadialGradient(x,y,0,x,y,r);
 g.addColorStop(0,color);g.addColorStop(.22,color+'aa');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
// 素材の準備前・取得失敗時にも、軌道と作用点は同じ場所へ描く。
function material(c,kind,x,y,w,h,angle,t,alpha,lite,tone=null){
 if(w<=0||h<=0||alpha<=0)return;
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=clamp(alpha);
 if(image?.complete&&image.naturalWidth){
  const texture=colored(kind,tone)||image,row=texture===image?rows[kind]*3:0;
  const frame=((t*17)%18+18)%18,first=Math.floor(frame),blend=frame-first;
  for(let k=0;k<(lite?1:2);k++){
   const index=(first+k)%18;c.globalAlpha=clamp(alpha)*(lite?1:k?blend:1-blend);
   c.drawImage(texture,index%6*96,(row+Math.floor(index/6))*96,96,96,-w/2,-h/2,w,h);
  }
 }else{
  const color={shadow:'#ad79dd',venom:'#aabe72',life:'#a3edc3',stone:'#c9ab82',water:'#83cfff',wind:'#b6e7d6',light:'#ffeab4',crystal:'#c3f4ff',pressure:'#ffcf9c',ribbon:'#e8f8ff'}[kind];
  c.scale(1,h/w);light(c,0,0,w*.5,color,alpha);
 }
 c.restore();
}
function ring(c,x,y,r,flat,color,a,width=2){
 c.globalAlpha=clamp(a);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(.1,r),Math.max(.1,r*flat),0,0,TAU);c.stroke();
}
function mote(c,x,y,size,color,a){
 stroke(c,[[x-size,y],[x+size,y]],color,a,1.2);stroke(c,[[x,y-size],[x,y+size]],color,a,1.2);
}
// 補助粒子の合計は一つの主演出で18以下。連撃中は主軌道だけを繰り返す。
function debris(c,e,x,y,r,t,color,lite,reduced,up=false){
 if(reduced)return;
 const count=lite?4:Math.min(18,6+Math.min(3,e.design.tier)*4);
 for(let i=0;i<count;i++){
  const a=noise(i,e.seed)*TAU,q=clamp((t-noise(i+20,e.seed)*.2)/.8),d=r*(.15+q)*(.4+noise(i+50,e.seed));
  const xx=x+Math.cos(a)*d,yy=y+(up?-q*r:Math.sin(a)*d+q*q*r*.25);
  stroke(c,[[xx,yy],[xx-Math.cos(a)*3,yy+(up?5:-Math.sin(a)*3)]],color,Math.sin(q*Math.PI)*.7,1+i%2);
 }
}
function shard(c,x,y,w,h,angle,t,a,lite){
 c.save();c.translate(x,y);c.rotate(angle);
 // 面の明暗を分け、透明な芯と影の面を持つ氷にする。
 c.globalAlpha=a;c.fillStyle='#478aa5';c.beginPath();c.moveTo(-w*.4,h*.4);c.lineTo(-w*.18,-h*.35);c.lineTo(w*.1,-h*.6);c.lineTo(w*.4,h*.35);c.closePath();c.fill();
 c.fillStyle='#b3edf5';c.beginPath();c.moveTo(-w*.18,-h*.35);c.lineTo(w*.1,-h*.6);c.lineTo(w*.05,h*.3);c.lineTo(-w*.4,h*.4);c.closePath();c.fill();
 material(c,'crystal',0,0,w*1.8,h*1.4,0,t,a*.85,lite);
 stroke(c,[[w*.1,-h*.6],[w*.05,h*.3]],'#efffff',a,1.2);c.restore();
}
function bolt(c,x,y,r,angle,t,color,alpha,width){
 const points=[];for(let i=0;i<=9;i++){
  const d=r*i/9,j=i===0||i===9?0:Math.sin(i*8.3+Math.floor(t*7))*r*.075;
  points.push([x+Math.cos(angle)*d-Math.sin(angle)*j,y+Math.sin(angle)*d+Math.cos(angle)*j]);
 }
 stroke(c,points,color,alpha*.3,width*3);stroke(c,points,color,alpha,width);stroke(c,points,'#f9fcff',alpha,width*.3);
}
// 系統の色に加え、物の厚み・流れる方向・密度・破砕の仕方を変える。
export function drawMaterialSkill(c,e,t,w,h,lite,reduced){
 const f=e.design.family;if(!families.includes(f))return false;
 const detail=Math.min(5,Math.max(1,e.design.tier)),rank=Math.min(3,detail),x=e.x;let y=e.y;
 const q=reduced?.4:clamp(t),grow=ease(q/.3),tail=(1-t)**.7,crest=Math.sin(Math.PI*clamp(t));
 const color=e.col||e.signature?.tone||({cut:'#dcf4ff',cleave:'#d8eaff',flurry:'#e5e7ff',impact:'#e8bc82',pierce:'#f1f4ff',projectile:'#b6eaff',fireball:'#ffae58',blast:'#ffb76b',ice:'#b2edff',wave:'#67c9ff',gale:'#b0ebcf',lightning:'#e3dcff',stone:'#d2b58c',quake:'#c2a078',radiance:'#ffe4a4',void:'#b483e3',arcane:'#bea9ff',heal:'#9df1c4',revive:'#ffe7ac',purify:'#acf1ef',ward:'#b2d8ff',mana:'#9ccfff',empower:'#f2cd8c',charge:'#edd3a4',weaken:'#bda1d9',dispel:'#dae3fa',seal:'#cda2ea',paralyze:'#f0e0a3',poison:'#b4c97b',illusion:'#d4b5eb',sleep:'#b3c2ef',gravity:'#b39be5',doom:'#dc99bd',drain:'#cb9bce',steal:'#ecd89b',escape:'#b9c4db',survey:'#abedf1'}[f]);
 const span=e.all?Math.min(w*.46,Math.max(100,(e.w||80)*.58)):65;
 const full=rank===3&&['ice','wave','gale','lightning','stone','quake'].includes(f)&&!e.design.combo;
 const r=(full?Math.max(w,h)*.55:Math.max(span,rank===3?105:rank===2?82:62))*(e.design.scale||1);
 if(e.primaryPts?.length&&e.primaryPts.every(p=>p.side==='party'))y=Math.min(y,h-r*.6);
 c.save();c.globalCompositeOperation='lighter';
 if(full){
  c.globalAlpha=tail*.09;c.fillStyle=color;c.fillRect(0,0,w,h);
  const kind={ice:'crystal',wave:'water',gale:'wind',lightning:'light',stone:'stone',quake:'stone'}[f];
  material(c,kind,w*.5,h*.5,w*1.25,h*1.25,0,q,tail*.2,lite);
 }
 if(['cut','cleave','flurry'].includes(f)){
  const count=e.design.combo?1:f==='cut'?detail:f==='cleave'?rank+1:rank+2;
  material(c,'pressure',x,y,r*.55,r*.22,0,q,tail*.35,lite);
  for(let i=0;i<count;i++){
   const p=reduced?.5:clamp((q-i*.09)/(.65-i*.07));if(p<=0)continue;
   const angle=f==='cleave'?(i%2?-.18:Math.PI+.18):(i%2?.65:-.65)+i*.08;
   c.save();c.translate(x,y);c.rotate(angle);
   // 彗星状の帯を振り抜き、白い芯の後ろへ材質のある残像が遅れて走る。
   const front=-r+r*2*ease(p/.65);
   material(c,'ribbon',front-r*.35,0,r*1.9,r*(f==='cleave'?.6:.36),0,q+i*.12,tail*(1-p*.45),lite,e.element?color:null);
   stroke(c,[[Math.max(-r,front-r*.7),-r*.03],[front,r*.03]],color,tail,rank+1);
   if(rank>=2)material(c,'ribbon',front-r*.5,r*.13,r*1.4,r*.2,0,q+.4,tail*.35,lite,e.element?color:null);
   c.restore();
  }
  material(c,'light',x,y,r*.6,r*.45,0,q,crest*.5,lite);
 }else if(f==='impact'){
  const p=ease(q/.22),compress=1-Math.min(1,q/.15);
  material(c,'pressure',x,y,r*(.8+p*1.7),r*(.4+p*.8),0,q,tail,lite);
  material(c,'stone',x,y+r*.2,r*(.5+p*1.6),r*.65,0,q,tail*.55,lite);
  light(c,x,y,r*(.12+compress*.22),'#fff0d5',tail*.8);
  for(let i=0;i<rank+2;i++){
   const a=i*TAU/(rank+2)+.2;
   stroke(c,[[x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2],[x+Math.cos(a)*r*.6*p,y+Math.sin(a)*r*.6*p],[x+Math.cos(a+.15)*r*p,y+Math.sin(a+.15)*r*p]],color,tail*.7,rank);
  }
  if(detail>=4)for(let i=0;i<detail-2;i++){
   const p=clamp((q-i*.12)/.65);material(c,'pressure',x+(i-(detail-3)/2)*r*.3,y,r*(.7+p*1.3),r*(.3+p*.5),i*.2,q+i*.2,tail*.4,lite,e.element?color:null);
  }
 }else if(f==='pierce'||f==='projectile'){
  const n=f==='pierce'?rank:rank*2-1;
  for(let i=0;i<n;i++){
   const p=reduced?.7:clamp((q-i*.055)/.5),dx=(i-(n-1)/2)*r*.2,front=y+r*(1-p*2);
   material(c,'ribbon',x+dx,front+r*.2,r*1.7,r*.25,-Math.PI/2,q+i*.15,tail,lite);
   stroke(c,[[x+dx,front+r*.7],[x+dx*.3,front]],'#f0fbff',tail,rank);
   material(c,'pressure',x+dx*.3,y,r*.5,r*.25,0,q,crest*.6,lite);
  }
 }else if(f==='fireball'||f==='blast'){
  // 炎の専用アトラスの上に、圧力・煙・収束する光を組み合わせる。
  const n=f==='blast'?rank+1:rank;
  for(let i=0;i<n;i++){
   const p=ease((q-i*.07)/.45),a=i*TAU/n,dx=f==='blast'?Math.cos(a)*r*.25:Math.cos(a)*r*(1-p)*.8,dy=f==='blast'?Math.sin(a)*r*.18:-r*(1-p);
   material(c,'pressure',x+dx,y+dy,r*(.8+p),r*(.8+p),q*.4,q+i*.2,tail*.8,lite);
   light(c,x+dx,y+dy,r*.26,'#ffb95e',tail*.5);
  }
 }else if(f==='ice'){
  const n=lite?rank+2:rank*3+2;
  for(let i=0;i<n;i++){
   const a=i*TAU/n,delay=rank===1?0:i*.025,p=ease((q-delay)/.45),d=rank===1?(1-p)*r:rank===2?r*.6:r*(.4+noise(i)*.7);
   const xx=x+Math.cos(a)*d,yy=y+Math.sin(a)*d*.35+(rank===3?-r*(1-p)*.7:0);
   shard(c,xx,yy,r*.22,r*(.6+noise(i)*.45)*Math.max(.1,p),(i/n-.5)*.7,q,tail,lite);
  }
  material(c,'water',x,y+r*.28,r*2,r*.6,0,q,tail*.45,lite);
 }else if(f==='wave'){
  const n=rank===3?(lite?3:5):rank;
  for(let i=0;i<n;i++){
   const p=ease((q-i*.09)/.6),xx=x-r*(1-p)*1.2+i*r*.12,yy=y+(i-(n-1)/2)*r*.2;
   material(c,'water',xx,yy,r*(1.7+rank*.2),r*(.7+rank*.14),i%2?.1:-.1,q+i*.2,tail,lite);
   if(rank>=2)material(c,'water',x+r*(1-p),yy+r*.12,r*1.5,r*.65,Math.PI,q+.3,tail*.5,lite);
  }
 }else if(f==='gale'){
  const n=lite?rank+1:rank*2+1;
  for(let i=0;i<n;i++){
   const a=i*TAU/n+q*4,d=r*(rank===3?.6:.35),xx=x+Math.cos(a)*d,yy=y+Math.sin(a)*d*.4-q*r*.2;
   material(c,'wind',xx,yy,r*(1.4-i*.06),r*(rank===3?1.1:.65),a*.3,q+i*.1,tail*.75,lite);
  }
 }else if(f==='lightning'||f==='paralyze'){
  const n=f==='paralyze'?rank+1:rank*2-1;
  for(let i=0;i<n;i++){
   const a=f==='paralyze'?i*TAU/n:-Math.PI/2+(i-(n-1)/2)*.45;
   bolt(c,x-Math.cos(a)*r,y-Math.sin(a)*r,r,a,q,color,tail,f==='paralyze'?2:rank+1);
   if(rank>=2)bolt(c,x,y,r*.65,a+.7,q+.2,color,tail*.55,1.5);
  }
  material(c,'light',x,y,r,r,0,q,tail*.6,lite);
 }else if(f==='stone'||f==='quake'){
  const n=f==='stone'?rank+1:rank*2+1;
  c.globalCompositeOperation='source-over';
  for(let i=0;i<n;i++){
   const p=ease((q-i*.055)/.3),xx=x+(i-(n-1)/2)*r*.35,hh=r*(.5+noise(i)*.7)*p;
   if(f==='stone'){
    c.globalAlpha=tail;c.fillStyle=i%2?'#86715b':'#b79b77';c.beginPath();c.moveTo(xx-r*.18,y+r*.3);c.lineTo(xx-r*.25,y-hh*.5);c.lineTo(xx-r*.06,y-hh);c.lineTo(xx+r*.16,y-hh*.85);c.lineTo(xx+r*.24,y+r*.3);c.closePath();c.fill();
    material(c,'stone',xx,y-hh*.3,r*.65,hh*1.4,0,q,tail,lite);
   }else{
    const a=i*TAU/n;
    stroke(c,[[x,y],[x+Math.cos(a)*r*.4*p,y+Math.sin(a)*r*.2*p],[x+Math.cos(a+.2)*r*p,y+Math.sin(a+.2)*r*.45*p]],'#e0bb83',tail,rank+2);
   }
  }
  material(c,'stone',x,y+r*.3,r*2.6,r*.7,0,q,tail*.6,lite);
 }else if(['radiance','heal','revive','purify','mana','empower','charge','ward'].includes(f)){
  const kind=f==='heal'?'life':['purify','mana'].includes(f)?'water':'light';
  // 光は点滅させず、下から満ちる体積と重なった面を持つ。
  material(c,kind,x,y-r*.18,r*1.8,r*(1+grow),q*.2,q,tail*.85,lite);
  if(f==='mana'){
   for(let i=0;i<rank+2;i++){
    const a=i*TAU/(rank+2)+q*3,rr=r*(.5-.2*grow);
    material(c,'ribbon',x+Math.cos(a)*rr,y+Math.sin(a)*rr*.6-q*r*.2,r*.95,r*.3,a+Math.PI/2,q+i*.2,tail*.8,lite,'#67adff');
   }
   material(c,'water',x,y-r*.15,r*.6,r*1.4,-Math.PI/2,q,tail*.8,lite);
  }else if(f==='purify'){
   for(let i=0;i<rank+2;i++){
    const xx=x+(i-(rank+1)/2)*r*.35,yy=y-q*r*.7;
    material(c,'crystal',xx,yy,r*.45,r*.8,Math.PI/4,q+i*.2,tail*.7,lite);
    stroke(c,[[xx,yy+r*.35],[xx,yy-r*.45]],'#e1fcff',tail*.8,1.2);
   }
   material(c,'water',x,y+r*.1,r*1.9,r*.4,0,q,tail*.7,lite);
  }else if(f==='revive'){
   c.globalAlpha=tail*.7;c.strokeStyle='#ffedbd';c.lineWidth=2+rank;c.beginPath();
   c.moveTo(x-r*.5,y+r*.4);c.lineTo(x-r*.5,y-r*.5*grow);
   c.bezierCurveTo(x-r*.5,y-r*1.6*grow,x+r*.5,y-r*1.6*grow,x+r*.5,y-r*.5*grow);c.lineTo(x+r*.5,y+r*.4);c.stroke();
   for(const side of [-1,1])material(c,'light',x+side*r*.5,y-r*.4,r*.5,r*2.3,0,q,tail*.7,lite);
   material(c,'light',x,y-r*.25-q*r*.4,r*.65,r*.9,0,q,tail,lite);
  }else if(f==='radiance'){
   for(let i=0;i<rank+1;i++){
    const xx=x+(i-rank/2)*r*.36,p=ease((q-i*.045)/.4);
    material(c,'light',xx,y-r*.6,r*.7,r*2.8*p,0,q+i*.1,tail*.6,lite);
    stroke(c,[[xx,y+r*.3],[xx,y-r*1.1*p]],'#fff6d5',tail*.6,rank);
   }
  }else if(f==='ward'){
   const n=rank+1;
   for(let k=0;k<n;k++){
    const rr=r*(.5+k*.17)*grow,points=[];
    for(let i=0;i<=6;i++){const a=i*TAU/6-Math.PI/2;points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}
    c.globalAlpha=tail*.07;c.fillStyle=color;c.beginPath();points.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.fill();stroke(c,points,color,tail*.6,1.5);
    material(c,'crystal',x,y,rr*1.8,rr*1.8,q*.15,q,tail*.2,lite);
   }
  }else if(f==='empower'){
   for(let i=0;i<rank+1;i++){
    const yy=y+r*.3-i*r*.35-q*r*.35;
    stroke(c,[[x-r*.3,yy],[x,yy-r*.22],[x+r*.3,yy]],'#ffe4a6',tail,2+rank*.5);
    material(c,'ribbon',x,yy,r*1.2,r*.3,0,q+i*.2,tail*.65,lite,'#ffcd78');
   }
  }else if(f==='charge'){
   for(let i=0;i<rank+2;i++){
    const a=i*TAU/(rank+2)+q,d=r*(1-.65*grow);
    material(c,'ribbon',x+Math.cos(a)*d,y+Math.sin(a)*d,r*.8,r*.2,a+Math.PI,q,tail*.65,lite);
   }
  }else{
   for(let i=0;i<(lite?rank+1:rank+3);i++){
    const a=i*TAU/(rank+3)+q*.8,d=r*(.2+grow*.5),yy=y+Math.sin(a)*r*.2-q*r*.5;
    material(c,kind,x+Math.cos(a)*d,yy,r*.6,r*.9,-a,q+i*.17,tail*.7,lite);
   }
  }
  ring(c,x,y+r*.3,r*(.4+grow*.3),.22,color,tail*.55,1.5);
 }else if(['void','gravity','doom','drain','steal'].includes(f)){
  const inward=1-ease(q/.75),n=lite?rank+1:rank+3;
  for(let i=0;i<n;i++){
   const a=i*TAU/n+q*(f==='gravity'?-2:3),d=r*(.25+inward*.6);
   material(c,f==='steal'?'ribbon':'shadow',x+Math.cos(a)*d,y+Math.sin(a)*d*.65,r*1.25,r*.75,a,q+i*.13,tail*.7,lite);
  }
  if(f==='void'||f==='gravity'){
   c.globalCompositeOperation='source-over';light(c,x,y,r*.45,'#160e22',tail*.9);c.globalCompositeOperation='lighter';
   material(c,'shadow',x,y,r*1.2,r*1.2,-q,q,tail,lite);
  }
  if(f==='doom'){
   const rr=r*.6*grow;stroke(c,[[x-rr*.4,y-rr],[x+rr*.4,y+rr],[x-rr*.4,y+rr],[x+rr*.4,y-rr]],'#e3b9d6',tail,2);
   material(c,'shadow',x,y-r*.2,r*1.4,r*1.9,0,q,tail*.6,lite);
  }
 }else if(f==='arcane'||f==='survey'){
  const n=f==='survey'?rank+1:rank+3;
  for(let i=0;i<n;i++){
   const a=i*TAU/n+q*(f==='survey'?.6:2),d=r*(.2+grow*.5);
   material(c,f==='survey'?'wind':'shadow',x+Math.cos(a)*d,y+Math.sin(a)*d*.45,r*1.1,r*.65,a,q+i*.14,tail*.65,lite);
   if(f==='arcane')stroke(c,[[x,y],[x+Math.cos(a)*d,y+Math.sin(a)*d*.45]],color,tail*.35,1);
  }
  material(c,'light',x,y,r*.7,r*.7,0,q,tail*.6,lite);
 }else if(['poison','illusion','sleep','escape'].includes(f)){
  const n=lite?rank+1:rank+3,kind=f==='poison'?'venom':f==='escape'?'wind':'shadow';
  c.globalCompositeOperation='source-over';
  for(let i=0;i<n;i++){
   const a=i*2.4,xx=x+Math.cos(a)*r*.4+Math.sin(q*3+i)*r*.1,yy=y+Math.sin(a)*r*.15-q*r*.45;
   material(c,kind,xx,yy,r*(1.2+noise(i)*.5),r*(.8+noise(i+7)*.5),i*.8,q+i*.17,tail*.65,lite);
  }
  c.globalCompositeOperation='lighter';
  if(f==='sleep')for(let i=0;i<rank+1;i++)ring(c,x+Math.cos(i*2)*r*.3,y-r*.2-i*r*.18-q*r*.2,r*.1,.6,color,tail*.7,1.5);
  if(f==='illusion')material(c,'crystal',x,y,r*1.5,r*.8,q,q,tail*.3,lite);
 }else if(['weaken','dispel','seal'].includes(f)){
  material(c,'shadow',x,y,r*1.8,r*1.8,q*.5,q,tail*.7,lite);
  const n=rank+3;
  for(let i=0;i<n;i++){
   const a=i*TAU/n,rr=r*(f==='dispel'?.4+grow*.7:.8-grow*.2),next=a+TAU/n;
   stroke(c,[[x+Math.cos(a)*rr,y+Math.sin(a)*rr],[x+Math.cos(next)*rr,y+Math.sin(next)*rr]],color,tail*.8,rank);
   if(f==='dispel')material(c,'crystal',x+Math.cos(a)*rr,y+Math.sin(a)*rr,r*.35,r*.5,a,q,tail*.7,lite);
   if(f==='seal')stroke(c,[[x+Math.cos(a)*rr,y+Math.sin(a)*rr],[x+Math.cos(a+Math.PI)*rr,y+Math.sin(a+Math.PI)*rr]],color,tail*.4,1);
  }
  if(f==='weaken')for(let i=0;i<rank;i++){
   const yy=y+(i-(rank-1)/2)*r*.35+q*r*.2;stroke(c,[[x-r*.2,yy-r*.12],[x,yy+r*.1],[x+r*.2,yy-r*.12]],color,tail,2);
  }
 }
 if(!e.design.combo)debris(c,e,x,y,r,q,color,lite,reduced,['heal','revive','purify','empower','mana'].includes(f));
 c.restore();return true;
}

// 火球・爆発の格ごとの演出。素材は起動時に読み、失敗しても熱の光で知らせる。
const textures={};
for(const kind of ['fireball','blast'])if(typeof Image!=='undefined'){
 const img=new Image();img.src=new URL(`../art/effects/${kind}.webp`,import.meta.url).href;textures[kind]=img;
}
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>1-(1-clamp(t))**2;
function glow(c,x,y,r,alpha,color='#ff9e40'){
 c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);
 g.addColorStop(0,'#fff0c2');g.addColorStop(.25,color);g.addColorStop(1,'#ff450000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function sprite(c,kind,x,y,size,progress,alpha){
 const image=textures[kind];c.globalAlpha=alpha;
 if(image?.complete&&image.naturalWidth){
  const frame=Math.min(17,Math.floor(clamp(progress)*17));
  c.drawImage(image,frame%6*128,Math.floor(frame/6)*128,128,128,x-size/2,y-size/2,size,size);
 }else glow(c,x,y,size*.5,alpha);
}
function shock(c,x,y,r,q,alpha){
 // 太い輪郭線ではなく、薄い圧力の層を広げる。
 c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,Math.max(.1,r*.75),x,y,Math.max(.2,r));
 g.addColorStop(0,'#ffc27000');g.addColorStop(.65,`rgba(255,205,140,${(1-q)*.32})`);g.addColorStop(1,'#ff650000');
 c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function embers(c,e,t,r,lite,reduced){
 if(reduced)return;
 for(let i=0;i<(lite?4:12);i++){
  const a=i*2.399+e.seed, d=r*(.15+t)*( .55+(i%5)/8),x=e.x+Math.cos(a)*d,y=e.y+Math.sin(a)*d+t*t*r*.2;
  c.globalAlpha=(1-t)*.7;c.strokeStyle=i%3?'#ffa64a':'#fff0c9';c.lineWidth=1.3;
  c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(a)*5,y-Math.sin(a)*5);c.stroke();
 }
}
export function drawThermalFx(c,e,t,w,h,lite,reduced){
 const kind=e.design.family,rank=e.design.tier,fade=(1-t)**.8;
 const x=e.x,y=e.y,r=(rank===3?Math.min(w,h)*.7:rank===2?100:70)*e.design.scale;
 c.save();c.imageSmoothingEnabled=true;c.globalCompositeOperation='lighter';
 if(kind==='fireball'){
  // 基本は一発、上位は左右の火球が収束、最上位は戦場を横切る巨大な一撃。
  const impact=.42,flight=reduced?1:ease(t/impact),count=rank===2&&!reduced?3:1;
  const sx=e.source?.x??w*.5,sy=e.source?.y??h;
  for(let i=0;i<count;i++){
   const offset=(i-(count-1)/2)*r*.8*(1-flight),xx=sx+(x-sx)*flight+offset,yy=sy+(y-sy)*flight;
   if(t<impact||reduced){
    const size=r*(rank===3?1.35:rank===2?.85:1.0)*(reduced?.55:1);
    if(!reduced&&!lite)for(let k=3;k>=1;k--)sprite(c,'fireball',xx-(x-sx)*k*.045,yy-(y-sy)*k*.045,size*(1-k*.17),t+k*.1,fade*.12);
    sprite(c,'fireball',xx,yy,size,reduced?.45:t,fade);
   }
  }
  if(t>=impact||reduced){
   const q=reduced?.4:clamp((t-impact)/(1-impact));
   sprite(c,'fireball',x,y,r*(rank===3?1.8:rank===2?1:.7),q,fade*.55);
   sprite(c,'blast',x,y,r*(rank===3?3.6:rank===2?2.4:1.8),q,fade);
   shock(c,x,y,r*(.5+q*(rank===3?2.3:1.1)),q,fade);
  }
 }else{
  // 基本は局所の炸裂、上位は時間差の連鎖、最上位は中心爆発から戦場全体へ。
  const count=rank===3?(lite?5:9):rank===2?(lite?3:5):1;
  if(rank===3){
   c.globalCompositeOperation='source-over';c.globalAlpha=1;
   const atmosphere=c.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.max(w,h));
   atmosphere.addColorStop(0,`rgba(255,190,105,${fade*.24})`);atmosphere.addColorStop(1,`rgba(110,35,12,${fade*.18})`);
   c.fillStyle=atmosphere;c.fillRect(0,0,w,h);c.globalCompositeOperation='lighter';
  }
  for(let i=0;i<count;i++){
   const delay=i===0?0:(rank===3?.07:.10)*i,q=reduced?.45:clamp((t-delay)/(1-delay));
   if(t<delay&&!reduced)continue;
   const angle=i*2.399,spread=rank===3?Math.min(w,h)*.42:r*.58;
   const xx=i===0?(rank===3?w/2:x):x+Math.cos(angle)*spread, yy=i===0?(rank===3?h/2:y):y+Math.sin(angle)*spread*.7;
   sprite(c,'blast',xx,yy,(rank===3?Math.max(w,h)*1.2:r*2.4)*(i===0?1:.62),q,fade*(i===0?1:rank===3?.4:.65));
  }
  shock(c,rank===3?w/2:x,rank===3?h/2:y,rank===3?Math.max(w,h)*(.15+ease(t)*.8):r*(.1+ease(t)*1.5),t,fade);
 }
 embers(c,e,t,rank===3?Math.max(w,h)*.6:r,lite,reduced);c.restore();
}

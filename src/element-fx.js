// 六系統の材質・力の向きを描く。戦闘の結果やゲーム用乱数には触れない。
export const ELEMENT_FAMILIES=Object.freeze(['ice','wave','gale','lightning','stone','quake']);
const images={};
for(const key of ['flow','minerals'])if(typeof Image!=='undefined'){
 const image=new Image();image.src=new URL(`../art/effects/element-${key}.webp`,import.meta.url).href;images[key]=image;
}
const TAU=Math.PI*2,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>1-(1-clamp(t))**3;
function noise(i,seed=17){let n=Math.imul(i+seed,374761393);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function stroke(c,points,width,color,alpha){
 c.globalAlpha=clamp(alpha);c.lineWidth=width;c.strokeStyle=color;c.lineJoin='round';c.lineCap='round';c.beginPath();
 points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
function cloud(c,kind,x,y,w,h,t,alpha){
 const image=images.flow;c.globalAlpha=clamp(alpha);
 if(image?.complete&&image.naturalWidth){
  const frame=Math.floor(clamp(t)*17);c.drawImage(image,frame%6*128,(Math.floor(frame/6)+kind*3)*128,128,128,x-w/2,y-h/2,w,h);
 }else{
  c.save();c.translate(x,y);c.scale(1,h/Math.max(1,w));const g=c.createRadialGradient(0,0,0,0,0,w/2);
  g.addColorStop(0,kind===2?'#8c7965':'#afdef1');g.addColorStop(1,'#99ccdd00');c.fillStyle=g;c.fillRect(-w/2,-w/2,w,w);c.restore();
 }
}
function mineral(c,ice,x,y,width,height,angle,alpha,seed){
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;
 const shape=ice?[[-width*.5,0],[-width*.62,-height*.45],[-width*.22,-height],[width*.23,-height*.87],[width*.55,-height*.3],[width*.5,0]]:[[-width*.5,0],[-width*.62,-height*.4],[-width*.4,-height*.6],[-width*(.25+noise(seed)*.2),-height*.9],[-width*.05,-height],[width*.15,-height*.84],[width*.32,-height*(.8+noise(seed+3)*.18)],[width*.55,-height*.3],[width*.5,0]];
 c.beginPath();shape.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.save();c.clip();
 const image=images.minerals;
 if(image?.complete&&image.naturalWidth)c.drawImage(image,ice?0:128,0,128,128,-width*.7,-height,width*1.4,height);
 else{const gradient=c.createLinearGradient(-width,0,width,-height);gradient.addColorStop(0,ice?'#2e6d8a':'#45382e');gradient.addColorStop(1,ice?'#dcf8ff':'#ac9172');c.fillStyle=gradient;c.fillRect(-width,-height,width*2,height);}
 c.fillStyle=ice?'#c9f5ff44':'#08050266';c.beginPath();c.moveTo(-width*.22,-height);c.lineTo(width*.03,-height*.4);c.lineTo(width*.5,0);c.lineTo(width*.55,-height*.3);c.lineTo(width*.23,-height*.87);c.fill();c.restore();
 stroke(c,[shape[1],shape[2],shape[3]],ice?1.1:1.5,ice?'#e5fbff':'#c9ad87',alpha*.7);
 stroke(c,[[0,-height*.7],[width*.1,-height*.35],[-width*.1,-height*.13]],.7,ice?'#d9faff':'#211810',alpha*.5);
 c.restore();
}
function atmosphere(c,w,h,color,alpha){
 c.globalAlpha=1;const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,`${color}${Math.round(alpha*150).toString(16).padStart(2,'0')}`);g.addColorStop(1,`${color}${Math.round(alpha*100).toString(16).padStart(2,'0')}`);c.fillStyle=g;c.fillRect(0,0,w,h);
}
function drawIce(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.65,p=reduced?1:ease(t/.38),r=rank===3?Math.min(w,h)*.65:rank===2?115:70;
 const count=rank===3?(lite?6:12):rank===2?(lite?4:7):(lite?3:5);
 if(rank===3)atmosphere(c,w,h,'#8abbd2',fade*.33);
 for(let i=0;i<count;i++){
  const u=count===1?0:i/(count-1),a=u*TAU,spread=rank===3?w*.58:r*.7;
  let x,y,angle,height;
  if(rank===1){x=e.x+(u-.5)*r*(1-p+t*.9);y=e.y-r*(1-p)+Math.sin(u*Math.PI)*r*t*.3;angle=(u-.5)*1.5;height=r*(.28+noise(i,e.seed)*.25);}
  else if(rank===2){const q=reduced?1:ease((t-i*.035)/.3);x=e.x+Math.cos(a)*spread;y=e.y+Math.sin(a)*r*.2+r*.35;angle=(u-.5)*.35;height=r*(.5+noise(i,e.seed)*.5)*q;}
  else{x=w*(u*1.15-.07)+(reduced?0:t*r*.25);y=h*(-.25+noise(i+11,e.seed)*1.35)+(reduced?0:t*h*.65);angle=-.45;height=r*(.2+noise(i,e.seed)*.25);}
  mineral(c,true,x,y,height*.3,Math.max(1,height),angle,fade,i);
 }
 cloud(c,0,rank===3?w/2:e.x,rank===3?h*.55:e.y,r*(rank===3?4:2.1),r*.9,reduced?.4:t,fade*.75);
}
function waveFront(c,x,y,width,height,phase,alpha,direction=1){
 const points=[];
 for(let i=0;i<=24;i++){const u=i/24;points.push([x+(u-.5)*width*direction,y-Math.sin(Math.PI*u)**1.25*height*(.7+u*.3)+Math.sin(u*14+phase)*height*.08]);}
 c.globalAlpha=alpha;const g=c.createLinearGradient(0,y-height,0,y+height*.3);g.addColorStop(0,'#c6f4ff88');g.addColorStop(.35,'#4bafcfbb');g.addColorStop(1,'#153c5900');c.fillStyle=g;
 c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.lineTo(x+direction*width/2,y+height*.3);c.lineTo(x-direction*width/2,y+height*.3);c.closePath();c.fill();
 stroke(c,points,1.8,'#cceff4',alpha*.65);stroke(c,points.map(([px,py])=>[px,py+6]),6,'#71cbd8',alpha*.22);
}
function drawWave(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.7,p=reduced?.65:ease(t/.7),count=rank===1?1:rank===2?2:3;
 if(rank===3)atmosphere(c,w,h,'#286484',fade*.35);
 for(let i=0;i<count;i++){
  const direction=rank===2&&i===1?-1:1,ww=rank===3?w*1.25:rank===2?240:160,hh=rank===3?h*.78:rank===2?95:55;
  const x=rank===3?w*(-.15+p*.95):e.x+direction*(1-p)*ww*.6,y=rank===3?h*.9+i*h*.08:e.y+50+i*14;
  waveFront(c,x,y,ww,hh,reduced?1:t*5+i,fade/(1+i*.4),direction);
  for(let k=0;k<(lite?2:4);k++)cloud(c,1,x+(k/(lite?1:3)-.5)*ww*.65,y-hh*(.55+noise(k)*.4),ww*.4,hh*.55,reduced?.5:t,fade*.75);
 }
}
function windArc(c,x,y,r,phase,alpha){
 const pts=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI*.9+phase;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r*.25]);}
 for(const [width,a]of [[24,.04],[5,.14],[.8,.38]])stroke(c,pts,width,'#d8eee7',alpha*a);
}
function drawGale(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.7,phase=reduced?1:t*5;
 if(rank===3){
  atmosphere(c,w,h,'#617a75',fade*.28);
  const n=lite?5:9;
  for(let i=0;i<n;i++){
   const u=i/(n-1),y=h*(.96-u*.92),r=w*(.08+u*.51);
   const x=w*.5+(reduced?0:Math.sin(phase+i*.2)*w*.06);
   windArc(c,x,y,r,phase+i*.35,fade);cloud(c,0,x+Math.cos(phase+i)*r*.35,y,r*2,h*.27,reduced?.5:t,fade*.45);
  }
 }else if(rank===2){
  for(let i=0;i<2;i++){const x=e.x+(i?1:-1)*65*(reduced?.4:1-ease(t)),y=e.y+(i?18:-18);for(let k=0;k<(lite?2:4);k++)windArc(c,x,y,75+k*12,(i?phase:-phase)+k*.3,fade);cloud(c,0,x,y,190,95,reduced?.5:t,fade*.25);}
 }else{
  const front=e.x+(reduced?0:(t-.5)*160);
  for(let i=0;i<(lite?3:5);i++){const y=e.y+(i-2)*10,pts=[];for(let j=0;j<=12;j++)pts.push([front-110+j*14,y+Math.sin(j*.3+phase+i)*9]);stroke(c,pts,i%2?2:5,'#cfebe2',fade*(i%2?.6:.2));}
  cloud(c,0,front,e.y,210,80,reduced?.5:t,fade*.3);
 }
}
function bolt(c,x,y,tx,ty,seed,reveal,alpha){
 const pts=[];for(let i=0;i<=9;i++){const q=i/9,offset=i&&i<9?(noise(i,seed)-.5)*38:0;pts.push([x+(tx-x)*q+offset,y+(ty-y)*q]);}
 const count=Math.max(2,Math.ceil(pts.length*reveal));
 for(const [width,a]of [[15,.06],[6,.23],[1.6,.95]])stroke(c,pts.slice(0,count),width,'#dbedff',alpha*a);
 for(let i=3;i<8;i+=2){const p=pts[i];if(i<count){const side=noise(i+22,seed)>.5?1:-1;stroke(c,[p,[p[0]+side*19,p[1]+18],[p[0]+side*34,p[1]+30]],1,'#bcd6fb',alpha*.6);}}
}
function drawLightning(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.35,pts=e.primaryPts||e.pts||[],count=rank===3?(lite?3:5):rank===2?(lite?2:4):1;
 // 光は一度の立ち上がりと減衰。繰り返す全画面の明滅は作らない。
 if(rank===3)atmosphere(c,w,h,'#485878',fade*.3);
 for(let i=0;i<count;i++){
  const q=reduced?1:ease((t-i*(rank===3?.035:.055))/.2);if(!q)continue;
  const point=pts[i%Math.max(1,pts.length)]||e;
  const tx=rank===3?w*(.1+i*.8/Math.max(1,count-1)+(noise(i+80,e.seed)-.5)*.08):rank===2?point.x+(pts.length<=1?(i-1.5)*32:0):e.x;
  const ty=rank===3?h*(.65+noise(i,e.seed)*.3):rank===2?point.y+(i%2)*18:e.y;
  c.save();c.globalCompositeOperation='lighter';
  bolt(c,rank===2&&i?e.x:tx+(noise(i+33,e.seed)-.5)*45,rank===2&&i?e.y:rank===3?-20:e.y-140,tx,ty,e.seed+i*51,q,fade);
  const light=c.createRadialGradient(tx,ty,0,tx,ty,rank===3?45:25);light.addColorStop(0,'#f5fbff');light.addColorStop(1,'#b8d9ff00');c.globalAlpha=fade*.35;c.fillStyle=light;c.fillRect(tx-45,ty-45,90,90);c.restore();
 }
}
function drawStone(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.65,rise=reduced?1:ease(t/.3),count=rank===3?(lite?5:9):rank===2?(lite?3:6):1;
 if(rank===3)atmosphere(c,w,h,'#7b6650',fade*.32);
 for(let i=0;i<count;i++){
  const u=count===1?.5:i/(count-1),x=rank===3?w*(u*1.1-.05):e.x+(u-.5)*(rank===2?220:0);
  const base=rank===3?h*1.02:e.y+55,hh=(rank===3?h*(.65+noise(i,e.seed)*.35):rank===2?95+noise(i,e.seed)*60:100)*rise;
  mineral(c,false,x,base,rank===3?w*.2:rank===2?55:65,Math.max(1,hh),(noise(i+7,e.seed)-.5)*.15,fade,i);
  if(i%(lite?2:3)===0)cloud(c,2,x,base-12,rank===3?w*.4:135,rank===3?h*.5:70,reduced?.5:t,fade*.8);
 }
}
function fissure(c,x,y,length,angle,seed,p,alpha){
 const pts=[];for(let i=0;i<=8;i++){const q=i/8,side=(noise(i,seed)-.5)*length*.18*Math.sin(q*Math.PI);pts.push([x+Math.cos(angle)*q*length*p-Math.sin(angle)*side*p,y+Math.sin(angle)*q*length*p+Math.cos(angle)*side*p]);}
 stroke(c,pts,8,'#8d7b64',alpha*.14);stroke(c,pts,3.5,'#100c08',alpha);

 for(let i=2;i<7;i+=2){const point=pts[i];stroke(c,[point,[point[0]+(i%4?1:-1)*18,point[1]+16]],2,'#2c2117',alpha*.8);}
}
function drawQuake(c,e,t,w,h,lite,reduced){
 const rank=e.design.tier,fade=(1-t)**.65,p=reduced?1:ease(t/.55),count=rank===3?(lite?3:8):rank===2?(lite?3:5):3;
 if(rank===3)atmosphere(c,w,h,'#66543f',fade*.32);
 const x=rank===3?w*.5:e.x,y=rank===3?h*.6:e.y+35;
 for(let i=0;i<count;i++){
  const a=i/count*TAU+(noise(i+5,e.seed)-.5)*.7,length=rank===3?Math.max(w,h)*.9:rank===2?180:90;
  fissure(c,x,y,length,a,e.seed+i*31,p,fade);
  cloud(c,2,x+Math.cos(a)*length*p*.5,y+Math.sin(a)*length*p*.25,rank===3?w*.65:rank===2?180:110,rank===3?h*.65:80,reduced?.5:t,fade*.7);
 }
 if(rank===3)for(let i=0;i<(lite?3:6);i++){
  const a=i*2.399,xx=x+Math.cos(a)*w*.28*p,yy=y+Math.sin(a)*h*.22*p;
  mineral(c,false,xx,yy,w*(.14+noise(i,e.seed)*.06),h*(.07+noise(i+40,e.seed)*.08)*p,(noise(i+20,e.seed)-.5)*.4,fade*.9,i);
 }
 if(rank>=2)for(let i=0;i<(lite?3:8);i++){
  const vx=(noise(i,e.seed)-.5)*(rank===3?w:200),vy=-(30+noise(i+10,e.seed)*70),q=reduced?.3:t;
  mineral(c,false,x+vx*q,y+vy*q+q*q*80,8+i%3*3,13+i%4*4,noise(i+20,e.seed),fade,i);
 }
}
const DRAW={ice:drawIce,wave:drawWave,gale:drawGale,lightning:drawLightning,stone:drawStone,quake:drawQuake};
export function drawElementFx(c,e,t,w,h,lite,reduced){c.save();c.globalCompositeOperation='source-over';DRAW[e.design.family]?.(c,e,t,w,h,lite,reduced);c.restore();}

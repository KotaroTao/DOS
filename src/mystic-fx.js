// 聖光・闇・魔力・癒やしの専用描画。格ごとに構造を変え、対象の印は呼出し元で描く。
import { FX } from './battlefx.js';
const { line, star4, rgba, clamp01 }=FX, TAU=Math.PI*2;
export const MYSTIC_FAMILIES=Object.freeze(['radiance','void','arcane','heal','revive','purify','ward']);
const colors={radiance:'#ffe6a1',void:'#ad79e7',arcane:'#b6a9ff',heal:'#86efb6',revive:'#ffe1a0',purify:'#9beef5',ward:'#9ccfff'};
function ring(c,x,y,r,color,a,width=2,flatten=1){
 c.globalAlpha=clamp01(a);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(.1,r),Math.max(.1,r*flatten),0,0,TAU);c.stroke();
}
function glow(c,x,y,r,color,a){
 c.globalAlpha=clamp01(a);const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(color,.7));g.addColorStop(.3,rgba(color,.25));g.addColorStop(1,rgba(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
export function drawMysticFx(c,e,t,w,h,lite,reduced){
 const f=e.design.family,rank=e.design.tier,color=colors[f],x=e.x,y=e.y;
 const q=reduced?.55:clamp01(t),rise=1-(1-q)**3,fade=(1-t)**.8;
 const r=(rank===3?125:rank===2?92:60)*e.design.scale;
 const span=e.all?Math.max(r,Math.min(w*.45,e.w*.65)):r;
 const n=lite?rank+2:rank*3+3,phase=reduced?0:q*TAU;
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 glow(c,x,y,span*1.25,color,fade*.65);
 if(f==='radiance'){
  // 一条の降光 → 三重の光柱 → 光冠と放射する聖光。
  const count=rank===1?1:rank===2?3:lite?5:9;
  for(let i=0;i<count;i++){
   const dx=(i-(count-1)/2)*span*.20,delay=Math.abs(i-(count-1)/2)*.035,p=reduced?1:clamp01((t-delay)*4);
   line(c,x+dx,y-r*1.4,x+dx,y-r*1.4+r*1.8*p,rank===3?7:4,color,fade*.6);
   line(c,x+dx,y-r*1.4,x+dx,y-r*1.4+r*1.8*p,1.5,'#fffdf2',fade);
  }
  if(rank>=2)ring(c,x,y-r*.7,span*.5,color,fade,2,.25);
  if(rank===3)for(let i=0;i<n;i++){const a=i*TAU/n;line(c,x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3,x+Math.cos(a)*span,y+Math.sin(a)*r,2,color,fade*.6);}
  star4(c,x,y,r*.3,'#fffced',fade);
 }else if(f==='void'){
  // 闇の糸が吸い込まれ、中位で二重渦、最上位で裂け目を結ぶ。
  for(let i=0;i<n;i++){
   const a=i*TAU/n+phase*(rank>=2?1:0),d=span*(1-rise*.85);
   line(c,x+Math.cos(a)*span,y+Math.sin(a)*r,x+Math.cos(a+.5)*d,y+Math.sin(a+.5)*d,rank===3?3:1.5,color,fade*.7);
  }
  for(let i=0;i<rank;i++)ring(c,x,y,r*(.12+(1-rise)*.65+i*.13),color,fade,2);
  c.globalCompositeOperation='source-over';glow(c,x,y,r*.38,'#160d29',fade);
  if(rank===3){line(c,x,y-r*.8*rise,x,y+r*.8*rise,6,'#1b102a',fade);line(c,x+3,y-r*.8*rise,x+3,y+r*.8*rise,1,color,fade);}
 }else if(f==='arcane'){
  // 一つの波紋 → 交差する軌道 → 星の節を結ぶ多重波。
  for(let i=0;i<rank+1;i++)ring(c,x,y,span*(.15+((q+i*.22)%1)*.85),color,fade*(1-i*.15),2,i%2?.45:1);
  if(rank>=2)for(let i=0;i<rank;i++){c.save();c.translate(x,y);c.rotate(i*TAU/3+(reduced?0:q));ring(c,0,0,r*.7,color,fade*.6,1,.3);c.restore();}
  if(rank===3)for(let i=0;i<n;i++){const a=i*TAU/n+phase*.2;star4(c,x+Math.cos(a)*span*.75,y+Math.sin(a)*r*.75,5,color,fade);}
 }else if(f==='heal'){
  // 灯る芽 → 二重の癒やしの泉 → 花びらが昇る大きな光の花。
  for(let i=0;i<rank;i++)ring(c,x,y+r*.3-i*r*.12,span*(.35+rise*.35),color,fade*.7,2,.28);
  for(let i=0;i<n;i++){
   const a=i*2.399,xx=x+Math.cos(a)*span*.65,yy=y+r*.35-((q+i/n)%1)*r;
   star4(c,xx,yy,rank===3?7:4,color,fade*.8);
  }
  if(rank===3)for(let i=0;i<(lite?4:8);i++){c.save();c.translate(x,y);c.rotate(i*TAU/8);ring(c,0,-r*.32,r*.32,color,fade*.5,1,.45);c.restore();}
  line(c,x-r*.15,y,x+r*.15,y,4,'#d9ffe9',fade);line(c,x,y-r*.15,x,y+r*.15,4,'#d9ffe9',fade);
 }else if(f==='revive'){
  // 魂の灯が昇り、上位では光の門、最上位では三重の復活の光冠。
  const yy=y+r*.35-rise*r*.85;
  glow(c,x,yy,r*.38,color,fade);star4(c,x,yy,r*.22,'#fff5d1',fade);
  for(let i=0;i<rank;i++)ring(c,x,y+r*.35-i*r*.18,span*(.45+i*.1),color,fade*.8,2,.22);
  if(rank>=2){c.globalAlpha=fade*.65;c.strokeStyle=color;c.lineWidth=rank===3?5:2;c.beginPath();c.ellipse(x,y,r*.5,r*.95,0,Math.PI,TAU);c.stroke();}
  if(rank===3)for(let i=0;i<n;i++){const a=i*TAU/n;line(c,x+Math.cos(a)*r*.55,y-r*.5+Math.sin(a)*r*.55,x+Math.cos(a)*r*.85,y-r*.5+Math.sin(a)*r*.85,2,color,fade);}
 }else if(f==='purify'){
  // 星が汚れを払う → 回る清めの環 → 多重の浄化紋が外へほどける。
  for(let i=0;i<rank;i++)ring(c,x,y,span*(.25+rise*.5+i*.12),color,fade*.65,1.5);
  for(let i=0;i<n;i++){const a=i*TAU/n+(rank>=2?phase*.35:0),d=r*(.15+rise*.65);star4(c,x+Math.cos(a)*d,y+Math.sin(a)*d,rank===3?8:5,color,fade);}
  star4(c,x,y,r*.2,'#efffff',fade);
 }else if(f==='ward'){
  // 六角の薄膜 → 二重結界 → 外周の節で支える三重結界。
  for(let k=0;k<rank;k++){
   const rr=r*(.5+k*.16)*(.8+rise*.2);c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=k===0?3:1.5;c.beginPath();
   for(let i=0;i<=6;i++){const a=i*TAU/6-Math.PI/2+(k%2?Math.PI/6:0);const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();
   if(k===0){c.fillStyle=rgba(color,.07);c.fill();}c.stroke();
  }
  if(rank===3)for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2;star4(c,x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82,7,'#def3ff',fade);}
 }
 c.restore();
}

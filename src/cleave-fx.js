// なぎ払いの専用軌跡。各職業の同系統最上位を明示し、実行時にIDから形を作らない。
export const CLEAVE_TOP = Object.freeze({
 SHOUNETSURANBU:'flameDance', DAICHIMEIDOU:'fault', SENKOUZAN:'flash', DAIKAISHOU:'tidal',
 TOKOYAMI:'eclipse', SHADOW_MAGAKAZE:'illWind', PALADIN_GAIKA:'halo', CHIRETSU:'rift',
 ROKUDOU:'sixPaths', BRIGAND_HANAMICHI:'petals', KOUBOURANBU:'lightDance', BATTLEMAGE_JINARI:'tremor',
 DARKKNIGHT_KOKUUZUGIRI:'darkSpiral', EXORCIST_GOUMA:'purifyingCross', INQUISITOR_KAKEIBA:'pyre',
 ASCETIC_FUDOUKAEN:'mandala', RAIJINKEN:'thunder', ASURA_GOUKA:'fireWheel',
 DRAGONKNIGHT_GOUKA:'dragonBreath', SERA_SEIRYUUZAN:'holyStream'
});
export const CLEAVE_COLORS=Object.freeze({fire:'#ff4834',water:'#328dff',wind:'#72dfb0',earth:'#c49a58',light:'#ffe191',dark:'#9963dc'});
const TAU=Math.PI*2;
// 色だけに頼らず、弧の向き・開き・重なり・付随する紋を変える。
export const CLEAVE_MOTION={
 flameDance:[4,.5,.9,.35],fault:[3,0,.55,.18],flash:[1,-.3,.32,.1],tidal:[4,0,.75,.32],
 eclipse:[2,0,1,.8],illWind:[5,-.4,.7,.7],halo:[3,0,1,.42],rift:[2,.6,.45,.22],
 sixPaths:[6,0,.65,.65],petals:[5,.2,.4,.75],lightDance:[4,.7,.8,.45],tremor:[3,0,.5,.12],
 darkSpiral:[4,.2,1,.72],purifyingCross:[2,.78,.6,.5],pyre:[5,1.57,.5,.28],
 mandala:[6,0,1,.35],thunder:[3,-.7,.35,.5],fireWheel:[8,0,.7,.8],
 dragonBreath:[3,-.2,.4,.24],holyStream:[4,.15,.6,.16]
};
export function drawCleave(c,e,t,r,color,lite,reduced){
 const variant=e.design.variant, rank=e.design.tier;
 const [count,tilt,span,spread]=CLEAVE_MOTION[variant]||[rank,rank===2?-.2:0,rank===3?.95:.62,rank===3?.6:.18];
 const motion=reduced?.65:Math.min(1,t*1.6),fade=Math.pow(1-t,1.1);
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 for(let i=0;i<count;i++){
  const q=reduced?.7:Math.max(0,Math.min(1,(t-i*.045)*3));if(!q)continue;
  const angle=tilt+(variant||rank===3?i*TAU/count: i*Math.PI);
  c.save();c.rotate(angle);c.translate(0,(i-(count-1)/2)*r*spread/count);
  // 尾から先端へ細くなる透過の帯。白い芯は色の帯より細く抑える。
  const start=Math.PI*(1-span),end=start+Math.PI*span*2*q,rx=r*(.7+motion*.4),ry=r*.23;
  c.globalAlpha=fade*.55;c.fillStyle=color;c.beginPath();
  for(let j=0;j<=24;j++){const u=j/24,a=start+(end-start)*u,thick=Math.sin(u*Math.PI)*r*.065;c.lineTo(Math.cos(a)*(rx+thick),Math.sin(a)*(ry+thick));}
  for(let j=24;j>=0;j--){const u=j/24,a=start+(end-start)*u,thick=Math.sin(u*Math.PI)*r*.065;c.lineTo(Math.cos(a)*(rx-thick),Math.sin(a)*(ry-thick));}
  c.closePath();c.fill();
  for(let k=0;k<(lite?2:4);k++){
   c.globalAlpha=fade*(k===0?.55:.3);c.strokeStyle=k===0?'#f5fbff':color;c.lineWidth=k===0?1:8-k;
   c.beginPath();c.ellipse(0,0,r*(.7+motion*.4),r*(.2+k*.025),0,Math.PI*(1-span),Math.PI*(1-span)+Math.PI*span*2*q);c.stroke();
  }
  c.restore();
 }
 if(variant){
  const n=lite?4:8;
  for(let i=0;i<n;i++){
   const u=i/n,a=u*TAU,xx=Math.cos(a)*r*.7,yy=Math.sin(a)*r*.45;
   c.strokeStyle=variant==='sixPaths'?Object.values(CLEAVE_COLORS)[i%6]:color;c.fillStyle=color;c.globalAlpha=fade*.8;c.lineWidth=2;c.beginPath();
   if(['fault','rift','tremor'].includes(variant)){
    c.moveTo((u-.5)*r*2,r*.2);c.lineTo((u-.5)*r*2+8,r*(.35+motion*.3));c.lineTo((u-.5)*r*2-4,r*.8);
   }else if(variant==='thunder'){
    c.moveTo(xx,yy-r*.5);c.lineTo(xx-8,yy);c.lineTo(xx+7,yy-4);c.lineTo(xx-5,yy+r*.4);
   }else if(['pyre','dragonBreath','flameDance'].includes(variant)){
    c.moveTo(xx,r*.35);c.quadraticCurveTo(xx+Math.sin(i+motion*4)*12,-r*.15,xx+(variant==='dragonBreath'?r*.4:0),-r*(.3+u*.5));
   }else if(['purifyingCross','lightDance'].includes(variant)){
    c.moveTo(xx-6,yy);c.lineTo(xx+6,yy);c.moveTo(xx,yy-10);c.lineTo(xx,yy+10);
   }else if(['tidal','holyStream'].includes(variant)){
    c.moveTo(-r,yy);c.bezierCurveTo(-r*.3,yy-r*.3,r*.3,yy+r*.3,r,yy-motion*r*.2);
   }else if(['petals','illWind'].includes(variant)){
    c.ellipse(xx,yy,variant==='petals'?7:3,3,a+motion,0,TAU);c.fill();
   }else{
    c.ellipse(0,0,r*(.25+u*.7),r*(variant==='darkSpiral'?.35:.65)*( .25+u*.7),variant==='mandala'?a:0,a,a+(variant==='flash'?.25:1.2));
   }
   c.stroke();
  }
 }
 c.restore();
}

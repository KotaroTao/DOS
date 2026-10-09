// 読み物専用の一枚絵。場面ごとに背景・主題・人物の位置と手の動きを描き分ける。
// 既存の storyArt や館の肖像は使わない。192×108の素材色を点光源で照らし、共通パレットへ量子化する。
import { Layer, Mask, h2 } from "./pxpaint.js";
import { ICE_PAL, SWAMP_PAL } from "./storyart.js"; // 第六章の氷の青と極光の紫 / 第七章の沼の緑と枯れ葦を足したパレット

export const ARCHIVE_ART_W = 192, ARCHIVE_ART_H = 108;
export const ARCHIVE_FOCUS = ["city", "threeSouls", "door", "lamp", "vessel", "partyThree", "partyFour", "guard",
  "lantern", "sigil", "abbeyMap", "ordo", "sealedKey", "arm", "joint", "waterMap", "pass", "campLetter", "fortMap",
  "fortWindow", "fort", "roll", "emptySeat", "names", "seraHead", "namesScroll", "banner", "stormWindow", "soulMap",
  "sealedOrder", "crown", "fadingLamp", "pit", "rope", "gardenWindow", "hutDiary", "diary", "torso", "cup",
  "seraTogether", "climbingOrdo", "chancellor", "highLamp", "brokenVessel", "twoChairs", "openDoor",
  "votive", "mural", "legs", "seraWake", "priestKing", "blade", "husks", "cauldron", "abyss",
  "coat", "frozenMasters", "auroraMap", "frostKing", "thaw",
  "splint", "dollPile", "miasmaNote", "workshopIsle", "tower"];
// 氷の場面は氷の青を足したパレットで量子化する (共通のパレットだと青が灰色に沈む)
const ICE_FOCUS = ["coat", "frozenMasters", "auroraMap", "frostKing", "thaw"];
// 沼の場面は沼の緑と枯れ葦の黄土を足したパレットで量子化する
const SWAMP_FOCUS = ["splint", "dollPile", "miasmaNote", "workshopIsle", "tower"];
const cache = new Map();
const C = { stone:[71,67,85], dark:[25,22,37], edge:[114,104,118], wood:[104,64,47], gold:[199,150,70], paper:[201,183,139],
  iron:[81,94,115], bone:[185,165,137], soul:[73,214,190], blue:[91,131,190], purple:[107,65,143], skin:[188,151,147], black:[31,25,38],
  ice:[150,198,228], iceD:[62,102,146], snow:[226,238,248], coat:[48,42,58],
  mud:[54,48,32], bog:[30,44,24], reed:[150,128,80], sick:[150,196,70] };

function paintScene(scene) {
  const W = ARCHIVE_ART_W, H = ARCHIVE_ART_H, L = new Layer(W, H);
  const seed = [...scene.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
  const indoor = ["mansion", "workshop", "throne", "treasury", "warroom", "prison", "crypt", "passage", "abbey", "mine"].includes(scene.setting);
  const roomLight = ["mansion", "workshop", "throne", "treasury"].includes(scene.setting);
  const focalX = scene.people === "king" ? 139 : scene.people === "irene" ? 121 : 105;
  const light = { x:focalX, y:56, color:roomLight ? [1,0.69,0.38] : scene.setting==="ice" ? [0.55,0.8,1] : scene.setting==="swamp" ? [0.72,0.9,0.46] : [0.33,0.86,0.82] };
  function rgb(base, x, y, edge = false) {
    const d = Math.hypot((x - light.x) * 0.8, y - light.y) / 100;
    const k = Math.max(0, 1 - d) ** 2;
    const grain = (h2(x, y, seed) - 0.5) * 0.13;
    return base.map((v, i) => v * (0.32 + k * light.color[i] * 0.85 + grain + (edge ? 0.15 : 0)));
  }
  const mask = () => new Mask(W, H);
  function draw(m, col, textured = true) { L.paint(m, (x,y) => textured ? rgb(col,x,y,m.nx(x,y,3) < -0.2) : col); }
  function rect(x,y,w,h,col,texture = true) { const m=mask();m.rect(x,y,w,h);draw(m,col,texture); }
  function ellipse(x,y,rx,ry,col,texture = true) { const m=mask();m.ellipse(x,y,rx,ry);draw(m,col,texture); }
  function line(x0,y0,x1,y1,col,width = 1,texture = true) {
    const steps = Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
    for(let i=0;i<=steps;i++){const t=i/steps;rect(Math.round(x0+(x1-x0)*t),Math.round(y0+(y1-y0)*t),width,width,col,texture);}
  }
  function poly(points,col) {
    const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),maxY=Math.min(H-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
    const m=mask();
    for(let y=minY;y<=maxY;y++){
      const xs=[];
      for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)m.rect(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1);
    }
    draw(m,col);
  }
  function glow(x,y,r,col,k=0.7){for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(H,y+r);yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(W,x+r);xx++){const f=Math.max(0,1-Math.hypot(xx-x,yy-y)/r)**2*k;L.add(xx,yy,col,f);}}
  function candle(x,y,size=1,weak=false){rect(x-1,y,3,11*size,C.paper);rect(x-5,y+11*size,11,2,C.gold);ellipse(x,y-3*size,size,3*size,weak?[91,94,128]:[245,190,93],false);if(!weak)glow(x,y-3,19*size,[255,152,52],0.8);}
  function lantern(x,y){rect(x-8,y-12,17,23,C.black);rect(x-6,y-10,13,18,C.gold);rect(x-4,y-8,9,14,C.dark);ellipse(x,y-2,3,6,C.soul,false);rect(x-8,y-12,17,3,C.gold);line(x-4,y-12,x-4,y-19,C.gold);line(x-4,y-19,x+4,y-19,C.gold);line(x+4,y-19,x+4,y-12,C.gold);line(x,y-7,x,y+5,C.gold);glow(x,y-2,31,[55,198,162]);}
  function table(x,y,w=65){rect(x,y,w,7,C.wood);line(x,y,x+w,y,C.gold);rect(x+5,y+7,5,H-y,C.dark);rect(x+w-10,y+7,5,H-y,C.dark);}
  function paper(x,y,w=38,h=22){poly([[x,y],[x+w,y+2],[x+w-3,y+h],[x-2,y+h-2]],C.paper);for(let i=0;i<4;i++)line(x+5,y+5+i*3,x+w-7-(i%2)*6,y+5+i*3,C.wood);}
  function ring(x,y,r,col){ellipse(x,y,r,r,col);ellipse(x,y,r-2,r-2,C.dark);}
  function sigil(x,y){ring(x,y,10,C.gold);line(x-5,y+2,x+5,y+2,C.gold,2);line(x-6,y+2,x-2,y+7,C.gold);line(x-2,y+7,x+6,y+2,C.gold);ellipse(x,y-3,2,4,C.soul,false);}
  function doll(x,y,part="full",scale=1){
    const q=(a)=>a*scale;
    if(part!=="arm"&&part!=="torso"){ellipse(x,y-12*scale,q(7),q(9),C.wood);poly([[x-q(8),y-q(19)],[x+q(5),y-q(22)],[x+q(9),y-q(7)],[x+q(7),y-q(1)],[x+q(6),y-q(16)],[x-q(5),y-q(15)],[x-q(7),y-q(1)]],C.black);line(x-q(4),y-q(12),x-q(1),y-q(12),C.soul,1,false);line(x+q(2),y-q(12),x+q(4),y-q(12),C.soul,1,false);}
    if(part==="head")return;
    if(part==="arm"){line(x-16,y+3,x+16,y-5,C.wood,5);ring(x-14,y+5,4,C.iron);for(let i=0;i<4;i++)line(x+15,y-5+i*2,x+23-i,y-10+i*3,C.wood,2);return;}
    poly([[x-q(9),y],[x+q(9),y],[x+q(7),y+q(23)],[x-q(7),y+q(23)]],C.wood);rect(x-q(8),y+q(5),q(16),q(2),C.iron);ring(x,y+q(10),q(4),C.gold);
    if(part==="torso")return;
    line(x-q(12),y+q(2),x-q(16),y+q(24),C.wood,q(3));line(x+q(10),y+q(2),x+q(15),y+q(24),C.wood,q(3));
    line(x-q(5),y+q(24),x-q(7),y+q(44),C.wood,q(4));line(x+q(3),y+q(24),x+q(5),y+q(44),C.wood,q(4));
    for(const a of [-1,1])ring(x+a*q(11),y+q(5),q(3),C.iron);
  }
  function traveller(x,y,scale=1){poly([[x-8*scale,y-22*scale],[x+8*scale,y-22*scale],[x+14*scale,y+26*scale],[x-15*scale,y+26*scale]],C.blue);ellipse(x,y-18*scale,8*scale,10*scale,C.black);line(x-9*scale,y-2*scale,x+8*scale,y-7*scale,C.iron,2);rect(x-8*scale,y+26*scale,5*scale,9*scale,C.black);rect(x+3*scale,y+26*scale,5*scale,9*scale,C.black);}
  function irene(x,y,pose){
    // 黒い長髪・紫の衣・金の留め具。初対面の絵では人業の継ぎ目を見せない。
    ellipse(x,y-19,13,18,C.black);poly([[x-12,y-21],[x-16,y+21],[x+16,y+19],[x+12,y-23]],C.black);
    poly([[x-9,y],[x+9,y],[x+18,y+38],[x-19,y+38]],C.purple);line(x-7,y+5,x+8,y+8,C.gold);rect(x-3,y-4,6,6,C.skin);
    ellipse(x,y-17,8,11,C.skin);poly([[x-12,y-26],[x+5,y-33],[x+12,y-25],[x+9,y-8],[x+5,y-24],[x-8,y-17],[x-10,y-5]],C.black);
    line(x-5,y-16,x-2,y-16,[158,112,210],1,false);line(x+2,y-16,x+5,y-16,[158,112,210],1,false);line(x-2,y-10,x+1,y-10,C.wood);
    for(let i=0;i<5;i++)rect(x-11+i*2,y-26+i*2,1,2,C.gold);
    if(pose==="welcome"){line(x+9,y+4,x+23,y+14,C.purple,5);line(x+23,y+14,x+32,y+8,C.skin,3);}
    else if(pose==="shelter"){line(x+9,y+6,x+30,y+5,C.purple,5);line(x+30,y+5,x+37,y-6,C.skin,3);line(x-9,y+7,x+18,y+17,C.purple,5);line(x+18,y+17,x+27,y+2,C.skin,3);}
    else {line(x+9,y+5,x+23,y+17,C.purple,5);line(x+23,y+17,x+37,y+14,C.skin,3);line(x-9,y+6,x-16,y+25,C.purple,5);}
    if(pose==="joint"){ring(x+30,y+16,3,C.iron);line(x+32,y+14,x+41,y+9,C.skin,2);}
  }
  function king(){rect(25,24,33,70,C.wood);poly([[23,27],[29,12],[35,24],[43,10],[51,25],[59,15],[61,82],[22,82]],C.gold);rect(29,30,26,53,[97,32,48]);ellipse(43,48,7,10,C.bone);rect(36,40,15,3,C.gold);for(const x of [36,41,46])rect(x,36,2,5,C.gold);poly([[33,59],[51,59],[63,89],[22,89]],C.purple);line(32,67,22,72,C.bone,3);line(52,67,63,72,C.bone,3);}
  function map(x,y,kind){paper(x,y,52,31);const pts=kind==="waterMap"?[[8,8],[20,14],[33,19],[42,25]]:[[8,8],[15,22],[30,9],[38,22],[43,15]];for(const [dx,dy]of pts){line(x+dx,y+dy,x+45,y+6,kind==="waterMap"?C.blue:C.wood);ring(x+dx,y+dy,2,C.gold);}rect(x+43,y+4,5,5,C.gold);}

  // 背景の素材と、場面の奥行き。
  L.shade(0,0,W-1,H-1,(x,y)=>{
    const base=indoor ? (y<82?C.stone:C.dark) : [25,34,57];
    const brick=indoor&&y<82&&((y%12===0)||((x+Math.floor(y/12)%2*12)%25===0));
    return rgb(brick?[22,20,31]:base,x,y);
  });
  if(indoor){for(let i=0;i<4;i++){rect(i*56-5,0,9,85,C.dark);rect(i*56+2,0,2,85,C.edge);}for(let y=86;y<H;y+=7)line(0,y,W,y,C.stone);}
  function window(x,y,w,h,storm=false){rect(x-3,y-3,w+6,h+6,C.gold);rect(x,y,w,h,[20,27,68]);line(x+w/2,y,x+w/2,y+h,C.iron,2);line(x,y+h/2,x+w,y+h/2,C.iron);if(storm)poly([[x+w-8,y],[x+w-19,y+17],[x+w-10,y+16],[x+6,y+h]],C.blue);else{ellipse(x+w*0.75,y+9,3,4,C.blue);glow(x+w/2,y+h/2,30,[83,62,174],0.35);}}
  if(scene.setting==="mansion"||scene.setting==="workshop"){
    window(124,9,31,51);poly([[115,0],[120,63],[128,53],[126,0]],C.purple);poly([[154,0],[156,54],[164,64],[168,0]],C.purple);
    for(const x of [14,36]){doll(x,50,"full",0.55);rect(x-10,81,21,5,C.wood);}
    candle(175,62);candle(166,71);table(81,84,82);
  }
  if(scene.setting==="throne"){window(86,7,29,55);king();candle(14,37);candle(74,37);table(116,83,69);}
  if(scene.setting==="treasury"){for(let i=0;i<3;i++){rect(15+i*40,26,31,45,C.wood);rect(18+i*40,30,25,36,C.dark);ellipse(28+i*40,47,7,9,C.gold);line(18+i*40,60,42+i*40,60,C.gold);}table(105,82,75);}
  if(scene.setting==="crypt"){for(let i=0;i<4;i++){const x=8+i*49;rect(x,58-i%2*12,32,28,C.stone);poly([[x,58-i%2*12],[x+10,51-i%2*12],[x+33,56-i%2*12],[x+32,61-i%2*12]],C.edge);rect(x+9,62-i%2*12,2,13,C.iron);}}
  if(scene.setting==="passage"){poly([[15,0],[65,31],[65,76],[15,108]],C.dark);poly([[175,0],[125,31],[125,76],[175,108]],C.dark);rect(70,25,52,65,C.black);for(let x=75;x<121;x+=9)rect(x,26,2,66,C.iron);}
  if(scene.setting==="abbey"){window(83,4,27,39);table(59,69,76);for(const x of [65,122])candle(x,55);poly([[27,0],[36,0],[36,91],[21,98]],C.stone);poly([[157,0],[166,0],[175,98],[157,91]],C.stone);}
  if(scene.setting==="prison"){rect(7,11,47,74,C.black);for(let x=11;x<53;x+=8)rect(x,11,2,76,C.iron);line(7,33,54,33,C.iron,2);line(7,68,54,68,C.iron,2);}
  if(scene.setting==="warroom"){window(135,9,25,36,true);table(24,64,143);rect(47,9,15,37,[100,34,50]);rect(61,9,2,37,C.gold);}
  if(scene.setting==="mine"){for(let i=0;i<3;i++){line(20+i*63,0,13+i*63,91,C.wood,6);line(13+i*63,7,71+i*63,7,C.wood,5);}for(let i=0;i<6;i++)line(110+i*6,0,104+i*6,43,C.iron);}
  if(["roots","forest","sap","tree"].includes(scene.setting)){
    for(let i=0;i<7;i++){const x=i*34-10;poly([[x,0],[x+12,0],[x+10,35],[x+21,78],[x+35,99],[x+24,107],[x+8,73],[x-4,35]],C.wood);line(x+5,7,x+8,61,C.gold);}
    for(let i=0;i<35;i++){const x=h2(i,2,seed)*W,y=60+h2(i,4,seed)*45;ellipse(x,y,1,2,C.soul,false);}
  }
  if(["road","gate","fort","storm"].includes(scene.setting)){
    // 遠景の屋根と城壁、手前へ伸びる道。
    for(let i=0;i<9;i++){const x=i*24-9,h=17+h2(i,9,seed)*22;rect(x,74-h,22,h,C.stone);poly([[x-3,74-h],[x+10,63-h],[x+25,74-h]],C.black);if(i%2)rect(x+7,69-h,3,6,C.gold);}
    poly([[79,76],[105,76],[149,108],[38,108]],C.dark);line(78,77,38,108,C.edge);line(106,77,149,108,C.edge);
    if(scene.setting!=="road"){rect(47,23,99,52,C.stone);rect(44,20,105,8,C.dark);for(let x=45;x<150;x+=13)rect(x,13,8,13,C.stone);rect(79,42,34,33,C.black);ellipse(96,43,17,13,C.black);}
    if(scene.setting==="storm")poly([[146,0],[125,22],[139,20],[115,52],[150,17],[134,19]],C.blue);
  }
  // 第四章: 水に沈んだ旧都の神殿 (半ば沈んだ柱と水面)
  if(scene.setting==="temple"){
    for(let i=0;i<5;i++){const x=6+i*44;rect(x,0,13,80,C.stone);rect(x-2,0,17,5,C.edge);line(x+3,6,x+3,78,C.edge);}
    rect(0,74,W,34,[18,44,66]);for(let i=0;i<45;i++){const xx=h2(i,1,seed)*W,yy=76+h2(i,3,seed)*30;line(xx,yy,xx+7,yy,C.blue);}
    for(let i=0;i<20;i++){const xx=h2(i,6,seed)*W,yy=h2(i,8,seed)*70;ellipse(xx,yy,1,1,[150,200,220],false);}
  }
  // 第五章: 樹液を煮る火の洞 (赤く脈打つ岩と溶岩の照り返し)
  if(scene.setting==="furnace"){
    rect(0,0,W,84,[44,24,26]);
    for(let i=0;i<8;i++){const xx=i*28-8;poly([[xx,0],[xx+30,0],[xx+24,30+h2(i,2,seed)*18],[xx+4,24]],[52,30,34]);}
    rect(0,84,W,24,[90,30,18]);for(let i=0;i<30;i++){const xx=h2(i,5,seed)*W;line(xx,86+h2(i,7,seed)*20,xx+12,90+h2(i,9,seed)*16,[240,120,40]);}
    for(let i=0;i<28;i++){const xx=h2(i,11,seed)*W,yy=h2(i,13,seed)*80;rect(xx,yy,1,1,[255,170,80],false);}
    glow(W/2,104,80,[255,90,30],0.45);
  }
  // 第六章: 奈落の氷の回廊・氷棚 (青白い氷の壁、天井のつらら、鏡のような氷の床と吹き上げる雪)
  if(scene.setting==="ice"){
    rect(0,0,W,H,[18,32,56]);
    for(let i=0;i<9;i++){const xx=i*24-8,t=h2(i,2,seed);poly([[xx,0],[xx+24,0],[xx+20+t*6,52+t*20],[xx+4,40+h2(i,3,seed)*26]],i%2?[44,74,110]:[58,94,132]);line(xx+3,2,xx+8+t*8,40+t*20,C.ice);}
    for(let i=0;i<26;i++){const xx=h2(i,5,seed)*W,l=5+h2(i,6,seed)*14;poly([[xx-2,0],[xx+2,0],[xx,l]],C.ice);}
    rect(0,80,W,28,[30,54,84]);line(0,80,W,80,C.snow);
    for(let i=0;i<30;i++){const xx=h2(i,7,seed)*W,yy=83+h2(i,8,seed)*24;line(xx,yy,xx+6+h2(i,9,seed)*10,yy,[96,140,176]);}
    for(let i=0;i<45;i++){rect(h2(i,11,seed)*W,h2(i,13,seed)*H,1,1,C.snow,false);}
  }
  // 第七章: 奈落の底の毒の沼 (緑がかった黒い水・枯れた葦・沈んだ木・毒の霧)
  if(scene.setting==="swamp"){
    rect(0,0,W,H,[14,22,12]);
    for(let i=0;i<7;i++){const xx=8+i*30+h2(i,1,seed)*12,top=18+h2(i,2,seed)*24;line(xx,76,xx+2,top,[22,30,18],2);line(xx+1,top+12,xx+8,top+4,[22,30,18]);line(xx+1,top+20,xx-6,top+13,[22,30,18]);}
    rect(0,74,W,34,C.bog);for(let i=0;i<40;i++){const xx=h2(i,3,seed)*W,yy=77+h2(i,4,seed)*30;line(xx,yy,xx+5+h2(i,5,seed)*9,yy,[52,72,38]);}
    for(const [xx,yy,rx] of [[30,92,16],[166,86,12]]){ellipse(xx,yy,rx,2.4,C.sick,false);glow(xx,yy,rx*1.6,[100,150,40],0.5);}
    for(let i=0;i<34;i++){const xx=h2(i,6,seed)*W;if(xx>48&&xx<150)continue;const hh=14+h2(i,7,seed)*30,lean=(h2(i,8,seed)-0.5)*8;line(xx,108,xx+lean,108-hh,C.reed);if(h2(i,9,seed)>0.6)rect(xx+lean*0.9,108-hh*0.92,2,4,[90,54,32]);}
    for(let i=0;i<3;i++){const yy=40+i*22;for(let xx=0;xx<W;xx++)for(let d=-3;d<=3;d++){const k=(1-Math.abs(d)/4)*(h2(xx>>3,i,seed)*0.5+0.3)*0.22;L.add(xx,yy+d+Math.round(Math.sin(xx*0.05+i)*3),[60,80,30],k);}glow(W*(0.25+i*0.25),yy,40,[70,100,30],0.25);}
    for(let i=0;i<24;i++)rect(h2(i,11,seed)*W,h2(i,13,seed)*100,1,1,[190,230,110],false);
  }
  if(scene.setting==="water"){rect(0,73,W,35,[20,49,61]);for(let i=0;i<40;i++){const x=h2(i,1,seed)*W,y=76+h2(i,3,seed)*30;line(x,y,x+9,y,C.blue);}for(let x=143;x<183;x+=9)rect(x,18,3,71,C.iron);}

  // 一枚ごとの主題。小道具だけの色違いではなく、物語で向き合う相手と場所を変える。
  const x=focalX;
  switch(scene.focus){
    case "city": ellipse(154,23,10,10,C.blue);traveller(73,75,0.8);break;
    case "threeSouls": for(let i=0;i<3;i++){ellipse(126+i*21,64,5,7,[C.soul,C.gold,C.purple][i],false);glow(126+i*21,64,14,[45,126,133]);}traveller(88,76,0.55);break;
    case "door": case "openDoor": rect(78,14,38,66,C.gold);rect(81,17,32,63,C.black);poly([[81,17],[107,23],[107,80],[81,80]],C.wood);traveller(92,71,0.58);break;
    case "lamp": case "highLamp": candle(128,62,scene.focus==="highLamp"?2:1);rect(142,66,17,29,C.wood);rect(146,70,9,20,C.purple);break;
    case "vessel": table(87,82,77);doll(132,57,"full",0.7);ellipse(130,68,3,4,C.soul,false);glow(130,68,27,[34,152,145]);break;
    case "partyThree": case "partyFour": for(let i=0;i<(scene.focus==="partyThree"?3:4);i++)doll(82+i*24,65+i%2*5,"full",0.55);break;
    case "guard": poly([[37,59],[51,59],[58,93],[30,93]],C.iron);ellipse(44,49,7,9,C.iron);rect(36,49,16,3,C.black);line(29,22,29,98,C.gold,2);for(let i=0;i<4;i++)doll(87+i*25,72,"full",0.45);break;
    case "lantern": if(scene.setting!=="throne")rect(x-19,78,43,17,C.stone);lantern(x,67);break;
    case "sigil": sigil(149,43);ring(125,80,3,C.gold);line(125,83,125,95,C.gold,2);break;
    case "abbeyMap": map(119,54,"abbeyMap");poly([[137,61],[151,61],[151,80],[137,80]],C.stone);line(143,63,143,74,C.gold);line(139,67,147,67,C.gold);break;
    case "ordo": traveller(93,54,0.75);lantern(112,63);doll(145,54,"full",0.5);break;
    case "sealedKey": paper(127,62,38,22);ring(144,60,6,C.gold);line(144,65,144,84,C.gold,3);rect(144,79,8,3,C.gold);break;
    case "arm": if(scene.setting==="water")poly([[73,83],[102,76],[137,80],[155,87]],C.stone);doll(x,75,"arm");break;
    case "joint": doll(135,79,"arm");rect(149,84,15,5,C.purple);break;
    case "waterMap": map(116,53,"waterMap");rect(163,74,5,9,C.gold);break;
    case "pass": paper(122,49,38,29);ellipse(144,71,5,5,[154,48,49]);line(147,75,162,89,C.gold);break;
    case "campLetter": ellipse(71,87,21,5,C.dark);for(let i=0;i<5;i++)line(57+i*5,82,64+i*5,90,C.wood,2);paper(114,69,43,22);rect(144,72,13,16,C.wood);traveller(25,72,0.55);break;
    case "fortMap": map(116,48,"fortMap");rect(132,57,22,15,C.stone);for(let i=0;i<3;i++)rect(132+i*8,54,5,5,C.stone);break;
    case "fortWindow": window(121,10,37,51,true);candle(125,67);break;
    case "fort": traveller(80,74,0.6);lantern(96,88);poly([[123,16],[129,14],[129,39],[123,41]],C.purple);break;
    case "roll": table(63,78,98);paper(79,52,49,27);paper(130,55,24,25);line(129,51,129,79,C.wood,2);ring(146,82,5,C.iron);line(147,86,159,95,C.iron,2);break;
    case "emptySeat": rect(132,39,23,43,C.wood);rect(136,43,15,26,C.purple);rect(132,78,26,7,C.wood);candle(174,58);break;
    case "names": for(let i=0;i<6;i++){for(let j=0;j<6;j++)line(73+j*13,19+i*10,78+j*13,23+i*10,C.bone);line(72,25+i*10,151-i*7,25+i*10,C.edge);}sigil(148,79);break;
    case "seraHead": table(scene.setting==="prison"?72:97,84,75);doll(x+9,73,"head",1.2);if(scene.people==="irene")candle(163,62);else traveller(37,80,0.6);break;
    case "namesScroll": paper(120,44,49,36);for(let i=0;i<4;i++)line(124,51+i*6,159,51+i*6,C.wood);break;
    case "banner": line(123,11,120,95,C.iron,3);poly([[124,15],[165,18],[160,43],[149,36],[140,43],[123,35]],C.purple);line(132,19,155,35,C.gold);poly([[150,18],[154,23],[151,29],[157,31],[158,35],[162,25]],C.black);break;
    case "stormWindow": window(126,10,38,49,true);paper(124,65,39,15);break;
    case "soulMap": map(63,41,"soulMap");for(const [dx,dy]of [[0,0],[31,10],[54,5]])glow(80+dx,60+dy,12,[26,85,77],0.4);break;
    case "sealedOrder": paper(75,41,57,25);for(const q of [111,123])ellipse(q,61,4,4,[170,50,50]);line(85,57,131,58,C.wood);break;
    case "crown": paper(124,60,33,19);rect(128,53,25,7,C.gold);for(let i=0;i<4;i++)poly([[128+i*7,53],[131+i*7,45],[135+i*7,53]],C.gold);break;
    case "fadingLamp": candle(115,58,1,true);glow(115,54,13,[91,86,142],0.25);break;
    case "pit": ellipse(99,83,41,18,C.iron);ellipse(99,83,37,15,C.black);line(126,67,145,102,C.gold);traveller(37,69,0.7);break;
    case "rope": line(111,0,109,103,C.paper,2);for(let i=0;i<7;i++)line(108,38+i*2,117,43+i*2,C.paper);paper(122,41,35,18);break;
    case "gardenWindow": window(124,6,43,51);poly([[139,55],[143,30],[136,20],[145,24],[152,15],[150,32],[154,55]],C.wood);break;
    case "hutDiary": rect(50,33,99,58,C.wood);poly([[40,34],[96,7],[158,34]],C.dark);rect(62,45,26,45,C.black);table(103,77,45);paper(108,56,29,22);ellipse(125,52,6,7,C.bone);break;
    case "diary": rect(118,50,50,27,C.wood);paper(119,51,23,22);paper(144,51,21,22);line(142,49,142,77,C.gold);break;
    case "torso": doll(x,57,"torso",1.25);for(let i=0;i<5;i++)line(75+i*9,93,92+i*7,69,C.wood,3);paper(140,57,30,21);break;
    case "cup": rect(126,54,25,4,C.gold);poly([[127,58],[150,58],[144,72],[134,72]],C.gold);rect(137,71,5,10,C.gold);rect(131,81,18,3,C.gold);paper(156,64,21,15);break;
    case "seraTogether": doll(137,69,"torso",0.7);doll(127,55,"head",0.7);doll(112,83,"arm",0.6);paper(153,73,21,14);break;
    case "climbingOrdo": poly([[65,0],[128,0],[152,108],[43,108]],C.wood);poly([[80,0],[112,0],[126,108],[65,108]],C.black);for(let i=0;i<35;i++){const xx=84+h2(i,4,seed)*24,yy=h2(i,3,seed)*108;ellipse(xx,yy,1,3,C.soul,false);glow(xx,yy,6,[35,113,94],0.4);}traveller(96,44,0.5);line(64,85,41,98,C.bone,5);break;
    case "chancellor": poly([[105,47],[119,47],[138,98],[87,98]],C.black);ellipse(111,36,7,10,C.skin);rect(107,24,13,5,C.black);line(112,42,117,42,C.bone);line(88,96,136,96,C.gold);break;
    case "brokenVessel": doll(123,63,"torso",0.75);doll(150,83,"arm",0.7);doll(110,80,"head",0.7);for(let i=0;i<5;i++)rect(131+i*4,91-i%2*4,3,2,C.soul,false);break;
    case "twoChairs": for(const q of [93,145]){rect(q,66,18,24,C.wood);rect(q+3,70,12,16,C.purple);}candle(129,70);break;
    // ---- 第四章「王都の地下」・第五章「灼熱の洞」 ----
    case "votive": for(let i=0;i<4;i++){const q=40+i*34,sz=1-i*0.12;rect(q-5*sz,60-12*sz,10*sz,22*sz,C.stone);poly([[q-9*sz,60-12*sz],[q,52-14*sz],[q+9*sz,60-12*sz]],C.edge);}ellipse(142,52,3,5,C.soul,false);glow(142,52,22,[60,200,200],0.7);sigil(142,36);break;
    case "mural": rect(58,10,108,62,[96,82,70]);for(let i=0;i<8;i++)line(60+h2(i,3,seed)*100,12+h2(i,5,seed)*56,66+h2(i,7,seed)*100,18+h2(i,9,seed)*50,[70,60,52]);poly([[82,64],[94,30],[106,64]],C.bone);ellipse(94,26,5,6,C.skin);rect(88,17,13,4,C.gold);poly([[128,64],[136,32],[144,64]],[60,60,70]);ellipse(136,28,4,6,[220,215,210]);line(133,28,139,28,C.black);line(146,52,152,46,[80,140,70],2);break;
    case "legs": ellipse(100,92,52,10,C.dark);for(let i=0;i<6;i++)line(52+i*18,108,70+i*12,74,C.wood,2);line(92,62,86,96,C.wood,5);line(110,62,116,96,C.wood,5);ring(92,62,4,C.iron);ring(110,62,4,C.iron);ring(88,80,3,C.iron);ring(114,80,3,C.iron);sigil(101,46);break;
    case "seraWake": table(98,84,64);doll(130,52,"full",0.8);ellipse(130,62,3,4,C.soul,false);glow(130,62,30,[60,210,200],0.8);lantern(166,72);break;
    case "priestKing": poly([[120,0],[150,0],[156,108],[112,108]],C.wood);for(let i=0;i<20;i++){const yy=h2(i,3,seed)*100;ellipse(134+h2(i,5,seed)*10-5,yy,1,3,C.soul,false);}rect(64,44,30,44,[70,80,110]);poly([[62,40],[70,30],[79,38],[87,30],[96,40]],C.gold);ellipse(79,52,7,9,[170,190,210]);poly([[68,60],[90,60],[96,92],[62,92]],[150,170,200]);glow(79,60,30,[120,160,220],0.35);break;
    case "blade": rect(108,20,40,72,C.iron);rect(112,24,32,64,C.black);line(126,40,104,76,[210,210,220],3);line(104,76,99,84,C.wood,3);rect(96,82,7,4,[120,60,40]);for(let i=0;i<5;i++)line(127-i,40+i*7,123-i,46+i*7,C.iron);glow(128,56,24,[255,110,40],0.4);break;
    case "husks": for(let i=0;i<9;i++){const q=72+(i%4)*22+(i>3?11:0),yy=86-Math.floor(i/4)*15;doll(q,yy,"torso",0.55);ellipse(q,yy-8,4,5,[40,32,30]);}for(let i=0;i<40;i++)rect(h2(i,2,seed)*W,h2(i,4,seed)*90,1,2,[150,140,130],false);paper(150,40,24,16);break;
    case "cauldron": ellipse(98,102,48,8,C.black);poly([[56,52],[140,52],[132,92],[64,92]],[60,40,38]);ellipse(98,52,42,8,[200,90,40]);glow(98,52,46,[255,120,40],0.6);line(64,92,58,104,C.iron,3);line(132,92,138,104,C.iron,3);poly([[156,40],[166,40],[172,98],[150,98]],C.black);ellipse(161,33,5,7,C.skin);break;
    case "abyss": ellipse(98,80,60,24,C.black);ellipse(98,80,50,19,[8,6,14]);for(let i=0;i<20;i++){const a=h2(i,2,seed)*6.28,r=10+h2(i,4,seed)*40;rect(98+Math.cos(a)*r,80+Math.sin(a)*r*0.38,1,1,C.soul,false);}candle(160,58,1);break;
    // ---- 第六章「氷結回廊」 ----
    case "coat": poly([[40,76],[150,72],[160,78],[44,86]],C.snow);poly([[44,86],[160,78],[150,90],[52,94]],C.iceD);for(let i=0;i<9;i++)poly([[58+i*11,92],[62+i*11,92],[60+i*11,100+h2(i,4,seed)*6]],C.ice);
      poly([[116,78],[122,78],[120,22],[118,22]],C.ice);poly([[110,30],[128,30],[134,58],[140,74],[100,76],[104,56]],C.coat);ellipse(119,30,8,3,C.coat);line(104,34,98,58,C.coat,4);line(130,34,140,46,C.coat,4);
      line(100,75,140,73,C.gold);line(119,34,119,74,C.gold);paper(124,52,9,6);for(let i=0;i<12;i++)rect(100+h2(i,3,seed)*40,30+h2(i,5,seed)*44,1,1,C.snow,false);ellipse(108,6,30,6,[90,30,20]);ellipse(108,5,26,4,C.black);break;
    case "frozenMasters": for(let i=0;i<5;i++){const q=56+i*24,sz=1-Math.abs(i-2)*0.08,top=28+Math.abs(i-2)*6;rect(q-9*sz,0,18*sz,90,C.ice);
      const body=[[q-2,top+17],[q+2,top+17],[q+5.5,top+22],[q+4.6,top+44],[q+6,90],[q-6,90],[q-4.6,top+44],[q-5.5,top+22]];
      if(i===3){poly(body,C.iceD);ellipse(q,top+12,3.4,4,C.iceD);for(let k=0;k<body.length;k++){const a=body[k],b=body[(k+1)%body.length];line(a[0],a[1],b[0],b[1],C.snow,1,false);}line(q+5,top+30,q+9,top+24,C.snow,1,false);}
      else{poly(body,[24,34,56]);line(q-5,top+22,q-6.6,top+46,[24,34,56],2);line(q+5,top+22,q+6.6,top+46,[24,34,56],2);ellipse(q,top+12,3.4,4,[150,170,190]);}
      line(q-6*sz,0,q-6*sz,90,C.snow,1,false);rect(q-11*sz,88,22*sz,4,C.snow);}glow(124,60,26,[150,210,240],0.25);break;
    case "auroraMap": for(const [y0,col] of [[18,[80,230,150]],[28,[80,140,240]],[10,[150,90,220]]]){const pts=[];for(let xx=0;xx<=W;xx+=12)pts.push([xx,y0+Math.sin(xx*0.05+y0)*6]);for(let xx=W;xx>=0;xx-=12)pts.push([xx,y0+9+Math.sin(xx*0.05+y0)*6]);poly(pts,col);}
      for(let i=0;i<24;i++){const xx=h2(i,3,seed)*W,yy=8+h2(i,4,seed)*30;ellipse(xx,yy,1,1,[230,255,244],false);glow(xx,yy,5,[60,200,150],0.4);}glow(96,24,70,[60,200,150],0.35);paper(92,84,44,16);rect(136,92,5,4,C.ice);break;
    case "frostKing": for(let k=0;k<3;k++)rect(96-k*8,82+k*6,64+k*16,6,C.ice);poly([[108,82],[106,30],[112,20],[116,28],[122,14],[128,26],[134,18],[140,30],[138,82]],C.ice);rect(104,62,38,20,C.iceD);
      poly([[115,46],[131,46],[134,80],[112,80]],[62,72,104]);ellipse(123,40,5,6,C.bone);poly([[119,43],[127,43],[123,52]],C.snow);for(let i=0;i<4;i++)poly([[118+i*3,34],[119.5+i*3,27-(i%2)*2],[121+i*3,34]],C.snow);glow(123,32,18,[160,220,255],0.6);break;
    case "thaw": table(84,84,84);rect(104,58,30,26,[120,170,206]);poly([[104,58],[134,58],[130,52],[108,52]],C.snow);for(let i=0;i<4;i++)line(108+i*7,84,108+i*7,88+h2(i,2,seed)*4,C.ice);ellipse(119,93,20,2,C.iceD);line(106,60,106,82,C.snow,1,false);
      ellipse(119,71,2,3,C.soul,false);glow(119,71,9,[60,200,170],0.4);candle(156,64);glow(140,64,34,[255,170,80],0.35);break;
    // ---- 第七章「毒沼」 ----
    case "splint": rect(66,0,9,74,[150,190,186]);line(68,0,68,74,C.snow,1,false);line(72,4,73,74,[200,226,222],1,false);ellipse(71,74,15,3,C.snow,false);glow(71,72,24,[140,200,190],0.4);
      poly([[0,86],[60,82],[120,84],[192,80],[192,108],[0,108]],C.mud);ellipse(82,96,22,4,[40,56,52]);poly([[66,95],[74,91],[88,92],[82,96]],C.ice);poly([[82,99],[92,96],[100,98],[94,101]],C.ice);
      line(108,96,118,94,C.wood,4);ellipse(120,94,4,3,C.wood);for(let i=0;i<4;i++)line(123,92+i*2,128,89+i*2.6,C.wood);line(119,92,121,88,C.wood);ring(115,95,2,C.iron);
      paper(22,88,22,12);ellipse(42,89,5,3,C.stone);for(let i=0;i<4;i++){ellipse(140+i*13,99-i*4,2,1,C.black);line(133+i*13,101-i*4,141+i*13,100-i*4,C.black);}break;
    case "dollPile": { const crest=(q,yy,sz)=>{ellipse(q,yy,2.6*sz,1.4*sz,C.gold,false);for(let k=0;k<4;k++)line(q+0.6*sz+k*0.9*sz,yy-0.6*sz,q+1.2*sz+k*1.1*sz,yy-2.6*sz,C.gold,1,false);line(q-2.2*sz,yy,q-3*sz,yy-1.8*sz,C.gold,1,false);ellipse(q-0.6*sz,yy-2.6*sz,0.9*sz,1.6*sz,[255,190,90],false);};
      poly([[30,108],[76,52],[100,46],[128,54],[170,108]],[46,40,30]);for(let i=0;i<60;i++){const xx=40+h2(i,2,seed)*120,yy=58+h2(i,3,seed)*48;line(xx,yy,xx+4+h2(i,4,seed)*6,yy+(h2(i,5,seed)-0.5)*5,C.wood,2);}
      for(let i=0;i<6;i++){const q=66+i*13,yy=56+Math.abs(q-100)*0.25;doll(q,yy,"torso",0.45);crest(q,yy+5,0.6);}
      doll(150,70,"torso",1.1);crest(150,80,1.6);glow(150,78,14,[255,170,70],0.4);break; }
    case "miasmaNote": poly([[60,84],[72,76],[130,74],[146,82],[138,96],[66,96]],C.stone);paper(76,72,30,13);for(const [q,yy] of [[78,73],[104,73],[104,84]])ellipse(q,yy,2,1.4,C.edge);
      for(let i=0;i<6;i++)line(110,76,118+i,70+i*1.4,[150,170,80]);for(const [q,hh,col] of [[126,13,[150,220,170]],[134,9,null]]){poly([[q-3,77],[q+3,77],[q+3,77-hh*0.6],[q+1,77-hh],[q-1,77-hh],[q-3,77-hh*0.6]],col||[90,110,96]);rect(q-1,76-hh,3,2,C.wood);}glow(126,70,14,[120,220,160],0.5);
      ring(42,98,8,C.stone);ellipse(42,98,6,2,[110,104,92]);rect(40,97,4,1,[230,120,40],false);break;
    case "workshopIsle": ellipse(100,84,52,9,[40,44,30]);poly([[64,84],[64,48],[80,38],[96,46],[112,36],[134,48],[134,84]],C.stone);for(let x2=66;x2<134;x2+=9)line(x2,50,x2,84,[60,56,62]);
      poly([[88,84],[88,62],[100,54],[112,62],[112,84]],[60,46,30]);glow(100,70,34,[255,170,70],0.6);poly([[92,84],[93,66],[97,62],[99,66],[98,74],[100,84]],C.black);line(98,66,104,65,C.black,1);
      ellipse(107,64,2.4,2.8,C.black);poly([[104,84],[105,68],[110,68],[111,84]],C.black);ellipse(107.5,74,1.6,1.8,C.soul,false);glow(107,74,8,[60,200,170],0.6);
      for(let i=0;i<20;i++)line(36+h2(i,2,seed)*130,94+h2(i,3,seed)*12,44+h2(i,2,seed)*130,94+h2(i,3,seed)*12,[60,80,40]);break;
    case "tower": ellipse(98,92,40,7,[34,38,26]);poly([[82,94],[86,0],[112,0],[116,94]],[30,30,40]);for(let yy=6;yy<94;yy+=12)line(84,yy,114,yy+5,[46,46,60]);
      for(const [q,yy] of [[94,20],[104,44],[92,66],[100,8]]){rect(q,yy,2,3,[230,190,110],false);glow(q+1,yy+1,6,[200,150,60],0.4);}
      rect(94,80,9,14,C.black);glow(98,86,10,[200,150,70],0.3);traveller(98,78,0.32);
      poly([[150,0],[140,18],[148,17],[134,44],[156,13],[147,14]],[200,210,240]);glow(146,20,30,[150,160,230],0.35);for(let i=0;i<40;i++)line(h2(i,2,seed)*W,h2(i,3,seed)*90,h2(i,2,seed)*W-2,h2(i,3,seed)*90+5,[110,120,150]);break;
    default: throw new Error(`読み物の図版に未定義の主題: ${scene.focus}`);
  }
  if(scene.people==="irene")irene(scene.pose==="shelter"?80:62,scene.pose==="seated"?66:63,scene.pose);
  // 奥行きを示す手前の欄干と、端へ落ちる暗がり。
  if(scene.setting==="mansion"){line(0,101,192,101,C.wood,4);for(let q=9;q<W;q+=35)rect(q,94,3,14,C.dark);}
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){
    const d=Math.min(0.68,((xx-W/2)/(W/2))**4*0.42+((y-H/2)/(H/2))**4*0.30),i=(y*W+xx)*3;
    for(let j=0;j<3;j++)L.c[i+j]*=1-d;
  }
  const swamp = scene.setting === "swamp" || SWAMP_FOCUS.includes(scene.focus);
  return L.canvas(8, swamp ? SWAMP_PAL : scene.setting === "ice" || ICE_FOCUS.includes(scene.focus) ? ICE_PAL : undefined);
}

export function archiveArt(scene) {
  if (!scene || !ARCHIVE_FOCUS.includes(scene.focus)) return null;
  if (!cache.has(scene.id)) cache.set(scene.id, paintScene(scene));
  const canvas = document.createElement("canvas");
  canvas.width = ARCHIVE_ART_W; canvas.height = ARCHIVE_ART_H;
  canvas.getContext("2d").drawImage(cache.get(scene.id), 0, 0);
  canvas.setAttribute("role", "img");
  return canvas;
}

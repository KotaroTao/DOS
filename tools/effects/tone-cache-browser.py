"""斬撃色を巡回しても描画から画素変換を始めないこと、素材と保持上限を検査。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/effects-lab.html');page.wait_for_timeout(1500)
 report=page.evaluate('''async()=>{
 const {drawMaterialSkill,materialPerformance}=await import('/src/skill-fx-materials.js');
 const {PHYSICAL_TONES}=await import('/src/skill-fx-tones.js');
 const colors=Object.keys(PHYSICAL_TONES),c=document.createElement('canvas').getContext('2d');
 let reads=0;const original=CanvasRenderingContext2D.prototype.getImageData;
 CanvasRenderingContext2D.prototype.getImageData=function(...args){if(args[2]===1152&&args[3]===288)reads++;return original.apply(this,args);};
 const draw=col=>drawMaterialSkill(c,{design:{family:'cut',kind:'phys',tier:1},col,x:150,y:150,dur:400},.1,640,360,false,false);
 for(let pass=0;pass<2;pass++)for(const col of colors){draw(col);await new Promise(r=>setTimeout(r,20));}
 if(reads!==0)throw Error('描画から斬撃の画素を読み出した');
 const readbacksDuringRendering=reads;
 const stats=materialPerformance();if(stats.residentTones>stats.maxTones||stats.decodedBytes>16*1152*288*4)throw Error('色素材の保持上限を超えた');
 // 出荷前の色変換も同じ式・同じ透明度。強い色と淡い色の両方を比較する。
 const base=new Image();base.src='/art/effects/physical-materials.webp';await base.decode();
 const sample=document.createElement('canvas');sample.width=1152;sample.height=288;const ctx=sample.getContext('2d');ctx.drawImage(base,0,0);const a=ctx.getImageData(0,0,1152,288).data;
 for(const color of ['#ff4938',colors.at(-1)]){
  const img=new Image();img.src=new URL(PHYSICAL_TONES[color],location.origin+'/src/skill-fx-tones.js').href;await img.decode();
  if(img.naturalWidth!==1152||img.naturalHeight!==288)throw Error('斬撃素材の寸法');
  ctx.clearRect(0,0,1152,288);ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,1152,288).data;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  for(let i=0;i<a.length;i+=4){if(data[i+3]!==a[i+3])throw Error('斬撃の透明度・形状が変化');if(a[i+3]<120)continue;for(let k=0;k<3;k++){
   const expected=a[i+k]*Math.min(1,.3+rgb[k]*.7+Math.max(0,(a[i+k]-195)/60)*.35);
   if(Math.abs(data[i+k]-expected)>6)throw Error('色変換の式が変化:'+JSON.stringify({color,i,k,alpha:a[i+3],before:a[i+k],after:data[i+k],expected}));
  }}
 }
 return {colors:colors.length,readbacksDuringRendering,...stats};
 }''')
 assert not errors,errors
 print(report);b.close()

"""連撃の時間枠ごとに該当する作用点だけが光る。低減時は全作用点を固定表示する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 result=page.evaluate('''async()=>{
 const image=new Image();image.src='/art/effects/skill-materials.webp';await image.decode();
 const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawSkillScene}=await import('/src/skill-fx.js');
 const {setFxQuality}=await import('/src/skill-fx-budget.js');let frames=0;
 for(const key of ['DOUBLE','RINNE'])for(const quality of ['high','low'])for(const reduced of [false,true]){
  setFxQuality(quality);const e=previewSkillFx(key)[0],expected=key==='DOUBLE'?2:6;
  if(e.strikes.length!==expected)throw Error(key+' 打数');
  const canvas=document.createElement('canvas');canvas.width=expected*500;canvas.height=400;const c=canvas.getContext('2d');
  e.pts=[];e.primaryPts=[];e.signature=null;e.ultimate=null;e.source=null;e.marks=false;
  e.strikes.forEach((p,i)=>{p.x=250+i*500;p.y=200;});
  for(let i=0;i<expected;i++){
   c.clearRect(0,0,canvas.width,400);drawSkillScene(c,e,(i+.3)*85/e.dur,canvas.width,400,reduced);
   for(let j=0;j<expected;j++){
    const pixels=c.getImageData(250+j*500-50,150,100,100).data,visible=pixels.some((v,k)=>k%4===3&&v>0);
    if(visible!==(reduced||i===j))throw Error(key+' '+quality+' '+reduced+' 枠'+i+' 対象'+j);
   }frames++;
  }
 }
 return {frames};
}''')
 print('二連・六連×通常/軽量×動き低減ON/OFF:',result);b.close()

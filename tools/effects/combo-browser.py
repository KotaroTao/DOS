"""連撃の各時間枠で一回だけ斬撃を描くことを実Canvasで確認する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 result=page.evaluate('''async()=>{
 const {previewSkillFx}=await import('/src/skill-fx-preview.js');
 const {drawSkillScene}=await import('/src/skill-fx.js');
 const {setFxQuality}=await import('/src/skill-fx-budget.js');
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
 const c=canvas.getContext('2d'),stroke=c.stroke.bind(c);let slashes=0;
 c.stroke=()=>{if(c.strokeStyle==='#fff9ef')slashes++;stroke();};
 let frames=0;
 for(const key of ['DOUBLE','RINNE'])for(const quality of ['high','low'])for(const reduced of [false,true]){
  setFxQuality(quality);const e=previewSkillFx(key)[0];
  const expected=key==='DOUBLE'?2:6;if(e.strikes.length!==expected)throw Error(key+' 打数');
  for(let i=0;i<expected;i++){
   slashes=0;c.clearRect(0,0,640,360);drawSkillScene(c,e,(i+.3)/expected,640,360,reduced);
   if(slashes!==1)throw Error(key+' '+quality+' '+reduced+' '+i+': '+slashes);frames++;
  }
 }
 return {frames};
}''')
 print('二連・六連×通常/軽量×動き低減ON/OFF:',result)
 b.close()

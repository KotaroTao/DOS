"""射撃の3段階と固有軌道を通常・軽量・動き低減で描き、空描画と重複を検査する。"""
from playwright.sync_api import sync_playwright
import base64
from pathlib import Path
Path("/tmp/dos-skill-fx-check").mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 data=page.evaluate('''async()=>{
 const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
 const keys=['SOGEKI','RENSHA','SENNYA','HUNTER_HIYA','HUNTER_BAKUFU','HUNTER_ARASHIYUZURU','HUNTER_KARIGAMI','HUNTER_HOSHIOTOSHI','HUNTER_AMIUCHI'];
 const sheet=document.createElement('canvas');sheet.width=960;sheet.height=660;const out=sheet.getContext('2d');out.fillStyle='#141821';out.fillRect(0,0,960,660);
 for(const quality of ['high','low'])for(const reduced of [false,true]){
  setFxQuality(quality);const results=[];
  for(const [i,key]of keys.entries()){
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');const scene=previewSkillFx(key);drawBattleFx(ctx,scene,scene[0].dur*.42,640,360,reduced);
   const pixels=ctx.getImageData(0,0,640,360).data;if(!pixels.some(v=>v))throw Error(key+' 空の描画');
   results.push(canvas.toDataURL());
   if(quality==='high'&&!reduced){out.drawImage(canvas,i%3*320,Math.floor(i/3)*220,320,180);out.fillStyle='#ffffff';out.font='13px sans-serif';out.fillText(key,i%3*320+8,Math.floor(i/3)*220+200);}
  }
  if(new Set(results).size!==keys.length)throw Error('射撃の描画が重複');
 }
 setFxQuality('high');return sheet.toDataURL().split(',')[1];}''')
 open('/tmp/dos-skill-fx-check/projectiles.png','wb').write(base64.b64decode(data));b.close()

"""補助9系統の格別の形を通常・軽量・動き低減で確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 print(page.evaluate('''async()=>{
 const {drawSkillScene}=await import('/src/skill-fx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
 const families=['mana','empower','charge','weaken','dispel','seal','poison','illusion','sleep'];
 let checks=0;const board=document.createElement('canvas');board.width=720;board.height=9*160;const bc=board.getContext('2d');bc.fillStyle='#151520';bc.fillRect(0,0,720,1440);
 for(const [row,family] of families.entries())for(const [quality,reduced] of [['high',false],['low',false],['high',true]]){
  setFxQuality(quality);const images=[];
  for(let tier=1;tier<=3;tier++){
   const c=document.createElement('canvas');c.width=240;c.height=160;const ctx=c.getContext('2d');
   const e={design:{family,tier,scale:1},x:120,y:80,seed:17,pts:[],w:80};drawSkillScene(ctx,e,.35,240,160,reduced);
   if(!ctx.getImageData(0,0,240,160).data.some(v=>v>0))throw Error(family+' 描画なし');images.push(c.toDataURL());checks++;
   if(quality==='high'&&!reduced){bc.drawImage(c,(tier-1)*240,row*160);bc.fillStyle='#fff';bc.fillText(family+' '+tier,(tier-1)*240+5,row*160+15);}
  }
  if(new Set(images).size!==3)throw Error(family+' 格の形が同じ');
 }
 setFxQuality('high');document.body.replaceChildren(board);return checks;
 }'''))
 page.locator('canvas').screenshot(path='/tmp/support-ranks.png');b.close()

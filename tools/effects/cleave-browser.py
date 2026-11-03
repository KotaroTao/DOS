"""なぎ払いの3ランク・専用軌跡・属性色を確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 print(page.evaluate('''async()=>{
 const {drawSkillScene}=await import('/src/skill-fx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
 const {CLEAVE_TOP,CLEAVE_COLORS}=await import('/src/cleave-fx.js');
 const {previewSkillFx}=await import('/src/skill-fx-preview.js');
 let checks=0;const board=document.createElement('canvas');board.width=720;board.height=1280;const bc=board.getContext('2d');bc.fillStyle='#151520';bc.fillRect(0,0,720,1280);
 const cases=[1,2,3,...Object.keys(CLEAVE_TOP)];
 for(const [quality,reduced] of [['high',false],['low',false],['high',true]]){
  const images=[];setFxQuality(quality);
  for(const [i,key] of cases.entries()){
   const c=document.createElement('canvas');c.width=240;c.height=160;const ctx=c.getContext('2d');
   const e=typeof key==='number'?{design:{family:'cleave',tier:key,scale:1},seed:17,pts:[],w:120}:previewSkillFx(key)[0];
   e.x=120;e.y=80;e.w=120;e.pts=[];
   drawSkillScene(ctx,e,.35,240,160,reduced);
   if(!ctx.getImageData(0,0,240,160).data.some(v=>v>0))throw Error(key+' 描画なし');images.push(c.toDataURL());checks++;
   if(quality==='high'&&!reduced){bc.drawImage(c,i%3*240,Math.floor(i/3)*160);bc.fillStyle='#fff';bc.fillText(String(key),i%3*240+5,Math.floor(i/3)*160+15);}
  }
  if(new Set(images).size!==cases.length)throw Error('重複する軌跡');
 }
 for(const [key,element] of [['KAENNAGI','fire'],['UZUSHIO','water']])if(previewSkillFx(key)[0].col!==CLEAVE_COLORS[element])throw Error(key+' 属性色');
 setFxQuality('high');document.body.replaceChildren(board);return checks;
 }'''))
 page.locator('canvas').screenshot(path='/tmp/cleave-ranks.png');b.close()

"""全系統の材質・ランク・低減・素材失敗・全技への適用を実Canvasで検査し、比較画像を残す。"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/dos-material-fx');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':760,'height':900},service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/effects-lab.html');page.wait_for_function('window.__effectsLab');page.wait_for_timeout(1500)
 result=page.evaluate('''async()=>{
 const img=new Image();img.src='/art/effects/skill-materials.webp';await img.decode();
 if(img.naturalWidth!==576||img.naturalHeight!==2880)throw Error('アトラス寸法');
 const {SPELLS}=await import('/src/skilldefs.js'),{SKILL_FX_CATALOG}=await import('/src/skill-fx-catalog.js');
 const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js');
 const {MATERIAL_FAMILIES}=await import('/src/skill-fx-materials.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
 const forbidden=['stroke','fill','arc','ellipse','lineTo','moveTo','rect','fillRect','strokeRect','bezierCurveTo','quadraticCurveTo'];
 const used=new Map();for(const key of Object.keys(SPELLS)){const f=SKILL_FX_CATALOG[key].family;if(!used.has(f))used.set(f,key);}
 if([...used.keys()].some(f=>f!=='firePillar'&&!MATERIAL_FAMILIES.includes(f)))throw Error('未対応系統');
 const board=document.createElement('canvas');board.width=720;board.height=used.size*180;const bc=board.getContext('2d');bc.fillStyle='#1b1922';bc.fillRect(0,0,board.width,board.height);
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d');for(const method of forbidden)c[method]=()=>{throw Error('技で図形APIを使用: '+method);};let draws=0;const real=c.drawImage.bind(c);c.drawImage=(...args)=>{draws++;real(...args);};
 let checked=0;for(const key of Object.keys(SPELLS)){
  const scene=previewSkillFx(key);draws=0;c.clearRect(0,0,640,360);drawBattleFx(c,scene,scene[0].dur*.4,640,360,false);
  if(!draws)throw Error(key+' が材質を使用していない');checked++;
 }
 let row=0,comparisons=0;const rows=[],familyImages=new Map();
 for(const [family,key]of used){
  const e=previewSkillFx(key)[0],rankImages=[];
  for(let tier=1;tier<=3;tier++){
   const scene={...e,strikes:[],pts:[],primaryPts:[],ultimate:null,signature:null,all:false,x:320,y:200,w:100,design:{family,tier,scale:1},dur:1200};
   setFxQuality('high');c.clearRect(0,0,640,360);drawBattleFx(c,[scene],480,640,360,false);
   bc.drawImage(canvas,(tier-1)*240,row*180,240,155);bc.fillStyle='#dcd5c5';bc.font='13px sans-serif';bc.fillText(family+' / '+tier,(tier-1)*240+8,row*180+172);
   rankImages.push(canvas.toDataURL());
   for(const reduced of [false,true])for(const quality of ['high','low']){
    setFxQuality(quality);const images=[];
    for(const fraction of [.12,.4,.8]){c.clearRect(0,0,640,360);drawBattleFx(c,[scene],scene.dur*fraction,640,360,reduced);images.push(canvas.toDataURL());}
    if(reduced&&new Set(images).size!==1)throw Error(family+' 低減中に動く');
    if(!reduced&&new Set(images).size<2)throw Error(family+' 材質が動かない');comparisons++;
   }
  }
  if(new Set(rankImages).size!==3)throw Error(family+' ランクが同じ');familyImages.set(family,rankImages[2]);rows.push({family,key});row++;
 }
 if(new Set(['heal','purify','mana','revive','radiance','empower'].map(f=>familyImages.get(f))).size!==6)throw Error('回復と補助の構図が重複');
 setFxQuality('high');board.style.width='720px';board.style.height=board.height+'px';document.body.replaceChildren(board);return {checked,comparisons,rows};
}''')
 page.locator('canvas').screenshot(path=str(OUT/'families-ranks.png'))
 for name,offset in [('physical',0),('elements',1500),('restoration',2200),('curses',3900),('utility',5000)]:
  page.evaluate('(y)=>scrollTo(0,y)',offset);page.screenshot(path=str(OUT/(name+'.png')))
 (OUT/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 fail=b.new_page(service_workers='block');fail.route('**/art/effects/skill-materials.webp',lambda r:r.abort());fail.goto('http://localhost:8000/effects-lab.html')
 assert fail.evaluate('''async()=>{
 const {MATERIAL_FAMILIES,drawMaterialSkill}=await import('/src/skill-fx-materials.js');
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=220;const c=canvas.getContext('2d');
 for(const family of MATERIAL_FAMILIES){c.clearRect(0,0,320,220);drawMaterialSkill(c,{design:{family,tier:3,scale:1},x:160,y:120,w:80},.4,320,220,false,false);if(!c.getImageData(0,0,320,220).data.some(v=>v))throw Error(family);}
 return true;
 }''')
 assert not errors,errors
 print(json.dumps({'checked':result['checked'],'comparisons':result['comparisons'],'families':len(result['rows']),'artifacts':str(OUT)},ensure_ascii=False));b.close()

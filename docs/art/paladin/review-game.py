"""ゲームと同じ描画関数をChromiumで使い全身・顔を確認する。"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
D=Path(__file__).parent
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':2400,'height':850},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/')
 page.evaluate('''async () => {
 const {jobSprite,jobBust}=await import('/src/souls.js');
 const {crispCanvas}=await import('/src/sprites.js');
 document.body.innerHTML='';
 document.head.innerHTML='<style>body{margin:0;padding:20px;background:#242228;color:#eee;font-family:sans-serif}h1{font-size:22px;margin:0 0 15px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}section{background:#302d35;padding:8px;overflow:hidden}h2{font-size:16px}.full{height:380px;display:flex;align-items:end;justify-content:center;border-bottom:1px solid #555}.faces{display:flex;align-items:start;gap:14px;height:65px;margin-top:20px}.large{margin-top:15px}canvas{flex-shrink:0}p{font-size:13px}</style>';
 const h=document.createElement('h1');h.textContent='死霊術師基準・聖騎士 R1〜R5／同倍率の全身と顔アイコン';document.body.append(h);
 const main=document.createElement('main');document.body.append(main);
 window.reviewSprites=[];
 for(const [key,r,label] of [['necromancer',1,'死霊術師 R1'],...[1,2,3,4,5].map(r=>['paladin',r,'聖騎士 R'+r])]) {
  const spr=jobSprite(key,r),bust=jobBust(key,r);
  if(!spr.photo||!bust.photo)throw new Error('原画の選択失敗 '+key+r);
  window.reviewSprites.push({key,rank:r,face:spr.face,head:spr.head,w:spr.w,h:spr.h,src:spr.photo.img.src});
  await Promise.all([spr.photo.img,bust.photo.img].map(img=>img.decode()));
  const section=document.createElement('section');main.append(section);
  const title=document.createElement('h2');title.textContent=label;section.append(title);
  const full=document.createElement('div');full.className='full';section.append(full);
  // 全職共通の枠を同じ4倍で表示。全身の頭頂・顎・足元を直接比較できる。
  const c=crispCanvas(spr,Math.max(spr.w,spr.h)*4);c.style.width=spr.w*4+'px';c.style.height=spr.h*4+'px';full.append(c);
  const note=document.createElement('p');note.textContent='顔アイコン 56 / 36 / 26 px';section.append(note);
  const faces=document.createElement('div');faces.className='faces';section.append(faces);
  for(const size of [56,36,26])faces.append(crispCanvas(bust,size));
  const large=document.createElement('div');large.className='large';large.append(crispCanvas(bust,180));section.append(large);
 }
}''')
 page.wait_for_function("[...document.querySelectorAll('canvas')].every(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0)})")
 page.screenshot(path=str(D/'game-display-review.png'),full_page=True)
 rows=page.evaluate('window.reviewSprites')
 assert len(rows)==6 and page.locator('canvas').count()==30
 assert all(rows[i]['face']==rows[0]['face'] for i in range(1,6)),rows
 assert all(abs(rows[i]['head'][j]-rows[0]['head'][j])<.3 for i in range(1,6) for j in range(3)),rows
 page.goto('http://127.0.0.1:8000/');page.wait_for_load_state('networkidle')
 assert not errors,errors
 json.dump({'sprites':rows,'canvasCount':30,'browserErrors':errors},open(D/'game-verification.json','w'),ensure_ascii=False,indent=2)
 browser.close()
 print('全身6枚・顔24枚の描画、共通座標とゲーム起動を確認')

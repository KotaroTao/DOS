"""ゲームと同じ描画関数をChromiumで使い全身・顔を確認する。"""
from pathlib import Path
import json, argparse, shutil
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser(description='基準の聖戦士と対象職業の全身・顔を同倍率で確認する')
ap.add_argument('job')
ap.add_argument('--label', help='画像に表示する職業名')
ap.add_argument('--ranks', nargs='+', type=int, choices=range(1,6), default=[1,2,3,4,5])
ap.add_argument('--url', default='http://127.0.0.1:8000/')
ap.add_argument('--chromium', default=shutil.which('chromium'))
ap.add_argument('--output', required=True, help='出力ファイル名の先頭（拡張子なし）')
ap.add_argument('--require-photos', action='store_true', help='取り込み後の新画像と基準座標も検査する')
a=ap.parse_args()
if not a.chromium: ap.error('Chromiumのパスを--chromiumで指定してください')
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=a.chromium,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':2400,'height':850},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(a.url)
 page.evaluate('''async ({job,label,ranks,requirePhotos}) => {
 const {jobSprite,jobBust,SOUL_CLASSES}=await import('/src/souls.js');
 const {crispCanvas}=await import('/src/sprites.js');
 if(!Object.hasOwn(SOUL_CLASSES,job))throw new Error('存在しない職業ID '+job);
 document.body.innerHTML='';
 document.head.innerHTML='<style>body{margin:0;padding:20px;background:#242228;color:#eee;font-family:sans-serif}h1{font-size:22px;margin:0 0 15px}main{display:grid;grid-template-columns:repeat(var(--columns),1fr);gap:8px}section{background:#302d35;padding:8px;overflow:hidden}h2{font-size:16px}.full{height:380px;display:flex;align-items:end;justify-content:center;border-bottom:1px solid #555}.faces{display:flex;align-items:start;gap:14px;height:65px;margin-top:20px}.large{margin-top:15px}canvas{flex-shrink:0}p{font-size:13px}</style>';
 const h=document.createElement('h1');h.textContent='聖戦士基準・'+label+'／同倍率の全身と顔アイコン';document.body.append(h);
 const main=document.createElement('main');main.style.setProperty('--columns',ranks.length+1);document.body.append(main);
 window.reviewSprites=[];
 for(const [key,r,displayLabel] of [['crusader',1,'基準：聖戦士 R1'],...ranks.map(r=>[job,r,label+' R'+r])]) {
  const spr=jobSprite(key,r),bust=jobBust(key,r);
  const w=spr.w ?? Math.max(...spr.art.map(row=>row.length)),h=spr.h ?? spr.art.length;
  if(requirePhotos&&(!spr.photo||!bust.photo))throw new Error('原画の選択失敗 '+key+r);
  if(requirePhotos&&!spr.photo.img.src.endsWith('/art/jobs/'+key+'_'+r+'.webp'))throw new Error('対象ランクの画像が未選択 '+key+r);
  window.reviewSprites.push({key,rank:r,face:spr.face,head:spr.head,w,h,src:spr.photo?.img.src ?? null});
  await Promise.all([spr.photo?.img,bust.photo?.img].filter(Boolean).map(img=>img.decode()));
  const section=document.createElement('section');main.append(section);
  const title=document.createElement('h2');title.textContent=displayLabel;section.append(title);
  const full=document.createElement('div');full.className='full';section.append(full);
  // 全職共通の枠を同じ4倍で表示。全身の頭頂・顎・足元を直接比較できる。
  const c=crispCanvas(spr,Math.max(w,h)*4);c.style.width=w*4+'px';c.style.height=h*4+'px';full.append(c);
  const note=document.createElement('p');note.textContent='顔アイコン 56 / 36 / 26 px';section.append(note);
  const faces=document.createElement('div');faces.className='faces';section.append(faces);
  for(const size of [56,36,26])faces.append(crispCanvas(bust,size));
  const large=document.createElement('div');large.className='large';large.append(crispCanvas(bust,180));section.append(large);
 }
}''', {'job':a.job,'label':a.label or a.job,'ranks':a.ranks,'requirePhotos':a.require_photos})
 page.wait_for_function("[...document.querySelectorAll('canvas')].every(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0)})")
 page.screenshot(path=str(out)+'.png',full_page=True)
 rows=page.evaluate('window.reviewSprites')
 assert len(rows)==len(a.ranks)+1 and page.locator('canvas').count()==5*len(rows)
 if a.require_photos:
  assert all(row['face']==rows[0]['face'] for row in rows),rows
  assert all(abs(row['head'][j]-rows[0]['head'][j])<.3 for row in rows for j in range(3)),rows
 page.goto(a.url);page.wait_for_load_state('networkidle')
 assert not errors,errors
 json.dump({'sprites':rows,'canvasCount':5*len(rows),'browserErrors':errors},open(str(out)+'.json','w'),ensure_ascii=False,indent=2)
 browser.close()
 print(f'全身{len(rows)}枚・顔{4*len(rows)}枚とゲーム起動を確認：{out}.png')

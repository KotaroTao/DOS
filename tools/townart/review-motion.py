#!/usr/bin/env python3
"""390px幅で修正前後の動きを比較する。先に localhost:8000 を起動する。

必要: Playwright、Pillow、Chromium、ffmpeg。変更した描画関数に時刻を渡して
実際の街の切り取りを6秒のGIFに残し、2秒間の明暗差も測る。
"""
import subprocess,json,tempfile,shutil
from pathlib import Path
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];out=root/'docs/art/town/panorama-review';results={}
baseline='3027c4ae5234982ad6a748a9c8d0af88b2238c74'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for variant in ['before','after']:
  page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  src=(subprocess.check_output(['git','show',f'{baseline}:src/townpaint.js'],cwd=root).decode() if variant=='before' else (root/'src/townpaint.js').read_text())
  src=src.replace('return living(c, paint, 20, true);','window.townReviewDraw=paint; return c;')
  page.route('**/src/townpaint.js',lambda route,request:route.fulfill(body=src,content_type='text/javascript'))
  if variant=='before':
   registry=subprocess.check_output(['git','show',f'{baseline}:src/townkeyart.js'],cwd=root).decode()
   page.route('**/src/townkeyart.js',lambda route:route.fulfill(body=registry,content_type='text/javascript'))
  page.goto('http://localhost:8000/?testDungeon=w17&testPlace=town')
  page.wait_for_function("document.querySelector('.town-scene')?.dataset.art==='painted'")
  page.evaluate('townReviewDraw(1000)')
  page.evaluate("window.motionBefore=document.querySelector('.town-scene').getContext('2d').getImageData(0,0,document.querySelector('.town-scene').width,document.querySelector('.town-scene').height).data")
  page.evaluate('townReviewDraw(3000)')
  results[variant]=page.evaluate('''() => {const c=document.querySelector('.town-scene'),a=motionBefore,b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const boxes={cloud:[.5,.32,.10,.06],lamp:[.50,.71,.025,.04],soul:[.14,.56,.04,.10]};return Object.fromEntries(Object.entries(boxes).map(([key,[x,y,w,h]])=>{let total=0,n=0,strong=0;for(let j=Math.floor(y*c.height);j<(y+h)*c.height;j++)for(let i=Math.floor(x*c.width);i<(x+w)*c.width;i++){const k=(j*c.width+i)*4;const d=(Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]))/3;total+=d;n++;if(d>8)strong++}return[key,{mean:total/n,visibleFraction:strong/n}]}))}''')
  frames=[]
  for i in range(60):
   page.evaluate('t=>townReviewDraw(t)',1000+i*100)
   frames.append(Image.open(BytesIO(page.locator('.hb-hero').screenshot())).convert('RGB'))
  with tempfile.TemporaryDirectory() as tmp:
   raw=Path(tmp)/'capture.gif'
   frames[0].save(raw,save_all=True,append_images=frames[1:],duration=100,loop=0)
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-vf','split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',str(out/f'motion-{variant}.gif')],check=True)
  page.close()
 b.close()
for key,minimum in [('cloud',5),('lamp',4),('soul',8)]:
 assert results['after'][key]['mean'] > minimum, f'{key}: 携帯幅で動きが弱い'
 assert results['after'][key]['visibleFraction'] > .15, f'{key}: 動く範囲が狭い'
shutil.copyfile(out/'motion-after.gif',out/'animation.gif')
(out/'motion-visibility.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,indent=2))

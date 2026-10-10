#!/usr/bin/env python3
"""タイトル演出の実画面を検査し、画像・GIFと明暗差を記録する。
先にリポジトリのルートで python3 -m http.server 8000 を起動する。
必要: Playwright、Pillow、Chromium。
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from io import BytesIO
import json
root=Path(__file__).resolve().parents[2]; out=root/'docs/art/title/review'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 results={}
 for w,h in [(390,844),(744,998),(1180,820)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  source=(root/'src/title.js').read_text().replace('scene = next;', 'scene = next; window.reviewScene = scene; window.reviewContext = g;').replace('if (!REDUCED) raf = requestAnimationFrame(loop);','')
  page.route('**/src/title.js',lambda route:route.fulfill(body=source,content_type='text/javascript'))
  page.goto('http://localhost:8000/')
  page.wait_for_function("window.reviewScene && document.querySelector('.ttl-ready')")
  page.wait_for_timeout(2200)
  def draw(t):
   page.evaluate('''t=>{const s=reviewScene;s.weatherTime=t;s.nextStorm=1e9;s.storm=null;s.crows=[];s.nextCrow=1e9;s.draw(reviewContext,t,0)}''',t)
   return Image.open(BytesIO(page.screenshot())).convert('RGB')
  before=draw(1000);after=draw(7000)
  crop=(0,0,w,int(h*.33))
  diff=ImageChops.difference(before.crop(crop),after.crop(crop))
  mean=sum(ImageStat.Stat(diff).mean)/3
  assert mean>2,(w,mean)
  after.save(out/f'rich-{w}x{h}.png')
  page.evaluate('''()=>{const s=reviewScene;s.nextStorm=0;s.draw(reviewContext,7050,50);s.draw(reviewContext,7150,100)}''')
  lightning=Image.open(BytesIO(page.screenshot())).convert('RGB');lightning.save(out/f'lightning-{w}x{h}.png')
  flash=sum(ImageStat.Stat(ImageChops.difference(after.crop(crop),lightning.crop(crop))).mean)/3
  assert flash>8,(w,flash)
  assert not errors,errors
  results[str(w)]={'cloud_motion_mean':round(mean,2),'lightning_mean':round(flash,2),'errors':errors}
  if w==390:
   frames=[]
   for i in range(40):
    page.evaluate('''i=>{const s=reviewScene;s.weatherTime=1000+i*150;s.nextStorm=i<15?3250:1e9;s.draw(reviewContext,1000+i*150,0)}''',i)
    frames.append(Image.open(BytesIO(page.screenshot())).convert('RGB'))
   frames[0].save(out/'rich-animation.gif',save_all=True,append_images=frames[1:],duration=150,loop=0)
  page.close()
 page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
 page.goto('http://localhost:8000/');page.wait_for_selector('.ttl-ready');page.wait_for_timeout(2200)
 a=page.locator('.ttl-scene').screenshot();page.wait_for_timeout(1000);assert a==page.locator('.ttl-scene').screenshot()
 b.close()
 (out/'rich-visibility.json').write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(results))

# 奉納品1〜20の原画を切り出して透過WebPへ変換 (Pillow・NumPy・SciPy・Node)。
from PIL import Image
from pathlib import Path
import os
import subprocess
os.chdir(Path(__file__).resolve().parents[2])
import json
import numpy as np
from scipy.ndimage import label
im=Image.open('docs/art/offerings/01-20-master.png').convert('RGBA')
boxes=[(25,0,245,282),(285,0,530,282),(580,0,815,282),(845,30,1085,282),(1090,35,1402,280),(0,290,295,560),(295,285,600,580),(605,295,815,554),(835,300,1095,550),(1140,282,1370,565),(90,560,200,815),(275,558,535,825),(535,570,884,811),(885,575,1140,813),(1145,520,1402,842),(30,835,278,1100),(310,825,553,1110),(560,810,890,1115),(905,813,1140,1115),(1145,845,1402,1115)]
entries=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {MISC} from "./src/catalog/misc.js"; console.log(JSON.stringify(MISC.filter(i=>i.slot==="misc").slice(0,20).map(i=>({id:i.id,name:i.name}))))'],text=True))
for n,(e,box) in enumerate(zip(entries,boxes),1):
 tile=im.crop(box)
 a=np.array(tile)
 labels,count=label(a[:,:,3]>16)
 largest=int(np.bincount(labels.ravel())[1:].argmax()+1)
 for component in range(1,count+1):
  yy,xx=np.where(labels==component)
  edge=(xx.min()==0 or yy.min()==0 or xx.max()==tile.width-1 or yy.max()==tile.height-1)
  if len(xx)<20 or (n in [7,10,13,15] and edge and component!=largest): a[labels==component,3]=0
 tile=Image.fromarray(a)
 tile=tile.crop(tile.getbbox())
 tile.thumbnail((288,288),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(320,320));out.alpha_composite(tile,((320-tile.width)//2,(320-tile.height)//2))
 out.save('art/offerings/'+e['id']+'.webp',quality=88,method=6)
print('WebP',len(entries),sum(p.stat().st_size for p in Path('art/offerings').glob('*.webp')),'bytes')

"""制作番号801〜900の原画から透過384px WebPと確認一覧を作る。"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-801-900'
items = json.loads((DOC / 'items.json').read_text())
preview = Image.new('RGB', (1200, 1500), '#19191f')
draw = ImageDraw.Draw(preview)
# 先頭原画は聖典が横長のため、実際の配置に合わせて中心を指定する。
first = [(90,90),(270,90),(450,90),(640,90),(810,90),
         (135,275),(300,275),(500,275),(750,275),
         (90,450),(270,450),(450,450),(630,450),(810,450),
         (80,620),(230,620),(370,620),(510,620),(665,620),(820,620)]
for batch in range(5):
    start = 801 + batch * 20
    im = Image.open(DOC / f'master-{start}-{start+19}.png').convert('RGBA')
    pixels = np.array(im)
    centers = np.array(first if batch == 0 else
                       [(90+180*c,90+180*r) for r in range(4) for c in range(5)])
    centers = centers * np.array([im.width/900, im.height/720])
    components, count = label(pixels[:,:,3] > 16)
    yy, xx = np.indices(components.shape)
    sizes = np.bincount(components.ravel())
    cx = np.bincount(components.ravel(), weights=xx.ravel()) / np.maximum(sizes, 1)
    cy = np.bincount(components.ravel(), weights=yy.ravel()) / np.maximum(sizes, 1)
    points = np.column_stack((cx,cy))
    nearest = np.argmin(((points[:,None,:]-centers[None,:,:])**2).sum(axis=2),axis=1)+1
    nearest[0] = 0
    owner = nearest[components]
    for cell in range(20):
        it = items[batch*20+cell]
        part = pixels.copy()
        part[owner != cell+1,3] = 0
        tile = Image.fromarray(part)
        box = tile.getchannel('A').getbbox()
        assert box, it['id']
        tile = tile.crop(box)
        tile.thumbnail((352,352), Image.Resampling.LANCZOS)
        square = Image.new('RGBA',(384,384))
        square.alpha_composite(tile,((384-tile.width)//2,(384-tile.height)//2))
        path = ROOT / 'art/items' / (it['id']+'.webp')
        square.save(path,'WEBP',quality=92,method=6)
        check = Image.open(path)
        assert check.size == (384,384) and check.mode == 'RGBA'
        assert check.getchannel('A').getextrema()[0] == 0
        n=it['number']-801
        x,y=n%10*120,n//10*150
        thumb=square.resize((112,112),Image.Resampling.LANCZOS)
        preview.paste(thumb,(x+4,y+4),thumb)
        draw.text((x+6,y+121),str(it['number']),fill='#d8c6a2')
preview.save(DOC/'preview.jpg',quality=92)
print('制作番号801〜900: 透過384×384 WebP100点を確認')

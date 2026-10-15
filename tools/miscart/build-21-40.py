"""奉納品21〜40の原画から透過WebPと確認用見本を作る。Pillow・NumPy・SciPy使用。"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/offerings-21-40'
items = json.loads((DOC / 'items.json').read_text())
im = Image.open(DOC / 'master.png').convert('RGBA')
pixels = np.array(im)
labels, _ = ndimage.label(pixels[:, :, 3] > 20)
parts = {}
for label, slices in enumerate(ndimage.find_objects(labels), 1):
    y, x = slices
    if (y.stop-y.start)*(x.stop-x.start) < 10000:
        continue
    row = int(((y.start+y.stop)/2) / (im.height/5))
    col = int(((x.start+x.stop)/2) / (im.width/4))
    index = row*4+col
    assert index not in parts, index
    parts[index] = label
assert sorted(parts) == list(range(20))
preview = Image.new('RGB', (4*256, 5*280), '#20222a')
draw = ImageDraw.Draw(preview)
for i, item in enumerate(items):
    # 薄い透明画素が隣の品を結ぶため、主成分から縁を2画素だけ戻す。
    mask = ndimage.binary_dilation(labels == parts[i], iterations=2)
    rgba = pixels.copy()
    rgba[:, :, 3] = np.where(mask, pixels[:, :, 3], 0)
    cut = Image.fromarray(rgba).crop(Image.fromarray(rgba[:, :, 3]).getbbox())
    cut.thumbnail((288, 288), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (320, 320))
    canvas.alpha_composite(cut, ((320-cut.width)//2, (320-cut.height)//2))
    target = ROOT / 'art/misc' / (item['id']+'.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, 'WEBP', quality=92, method=6)
    thumb = canvas.resize((240, 240), Image.Resampling.LANCZOS)
    x, y = (i%4)*256+8, (i//4)*280
    preview.paste(thumb, (x, y), thumb)
    draw.text((x+8,y+245), f"{item['n']:02}  {item['id'][2:]}", fill='#eee6d5')
preview.save(DOC / 'preview.jpg', quality=92)
print('20点の透過WebP・見本を作成')

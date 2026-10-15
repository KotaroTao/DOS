"""固定制作番号1501〜1600の5列×4行原画を個別の透過WebPにする。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-1501-1600'
items = json.loads((DOC / 'items.json').read_text())
out = ROOT / 'art/items'
out.mkdir(exist_ok=True)
preview = Image.new('RGB', (1200, 1560), '#19191f')
draw = ImageDraw.Draw(preview)
for batch in range(5):
    start = batch * 20 + 1501
    source = DOC / f'master-{start:03}-{start+19:03}.png'
    im = Image.open(source).convert('RGBA')
    pixels = np.array(im)
    # 斜めの刃先が升目の境界を越えても切れないよう、つながった本体を基準に
    # 切り出す。色・形は変えず、近い本体へ透明な縁と離れた小部品を割り当てる。
    components, _ = label(pixels[:, :, 3] > 128)
    sizes = np.bincount(components.ravel())
    seeds = np.zeros(components.shape, dtype=np.uint8)
    # 最初の原画は上から5・5・6・4点。図鑑順の中心を明示して
    # 帽子・兜・左右に離れた靴を別の品へ混ぜない。
    anchors = ([(c / 5 + .1, r / 4 + .125) for r in range(2) for c in range(5)]
               + [(x, .635) for x in [.11, .29, .45, .605, .77, .92]]
               + [(x, .875) for x in [.11, .37, .605, .87]]) if batch == 0 else [
                   (c / 5 + .1, r / 4 + .125) for r in range(4) for c in range(5)]
    for component in np.flatnonzero(sizes >= 1000):
        if component == 0:
            continue
        ys, xs = np.where(components == component)
        cx, cy = xs.mean() / im.width, ys.mean() / im.height
        cell = min(range(20), key=lambda k: (anchors[k][0]-cx)**2 + (anchors[k][1]-cy)**2)
        seeds[components == component] = cell + 1
    assert set(np.unique(seeds)) == set(range(21)), source
    nearest = distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    owners = seeds[tuple(nearest)]
    for cell in range(20):
        item = items[batch * 20 + cell]
        isolated = pixels.copy()
        isolated[owners != cell + 1, 3] = 0
        tile = Image.fromarray(isolated)
        box = tile.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        assert box, item['id']
        tile = tile.crop((max(0, box[0]-4), max(0, box[1]-4),
                          min(im.width, box[2]+4), min(im.height, box[3]+4)))
        # 個別に描き直した原画があれば、その品だけを置き換える。
        override = DOC / f"{item['id']}.png"
        if override.exists():
            tile = Image.open(override).convert('RGBA')
            tile = tile.crop(tile.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox())
        tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
        square = Image.new('RGBA', (384, 384))
        square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
        path = out / (item['id'] + '.webp')
        square.save(path, 'WEBP', quality=92, method=4)
        check = Image.open(path)
        assert check.size == (384, 384) and check.getbbox() and check.mode == 'RGBA'
        thumb = square.resize((112, 112), Image.Resampling.LANCZOS)
        n = item['number'] - 1501
        px, py = (n % 10) * 120, (n // 10) * 156
        preview.paste(thumb, (px+4, py+4), thumb)
        draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号1501〜1600: 個別WebP100点・透過・寸法を確認')

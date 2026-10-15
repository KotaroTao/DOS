"""固定制作番号601〜700の5列×4行原画を個別の透過WebPにする。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-601-700'
items = json.loads((DOC / 'items.json').read_text())
out = ROOT / 'art/items'
out.mkdir(exist_ok=True)
preview = Image.new('RGB', (1200, 1560), '#19191f')
draw = ImageDraw.Draw(preview)
for batch in range(5):
    start = batch * 20 + 601
    source = DOC / f'master-{start:03}-{start+19:03}.png'
    im = Image.open(source).convert('RGBA')
    pixels = np.array(im)
    # 斜めの刃先が升目の境界を越えても切れないよう、つながった本体を基準に
    # 切り出す。色・形は変えず、近い本体へ透明な縁と離れた小部品を割り当てる。
    components, _ = label(pixels[:, :, 3] > 128)
    sizes = np.bincount(components.ravel())
    seeds = np.zeros(components.shape, dtype=np.uint8)
    for component in np.flatnonzero(sizes >= 1000):
        if component == 0:
            continue
        ys, xs = np.where(components == component)
        col = min(4, int(xs.mean() * 5 / im.width))
        row = min(3, int(ys.mean() * 4 / im.height))
        seeds[components == component] = row * 5 + col + 1
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
        tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
        square = Image.new('RGBA', (384, 384))
        square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
        path = out / (item['id'] + '.webp')
        square.save(path, 'WEBP', quality=92, method=6)
        check = Image.open(path)
        assert check.size == (384, 384) and check.getbbox() and check.mode == 'RGBA'
        thumb = square.resize((112, 112), Image.Resampling.LANCZOS)
        n = item['number'] - 601
        px, py = (n % 10) * 120, (n // 10) * 156
        preview.paste(thumb, (px+4, py+4), thumb)
        draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号601〜700: 個別WebP100点・透過・寸法を確認')

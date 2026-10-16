"""固定制作番号501〜600の5列×4行原画を透過WebPへ変換する。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-501-600'
items = json.loads((DOC / 'items.json').read_text())
preview = Image.new('RGB', (1200, 1560), '#19191f')
draw = ImageDraw.Draw(preview)
for batch in range(5):
    start = 501 + batch * 20
    source = DOC / f'master-{start}-{start+19}.png'
    im = Image.open(source).convert('RGBA')
    assert im.getchannel('A').getextrema()[0] == 0, f'{source}: 背景が透過していない'
    pixels = np.array(im)
    # 升目をわずかに越えた刃先や房を切らず、本体と近い小部品をまとめる。
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
    assert set(np.unique(seeds)) == set(range(21)), f'{source}: 20点の本体を確認できない'
    nearest = distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    owners = seeds[tuple(nearest)]
    for cell in range(20):
        item = items[batch * 20 + cell]
        isolated = pixels.copy()
        isolated[owners != cell + 1, 3] = 0
        tile = Image.fromarray(isolated)
        box = tile.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        assert box, item['id']
        tile = tile.crop(box)
        tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
        square = Image.new('RGBA', (384, 384))
        square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
        path = ROOT / 'art/items' / (item['id'] + '.webp')
        if not path.exists() or path.stat().st_mtime < source.stat().st_mtime:
            square.save(path, 'WEBP', quality=92, method=6)
        check = Image.open(path)
        assert check.size == (384, 384) and check.mode == 'RGBA' and check.getbbox()
        thumb = square.resize((112, 112), Image.Resampling.LANCZOS)
        n = item['number'] - 501
        px, py = (n % 10) * 120, (n // 10) * 156
        preview.paste(thumb, (px+4, py+4), thumb)
        draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号501〜600: 個別WebP100点・透過・寸法を確認')

"""固定制作番号1401〜1500の5列×4行原画を個別の透過WebPにする。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-1401-1500'
items = json.loads((DOC / 'items.json').read_text())
out = ROOT / 'art/items'
out.mkdir(exist_ok=True)
preview = Image.new('RGB', (1200, 1560), '#19191f')
draw = ImageDraw.Draw(preview)
for batch in range(5):
    start = batch * 20 + 1401
    source = DOC / f'master-{start:03}-{start+19:03}.png'
    im = Image.open(source).convert('RGBA')
    pixels = np.array(im)
    # 透過原画の背景に残るごく薄い格子と色のかすれだけを除く。
    pixels[pixels[:, :, 3] < 32, 3] = 0
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
        # 1461〜1480の原画は3行目が手袋5点、4行目が4点。
        # 欠けた1471番は下の独立原画を使い、以後の対応を保つ。
        cell = row * 5 + col
        if batch == 3 and row == 2:
            cell += 1
        elif batch == 3 and row == 3:
            cell = 16 + min(3, int(xs.mean() * 4 / im.width))
        seeds[components == component] = cell + 1
    assert set(np.unique(seeds)) == (set(range(21)) - ({11} if batch == 3 else set())), source
    nearest = distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    owners = seeds[tuple(nearest)]
    for cell in range(20):
        if batch == 3 and cell == 10:
            continue
        item = items[batch * 20 + cell]
        isolated = pixels.copy()
        isolated[owners != cell + 1, 3] = 0
        tile = Image.fromarray(isolated)
        box = tile.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        assert box, item['id']
        tile = tile.crop((max(0, box[0]-8), max(0, box[1]-8),
                          min(im.width, box[2]+8), min(im.height, box[3]+8)))
        tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
        square = Image.new('RGBA', (384, 384))
        square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
        path = out / (item['id'] + '.webp')
        square.save(path, 'WEBP', quality=92, method=6)
        check = Image.open(path)
        assert check.size == (384, 384) and check.getbbox() and check.mode == 'RGBA'
        thumb = square.resize((112, 112), Image.Resampling.LANCZOS)
        n = item['number'] - 1401
        px, py = (n % 10) * 120, (n // 10) * 156
        preview.paste(thumb, (px+4, py+4), thumb)
        draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
# 原画で抜けた竜将の脚甲は専用に生成した1枚を取り込む。
correction = Image.open(DOC / 'correction-1471.png').convert('RGBA')
box = correction.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
assert box
correction = correction.crop(box)
correction.thumbnail((352, 352), Image.Resampling.LANCZOS)
square = Image.new('RGBA', (384, 384))
square.alpha_composite(correction, ((384-correction.width)//2, (384-correction.height)//2))
square.save(out / (items[70]['id'] + '.webp'), 'WEBP', quality=92, method=6)
# 一覧は修正を含む出荷画像から作り直す。
preview = Image.new('RGB', (1200, 1560), '#19191f')
draw = ImageDraw.Draw(preview)
for n, item in enumerate(items):
    tile = Image.open(out / (item['id'] + '.webp')).convert('RGBA')
    tile.thumbnail((112, 112), Image.Resampling.LANCZOS)
    px, py = (n % 10) * 120, (n // 10) * 156
    preview.paste(tile, (px+4, py+4), tile)
    draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号1401〜1500: 個別WebP100点・透過・寸法を確認')

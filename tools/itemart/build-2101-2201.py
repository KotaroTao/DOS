"""固定制作番号2101〜2201の5列×4行原画を個別の透過WebPにする。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-2101-2201'
items = json.loads((DOC / 'items.json').read_text())
out = ROOT / 'art/items'
out.mkdir(exist_ok=True)
preview = Image.new('RGB', (1200, 1716), '#19191f')
draw = ImageDraw.Draw(preview)
for batch in range(6):
    start = batch * 20 + 2101
    source = DOC / f'master-{start:03}-{min(start+19,2201):03}.png'
    im = Image.open(source).convert('RGBA')
    pixels = np.array(im)
    # 斜めの刃先が升目の境界を越えても切れないよう、つながった本体を基準に
    # 切り出す。色・形は変えず、近い本体へ透明な縁と離れた小部品を割り当てる。
    components, _ = label(pixels[:, :, 3] > 128)
    sizes = np.bincount(components.ravel())
    # 2181〜2200の原画は5・6・6・3点の行構成。他は5列×4行。
    if batch == 4:
        anchors = [(x, .115) for x in [.10,.29,.48,.68,.90]]
        anchors += [(x, .36) for x in [.08,.25,.42,.57,.74,.92]]
        anchors += [(x, .64) for x in [.09,.26,.42,.58,.76,.93]]
        anchors += [(x, .89) for x in [.12,.50,.86]]
    elif batch == 5:
        anchors = [(.5, .5)]
    else:
        anchors = [((c+.5)/5, (r+.5)/4) for r in range(4) for c in range(5)]
    seeds = np.zeros(components.shape, dtype=np.uint8)
    for component in np.flatnonzero(sizes >= 2500):
        if component == 0:
            continue
        ys, xs = np.where(components == component)
        cx, cy = xs.mean()/im.width, ys.mean()/im.height
        cell = min(range(len(anchors)), key=lambda n: (cx-anchors[n][0])**2+(cy-anchors[n][1])**2)
        seeds[components == component] = cell+1
    assert set(np.unique(seeds)) == set(range(len(anchors)+1)), source
    distance, nearest = distance_transform_edt(seeds == 0, return_indices=True)
    owners = seeds[tuple(nearest)]
    # 本体から離れた制作ラベル・粒子・背景の光を出荷画像へ持ち込まない。
    pixels[distance > 6, 3] = 0
    for cell in range(len(anchors)):
        item = items[batch * 20 + cell]
        isolated = pixels.copy()
        isolated[owners != cell + 1, 3] = 0
        tile = Image.fromarray(isolated)
        box = tile.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        assert box, item['id']
        tile = tile.crop((max(0, box[0]-4), max(0, box[1]-4),
                          min(im.width, box[2]+4), min(im.height, box[3]+4)))
        scale = 352 / max(tile.size)
        tile = tile.resize((round(tile.width * scale), round(tile.height * scale)), Image.Resampling.LANCZOS)
        square = Image.new('RGBA', (384, 384))
        square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
        path = out / (item['id'] + '.webp')
        square.save(path, 'WEBP', quality=92, method=4)
        check = Image.open(path)
        assert check.size == (384, 384) and check.getbbox() and check.mode == 'RGBA'
        thumb = square.resize((112, 112), Image.Resampling.LANCZOS)
        n = item['number'] - 2101
        px, py = (n % 10) * 120, (n // 10) * 156
        preview.paste(thumb, (px+4, py+4), thumb)
        draw.text((px+6, py+121), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号2101〜2201: 個別WebP101点・透過・寸法を確認')

"""制作番号401・402を変換し、既存98点と合わせた確認用一覧を作る。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/items-401-500'
items = json.loads((DOC / 'items.json').read_text())
master = Image.open(DOC / 'master-401-402.png').convert('RGBA')
assert master.getchannel('A').getextrema()[0] == 0, '原画の背景が透過ではありません'
# 原画の中央から右へ最初の完全な透明列を探し、尾羽の先を切らない。
split = next(x for x in range(master.width//2, master.width*2//3)
             if master.getchannel('A').crop((x, 0, x+1, master.height)).getextrema()[1] == 0)
for index, item in enumerate(items[:2]):
    tile = master.crop((0 if index == 0 else split, 0,
                        split if index == 0 else master.width, master.height))
    box = tile.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    assert box, item['id']
    tile = tile.crop(box)
    tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
    square = Image.new('RGBA', (384, 384))
    square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
    square.save(ROOT / item['path'], 'WEBP', lossless=True, method=6)

preview = Image.new('RGB', (1200, 1500), '#19191f')
draw = ImageDraw.Draw(preview)
for index, item in enumerate(items):
    path = ROOT / item['path']
    im = Image.open(path).convert('RGBA')
    assert im.size == ((384, 384) if item['created'] else tuple(item['size'])), path
    assert im.getchannel('A').getextrema() == tuple(item['alphaRange']), path
    assert im.getbbox(), path
    im.thumbnail((112, 112), Image.Resampling.LANCZOS)
    x, y = index % 10 * 120, index // 10 * 150
    preview.paste(im, (x+4, y+4), im)
    draw.text((x+6, y+122), str(item['number']), fill='#d8c6a2')
preview.save(DOC / 'preview.jpg', quality=92)
print('制作番号401〜500: 新規2点・既存98点、100点の寸法・背景仕様を確認')

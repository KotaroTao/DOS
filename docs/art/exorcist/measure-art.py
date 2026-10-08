"""原画の測定用座標を表示する。"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
paths = sorted(ROOT.glob('exorcist-r*-final.png'))
sheet = Image.new('RGB', (550 * len(paths), 740), '#242228')
draw = ImageDraw.Draw(sheet)
for i, path in enumerate(paths):
    im = Image.open(path).convert('RGBA')
    print(path.name, im.size, im.getchannel('A').getbbox())
    tile = Image.new('RGBA', im.size, '#242228')
    tile.alpha_composite(im)
    d = ImageDraw.Draw(tile)
    head = tile.crop((350, 80, 750, 460))
    hd = ImageDraw.Draw(head)
    for y in range(90, 460, 10):
        hd.line((0, y - 80, 400, y - 80), fill='#666666')
        hd.text((0, y - 80), str(y), fill='white')
    head.save(ROOT / (path.stem + '-head-grid.png'))
    for y in range(50, im.height, 50):
        d.line((0, y, im.width, y), fill='#777777', width=1)
        d.text((300, y), str(y), fill='white')
    for x in range(300, 800, 50):
        d.line((x, 0, x, 500), fill='#777777', width=1)
        d.text((x, 450), str(x), fill='white')
    sheet.paste(tile.resize((550, 711)), (i * 550, 25))
    draw.text((i * 550 + 10, 5), path.name, fill='white')
sheet.save(ROOT / 'measurement-grid.png')

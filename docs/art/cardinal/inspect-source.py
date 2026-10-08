"""原画の測定用に座標目盛りを重ねる。原画は変更しない。"""
from pathlib import Path
from PIL import Image, ImageDraw
import sys

for name in sys.argv[1:]:
    path = Path(name)
    im = Image.open(path).convert('RGBA')
    bg = Image.new('RGBA', im.size, '#302d35')
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    for x in range(0, im.width, 100):
        d.line((x, 0, x, im.height), fill='#666666')
        d.text((x + 2, 10), str(x), fill='white')
    for y in range(0, im.height, 100):
        d.line((0, y, im.width, y), fill='#666666')
        d.text((10, y + 2), str(y), fill='white')
    bg.thumbnail((800, 1000))
    bg.convert('RGB').save(path.with_name(path.stem + '-measure.jpg'))

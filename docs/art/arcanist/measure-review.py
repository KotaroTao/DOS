"""原画の頭頂・頬・顎を確認する目盛り付き比較。"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
sheet = Image.new('RGB', (1800, 400), '#302d35')
d = ImageDraw.Draw(sheet)
for r in range(1, 6):
    im = Image.open(root / f'arcanist-r{r}-final.png').convert('RGBA')
    crop = im.crop((400, 160, 750, 520))
    ox = (r - 1) * 360
    sheet.paste(crop, (ox, 30), crop)
    d.text((ox + 10, 8), f'R{r}', fill='white')
    for y in [178, 390, 430, 460, 470, 480]:
        yy = y - 160 + 30
        d.line((ox, yy, ox + 350, yy), fill='#62736d')
        d.text((ox, yy), str(y), fill='white')
sheet.save(root / 'head-measure-review.png')

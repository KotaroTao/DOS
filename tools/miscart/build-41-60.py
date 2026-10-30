"""奉納品41〜60を、原画の品ごとの範囲から中央へ切り出す。"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/offerings/41-60'
source = Image.open(DOC / 'master.png').convert('RGB')
items = json.loads((DOC / 'crops.json').read_text())
preview = Image.new('RGB', (1000, 4 * 224), '#20222a')
draw = ImageDraw.Draw(preview)
for i, item in enumerate(items):
    left, top, right, bottom = item['box']
    assert 0 <= left < right <= source.width and 0 <= top < bottom <= source.height
    cut = source.crop(item['box'])
    cut.thumbnail((288, 288), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (320, 320), (13, 15, 17))
    canvas.paste(cut, ((320 - cut.width) // 2, (320 - cut.height) // 2))
    canvas.save(ROOT / 'art/misc' / (item['id'] + '.webp'), 'WEBP', quality=92, method=6)
    x, y = i % 5 * 200, i // 5 * 224
    preview.paste(canvas.resize((192, 192), Image.Resampling.LANCZOS), (x + 4, y))
    draw.text((x + 4, y + 196), f"{41+i}: {item['id'][2:24]}", fill='white')
preview.save(DOC / 'preview.jpg', quality=92)
print('奉納品41〜60: 20点を再切り出し')

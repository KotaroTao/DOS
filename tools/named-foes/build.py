"""記録した輪郭の範囲から24体の透過ロスレスWebPを再生成する。"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/named-foes'
for entry in json.loads((SOURCE / 'manifest.json').read_text()):
    image = Image.open(SOURCE / f'sheet-{entry["sheet"]}.png').convert('RGBA')
    image = image.crop(entry['frame'])
    image = image.crop(image.getchannel('A').getbbox())
    padded = Image.new('RGBA', (image.width + 8, image.height + 8))
    padded.paste(image, (4, 4))
    assert list(padded.size) == entry['size'], entry['id']
    padded.save(ROOT / 'art/monsters' / f'{entry["id"]}.webp', lossless=True, method=6)

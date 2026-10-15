"""獄吏の詰所の未作成だった主を透過WebPへ変換する（Pillow）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KEY = 'bs_ironcagewarden'
image = Image.open(ROOT / f'docs/art/guardhouse-enemies/{KEY}.png').convert('RGBA')
bounds = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
if bounds is None:
    raise ValueError('原画が空です')
image = image.crop(bounds)
image.thumbnail((504, 504), Image.Resampling.LANCZOS)
padded = Image.new('RGBA', (image.width + 16, image.height + 16))
padded.paste(image, (8, 8))
padded.save(ROOT / f'art/monsters/{KEY}.webp', lossless=True, method=6)
print(KEY, padded.size)

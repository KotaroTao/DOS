"""魂喰らいの大樹の主を透過WebPへ変換する（Pillow）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
image = Image.open(ROOT / 'docs/art/soul-devouring-tree/bs_forestlord.png').convert('RGBA')
image.thumbnail((504, 504), Image.Resampling.LANCZOS)
padded = Image.new('RGBA', (image.width + 16, image.height + 16))
padded.paste(image, (8, 8))
padded.save(ROOT / 'art/monsters/bs_forestlord.webp', lossless=True, method=6)
print(f'bs_forestlord: {padded.width}×{padded.height}')

"""同倍率のゲーム実描画レビューからR4とR5を比較する。"""
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
im = Image.open(folder / 'final-review.png')
track = (im.width - 40 - 5 * 8) / 6
left = round(20 + 4 * (track + 8))
im.crop((left, 66, im.width - 20, im.height - 20)).save(folder / 'r4-r5-comparison.png')

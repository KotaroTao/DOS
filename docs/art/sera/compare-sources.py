"""原画の人物倍率を合わせ、全身と顔を並べる確認用画像を作る。"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
out = Path(__file__).parent
settings = json.loads((out / 'import-settings.json').read_text())
ref = json.loads((root / 'docs/art/crusader-reference.json').read_text())['sourceR1']
sources = [ref, *settings['sources']]
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 19)
sheet = Image.new('RGB', (1920, 740), '#24272b')
draw = ImageDraw.Draw(sheet)
for i, source in enumerate(sources):
    image = Image.open(root / source['source']).convert('RGBA')
    left, right, top, chin = source['head'][:4]
    cx = (left + right) / 2
    scale = 4 / source['perDot']
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    ox = round(i * 320 + 160 - cx * scale)
    oy = round(65 - top * scale)
    sheet.paste(resized, (ox, oy), resized)
    draw.text((i * 320 + 15, 20), '聖戦士 R1' if i == 0 else f'灯守 R{i}', font=font, fill='white')
    for y in (65, 395):
        draw.line((i * 320 + 8, y, i * 320 + 312, y), fill='#555c65')
    half = 60 / scale
    face = image.crop((cx-half, (top+chin)/2-half, cx+half, (top+chin)/2+half)).resize((240, 240), Image.Resampling.LANCZOS)
    sheet.paste(face, (i * 320 + 40, 460), face)
draw.text((15, 710), '同倍率の原画比較／顔は全身の2倍。頭身は承認済みセラR1を維持。', font=font, fill='#c6cbd2')
sheet.save(out / 'source-comparison.png')

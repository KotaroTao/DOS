"""出荷画像を変更せず、原画を共通枠へ配置して比較する。"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out, bust_crop

out = Path(__file__).parent
crown, chin, sole = 166, 480, 1346
left, right = 524, 654
cx = (left + right) / 2
per_dot = (sole - crown) / 82.9
im, bbox = cut_out(out / 'priest-r1-draft.png')
scale = 4 / per_dot
scaled = im.convert('RGBa').resize(
    (round(im.width * scale), round(im.height * scale)),
    Image.Resampling.LANCZOS).convert('RGBA')
candidate = Image.new('RGBA', (360, 368))
candidate.alpha_composite(scaled, (round(180 - cx * scale), round(36 - crown * scale)))
candidate.save(out / 'priest-r1-scale-preview.png')
master = Image.open(root / 'art/jobs/crusader_1.webp').convert('RGBA')
assert master.size == candidate.size
canvas = Image.new('RGB', (1480, 1100), '#242228')
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
for i, (image, title, head) in enumerate([
    (master, 'CRUSADER R1 / APPROVED STANDARD', [45, 9, 30.93]),
    (candidate, 'PRIEST R1 / AWAITING APPROVAL', [45, 9, 9 + (chin-crown)/per_dot]),
]):
    x = 10 + i * 740
    draw.text((x + 20, 15), title, font=font, fill='white')
    enlarged = image.resize((720, 736), Image.Resampling.NEAREST)
    canvas.paste(enlarged, (x, 50), enlarged)
    for y, color in [(50+72, '#00cddd'), (50+round(30.93*8), '#df74be'), (50+735, '#888888')]:
        draw.line((x, y, x+720, y), fill=color)
    draw.text((x+20, 805), 'FACE 56 / 36 / 26 px / enlarged', font=font, fill='white')
    bx, by, size = bust_crop({'head': head})
    face = image.crop(tuple(round(v*4) for v in (bx, by, bx+size, by+size)))
    pos = x+20
    for icon_size in (56, 36, 26, 196):
        icon = face.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        canvas.paste(icon, (pos, 845), icon)
        pos += icon_size+24
draw.text((30, 1065), 'Cyan: anatomical crown (priest inferred under hood); pink: chin; gray: soles', font=font, fill='white')
canvas.save(out / 'r1-comparison.png')
(out / 'r1-review-settings.json').write_text(json.dumps({
    'status': 'R1確認待ち。ゲームへの取り込み前。',
    'source': 'docs/art/priest/priest-r1-draft.png',
    'reference': 'docs/art/crusader/crusader-r1-final.png',
    'perDot': per_dot, 'head': [left, right, crown, chin], 'sole': sole,
    'crownNote': '頭巾の上端ではなく、隠れた主な髪の頭頂を推定。承認用の暫定測定。',
    'frame': [90, 92], 'frameTop': 9,
    'headBodyRatio': (sole-crown)/(chin-crown),
    'alphaBBox': bbox,
}, ensure_ascii=False, indent=2)+'\n')

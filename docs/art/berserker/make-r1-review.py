"""出荷画像を変更せず、測定した原画を聖戦士と同倍率で比較する。"""
from pathlib import Path
import sys, json
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
from jobimg import cut_out, bust_crop
D = Path(__file__).parent
# 逆立った髪は先端と付け根の中間を主な頭頂として測る。
crown, chin, sole, left, right = 125, 438, 1303, 512, 648
per_dot = (sole - crown) / 82.9
source = D / 'berserker-r1-review-candidate.png'
im, bbox = cut_out(source)
k = 4 / per_dot
target = Image.new('RGBA', (360, 368))
scaled = im.convert('RGBa').resize((round(im.width*k), round(im.height*k)), Image.Resampling.LANCZOS).convert('RGBA')
target.alpha_composite(scaled, (round(180-(left+right)/2*k), round(36-crown*k)))
target.save(D / 'berserker-r1-scale-preview.png')
master = Image.open(ROOT / 'art/jobs/crusader_1.webp').convert('RGBA')
canvas = Image.new('RGB', (1480, 1060), (36, 34, 40))
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
for i, (img, title, head) in enumerate([
    (master, 'CRUSADER R1 / APPROVED REFERENCE', [45, 9, 30.93]),
    (target, 'BERSERKER R1 / REVIEW', [45, 9, 9+(chin-crown)/per_dot]),
]):
    x = 10 + i*740
    draw.text((x+20, 12), title, fill='white', font=font)
    full = img.resize((720, 736), Image.Resampling.NEAREST)
    canvas.paste(full, (x, 50), full)
    for yy, color in [(36, 'cyan'), (123.72, 'magenta'), (367.6, 'gray')]:
        draw.line((x, 50+yy*2, x+720, 50+yy*2), fill=color)
    draw.text((x+20, 804), 'FACE 56px / 36px / 26px / enlarged', fill='white', font=font)
    bx, by, bs = bust_crop({'head': head})
    face = img.crop(tuple(round(v*4) for v in (bx, by, bx+bs, by+bs)))
    pos = x+20
    for size in (56, 36, 26, 196):
        icon = face.resize((size, size), Image.Resampling.LANCZOS)
        canvas.paste(icon, (pos, 846), icon)
        pos += size+24
canvas.save(D / 'r1-comparison.png')
json.dump({
    'status': 'ユーザー確認前。ゲーム未取り込み。',
    'job': 'berserker', 'source': str(source.relative_to(ROOT)),
    'reference': 'art/jobs/crusader_1.webp',
    'perDot': per_dot, 'head': [left, right, crown, chin], 'sole': sole,
    'frame': [90, 92], 'frameTop': 9,
    'headBodyRatio': (sole-crown)/(chin-crown),
    'headHeightDots': (chin-crown)/per_dot,
    'notes': ['逆立った髪の先端は頭頂に含めない。先端と付け根の中間を目視測定。', '比較用の縮尺調整のみ。機械的なドット化・減色なし。'],
}, open(D / 'r1-review-settings.json', 'w'), ensure_ascii=False, indent=2)
print('R1の同倍率全身・顔比較を保存。出荷画像は未変更。')

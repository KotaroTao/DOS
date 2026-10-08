"""出荷画像を変更せず、測定した原画を聖戦士と同倍率で比較する。"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).parent
root = out.parents[2]
sys.path.insert(0, str(root / 'tools'))
from jobimg import bust_crop, cut_out

settings = json.loads((out / 'r1-review-settings.json').read_text())
left, right, crown, chin = settings['head']
per_dot = settings['perDot']
im, bbox = cut_out(root / settings['source'])
scale = 4 / per_dot
scaled = im.convert('RGBa').resize(
    (round(im.width * scale), round(im.height * scale)),
    Image.Resampling.LANCZOS).convert('RGBA')
candidate = Image.new('RGBA', (360, 368))
candidate.alpha_composite(scaled, (
    round(180 - (left + right) / 2 * scale), round(36 - crown * scale)))
alpha = candidate.getchannel('A').point(lambda value: 255 if value > 16 else 0)
assert not any(alpha.crop(edge).getbbox() for edge in [
    (0, 0, 360, 1), (0, 367, 360, 368), (0, 0, 1, 368), (359, 0, 360, 368)
]), '共通枠の端に不透明な画素がある。装備の欠けを確認する。'
candidate.save(out / 'archbishop-r1-scale-preview.png')
master = Image.open(root / 'art/jobs/crusader_1.webp').convert('RGBA')
canvas = Image.new('RGB', (1480, 1100), '#242228')
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
for i, (sprite, title, head) in enumerate([
    (master, 'CRUSADER R1 / APPROVED STANDARD', [45, 9, 30.93]),
    (candidate, 'ARCHBISHOP R1 / AWAITING APPROVAL',
     [45, 9, 9 + (chin - crown) / per_dot]),
]):
    x = 10 + i * 740
    draw.text((x + 20, 15), title, font=font, fill='white')
    enlarged = sprite.resize((720, 736), Image.Resampling.NEAREST)
    canvas.paste(enlarged, (x, 50), enlarged)
    for y, color in [(122, '#00cddd'), (50 + round(30.93 * 8), '#df74be'),
                     (785, '#888888')]:
        draw.line((x, y, x + 720, y), fill=color)
    draw.text((x + 20, 805), 'FACE 56 / 36 / 26 px / enlarged', font=font, fill='white')
    bx, by, size = bust_crop({'head': head})
    face = sprite.crop(tuple(round(v * 4) for v in (bx, by, bx + size, by + size)))
    pos = x + 20
    for icon_size in (56, 36, 26, 196):
        icon = face.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        canvas.paste(icon, (pos, 845), icon)
        pos += icon_size + 24
draw.text((30, 1065), 'Cyan: anatomical hair crown; pink: standard chin; gray: soles',
          font=font, fill='white')
canvas.save(out / 'r1-crusader-comparison.png')
settings['alphaBBox'] = list(bbox)
settings['headBodyRatio'] = (settings['sole'] - crown) / (chin - crown)
(out / 'r1-review-settings.json').write_text(
    json.dumps(settings, ensure_ascii=False, indent=2) + '\n')

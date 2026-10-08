from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

D = Path(__file__).resolve().parent
ROOT = D.parents[2]

SOURCES = [
    ("CRUSADER R1 / STANDARD", ROOT / "docs/art/crusader/crusader-r1-final.png", (475, 603, 148, 462)),
    ("MONK R1 / REVIEW", D / "monk-r1-review.png", (494, 622, 145, 462)),
]


def bust_crop(im, head):
    left, right, top, chin = head
    cx = (left + right) / 2
    head_h = chin - top
    size = 36 * head_h / 20.5
    x0 = int(round(cx - size / 2))
    y0 = int(round(top - size / 36))
    x1 = int(round(x0 + size))
    y1 = int(round(y0 + size))
    crop = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    crop.alpha_composite(im, (-x0, -y0))
    return crop


def paste_same_scale(sheet, im, rect, scale):
    x, y, w, h = rect
    rw, rh = int(round(im.width * scale)), int(round(im.height * scale))
    img = im.resize((rw, rh), Image.Resampling.LANCZOS)
    sheet.alpha_composite(img, (x + (w - rw) // 2, y + h - rh))


font = ImageFont.load_default()
panel_w, panel_h = 620, 820
full_scale = 0.36
sheet = Image.new("RGBA", (panel_w * 2 + 42, panel_h), (36, 34, 40, 255))
draw = ImageDraw.Draw(sheet)

for i, (title, path, head) in enumerate(SOURCES):
    x = 20 + i * (panel_w + 2)
    draw.rectangle((x, 20, x + panel_w - 20, panel_h - 20), fill=(48, 45, 53, 255))
    draw.text((x + 18, 36), title, fill=(238, 238, 238), font=font)
    im = Image.open(path).convert("RGBA")
    paste_same_scale(sheet, im, (x + 40, 70, panel_w - 80, 500), full_scale)
    draw.line((x + 18, 582, x + panel_w - 38, 582), fill=(86, 82, 92, 255), width=1)
    draw.text((x + 18, 596), "face icon 56 / 36 / 26 px", fill=(205, 202, 210), font=font)
    bust = bust_crop(im, head)
    icon_x = x + 32
    for size in (56, 36, 26):
        icon = bust.resize((size, size), Image.Resampling.LANCZOS)
        sheet.alpha_composite(icon, (icon_x, 625))
        icon_x += size + 20
    large = bust.resize((150, 150), Image.Resampling.LANCZOS)
    sheet.alpha_composite(large, (x + 34, 680))

out = D / "r1-comparison.png"
sheet.convert("RGB").save(out)
print(out)

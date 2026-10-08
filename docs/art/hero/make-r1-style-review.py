"""Compose a review without changing shipped game art."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("--head", type=float, nargs=3, required=True,
                    metavar=("CENTER", "CROWN", "CHIN"))
parser.add_argument("--sole", type=float, required=True)
args = parser.parse_args()
cx, crown, chin = args.head
per_dot = (args.sole - crown) / 82.9
scale = 4 / per_dot
source = Image.open(DIR / args.source).convert("RGBA")
scaled = source.convert("RGBa").resize(
    (round(source.width * scale), round(source.height * scale)),
    Image.Resampling.LANCZOS).convert("RGBA")
preview = Image.new("RGBA", (360, 368))
preview.alpha_composite(scaled, (round(180 - cx * scale), round(36 - crown * scale)))
preview.save(DIR / "hero-r1-style-preview.png")
ref = Image.open(ROOT / "art/jobs/crusader_1.webp").convert("RGBA")
canvas = Image.new("RGB", (1440, 1000), (34, 36, 40))
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
for i, (im, label, head_height) in enumerate([
    (ref, "CRUSADER R1 / REFERENCE", 21.93),
    (preview, "HERO R1 / STYLE REVISION", (chin - crown) / per_dot),
]):
    x = i * 720
    draw.text((x + 20, 12), label, font=font, fill="white")
    big = im.resize((720, 736), Image.Resampling.NEAREST)
    canvas.paste(big, (x, 48), big)
    draw.line((x, 120, x + 720, 120), fill="cyan")
    draw.line((x, 783, x + 720, 783), fill="gray")
    draw.text((x + 20, 802), "FACE 56px / 36px / 26px / enlarged", font=font, fill="white")
    # Same crop proportions as the game's head-based bust renderer.
    side = 36 * head_height / 20.5
    left = 45 - side / 2
    top = 9 - side / 36
    face = im.crop(tuple(round(v * 4) for v in (left, top, left + side, top + side)))
    pos = x + 20
    for size in (56, 36, 26, 140):
        icon = face.resize((size, size), Image.Resampling.LANCZOS)
        canvas.paste(icon, (pos, 845), icon)
        pos += size + 24
canvas.save(DIR / "r1-style-comparison.png")
(DIR / "r1-style-review-settings.json").write_text(json.dumps({
    "status": "Review only; game assets unchanged",
    "source": args.source,
    "headCenterCrownChin": args.head,
    "sole": args.sole,
    "perDot": per_dot,
    "headBodyRatio": (args.sole - crown) / (chin - crown),
    "frame": [90, 92],
}, indent=2) + "\n")

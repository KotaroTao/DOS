"""地下墓地の原画を個別の透過WebPへ切り出す（Pillow）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/art/crypt-enemies/master.png"
# 等分の格子ではなく、翼・炎・冠を含む実際の輪郭で区切る。
FRAMES = {
    "bs_bonebat": (0, 0, 440, 430),
    "bs_carrioncrow": (440, 0, 850, 430),
    "bs_corpsemaggot": (850, 0, 1254, 430),
    "bs_grasphand": (0, 430, 440, 790),
    "bs_gravewisp": (440, 430, 790, 822),
    "bs_bonepile": (790, 430, 1254, 822),
    "el_cryptlord": (0, 790, 455, 1254),
    "d01_skeleton": (455, 822, 810, 1254),
    "mimic": (810, 822, 1254, 1254),
}

if __name__ == "__main__":
    source = Image.open(SOURCE).convert("RGBA")
    target = ROOT / "art/monsters"
    target.mkdir(parents=True, exist_ok=True)
    for key, frame in FRAMES.items():
        image = source.crop(frame)
        image = image.crop(image.getchannel("A").getbbox())
        # 細い輪郭を削らず、画像の外周には透過の余白を残す。
        padded = Image.new("RGBA", (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(target / f"{key}.webp", lossless=True, method=6)
        print(f"{key}: {padded.width}×{padded.height}")

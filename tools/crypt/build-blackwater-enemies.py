"""取水口の原画を輪郭ごとに切り出す（Pillow・NumPy・SciPy）。"""
from pathlib import Path
import numpy as np
from scipy.ndimage import label, distance_transform_edt
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/monsters'
IDS = ['bs_bloatfly', 'bs_fogspecter', 'bs_giantleech', 'bs_ratking',
       'bs_razorshrimp', 'bs_sewercrab', 'bs_mucusworm', 'bs_toxictoad',
       'bs_drownedcorpse', 'el_bloatqueen']


def split_a():
    source = Image.open(ROOT / 'docs/art/blackwater-enemies/master-a.png').convert('RGBA')
    pixels = np.array(source)
    # 格子線をまたぐ触角・尾・鎌を切らないよう、不透明な輪郭の連結成分で分ける。
    # ごく薄い縁と離れた毒粉は最も近い本体へ割り当て、元のRGBAを保持する。
    labels, _ = label(pixels[:, :, 3] > 8)
    counts = np.bincount(labels.ravel())
    owners = np.zeros(labels.shape, dtype=np.uint8)
    for component in np.flatnonzero(counts > 10000):
        if component == 0:
            continue
        ys, xs = np.where(labels == component)
        x, y = xs.mean(), ys.mean()
        col = 0 if x < 550 else 1 if x < 1030 else 2
        row = 0 if y < 530 else 1
        owners[labels == component] = row * 3 + col + 1
    _, nearest = distance_transform_edt(owners == 0, return_indices=True)
    assignment = owners[tuple(nearest)]
    for index, key in enumerate(IDS[:6], 1):
        isolated = pixels.copy()
        isolated[assignment != index] = 0
        yield key, Image.fromarray(isolated)


def split_b():
    source = Image.open(ROOT / 'docs/art/blackwater-enemies/master-b.png').convert('RGBA')
    width, height = source.size
    for index, key in enumerate(IDS[6:]):
        col, row = index % 2, index // 2
        yield key, source.crop((col * width // 2, row * height // 2,
                               (col + 1) * width // 2, (row + 1) * height // 2))


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for key, image in [*split_a(), *split_b()]:
        # 3%以下のほぼ見えない透過縁だけで枠が膨らまないよう、本体の枠に余白を足す。
        alpha = image.getchannel('A').point(lambda a: 255 if a > 8 else 0)
        box = alpha.getbbox()
        assert box, key
        image = image.crop((max(0, box[0] - 4), max(0, box[1] - 4),
                            min(image.width, box[2] + 4), min(image.height, box[3] + 4)))
        image.thumbnail((504, 504), Image.Resampling.LANCZOS)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(OUT / f'{key}.webp', lossless=True, method=6)
        print(f'  {key}: [{padded.width}, {padded.height}],')

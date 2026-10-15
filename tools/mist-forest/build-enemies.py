"""霧森の透過原画を区画ごとに切り出し、ロスレスWebPにする（Pillow）。"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
IDS = [
    'bs_dryadfey', 'bs_wisplure', 'bs_thornhound',
    'bs_direboar', 'bs_chimera', 'bs_thunderbird',
    'bs_fogpanther', 'bs_corruptstag', 'bs_satyrpiper',
    'el_mistmother', 'bs_giantmoth',
]

if __name__ == '__main__':
    source = Image.open(ROOT / 'docs/art/mist-forest-enemies/master.png').convert('RGBA')
    target = ROOT / 'art/monsters'
    pixels = np.array(source)
    labels, _ = label(pixels[:, :, 3] > 32)
    counts = np.bincount(labels.ravel())
    owners = np.zeros(labels.shape, dtype=np.uint8)
    found = set()
    # 羽や角が格子を越えても欠けないよう、本体の連結した輪郭で分ける。
    for component in np.flatnonzero(counts > 10000):
        if component == 0:
            continue
        ys, xs = np.where(labels == component)
        index = min(3, int(ys.mean() * 4 / source.height)) * 3 + min(2, int(xs.mean() * 3 / source.width)) + 1
        if index in found:
            raise ValueError('区画に複数の本体があります')
        found.add(index)
        owners[labels == component] = index
    if found != set(range(1, len(IDS) + 1)):
        raise ValueError(f'本体に不足があります: {found}')
    # 本体から離れた火・霧の粒・繭は、原画を確認した所属へ先に戻す。
    satellites = {37: 5, 48: 7, 53: 7, 59: 7, 61: 7,
                  66: 10, 67: 10, 70: 10, 71: 10}
    for component in np.flatnonzero((counts > 100) & (counts <= 10000)):
        ys, xs = np.where(labels == component)
        index = satellites.get(int(component), min(3, int(ys.mean() * 4 / source.height)) * 3 + min(2, int(xs.mean() * 3 / source.width)) + 1)
        owners[labels == component] = index
    _, nearest = distance_transform_edt(owners == 0, return_indices=True)
    assignment = owners[tuple(nearest)]
    for index, key in enumerate(IDS, 1):
        isolated = pixels.copy()
        isolated[assignment != index] = 0
        image = Image.fromarray(isolated)
        bounds = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        image = image.crop(bounds)
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(target / f'{key}.webp', lossless=True, method=6)
        print(f'  {key}: [{padded.width}, {padded.height}],')

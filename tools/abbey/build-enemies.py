"""修道院の透過原画を個別のロスレスWebPへ変換する。"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
IDS = [
    'bs_zombie', 'bs_weepangel', 'bs_tombwarden',
    'bs_shroudstrangler', 'bs_pettyrevenant', 'bs_sarcoguard',
    'bs_ghoul', 'bs_skullswarm', 'd02_soldier',
    'bs_bonechanter', 'bs_gravecaller', 'bs_cryptabbot',
]

if __name__ == '__main__':
    source = Image.open(ROOT / 'docs/art/abbey-enemies/master.png').convert('RGBA')
    rgba = np.array(source)
    labels, _ = ndimage.label(rgba[:, :, 3] > 20)
    sizes = np.bincount(labels.ravel())
    major = [int(i) for i in np.argsort(sizes)[::-1] if i and sizes[i] > 10000]
    assert len(major) == 12, '12体の独立した輪郭を確認する'
    # 互い違いに伸びる布や霧を格子で切らず、つながった輪郭で分離する。
    major.sort(key=lambda i: (int(ndimage.center_of_mass(labels == i)[0] // 362), ndimage.center_of_mass(labels == i)[1]))
    seeds = np.where(np.isin(labels, major), labels, 0)
    nearest = ndimage.distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    owners = seeds[tuple(nearest)]
    for key, label in zip(IDS, major):
        pixels = rgba.copy()
        pixels[owners != label] = 0
        image = Image.fromarray(pixels)
        image = image.crop(image.getchannel('A').getbbox())
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
        print(f'  {key}: [{padded.width}, {padded.height}],')

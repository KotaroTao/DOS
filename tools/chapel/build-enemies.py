"""沈んだ礼拝堂の透過原画を個別のロスレスWebPへ変換する。"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
IDS = [
    'bs_sludgeooze', 'bs_waterelemental', 'bs_sewerdredger',
    'bs_brinewraith', 'bs_waterhag', 'bs_eelfiend',
    'bs_anglerfiend', 'd03_sahagin', 'bs_abysstentacle',
    'el_drownedpaladin', 'bs_sewerlord',
]

if __name__ == '__main__':
    source = Image.open(ROOT / 'docs/art/chapel-enemies/master.png').convert('RGBA')
    rgba = np.array(source)
    # 透過の薄い生成ノイズを除き、離れた水滴は最寄りの輪郭へ割り当てる。
    rgba[rgba[:, :, 3] <= 20] = 0
    labels, _ = ndimage.label(rgba[:, :, 3] > 20)
    sizes = np.bincount(labels.ravel())
    major = [int(i) for i in np.argsort(sizes)[::-1] if i and sizes[i] > 10000]
    assert len(major) == 11, '11体の独立した輪郭を確認する'
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

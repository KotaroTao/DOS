"""本丸の原画を輪郭ごとに切り出し、透過WebPを作る（Pillow・NumPy・SciPy）。"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, label

ROOT = Path(__file__).resolve().parents[2]
SHEETS = {'main': (3, ['bs_dullahan', 'bs_shadowmage', 'bs_vampire', 'bs_bloodwraith', 'bs_fortlord', 'd03_ghost'])}


def split_sheet(sheet, columns, ids):
    pixels = np.array(Image.open(ROOT / 'docs/art/honmaru-enemies/sheet.png').convert('RGBA'))
    height, width = pixels.shape[:2]
    rows = (len(ids) + columns - 1) // columns
    labels, _ = label(pixels[:, :, 3] > 128)
    counts = np.bincount(labels.ravel())
    owners = np.zeros(labels.shape, dtype=np.uint8)
    found = set()
    # 槍・刀・旗の輪郭は格子の境界を越えるため、矩形の等分では切らない。
    for component in np.flatnonzero(counts > 10000):
        if component == 0:
            continue
        ys, xs = np.where(labels == component)
        col = min(columns - 1, int(xs.mean() * columns / width))
        row = min(rows - 1, int(ys.mean() * rows / height))
        index = row * columns + col + 1
        if index in found:
            raise ValueError(f'{sheet}: 一つの区画に複数の大きな輪郭があります')
        found.add(index)
        owners[labels == component] = index
    if found != set(range(1, len(ids) + 1)):
        raise ValueError(f'{sheet}: 本体の輪郭に不足があります: {found}')
    # 離れた火の粉・薄い霊の縁も、一番近い本体へ割り当てて元のRGBAを保つ。
    _, nearest = distance_transform_edt(owners == 0, return_indices=True)
    assignment = owners[tuple(nearest)]
    for index, key in enumerate(ids, 1):
        isolated = pixels.copy()
        isolated[assignment != index] = 0
        image = Image.fromarray(isolated)
        bounds = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bounds is None:
            raise ValueError(f'{key}: 絵が空です')
        left, top, right, bottom = bounds
        image = image.crop((max(0, left - 4), max(0, top - 4),
                            min(width, right + 4), min(height, bottom + 4)))
        yield key, image


if __name__ == '__main__':
    target = ROOT / 'art/monsters'
    target.mkdir(parents=True, exist_ok=True)
    for sheet, (columns, ids) in SHEETS.items():
        for key, image in split_sheet(sheet, columns, ids):
            if key != 'bs_fortlord':
                continue  # mainに先行して追加された5体は作り直さない。
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            padded = Image.new('RGBA', (image.width + 8, image.height + 8))
            padded.paste(image, (4, 4))
            padded.save(target / f'{key}.webp', lossless=True, method=6)
            print(f'  {key}: [{padded.width}, {padded.height}],')

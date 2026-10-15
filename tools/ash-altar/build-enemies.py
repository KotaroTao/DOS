"""灰の降る祭場の原画を個別の透過WebPへ変換・登録する（Pillow・NumPy・SciPy）。"""
from pathlib import Path
import json
import re
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/ash-altar-enemies'
SHEETS = {
    'a': [None, None, None, 'bs_demon', 'bs_pyrelich', 'bs_brimstonegolem'],
    'b': ['bs_shadowogre', 'bs_darkliege', 'bs_flamedrake'],
}


def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        image = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        if sheet == 'b':
            # 作成済みの下段3種は使わない。上段の足先より下で分ける。
            image = image.crop((0, 0, image.width, 650))
        pixels = np.array(image)
        components, _ = label(pixels[:, :, 3] > 20)
        bodies = []
        for number, slices in enumerate(find_objects(components), 1):
            if slices is None:
                continue
            y, x = slices
            if (y.stop-y.start) * (x.stop-x.start) > 20000:
                bodies.append((number, x.start, y.start))
        # 原画の上段3体・下段3体。格子をまたぐ翼も切断しない。
        bodies.sort(key=lambda b: (b[2] > 418 if sheet == 'a' else False, b[1]))
        if len(bodies) != len(ids):
            raise ValueError(f'{sheet}: 本体の数が違う {bodies}')
        owners = np.zeros(components.shape, dtype=np.uint8)
        for index, (number, _, _) in enumerate(bodies, 1):
            owners[components == number] = index
        _, nearest = distance_transform_edt(owners == 0, return_indices=True)
        assigned = owners[tuple(nearest)]
        for index, key in enumerate(ids, 1):
            if key is None:
                continue
            output = pixels.copy()
            output[assigned != index] = 0
            sprite = Image.fromarray(output)
            # 不可視に近い生成時の余白は寸法判定から外す。輪郭の半透明は保つ。
            bbox = sprite.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
            if not bbox:
                raise ValueError(f'{key}: 空の原画')
            sprite = sprite.crop(bbox)
            sprite.thumbnail((512, 512), Image.Resampling.LANCZOS)
            padded = Image.new('RGBA', (sprite.width + 8, sprite.height + 8))
            padded.paste(sprite, (4, 4))
            padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
            dimensions[key] = list(padded.size)
    photo_path = ROOT / 'src/monsterphotos.js'
    photos = photo_path.read_text()
    photos = re.sub(r'  // <<ASH_ALTAR_ART>>.*?  // <</ASH_ALTAR_ART>>\n', '', photos, flags=re.S)
    block = '  // <<ASH_ALTAR_ART>>\n  // 灰の降る祭場（作成済みの通常敵・強敵・共通敵は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</ASH_ALTAR_ART>>\n'
    photo_path.write_text(photos.replace('export const MONSTER_PHOTOS = {\n', 'export const MONSTER_PHOTOS = {\n' + block))
    sw_path = ROOT / 'sw.js'
    sw = sw_path.read_text()
    assets = ''.join(f'  "./art/monsters/{key}.webp",\n' for key in dimensions if f'"./art/monsters/{key}.webp"' not in sw)
    if assets:
        sw_path.write_text(sw.replace('  "./src/monsterphotos.js",', '  "./src/monsterphotos.js",\n' + assets.rstrip()))
    (SOURCE / 'dimensions.json').write_text(json.dumps(dimensions, indent=2) + '\n')
    print(json.dumps(dimensions, indent=2))


if __name__ == '__main__':
    build()

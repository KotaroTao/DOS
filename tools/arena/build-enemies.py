"""第九章・闘技場跡の原画を個別の透過WebPへ変換・登録する（Pillow・NumPy・SciPy）。"""
from pathlib import Path
import json
import re
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/arena-enemies'
SHEETS = {
    'a': ['bs_championwraith', 'bs_netfighter', 'bs_arenabeast', 'bs_spectreaudience', 'bs_chainedogre', 'bs_bladedancer'],
    'b': ['bs_executioner', 'bs_beastmaster', 'bs_mirrorduelist', 'bs_crowdroar', 'bs_sandlurker', 'bs_gladiatorlich'],
    'c': ['bs_spikedgolem', 'bs_hookmaster', 'bs_bloodpriest', 'bs_warbeasthound', 'bs_championofash', 'bs_impaler'],
    'd': ['bs_ghostgladiator', 'bs_chaingang', 'bs_arenalord'],
}


def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        image = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        pixels = np.array(image)
        components, _ = label(pixels[:, :, 3] > 20)
        bodies = []
        for number, slices in enumerate(find_objects(components), 1):
            if slices is None:
                continue
            y, x = slices
            if (y.stop-y.start) * (x.stop-x.start) > 20000:
                bodies.append((number, x.start, y.start))
        # 原画の3列を行順に扱い、格子をまたぐ武器も輪郭ごとに残す。
        bodies.sort(key=lambda b: (b[2] > image.height * 0.45 if sheet != 'd' else False, b[1]))
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
    photos = re.sub(r'  // <<ARENA_ART>>.*?  // <</ARENA_ART>>\n', '', photos, flags=re.S)
    block = '  // <<ARENA_ART>>\n  // 第九章・闘技場跡（本筋4・寄り道2。強敵と共通敵は作成済み原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</ARENA_ART>>\n'
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

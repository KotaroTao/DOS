"""釜場の4体の透過原画を個別のロスレスWebPへ変換・登録する。"""
from pathlib import Path
import json
import re
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/cauldron-enemies'
IDS = ['bs_furnacefiend', 'bs_obsidianguard', 'bs_basaltdrake', 'bs_infernaltyrant']


def build():
    sheet = Image.open(SOURCE / 'master.png').convert('RGBA')
    pixels = np.array(sheet)
    components, _ = label(pixels[:, :, 3] > 20)
    bodies = []
    for number, slices in enumerate(find_objects(components), 1):
        y, x = slices
        if (y.stop - y.start) * (x.stop - x.start) > 20000:
            bodies.append((number, x.start, y.start))
    bodies.sort(key=lambda body: (body[2] > 500, body[1]))
    if len(bodies) != len(IDS):
        raise ValueError(f'本体の数が違う: {bodies}')
    # 格子をまたぐ大槌・竜の尾・火球を切らず、離れた火の粉も最寄りの本体へ割り当てる。
    owners = np.zeros(components.shape, dtype=np.uint8)
    for index, (number, _, _) in enumerate(bodies, 1):
        owners[components == number] = index
    _, nearest = distance_transform_edt(owners == 0, return_indices=True)
    assigned = owners[tuple(nearest)]
    dimensions = {}
    for index, key in enumerate(IDS, 1):
        output = pixels.copy()
        output[assigned != index] = 0
        sprite = Image.fromarray(output)
        bbox = sprite.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
        if not bbox:
            raise ValueError(f'{key}: 空の原画')
        sprite = sprite.crop(bbox)
        sprite.thumbnail((512, 512), Image.Resampling.LANCZOS)
        padded = Image.new('RGBA', (sprite.width + 8, sprite.height + 8))
        padded.paste(sprite, (4, 4))
        padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
        dimensions[key] = list(padded.size)
    path = ROOT / 'src/monsterphotos.js'
    photos = re.sub(r'  // <<CAULDRON_ART>>.*?  // <</CAULDRON_ART>>\n', '', path.read_text(), flags=re.S)
    block = '  // <<CAULDRON_ART>>\n  // 魂を煮る釜場（作成済みの通常敵・強敵・共通敵は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</CAULDRON_ART>>\n'
    path.write_text(photos.replace('export const MONSTER_PHOTOS = {\n', 'export const MONSTER_PHOTOS = {\n' + block))
    path = ROOT / 'sw.js'
    sw = path.read_text()
    assets = ''.join(f'  "./art/monsters/{key}.webp",\n' for key in IDS if f'"./art/monsters/{key}.webp"' not in sw)
    if assets:
        path.write_text(sw.replace('  "./src/monsterphotos.js",', '  "./src/monsterphotos.js",\n' + assets.rstrip()))
    (SOURCE / 'dimensions.json').write_text(json.dumps(dimensions, indent=2) + '\n')
    print(json.dumps(dimensions, indent=2))


if __name__ == '__main__':
    build()

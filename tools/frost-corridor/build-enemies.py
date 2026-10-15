"""第六章の透過原画を個別のロスレスWebPへ変換・登録する。"""
from pathlib import Path
import json
import re
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects, distance_transform_edt

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/frost-corridor-enemies'
SHEETS = {
    'a': ['bs_frostwolf', 'bs_winterbat', 'bs_icewraith', 'bs_blizzardspirit', 'bs_iceserpent', 'bs_glacialcrab'],
    'b': ['bs_snowstalker', 'bs_rimecrawler', 'bs_frozenexplorer', 'bs_snowmantis', 'bs_aurorawisp', 'bs_iciclehorror'],
    'c': ['bs_frostknight', 'bs_frostlich', 'bs_frostmaiden', 'bs_icegolem', 'bs_frozenangel', 'bs_frostwyrm'],
    'd': ['bs_rimegiant', 'bs_frostfiend', 'bs_glaciallord'],
}


def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        image = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        rows = 1 if sheet == 'd' else 2
        pixels = np.array(image)
        components, _ = label(pixels[:, :, 3] > 20)
        owners = np.zeros(components.shape, dtype=np.uint8)
        # 輪郭が格子を越えた翼・剣・脚を切らず、つながった形ごとに分ける。
        # 群火の5つの炎や離れた氷片は、各部品の中心が入る枠へまとめる。
        for number, slices in enumerate(find_objects(components), 1):
            if slices is None:
                continue
            ys, xs = np.where(components[slices] == number)
            cx = xs.mean() + slices[1].start
            cy = ys.mean() + slices[0].start
            col = min(2, int(cx * 3 / image.width))
            row = min(rows - 1, int(cy * rows / image.height))
            owners[components == number] = row * 3 + col + 1
        _, nearest = distance_transform_edt(owners == 0, return_indices=True)
        assigned = owners[tuple(nearest)]
        for index, key in enumerate(ids, 1):
            output = pixels.copy()
            output[assigned != index] = 0
            cell = Image.fromarray(output)
            bbox = cell.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
            if not bbox:
                raise ValueError(f'{key}: 空の原画')
            sprite = cell.crop(bbox)
            sprite.thumbnail((512, 512), Image.Resampling.LANCZOS)
            padded = Image.new('RGBA', (sprite.width + 8, sprite.height + 8))
            padded.paste(sprite, (4, 4))
            padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
            dimensions[key] = list(padded.size)
    photo_path = ROOT / 'src/monsterphotos.js'
    photos = re.sub(r'  // <<FROST_CORRIDOR_ART>>.*?  // <</FROST_CORRIDOR_ART>>\n', '', photo_path.read_text(), flags=re.S)
    block = '  // <<FROST_CORRIDOR_ART>>\n  // 第六章・氷結回廊（強敵2種は作成済み原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</FROST_CORRIDOR_ART>>\n'
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

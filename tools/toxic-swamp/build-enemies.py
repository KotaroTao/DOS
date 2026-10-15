"""第7章「毒沼」の原画を個別の透過WebPへ変換・登録する（Pillow・NumPy・SciPy）。"""
from pathlib import Path
import json
import re
import numpy as np
from scipy.ndimage import label, find_objects, distance_transform_edt
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/toxic-swamp-enemies'
SHEETS = {
    'a': ['bs_plaguerat', 'bs_rotooze', 'bs_bogdrowned'],
    'b': ['bs_leechswarm', 'bs_marshlurker', 'bs_blightmoth'],
    'c': ['bs_sludgehydra', 'bs_gasfiend', 'bs_plaguebeast'],
    'd': ['bs_discardeddoll', 'bs_fungalcorpse', 'bs_miasmawraith'],
    'e': ['bs_venomspider', 'bs_necromancer', 'bs_toxicgolem'],
    'f': ['bs_plaguewraith', 'bs_corpseflower', 'bs_swamphag'],
    'g': ['bs_pestilenceknight', 'bs_plaguelich', 'bs_swamplord'],
}


def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        image = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        pixels = np.array(image)
        components, _ = label(pixels[:, :, 3] > 20)
        owners = np.zeros(components.shape, dtype=np.uint8)
        centers = np.array([[.25, .25], [.75, .25], [.25, .75]])
        # 本体を単位として割り当て、中央線をまたぐ脚・尾・冠も切らない。
        # 鼠の群れなど、本体が複数に分かれる敵は同じ配置へまとめる。
        for number, slices in enumerate(find_objects(components), 1):
            if slices is None:
                continue
            y, x = slices
            body = components[y, x] == number
            if body.sum() < 20000:
                continue
            cy, cx = np.nonzero(body)
            center = np.array([(cx.mean() + x.start) / image.width,
                               (cy.mean() + y.start) / image.height])
            owner = int(np.argmin(((centers - center) ** 2).sum(axis=1))) + 1
            owners[components == number] = owner
        if set(np.unique(owners)) != {0, 1, 2, 3}:
            raise ValueError(f'{sheet}: 本体の割り当てに欠落')
        _, nearest = distance_transform_edt(owners == 0, return_indices=True)
        assigned = owners[tuple(nearest)]
        if sheet == 'd':
            # 霊の頭上の輪は本体から離れているが、木の人業の足元へ混ぜない。
            assigned[630:, :] = 3
            assigned[:630, :700] = 1
            assigned[:630, 700:] = 2
        for index, key in enumerate(ids, 1):
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
    photos = re.sub(r'  // <<TOXIC_SWAMP_ART>>.*?  // <</TOXIC_SWAMP_ART>>\n', '', photos, flags=re.S)
    block = '  // <<TOXIC_SWAMP_ART>>\n  // 第7章「毒沼」（作成済みの通常敵・強敵・共通敵は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</TOXIC_SWAMP_ART>>\n'
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

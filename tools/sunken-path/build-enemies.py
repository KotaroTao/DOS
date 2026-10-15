"""水底の参道の原画を個別の透過WebPに変換し、画像寸法とSW登録を更新する。"""
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/sunken-path-enemies'
SHEETS = {
    'a': ['bs_kelpdrowned', 'bs_abyssjelly', 'bs_fonthorror'],
    'b': ['bs_drownedpriest', 'bs_naga', 'bs_choirwraith'],
    'c': ['bs_tidecaller', 'bs_sunkenbell', 'bs_soulharvester'],
}

def transparent_seam(source, center, radius):
    """隣り合う輪郭を切らないよう、透明な余白を縦にたどる。"""
    alpha = source.getchannel('A')
    lo, hi = center - radius, center + radius
    width = hi - lo
    rows = []
    previous = [0] * width
    for y in range(source.height):
        current, parents = [], []
        for i, x in enumerate(range(lo, hi)):
            parent = min(range(max(0, i - 1), min(width, i + 2)), key=previous.__getitem__)
            current.append(previous[parent] + alpha.getpixel((x, y)) ** 2 * 100000 + abs(x - center))
            parents.append(parent)
        rows.append(parents)
        previous = current
    i = min(range(width), key=previous.__getitem__)
    seam = []
    for y in reversed(range(source.height)):
        seam.append(lo + i)
        i = rows[y][i]
    seam.reverse()
    if max(alpha.getpixel((x, y)) for y, x in enumerate(seam)) > 4:
        raise ValueError(f'原画の輪郭を横切るため切り出しを中止: {center=} alpha={max(alpha.getpixel((x,y)) for y,x in enumerate(seam))}')
    return seam

def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        source = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        w, h = source.size
        seams = [[0] * h, transparent_seam(source, w // 3, 180),
                 transparent_seam(source, 2 * w // 3, 100), [w] * h]
        for index, key in enumerate(ids):
            im = Image.new('RGBA', source.size)
            for y in range(h):
                left, right = seams[index][y], seams[index + 1][y]
                im.paste(source.crop((left, y, right, y + 1)), (left, y))
            # 生成PNGの透明領域に残るα=1の不可視画素を余白判定から除く。
            # 原画の色・半透明の輪郭は変更せず、切り出し位置だけを決める。
            bbox = im.getchannel('A').point(lambda a: 255 if a > 1 else 0).getbbox()
            if not bbox:
                raise ValueError(f'{key}: 原画が空')
            im = im.crop(bbox)
            im.thumbnail((512, 512), Image.Resampling.LANCZOS)
            padded = Image.new('RGBA', (im.width + 8, im.height + 8))
            padded.paste(im, (4, 4))
            padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
            dimensions[key] = list(padded.size)
    photo_path = ROOT / 'src/monsterphotos.js'
    photos = photo_path.read_text()
    photos = re.sub(r'  // <<SUNKEN_PATH_ART>>.*?  // <</SUNKEN_PATH_ART>>\n', '', photos, flags=re.S)
    block = '  // <<SUNKEN_PATH_ART>>\n  // 水底の参道（作成済みの異端大司教・共通敵は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</SUNKEN_PATH_ART>>\n'
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

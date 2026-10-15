"""大神殿の未作成3体を透過WebPへ変換し、寸法とSW登録を更新する。"""
from pathlib import Path
import json
import re
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/sunken-temple-enemies'
IDS = ['bs_divinegolem', 'bs_fallenangel', 'bs_templelord']

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
    source = Image.open(SOURCE / 'master.png').convert('RGBA')
    w, h = source.size
    left = transparent_seam(source, 528, 60)
    right = transparent_seam(source, 1024, 50)
    dimensions = {}
    for index, key in enumerate(IDS):
        image = Image.new('RGBA', source.size)
        for y in range(h):
            for x in range(w):
                cell = 0 if x < left[y] else 1 if x < right[y] else 2
                if cell == index:
                    image.putpixel((x, y), source.getpixel((x, y)))
        bbox = image.getchannel('A').point(lambda a: 255 if a > 1 else 0).getbbox()
        if not bbox:
            raise ValueError(f'{key}: 原画が空')
        image = image.crop(bbox)
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
        dimensions[key] = list(padded.size)
    path = ROOT / 'src/monsterphotos.js'
    photos = re.sub(r'  // <<SUNKEN_TEMPLE_ART>>.*?  // <</SUNKEN_TEMPLE_ART>>\n', '', path.read_text(), flags=re.S)
    block = '  // <<SUNKEN_TEMPLE_ART>>\n  // 沈める大神殿（作成済みの敵・召喚先は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</SUNKEN_TEMPLE_ART>>\n'
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

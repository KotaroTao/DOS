"""洗礼の大水槽の未作成3体を透過WebPへ変換し、寸法とSW登録を更新する。"""
from pathlib import Path
import json
import re
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/baptism-enemies'
IDS = ['bs_irongolem', 'bs_voidwalker', 'bs_shadowdragon']

# 原画の輪郭と、透明度4以下の余白を確認した境界。
FRAMES = [(0, 0, 925, 724), (925, 0, 1380, 724), (1380, 0, 2172, 724)]

def build():
    source = Image.open(SOURCE / 'master.png').convert('RGBA')
    if source.size != (2172, 724):
        raise ValueError('原画の寸法が変わったため切り出し位置の再確認が必要')
    for x in (925, 1380):
        if source.getchannel('A').crop((x, 0, x + 1, source.height)).getextrema()[1] > 4:
            raise ValueError('切り出し境界が輪郭を横切っている')
    dimensions = {}
    for index, key in enumerate(IDS):
        image = source.crop(FRAMES[index])
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
    photos = re.sub(r'  // <<BAPTISM_ART>>.*?  // <</BAPTISM_ART>>\n', '', path.read_text(), flags=re.S)
    block = '  // <<BAPTISM_ART>>\n  // 洗礼の大水槽（作成済みの通常敵・強敵・共通敵は既存原画を共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</BAPTISM_ART>>\n'
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

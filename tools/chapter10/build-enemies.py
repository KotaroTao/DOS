"""第十章の未作成敵の個別原画を透過ロスレスWebPへ変換・登録する。"""
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/chapter10-enemies'
IDS = ['bs_echowraith', 'bs_stalactiteghost', 'bs_moldern']
dimensions = {}
for key in IDS:
    sprite = Image.open(SOURCE / f'{key}.png').convert('RGBA')
    bbox = sprite.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    if not bbox:
        raise ValueError(f'{key}: 空の原画')
    sprite = sprite.crop(bbox)
    sprite.thumbnail((512, 512), Image.Resampling.LANCZOS)
    padded = Image.new('RGBA', (sprite.width + 8, sprite.height + 8))
    padded.paste(sprite, (4, 4))
    padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
    dimensions[key] = list(padded.size)
photos_path = ROOT / 'src/monsterphotos.js'
photos = re.sub(r'  // <<CHAPTER10_ART>>.*?  // <</CHAPTER10_ART>>\n', '', photos_path.read_text(), flags=re.S)
block = '  // <<CHAPTER10_ART>>\n  // 第十章・地底大空洞（作成済み26体は既存原画を共用）。\n'
block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
block += '  // <</CHAPTER10_ART>>\n'
photos_path.write_text(photos.replace('export const MONSTER_PHOTOS = {\n', 'export const MONSTER_PHOTOS = {\n' + block))
sw_path = ROOT / 'sw.js'
sw = sw_path.read_text()
assets = ''.join(f'  "./art/monsters/{key}.webp",\n' for key in IDS if f'"./art/monsters/{key}.webp"' not in sw)
if assets:
    sw_path.write_text(sw.replace('  "./src/monsterphotos.js",', '  "./src/monsterphotos.js",\n' + assets.rstrip()))
(SOURCE / 'dimensions.json').write_text(json.dumps(dimensions, indent=2) + '\n')
print(json.dumps(dimensions, indent=2))

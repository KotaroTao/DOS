"""閉架の原画を個別の透過WebPに変換し、画像寸法とSW登録を更新する。"""
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/closed-stacks-enemies'
SHEETS = {
    'a': ['bs_tomeguardian', 'bs_runegolem', 'bs_forbiddenspirit', 'bs_mindeater'],
    'b': ['bs_spellwraith', 'bs_cosmicwraith', 'bs_inkdragon', 'bs_elderlich'],
    'c': ['bs_arcanesentinel', 'bs_soulreaper', 'bs_inkhorror', 'bs_grimoirebeast'],
    'd': ['el_librarian', 'mt_gold', 'mt_king', 'master_mimic'],
}

def build():
    dimensions = {}
    for sheet, ids in SHEETS.items():
        source = Image.open(SOURCE / f'sheet-{sheet}.png').convert('RGBA')
        w, h = source.size
        mid_x, mid_y = (800, 510) if sheet == 'd' else (w // 2, h // 2)
        frames = [(0, 0, mid_x, mid_y), (mid_x, 0, w, mid_y),
                  (0, mid_y, mid_x, h), (mid_x, mid_y, w, h)]
        # 横長の墨竜・墨の異形は、余白の中で切り分け位置をずらす。
        if sheet in ('b', 'c'):
            cut = 900 if sheet == 'b' else 820
            frames[2:] = [(0, mid_y, cut, h), (cut, mid_y, w, h)]
        for key, frame in zip(ids, frames):
            im = source.crop(frame)
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
    photos = re.sub(r'  // <<CLOSED_STACKS_ART>>.*?  // <</CLOSED_STACKS_ART>>\n', '', photos, flags=re.S)
    block = '  // <<CLOSED_STACKS_ART>>\n  // 閉架の書庫（主は禁書の巨像と共用）。\n'
    block += ''.join(f'  {key}: {json.dumps(size)},\n' for key, size in dimensions.items())
    block += '  // <</CLOSED_STACKS_ART>>\n'
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

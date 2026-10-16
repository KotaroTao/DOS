"""依頼者の原画を切り出し、WebP・名前別台帳・SWを更新する。"""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
MASTERS = ROOT / 'docs/art/tavern-clients'
OUT = ROOT / 'art/quest-clients'
OUT.mkdir(parents=True, exist_ok=True)
names = json.loads((MASTERS / 'names.json').read_text())
entries = []
layouts = json.loads((MASTERS / 'atlases.json').read_text())
cells = [(a, cell) for a in layouts for cell in range(a['count'])]
if len(cells) != len(names) or len(set(names)) != len(names):
    raise ValueError('原画の人数と重複のない名前の台帳をそろえてください')
for i, (name, (layout, cell)) in enumerate(zip(names, cells)):
    cols, rows = layout['cols'], layout['rows']
    with Image.open(MASTERS / layout['file']) as atlas:
        col, row = cell % cols, cell // cols
        w, h = atlas.size
        tile = atlas.crop((round(col*w/cols), round(row*h/rows), round((col+1)*w/cols), round((row+1)*h/rows)))
        # 最初の47人は従来と同じ切り出しを保ち、縦長の追加原画は顔を中心に切る。
        portrait = tile.resize((256, 256), Image.Resampling.LANCZOS) if i < 47 else ImageOps.fit(tile, (256, 256), Image.Resampling.LANCZOS, centering=(0.5, 0.0))
        portrait.save(OUT / f'client-{i:02d}.webp', quality=88, method=6)
    entries.append((name, f'art/quest-clients/client-{i:02d}.webp'))
source = '// 酒場の依頼者の肖像 (tools/tavern/build-portraits.py が生成)。\nexport const QUEST_PORTRAITS = {\n'
source += ''.join(f'  {json.dumps(n, ensure_ascii=False)}: {json.dumps(p)},\n' for n, p in entries)
(ROOT / 'src/questportraits.js').write_text(source + '};\n')
sw = ROOT / 'sw.js'
text = sw.read_text()
start = '  // <<QUEST_PORTRAITS>>\n'
end = '  // <</QUEST_PORTRAITS>>\n'
block = start + '  "./src/questportraits.js",\n  "./src/ui/questportrait.js",\n'
block += ''.join(f'  "./{p}",\n' for _, p in entries) + end
if start in text:
    a = text.index(start)
    b = text.index(end, a) + len(end)
    text = text[:a] + block + text[b:]
else:
    text = text.replace('  "./src/game.js",\n', '  "./src/game.js",\n' + block)
sw.write_text(text)
print(f'{len(entries)}人の肖像を登録')

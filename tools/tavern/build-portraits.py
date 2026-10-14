"""依頼者の4×4原画を切り出し、WebP・名前別台帳・SWを更新する。"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTERS = ROOT / 'docs/art/tavern-clients'
OUT = ROOT / 'art/quest-clients'
OUT.mkdir(parents=True, exist_ok=True)
names = json.loads((MASTERS / 'names.json').read_text())
entries = []
for i, name in enumerate(names):
    with Image.open(MASTERS / f'atlas-{i // 16 + 1}.png') as atlas:
        col, row = i % 4, i % 16 // 4
        w, h = atlas.size
        tile = atlas.crop((round(col*w/4), round(row*h/4), round((col+1)*w/4), round((row+1)*h/4)))
        tile.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / f'client-{i:02d}.webp', quality=88, method=6)
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

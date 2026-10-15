"""原画と台帳から戦闘背景WebPを再生成する (Pillow)。"""
import json
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[2]
masters = root / 'docs/art/battle-backgrounds'
rows = json.loads((masters / 'manifest.json').read_text())
for row in rows:
    im = Image.open(masters / f"atlas-{row['atlas']:02}.png").convert('RGB')
    j = row['tile'] - 1
    col, line = j % 3, j // 3
    box = (round(col*im.width/3)+4, round(line*im.height/3)+4,
           round((col+1)*im.width/3)-4, round((line+1)*im.height/3)-4)
    dest = root / 'art/battle' / f"{row['id']}.webp"
    im.crop(box).resize((504,336), Image.Resampling.LANCZOS).save(dest, 'WEBP', quality=88, method=6)
    row['bytes'] = dest.stat().st_size
(masters / 'manifest.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
print(f'{len(rows)}点を生成')

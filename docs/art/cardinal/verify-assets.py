"""出荷画像の透過と端の余白を検査する。"""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[3]
rows = []
for rank in range(1, 6):
    path = root / f'art/jobs/cardinal_{rank}.webp'
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    bbox = alpha.getbbox()
    assert im.size == (360, 368)
    assert alpha.getextrema() == (0, 255)
    assert bbox and 0 < bbox[0] < bbox[2] < im.width
    assert 0 < bbox[1] < bbox[3] < im.height
    rows.append({'rank': rank, 'size': im.size, 'alphaBBox': bbox,
                 'transparentBackground': True, 'edgeClipping': False})
(Path(__file__).parent / 'asset-verification.json').write_text(
    json.dumps(rows, indent=2) + '\n')
print('全5枚の透過と画像端の余白を確認')

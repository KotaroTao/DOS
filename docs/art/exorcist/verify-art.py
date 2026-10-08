"""採用画像・選択・透過と共通枠を検査し、結果を記録する。"""
from pathlib import Path
import json
from collections import deque
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/art/exorcist'
review = json.loads((OUT / 'game-display-review.json').read_text())
baseline, *sprites = review['sprites']
assert review['canvasCount'] == 30 and not review['browserErrors']
assert len(sprites) == 5
assets = []
for rank, row in enumerate(sprites, 1):
    name = f'art/jobs/exorcist_{rank}.webp'
    assert row['key'] == 'exorcist' and row['rank'] == rank
    assert row['src'].endswith('/' + name)
    assert [row['w'], row['h']] == [baseline['w'], baseline['h']]
    assert row['head'][:2] == baseline['head'][:2]
    assert row['face'] == baseline['face'], row
    assert name in (ROOT / 'sw.js').read_text()
    im = Image.open(ROOT / name).convert('RGBA')
    assert im.size == (360, 368)
    alpha = np.array(im.getchannel('A'))
    assert alpha.min() == 0 and alpha.max() == 255
    edge_alpha = [int(alpha[0].max()), int(alpha[-1].max()),
                  int(alpha[:, 0].max()), int(alpha[:, -1].max())]
    # 基準画像にも縮小補間の半透明な足先が最下行に残る。人物の不透明部分は端に達しない。
    assert max(edge_alpha) < 128
    mask = alpha >= 128
    seen = np.zeros_like(mask)
    components = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        queue = deque([(y, x)])
        size = 0
        while queue:
            cy, cx = queue.popleft()
            size += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        components.append(size)
    assets.append({'rank': rank, 'size': list(im.size), 'alphaBBox': im.getbbox(),
                   'edgeAlphaMax': edge_alpha,
                   'opaqueComponents': sorted(components, reverse=True),
                   'head': row['head'], 'face': row['face'],
                   'chinDeltaFromCrusader': round(row['head'][2] - baseline['head'][2], 3)})
(OUT / 'asset-verification.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')
print('5ランクの新画像選択、共通枠・顔座標、透過・画像端、30枚の描画と起動を確認')

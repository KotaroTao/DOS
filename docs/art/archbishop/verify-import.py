"""実描画と、ユーザーが採用した大司教R1からのランク間整合性を確認する。"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

out = Path(__file__).parent
root = out.parents[2]
url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8001/'
subprocess.run([
    'python3', 'tools/review-job-art.py', 'archbishop', '--label', '大司教',
    '--url', url, '--output', 'docs/art/archbishop/final-review',
], cwd=root, check=True)
review = json.loads((out / 'final-review.json').read_text())
before = json.loads((out / 'before-import-review.json').read_text())
rows = review['sprites']
target = rows[1:]
assert [row['rank'] for row in target] == [1, 2, 3, 4, 5]
for row in rows:
    assert row['src'].endswith(f"/art/jobs/{row['key']}_{row['rank']}.webp")
    assert max(row['w'], row['h']) == max(before['sprites'][0]['w'], before['sprites'][0]['h'])
for row in target:
    assert row['face'] == target[0]['face']
    assert all(abs(row['head'][i] - target[0]['head'][i]) < .3 for i in range(3))
assets = []
sw = (root / 'sw.js').read_text()
assert 'const CACHE = "dos-dev";' in sw
for rank in range(1, 6):
    assert f'"./art/jobs/archbishop_{rank}.webp"' in sw
    path = root / f'art/jobs/archbishop_{rank}.webp'
    image = Image.open(path).convert('RGBA')
    alpha = np.asarray(image)[:, :, 3]
    assert alpha.min() == 0 and alpha.max() == 255
    assert max(alpha[0].max(), alpha[-1].max(), alpha[:, 0].max(), alpha[:, -1].max()) < 16
    assert image.size == (360, 376)
    assets.append({'rank': rank, 'size': list(image.size),
                   'alphaBBox': image.getchannel('A').getbbox(), 'transparent': True,
                   'edgeClear': True})
report = {
    'assets': assets,
    'rankHeadsAligned': True,
    'allExactRankPhotosSelected': True,
    'commonMaximumUnchanged': True,
    'standardFrameBefore': [before['sprites'][0]['w'], before['sprites'][0]['h']],
    'commonFrameAfter': [rows[0]['w'], rows[0]['h']],
    'note': 'ユーザーが添付して採用した初期R1の人体を維持。聖戦士との頭身一致検査は適用せず、大司教R1に対して全ランクを検査。',
}
(out / 'asset-verification.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('原画選択・全ランクの頭位置・透過・画像端・共通表示倍率を確認')

"""透過・枠・画像選択と承認済みR1からの配置差を検査する。"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label

root = Path(__file__).resolve().parents[3]
folder = root / 'docs/art/arcanist'
review = json.loads((folder / 'final-review.json').read_text())
settings = json.loads((folder / 'import-settings.json').read_text())
sw = (root / 'sw.js').read_text()
assert 'const CACHE = "dos-dev"' in sw
rows = review['sprites']
assert review['canvasCount'] == 30 and not review['browserErrors']
assert all(x['face'] == [48, 21] and x['w'] == 96 and x['h'] == 94 for x in rows)
assert all(x['src'].endswith(f"/art/jobs/{x['key']}_{x['rank']}.webp") for x in rows)
assert all(abs(x['head'][2] - rows[1]['head'][2]) < .2 for x in rows[1:])
assert all(abs(x['head'][2] - (10 + s['headHeightDots'])) < .002
           for x, s in zip(rows[1:], settings['sources']))
assets = []
for r, source in enumerate(settings['sources'], 1):
    path = f'art/jobs/arcanist_{r}.webp'
    assert f'"./{path}"' in sw
    im = Image.open(root / path).convert('RGBA')
    assert im.size == (360, 368)
    alpha = np.asarray(im)[:, :, 3]
    assert alpha.min() == 0 and alpha.max() == 255
    assert not any(edge.max() for edge in [alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    components, _ = label(alpha > 128, structure=np.ones((3, 3)))
    sizes = sorted(np.bincount(components.ravel())[1:].tolist(), reverse=True)
    assert len(sizes) == 1, (r, sizes)
    original = Image.open(root / source['source']).convert('RGBA')
    original_alpha = np.asarray(original)[:, :, 3]
    components, _ = label(original_alpha > 128, structure=np.ones((3, 3)))
    source_sizes = sorted(np.bincount(components.ravel())[1:].tolist(), reverse=True)
    assert len(source_sizes) == 1
    assets.append({'rank': r, 'src': path, 'size': list(im.size),
                   'alphaBBox': list(im.getchannel('A').getbbox()),
                   'opaqueComponents': len(sizes), 'sourceOpaqueComponents': len(source_sizes),
                   'transparentEdges': True, 'serviceWorkerAsset': True})
result = {'assets': assets, 'canvasCount': review['canvasCount'],
          'browserErrors': review['browserErrors'], 'cache': 'dos-dev',
          'rankHeadDifferenceFromApprovedR1': max(abs(x['head'][2] - rows[1]['head'][2]) for x in rows[1:]),
          'crusaderChinDifferences': [round(x['head'][2] - rows[0]['head'][2], 3) for x in rows[1:]],
          'comparisonNote': '確認済みR1の輪郭を維持。聖戦士より顎は約0.6ドット上で、顔位置・頭頂・共通枠は同じ。'}
(folder / 'asset-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('全5枚の透過・画像端・輪郭・画像選択・共通座標・SW登録を確認')

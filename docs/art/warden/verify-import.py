"""承認済み護法師R1を基準に取り込み結果を検査する。"""
from pathlib import Path
import importlib.util
import json
from PIL import Image

root = Path(__file__).resolve().parents[3]
art = root / 'docs/art/warden'
review = json.loads((art / 'game-display-review.json').read_text())
settings = json.loads((art / 'import-settings.json').read_text())
rows = review['sprites'][1:]
assert not review['browserErrors'] and review['canvasCount'] == 30
assert [r['rank'] for r in rows] == list(range(1, 6))
assets = (root / 'sw.js').read_text()
assert 'const CACHE = "dos-dev"' in assets
measurements = []
for row, spec in zip(rows, settings['ranks']):
    rank = spec['rank']
    path = f'art/jobs/warden_{rank}.webp'
    assert row['src'].endswith('/' + path)
    assert row['face'] == rows[0]['face']
    assert row['w'] == rows[0]['w'] and row['h'] == rows[0]['h']
    assert row['head'][:2] == rows[0]['head'][:2]
    assert abs(row['head'][2] - rows[0]['head'][2]) < 0.3
    assert f'"./{path}"' in assets
    image = Image.open(root / path)
    assert image.size == (360, 368)
    alpha = image.getchannel('A')
    assert alpha.getextrema() == (0, 255)
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    # 足裏は共通枠の最下行に来る。欠けはjobimgの変換前の枠検査で拒否される。
    assert bbox and 0 < bbox[0] < bbox[2] < 360 and 0 < bbox[1] < bbox[3] <= 368
    left, right, top, chin, sole = spec['head']
    stature = (sole - top) / spec['perDot']
    assert abs(stature - 82.9) < 0.2
    measurements.append({'rank': rank, 'visibleBBox': bbox, 'crownToSole': stature,
                         'headHeight': row['head'][2] - row['head'][1]})

# 新しいオプションでも既定の透過処理は変わらないことを確認する。
module_spec = importlib.util.spec_from_file_location('jobimg', root / 'tools/jobimg.py')
jobimg = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(jobimg)
sample = Image.new('RGBA', (3, 1), (0, 0, 0, 0))
sample.putdata([(1, 2, 3, 1), (1, 2, 3, 8), (1, 2, 3, 9)])
sample_path = Path('/tmp/warden-alpha-check.png')
sample.save(sample_path)
assert [jobimg.cut_out(sample_path)[0].getpixel((x, 0))[3] for x in range(3)] == [0, 8, 9]
assert [jobimg.cut_out(sample_path, 8)[0].getpixel((x, 0))[3] for x in range(3)] == [0, 0, 9]
result = {'photoSelection': 'passed', 'alphaFloor': 'passed', 'cacheAssets': 'passed',
          'rankMeasurements': measurements,
          'referenceHeadDifference': [round(m['headHeight'] - 21.93, 3) for m in measurements]}
(art / 'asset-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('護法師5ランクの新画像選択・透過・枠・高さ・キャッシュ登録を確認')

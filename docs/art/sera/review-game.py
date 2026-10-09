"""承認済みセラの頭身を基準に、画像選択とゲーム描画を確認する。"""
from pathlib import Path
import json
import subprocess
from PIL import Image
from playwright.sync_api import sync_playwright
import shutil

root = Path(__file__).resolve().parents[3]
out = Path(__file__).parent
subprocess.run([
    'python3', 'tools/review-job-art.py', 'sera', '--label', '灯守',
    '--output', 'docs/art/sera/final-review',
], cwd=root, check=True)
review = json.loads((out / 'final-review.json').read_text())
rows = review['sprites']
sera = [row for row in rows if row['key'] == 'sera']
assert len(sera) == 5
assert review['canvasCount'] == 30 and not review['browserErrors']
for row in rows:
    assert row['src'].endswith(f"/art/jobs/{row['key']}_{row['rank']}.webp"), row
    assert (row['w'], row['h']) == (rows[0]['w'], rows[0]['h']), row
for row in sera:
    assert row['face'] == sera[0]['face'], row
    assert max(abs(x-y) for x,y in zip(row['head'], sera[0]['head'])) < 0.5, row

assets = []
for rank in range(1, 6):
    path = root / f'art/jobs/sera_{rank}.webp'
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    assert im.size == (360, 368) and alpha.getextrema() == (0, 255)
    assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < im.width and bbox[3] < im.height, bbox
    assets.append({'rank': rank, 'size': list(im.size), 'alphaBBox': list(bbox)})

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8000/')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(out / 'mobile-startup.png'), full_page=True)
    assert not errors, errors
    browser.close()
(out / 'asset-verification.json').write_text(json.dumps(assets, indent=2))
print('灯守全5ランクの原画選択・透過・共通枠・顔位置・モバイル起動を確認')

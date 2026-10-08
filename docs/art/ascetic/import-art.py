"""確定した修験者の原画を、測定値に基づいて既存ツールで取り込む。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
folder = Path(__file__).parent
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out

measurements = [
    [500, 620, 166, 420],
    [500, 618, 164, 419],
    [500, 620, 164, 419],
    [496, 616, 164, 419],
    [500, 620, 166, 420],
]
sources = []
for rank, head in enumerate(measurements, 1):
    source = folder / f'ascetic-r{rank}-final.png'
    _, bbox = cut_out(source)
    # 縮小時の輪郭の補間も含め、足裏に余白を残す。
    per_dot = (bbox[3] - head[2]) / 82.5
    sources.append({
        'source': str(source.relative_to(root)), 'perDot': per_dot,
        'head': head, 'alphaBBox': list(map(int, bbox)),
        'crownToSoleApprox': 82.5,
        'headHeight': (head[3] - head[2]) / per_dot,
    })
settings = {
    'job': 'ascetic',
    'reference': 'docs/art/crusader/crusader-r1-final.png',
    'anatomySource': 'docs/art/ascetic/ascetic-r1-review-v2.png',
    'frame': [90, 92], 'frameTop': 9,
    'crownNote': '主な髪の塊の上端を測定。六角帽と跳ね毛の先端は含めない。',
    'sources': sources,
}
(folder / 'import-settings.json').write_text(
    json.dumps(settings, ensure_ascii=False, indent=2) + '\n')
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'ascetic',
    *[item['source'] for item in sources],
    '--per-dot', ','.join(str(item['perDot']) for item in sources),
    '--head', *[','.join(map(str, item['head'])) for item in sources],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/ascetic/import-preview.png',
], cwd=root, check=True)

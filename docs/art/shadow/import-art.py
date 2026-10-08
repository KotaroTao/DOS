"""測定した暗殺者の原画を既存ツールで取り込む。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out

folder = Path(__file__).parent
# フードの下の頭頂と覆面の下の顎は、承認済みR1の輪郭から推定する。
measurements = [
    ([489, 611, 210, 499], 1304),
    ([489, 611, 210, 500], 1302),
    ([470, 598, 210, 507], 1331),
    ([484, 608, 210, 506], 1332),
    ([489, 611, 213, 506], 1308),
]
sources = []
for rank, (head, sole) in enumerate(measurements, 1):
    source = folder / f'shadow-r{rank}.png'
    _, bbox = cut_out(source)
    per_dot = (bbox[3] - head[2]) / 82.8
    sources.append({'source': str(source.relative_to(root)), 'perDot': per_dot,
                    'head': head, 'sole': sole, 'alphaBBox': bbox,
                    'crownToSole': (sole-head[2])/per_dot,
                    'headHeight': (head[3]-head[2])/per_dot})
settings = {'job': 'shadow', 'reference': 'docs/art/crusader/crusader-r1-final.png',
            'anatomySource': 'docs/art/shadow/shadow-r1.png',
            'frame': [90, 92], 'frameTop': 9,
            'measurementNote': '顔の頬の中心、主な髪の頭頂、覆面の下の顎、足裏を測定。フードの上端を人体の頭頂に含めない。',
            'sources': sources}
(folder / 'import-settings.json').write_text(json.dumps(settings, ensure_ascii=False, indent=2)+'\n')
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'shadow',
    *[item['source'] for item in sources],
    '--per-dot', ','.join(str(item['perDot']) for item in sources),
    '--head', *[','.join(map(str, item['head'])) for item in sources],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/shadow/import-preview.png',
], cwd=root, check=True)

"""確認済み修羅の原画を測定値に基づいて取り込む。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out

folder = Path(__file__).parent
# 跳ねる髪と角を除く主な髪の頭頂、頬の左右、顎先。
measurements = [
    ([592, 708, 307, 612], 1459),
    ([480, 602, 170, 470], 1303),
    ([480, 594, 166, 467], 1298),
    ([482, 596, 181, 478], 1298),
    ([451, 576, 112, 440], 1348),
]
sources = []
for rank, (head, sole) in enumerate(measurements, 1):
    source = folder / f'asura-r{rank}-final.png'
    _, bbox = cut_out(source)
    per_dot = (bbox[3] - head[2]) / 82.8
    sources.append({'source': str(source.relative_to(root)), 'perDot': per_dot,
                    'head': head, 'sole': sole, 'alphaBBox': bbox,
                    'crownToSole': (sole - head[2]) / per_dot,
                    'headHeight': (head[3] - head[2]) / per_dot})
settings = {'job': 'asura', 'label': '修羅',
            'reference': 'docs/art/crusader/crusader-r1-final.png',
            'anatomySource': 'docs/art/asura/asura-r1-final.png',
            'frame': [90, 92], 'frameTop': 9,
            'crownNote': '逆立つ髪は主な頭の髪の先と根元の間で測定。後ろの髪束と角の先は除外。',
            'sources': sources}
(folder / 'import-settings.json').write_text(json.dumps(settings, ensure_ascii=False, indent=2) + '\n')
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'asura',
    *[item['source'] for item in sources],
    '--per-dot', ','.join(str(item['perDot']) for item in sources),
    '--head', *[','.join(map(str, item['head'])) for item in sources],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/asura/import-preview.png',
], cwd=root, check=True)

"""測定した僧侶の原画を既存ツールで取り込む。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out

folder = Path(__file__).parent
measurements = [
    ([524, 654, 166, 480], 1346),
    ([532, 656, 148, 464], 1343),
    ([524, 654, 166, 480], 1347),
    ([488, 618, 148, 466], 1349),
    ([520, 650, 166, 480], 1359),
]
sources = []
for rank, (head, sole) in enumerate(measurements, 1):
    source = folder / f'priest-r{rank}-final.png'
    _, bbox = cut_out(source)
    # 足裏下の半透明な輪郭も共通枠へ収める。
    per_dot = (bbox[3] - head[2]) / 82.8
    sources.append({'source': str(source.relative_to(root)), 'perDot': per_dot,
                    'head': head, 'sole': sole, 'alphaBBox': bbox,
                    'crownToSole': (sole-head[2])/per_dot,
                    'headHeight': (head[3]-head[2])/per_dot})
settings = {'job': 'priest', 'reference': 'docs/art/crusader/crusader-r1-final.png',
            'anatomySource': 'docs/art/priest/priest-r1-final.png',
            'frame': [90, 92], 'frameTop': 9,
            'crownNote': '主な髪の頭頂は頭巾の下の推定位置。帽子や金飾りの上端とは区別する。',
            'sources': sources}
(folder / 'import-settings.json').write_text(json.dumps(settings, ensure_ascii=False, indent=2)+'\n')
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'priest',
    *[item['source'] for item in sources],
    '--per-dot', ','.join(str(item['perDot']) for item in sources),
    '--head', *[','.join(map(str, item['head'])) for item in sources],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/priest/import-preview.png',
], cwd=root, check=True)

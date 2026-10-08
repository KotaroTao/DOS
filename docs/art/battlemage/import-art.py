"""魔闘士の測定値を保存し、既存の原画取り込みツールを実行する。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from jobimg import cut_out

folder = Path(__file__).parent
# 頬の左右・主な髪の頭頂・肌の顎先。跳ね毛は頭頂に含めない。
heads = [
    [488, 610, 193, 490],
    [480, 618, 130, 438],
    [491, 621, 157, 455],
    [488, 610, 188, 484],
    [488, 610, 194, 484],
]
sources = []
for rank, head in enumerate(heads, 1):
    source = folder / f'battlemage-r{rank}-final.png'
    _, bbox = cut_out(source)
    # 縮小補間後も足裏に1ドットの透明な余白を残す。
    per_dot = (bbox[3] - head[2]) / 82
    sources.append({'source': str(source.relative_to(root)), 'perDot': per_dot,
                    'head': head, 'alphaBBox': bbox,
                    'headHeight': (head[3] - head[2]) / per_dot})
settings = {'job': 'battlemage',
            'reference': 'docs/art/crusader/crusader-r1-final.png',
            'anatomySource': 'docs/art/battlemage/battlemage-r1-final.png',
            'frame': [90, 92], 'frameTop': 9, 'sources': sources}
(folder / 'import-settings.json').write_text(
    json.dumps(settings, ensure_ascii=False, indent=2) + '\n')
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'battlemage',
    *[item['source'] for item in sources],
    '--per-dot', ','.join(str(item['perDot']) for item in sources),
    '--head', *[','.join(map(str, item['head'])) for item in sources],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/battlemage/import-preview.png',
], cwd=root, check=True)

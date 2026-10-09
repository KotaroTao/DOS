"""測定した設定から灯守の原画を再取り込みする。"""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[3]
settings = json.loads((Path(__file__).parent / 'import-settings.json').read_text())
sources = settings['sources']
subprocess.run([
    'python3', 'tools/jobimg.py', 'sera',
    *[s['source'] for s in sources],
    '--per-dot', ','.join(str(s['perDot']) for s in sources),
    '--head', *[','.join(map(str, s['head'])) for s in sources],
    '--frame', ','.join(map(str, settings['frame'])),
    '--frame-top', str(settings['frameTop']),
    '--preview', 'docs/art/sera/import-preview.png',
], cwd=root, check=True)

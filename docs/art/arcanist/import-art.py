"""測定済み原画を既存ツールで再取り込みする。"""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[3]
s = json.loads((root / 'docs/art/arcanist/import-settings.json').read_text())
subprocess.run([
    'python3', 'tools/jobimg.py', 'arcanist',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', ','.join(map(str, s['frame'])), '--frame-top', str(s['frameTop']),
    '--preview', 'docs/art/arcanist/import-preview.png',
], cwd=root, check=True)

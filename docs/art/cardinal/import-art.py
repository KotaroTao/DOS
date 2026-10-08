"""保存した原画の測定値で、既存の取り込みツールを実行する。"""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[3]
settings = json.loads((Path(__file__).parent / 'import-settings.json').read_text())
subprocess.run([
    'python3', 'tools/jobimg.py', 'cardinal',
    *[s['source'] for s in settings['sources']],
    '--per-dot', ','.join(str(s['perDot']) for s in settings['sources']),
    '--head', *[','.join(map(str, s['head'])) for s in settings['sources']],
    '--frame', ','.join(map(str, settings['frame'])),
    '--frame-top', str(settings['frameTop']),
    '--preview', 'docs/art/cardinal/import-preview.png',
], cwd=root, check=True)

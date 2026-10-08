"""測定済みの騎士原画を既存ツールで取り込む。"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
folder = Path(__file__).parent
settings = json.loads((folder / 'import-settings.json').read_text())
subprocess.run([
    sys.executable, str(root / 'tools/jobimg.py'), 'knight',
    *[item['source'] for item in settings['sources']],
    '--per-dot', ','.join(str(item['perDot']) for item in settings['sources']),
    '--head', *[','.join(map(str, item['head'])) for item in settings['sources']],
    '--frame', ','.join(map(str, settings['frame'])),
    '--frame-top', str(settings['frameTop']),
    '--preview', str(folder / 'import-preview.png'),
], cwd=root, check=True)

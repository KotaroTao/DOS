"""保存した測定値で、既存の職業画像取り込みツールを実行する。"""
import json
import subprocess
from pathlib import Path

out = Path(__file__).parent
root = out.parents[2]
settings = json.loads((out / 'import-settings.json').read_text())
subprocess.run([
    'python3', 'tools/jobimg.py', 'archbishop',
    *[entry['source'] for entry in settings['sources']],
    '--per-dot', ','.join(str(entry['perDot']) for entry in settings['sources']),
    '--head', *[','.join(map(str, entry['head'])) for entry in settings['sources']],
    '--frame', ','.join(map(str, settings['frame'])),
    '--frame-top', str(settings['frameTop']),
    '--preview', 'docs/art/archbishop/import-preview.png',
], cwd=root, check=True)

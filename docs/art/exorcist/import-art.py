"""測定値から既存の職業画像取り込みを再実行する。"""
from pathlib import Path
import json
import importlib.util
import os

ROOT = Path(__file__).resolve().parents[3]
settings = json.loads((ROOT / 'docs/art/exorcist/import-settings.json').read_text())
spec = importlib.util.spec_from_file_location('jobimg', ROOT / 'tools/jobimg.py')
jobimg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jobimg)
write_manifest = jobimg.write_manifest


def write_aligned_manifest(job, entries):
    # 胸像は実測のheadを使い、全身の顔アンカーは確認済みR1の位置に固定する。
    for entry in entries.values():
        entry['face'] = settings['faceAnchor'][:]
    write_manifest(job, entries)


jobimg.write_manifest = write_aligned_manifest
os.chdir(ROOT)
jobimg.build('exorcist', [s['source'] for s in settings['sources']],
             [s['perDot'] for s in settings['sources']],
             [s['head'] for s in settings['sources']],
             'docs/art/exorcist/import-preview.png',
             tuple(settings['frame']), settings['frameTop'])

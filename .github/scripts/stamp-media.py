"""公開する画像だけを内容で版付けする。変更のない絵はコード更新後も再利用する。"""
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
worker = root / 'sw.js'
source = worker.read_text()
assets = source.split('const ASSETS = [', 1)[1].split('\n];', 1)[0]
revisions = {}
for name in re.findall(r'"(\./[^"\n]+)"', assets):
    if re.search(r'\.(png|webp|jpe?g|gif)$', name, re.I):
        revisions[name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
source, count = re.subn(r'^const MEDIA_REVISIONS = .*?;$',
                       'const MEDIA_REVISIONS = ' + json.dumps(revisions, separators=(',', ':')) + ';',
                       source, count=1, flags=re.M)
if count != 1:
    raise SystemExit('画像の版の挿入箇所が見つかりません')
worker.write_text(source)
print(f'画像{len(revisions)}件を内容のハッシュで版付けしました')

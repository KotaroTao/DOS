"""生成原画を5列×4行で切り出し、奉納品61〜80番をWebPへ変換する。"""
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
items = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    'import {MISC} from "./src/catalog/misc.js";console.log(JSON.stringify(MISC.filter(i=>i.slot==="misc").slice(60,80).map((i,n)=>({number:n+61,id:i.id,name:i.name,desc:i.desc}))))'
], cwd=ROOT))
source = ROOT / 'docs/art/collectibles-61-80/master.png'
im = Image.open(source).convert('RGBA')
assert im.width >= 1000 and im.height >= 800
out = ROOT / 'art/collectibles'
out.mkdir(exist_ok=True)
w = im.width / 5
# 原画の空白帯に切り出し境界を置き、上下の品の混入を防ぐ。
row_edges = [round(y * im.height / 1122) for y in (0, 300, 550, 815, 1122)]
for n, item in enumerate(items):
    x = (n % 5) * w
    y, bottom = row_edges[n // 5:n // 5+2]
    tile = im.crop((round(x), y, round(x+w), bottom))
    # セルの比率を保って正方形へ収める。描画内容は変えない。
    tile.thumbnail((352, 352), Image.Resampling.LANCZOS)
    square = Image.new('RGBA', (384, 384))
    square.alpha_composite(tile, ((384-tile.width)//2, (384-tile.height)//2))
    square.save(out / (item['id']+'.webp'), 'WEBP', quality=92, method=6)
    check = Image.open(out / (item['id']+'.webp'))
    assert check.size == (384, 384) and check.getbbox()
print(f'{len(items)}点をWebPへ変換')

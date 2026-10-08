"""既存の僧侶のドット絵を参照用に書き出す。"""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[3]
original = subprocess.check_output(['git', 'show', '32e5644:src/jobart.js'], cwd=root)
data = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {readFileSync} from 'node:fs'; const {JOB_IMAGES}=await import('data:text/javascript;base64,'+readFileSync(0).toString('base64')); console.log(JSON.stringify(JOB_IMAGES.priest));"
], cwd=root, input=original))
out = Path(__file__).parent
sheet = Image.new('RGB', (2500, 650), '#242228')
draw = ImageDraw.Draw(sheet)
for rank in range(1, 6):
    entry = data[str(rank)]
    rows = entry['art']
    im = Image.new('RGBA', (max(map(len, rows)), len(rows)))
    for y, row in enumerate(rows):
        for x, key in enumerate(row):
            if key in entry['palette']:
                color = entry['palette'][key]
                im.putpixel((x, y), tuple(bytes.fromhex(color[1:])) + (255,))
    im = im.resize((im.width * 6, im.height * 6), Image.Resampling.NEAREST)
    im.save(out / f'existing-r{rank}.png')
    sheet.paste(im, ((rank - 1) * 500, 45), im)
    draw.text(((rank - 1) * 500 + 15, 15), f'PRIEST R{rank}', fill='white')
sheet.save(out / 'existing-ranks.png')

#!/usr/bin/env python3
"""固定背景版の場面表と384×256・原寸への確認用リンクを作る。"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/art/story-refs/palace-story-rebuild'


def main():
    rows=json.loads((OUT/'composition.json').read_text())
    for offset in range(0,len(rows),15):
        group=rows[offset:offset+15]
        sheet=Image.new('RGB',(1152,278*((len(group)+2)//3)),(17,21,28))
        draw=ImageDraw.Draw(sheet)
        for i,row in enumerate(group):
            x=i%3*384;y=i//3*278
            master=Image.open(ROOT/row['master']).convert('RGB')
            assert master.size==(1536,1024)
            draw.text((x+5,y+4),row['id'],fill='white')
            sheet.paste(master.resize((384,256),Image.Resampling.LANCZOS),(x,y+22))
        sheet.save(OUT/'comparisons'/f'contact-{offset//15+1}.jpg',quality=92)
    lines=['# 固定背景版・比較と原寸の確認','','左が修正前、右が再制作。原寸リンクは1536×1024。各一覧の1枠は384×256。','']
    for i in range((len(rows)+14)//15):
        lines.extend([f'![縮小一覧{i+1}](comparisons/contact-{i+1}.jpg)',''])
    lines+=['| 場面 | 原寸 | 修正前後 | 背景 | 切り抜き x,y,w,h | 背景拡縮率 |','|---|---|---|---|---|---|']
    for row in rows:
        scene=row['id'];scale=1536/row['crop'][2]
        lines.append(f'| `{scene}` | [原寸](../../../../{row["master"]}) | [比較](comparisons/{scene}-before-after.jpg) | [固定背景](../../../../{row["background"]}) | `{row["crop"]}` | {scale:.4f} |')
    (OUT/'review.md').write_text('\n'.join(lines)+'\n')
    records=[]
    for path in sorted((OUT/'sources').glob('*.png')):
        im=Image.open(path)
        records.append({'file':str(path.relative_to(OUT)),'size':list(im.size),'mode':im.mode,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    for path in sorted((ROOT/'docs/art/story-refs/palace-3d/finished/variants').glob('*.png')):
        im=Image.open(path)
        records.append({'file':str(path.relative_to(ROOT)),'size':list(im.size),'mode':im.mode,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    (OUT/'sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
    print('比較一覧',len(rows),'場面・素材記録',len(records),'点')


if __name__=='__main__':
    main()

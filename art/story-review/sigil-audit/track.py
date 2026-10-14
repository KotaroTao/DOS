"""確認用の縮小画像と再開可能な進捗を保存する。原画は変更しない。"""
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent

def save(rows):
    for row in rows:
        if 'current_sha256' not in row:
            row['current_sha256'] = hashlib.sha256((ROOT / row['master']).read_bytes()).hexdigest()
    (HERE / 'progress.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
    counts = {}
    for r in rows:
        counts[r['status']] = counts.get(r['status'], 0)+1
    lines = ['# 一門の印：確認・修正の進捗', '', '判断基準：[rules.md](rules.md)。場面ごとの本文：[evidence.json](evidence.json)。', '',
             '更新：'+datetime.now(timezone.utc).isoformat(), '',
             '／'.join(f'{k} {v}枚' for k,v in counts.items()), '',
             '要確認は根拠・視認性が不足するため保留。修正保留は編集候補が基準を満たさず未完了。未確認は目視前であり、修正不要を意味しない。', '',
             '| 順 | 場面 | 状態 | 判定・根拠・修正 |', '|---|---|---|---|']
    for i,r in enumerate(rows,1):
        lines.append(f"| {i} | [{r['id']}](../../../{r['master']}) | {r['status']} | {r['note'].replace('|','／')} |")
    (HERE / 'progress.md').write_text('\n'.join(lines)+'\n')

def initialize():
    if (HERE/'progress.json').exists():
        return
    evidence=json.loads((HERE/'evidence.json').read_text())
    evidence.sort(key=lambda r:(r['chapter'],r['id']))
    rows=[dict(id=r['id'],master=r['master'],status='未確認',note='本文と縮小画像を照合予定。',sha256=hashlib.sha256((ROOT/r['master']).read_bytes()).hexdigest()) for r in evidence]
    save(rows)
    (HERE/'small').mkdir(exist_ok=True)
    for b in range(0,len(rows),4):
        sheet=Image.new('RGB',(768,552),(32,34,40)); draw=ImageDraw.Draw(sheet)
        for j,r in enumerate(rows[b:b+4]):
            im=Image.open(ROOT/r['master']).convert('RGB');im.thumbnail((384,256))
            x=(j%2)*384;y=(j//2)*276
            sheet.paste(im,(x,y+20));draw.text((x+5,y+3),f"{b+j+1}: {r['id']}",fill='white')
        sheet.save(HERE/'small'/f'{b//4+1:02}.jpg',quality=86)

def update(changes):
    rows=json.loads((HERE/'progress.json').read_text())
    for id, status, note in changes:
        r=next(r for r in rows if r['id']==id)
        r.update(status=status,note=note,checked_at=datetime.now(timezone.utc).isoformat())
        r['current_sha256'] = hashlib.sha256((ROOT / r['master']).read_bytes()).hexdigest()
    save(rows)

if __name__=='__main__':
    initialize()

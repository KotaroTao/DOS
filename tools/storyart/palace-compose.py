#!/usr/bin/env python3
"""固定背景に新規前景を重ね、未遮蔽画素と制作記録を検査する。"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/art/story-refs/palace-story-rebuild'
SIZE = (1536, 1024)


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def compose(row):
    background_path = ROOT / row['background']
    original = Image.open(background_path).convert('RGBA')
    x, y, w, h = row['crop']
    assert w * 2 == h * 3, '切り抜きは3:2'
    assert x >= 0 and y >= 0 and x+w <= original.width and y+h <= original.height
    base = original.crop((x, y, x+w, y+h)).resize(SIZE, Image.Resampling.LANCZOS)
    foreground = Image.new('RGBA', SIZE)
    transforms = []
    for part in row['parts']:
        source_path = OUT / part['source']
        source = Image.open(source_path).convert('RGBA')
        if 'mask' in part:
            mask = Image.open(OUT / part['mask']).convert('L')
            source.putalpha(Image.fromarray(np.minimum(np.array(mask), np.array(source.getchannel('A')))))
        if 'polygon' in part:
            mask = Image.new('L', source.size)
            ImageDraw.Draw(mask).polygon([tuple(p) for p in part['polygon']], fill=255)
            alpha = np.minimum(np.array(mask), np.array(source.getchannel('A')))
            source.putalpha(Image.fromarray(alpha))
        bbox = source.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        assert bbox, '前景が空'
        source = source.crop(bbox)
        if 'height' in part:
            scale = part['height'] / source.height
        else:
            scale = part.get('scale', 1)
        source = source.resize((round(source.width*scale), round(source.height*scale)), Image.Resampling.LANCZOS)
        # 画像生成の完全不透明部が253の素材もある。背景への色漏れを防ぐ。
        source.putalpha(source.getchannel('A').point(lambda a: 0 if a < 4 else min(255, round(a*255/253))))
        px, py = part['position']
        foreground.alpha_composite(source, (px, py))
        transforms.append({**part, 'sourceSha256': digest(source_path),
                           **({'maskSha256': digest(OUT/part['mask'])} if 'mask' in part else {}),
                           'sourceBounds': bbox, 'scale': scale})
    # 前景の足元にのみ軟らかな接地影を描き、建築の照明を描き直さない。
    shadow = Image.new('RGBA', SIZE)
    for ellipse in row.get('shadows', []):
        layer = Image.new('RGBA', SIZE)
        ImageDraw.Draw(layer).ellipse(ellipse['box'], fill=(4, 5, 12, ellipse.get('alpha', 100)))
        shadow = Image.alpha_composite(shadow, layer.filter(ImageFilter.GaussianBlur(ellipse.get('blur', 8))))
    occlusion = Image.new('L', SIZE)
    for polygon in row.get('occlusion', []):
        ImageDraw.Draw(occlusion).polygon([tuple(p) for p in polygon], fill=255)
    # 背景の椅子の前面など、人物より手前のものは元画素をそのまま保持する。
    keep = 255 - np.array(occlusion).astype(np.uint16)
    for layer in (foreground, shadow):
        layer.putalpha(Image.fromarray((np.array(layer.getchannel('A')).astype(np.uint16)*keep//255).astype('uint8')))
    master = Image.alpha_composite(Image.alpha_composite(base, shadow), foreground).convert('RGB')
    alpha = np.maximum(np.array(foreground.getchannel('A')), np.array(shadow.getchannel('A')))
    unchanged = alpha == 0
    changed = np.any(np.array(master) != np.array(base.convert('RGB')), axis=2)
    assert not np.any(changed & unchanged), '未遮蔽の背景画素が変わった'
    scene = row['id']
    for folder, im in [('foregrounds', foreground), ('shadows', shadow), ('occlusion', occlusion)]:
        (OUT/folder).mkdir(exist_ok=True)
        im.save(OUT/folder/(scene+'.png'))
    target = ROOT / row['master']
    before = OUT/'before'/(scene+'.png')
    before.parent.mkdir(exist_ok=True)
    if not before.exists():
        before.write_bytes(target.read_bytes())
    master.save(target)
    small = master.resize((384, 256), Image.Resampling.LANCZOS)
    (OUT/'comparisons').mkdir(exist_ok=True)
    small.save(OUT/'comparisons'/(scene+'-small.png'))
    comparison = Image.new('RGB', (1536, 512), (18, 18, 24))
    comparison.paste(Image.open(before).convert('RGB').resize((768, 512), Image.Resampling.LANCZOS), (0, 0))
    comparison.paste(master.resize((768, 512), Image.Resampling.LANCZOS), (768, 0))
    comparison.save(OUT/'comparisons'/(scene+'-before-after.jpg'), quality=92)
    return {'id': scene, 'background': row['background'], 'backgroundSha256': digest(background_path),
            'backgroundSize': list(original.size), 'crop': row['crop'], 'backgroundScale': SIZE[0]/w,
            'mirror': False, 'parts': transforms, 'shadows': row.get('shadows', []),
            'occlusion': row.get('occlusion', []), 'beforeSha256': digest(before), 'masterSha256': digest(target),
            'uncoveredPixels': int(unchanged.sum()), 'changedUncoveredPixels': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ids', nargs='*')
    parser.add_argument('--check', action='store_true', help='保存済みのレイヤー・背景・原画を読み取り専用で照合')
    args = parser.parse_args()
    rows = json.loads((OUT/'composition.json').read_text())
    if args.check:
        for row in rows:
            if args.ids and row['id'] not in args.ids:
                continue
            x,y,w,h = row['crop']
            base = Image.open(ROOT/row['background']).convert('RGBA').crop((x,y,x+w,y+h)).resize(SIZE,Image.Resampling.LANCZOS)
            shadow = Image.open(OUT/'shadows'/(row['id']+'.png')).convert('RGBA')
            foreground = Image.open(OUT/'foregrounds'/(row['id']+'.png')).convert('RGBA')
            expected = Image.alpha_composite(Image.alpha_composite(base,shadow),foreground).convert('RGB')
            actual = Image.open(ROOT/row['master']).convert('RGB')
            assert np.array_equal(np.array(expected),np.array(actual)), row['id']+': 合成結果が異なる'
            uncovered = (np.array(shadow.getchannel('A')) == 0) & (np.array(foreground.getchannel('A')) == 0)
            assert not np.any(np.any(np.array(actual) != np.array(base.convert('RGB')),axis=2) & uncovered)
            assert (OUT/'before'/(row['id']+'.png')).exists()
            print(row['id'], '合成一致・未遮蔽画素の変更0')
        return
    prior = json.loads((OUT/'verification.json').read_text()) if (OUT/'verification.json').exists() else []
    evidence = {r['id']: r for r in prior}
    for row in rows:
        if args.ids and row['id'] not in args.ids:
            continue
        evidence[row['id']] = compose(row)
        print(row['id'], '背景の未遮蔽画素の変更 0')
    (OUT/'verification.json').write_text(json.dumps(list(evidence.values()), ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    main()

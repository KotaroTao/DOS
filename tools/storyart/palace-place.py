#!/usr/bin/env python3
"""新規制作の前景シートを分離し、固定背景上の座面・床の位置へ配置する。"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/art/story-refs/palace-story-rebuild'
WIDE = {7,9,11,14,18,19,24,28,30,34,36,39,42,46,49,50,52}
EARLY = {3,4,5,6,7,8,13}
EVENING = {37,40,45,48}


def extract(scene, count):
    im = Image.open(OUT/'sources'/(scene+'.png')).convert('RGBA')
    a = np.array(im.getchannel('A'))
    labels, _ = ndimage.label(a > 128)
    sizes = np.bincount(labels.ravel())
    major = [i for i in range(1, len(sizes)) if sizes[i] > 18000]
    assert len(major) == count, f'{scene}: 人物の分離が要調整 {len(major)}/{count}'
    major.sort(key=lambda i: np.where(labels == i)[1].mean())
    # 各人物の主領域からの距離で毛先なども含める。人物が接触する素材には使わない。
    seed = np.zeros(a.shape, 'uint8')
    for i, label in enumerate(major):
        seed[labels == label] = i+1
    indices = ndimage.distance_transform_edt(seed == 0, return_distances=False, return_indices=True)
    owner = seed[tuple(indices)]
    paths = []
    for i in range(count):
        part = im.copy()
        part.putalpha(Image.fromarray(np.where(owner == i+1, a, 0).astype('uint8')))
        path = OUT/'parts'/f'{scene}-{i}-mask.png'
        path.parent.mkdir(exist_ok=True)
        Image.fromarray(np.where(owner == i+1, 255, 0).astype('uint8')).save(path)
        bounds = part.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        paths.append((str(path.relative_to(OUT)), bounds))
    return paths


def place(scene, master):
    n = int(scene.split('w')[1]) if scene.startswith('report_w') else 0
    view = ('right' if n%3 == 0 else 'left' if n%3 == 1 else 'high') if n in WIDE else 'audience'
    if scene == 'arrival':
        view = 'front'
    count = 3 if n in EARLY or n in (52,53) else 2
    parts = extract(scene, count)
    background = 'docs/art/story-refs/palace-3d/finished/'+view+'.png'
    if n >= 33:
        background = 'docs/art/story-refs/palace-3d/finished/variants/'+view+('-evening' if n in EVENING else '-day')+'.png'
    crop = [0,0,1536,1024] if view == 'audience' else [200,200,1200,800]
    if view == 'audience':
        locations = [(210,1035,930),(700,985,710),(1120,980,620)]
        if n in (32,33,43):
            locations = [(240,1040,880),(1155,1000,840)]
        if n in (5,13):
            locations[2] = (1280,1020,850)
        if n == 53:
            locations[2] = (1320,1010,540)
    elif view == 'left':
        locations = [(270,970,630),(646,614,325),(860,617,310)]
        if n == 52:
            locations[2] = (1150,900,430)
    elif view == 'right':
        locations = [(350,970,650),(794,627,345),(1040,645,330)]
    elif view == 'high':
        locations = [(400,850,450),(627,410,280),(780,407,260)]
    else:
        locations = [(440,970,620),(730,610,350)]
    transforms = []
    shadows = []
    for (mask,bounds),(center,bottom,height) in zip(parts,locations):
        width = round((bounds[2]-bounds[0])*height/(bounds[3]-bounds[1]))
        transforms.append({'source':'sources/'+scene+'.png','mask':mask,'height':height,'position':[round(center-width/2),bottom-height]})
        if bottom < 1020:
            shadows.append({'box':[round(center-width*.35),bottom-10,round(center+width*.35),bottom+10], 'alpha':100,'blur':7})
    return {'id':scene,'background':background,'crop':crop,'master':master,'parts':transforms,'shadows':shadows,'occlusion':[]}


if __name__ == '__main__':
    manifest = OUT/'composition.json'
    rows = json.loads(manifest.read_text())
    for spec in sys.argv[1:]:
        scene, master = spec.split(':',1)
        row = place(scene, master)
        rows = [r for r in rows if r['id'] != scene]+[row]
        print(scene, row['background'])
    manifest.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')

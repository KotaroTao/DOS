"""A-28の再現結果、2か所の領域外RGB、全153枚のハッシュを検査する。"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
from make_candidate import SOURCE, REFERENCE, EXPECTED, EXPECTED_REFERENCE, ZONES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    master=ROOT/'art/story-review/chapter7/irene_crest.png'
    shipped=ROOT/'art/story/chapter7/irene_crest.webp'
    candidate=HERE/'candidate.png'
    before=np.asarray(Image.open(SOURCE).convert('RGB'))
    after=np.asarray(Image.open(master).convert('RGB'))
    assert sha(SOURCE)==EXPECTED and sha(REFERENCE)==EXPECTED_REFERENCE
    assert before.shape==after.shape==(1024,1536,3)
    assert sha(master)==sha(candidate)
    allowed=np.asarray(Image.open(HERE/'allowed-region.png'))>0
    difference=np.any(before!=after,axis=2)
    assert not difference[~allowed].any()
    assert int(difference.sum())==1261
    zones={}
    webp=Image.open(shipped).convert('RGB');assert webp.size==(1536,1024)
    for name,z in ZONES.items():
        ax,ay,bx,by=z['allowed'];diff=difference[ay:by,ax:bx];ys,xs=np.where(diff)
        zones[name]={
            'allowed_xyxy_exclusive':z['allowed'],
            'changed_bbox_xyxy_exclusive':[int(xs.min())+ax,int(ys.min())+ay,int(xs.max())+ax+1,int(ys.max())+ay+1],
            'changed_pixels':int(diff.sum()), 'angle_degrees':z['angle'],
        }
        comp=Image.new('RGB',(1040,520))
        for i,(label,im) in enumerate([('master',Image.open(master)),('webp',webp)]):
            detail=im.crop(z['detail']).resize((520,520),Image.Resampling.NEAREST)
            detail.save(HERE/f'{name}-{label}-detail-8x.png');comp.paste(detail,(i*520,0))
        comp.save(HERE/f'comparison-{name}-master-webp-8x.png')
    rows=json.loads((ROOT/'art/story-review/sigil-audit/progress.json').read_text())
    mismatches=[r['id'] for r in rows if sha(ROOT/r['master'])!=r['current_sha256']]
    assert len(rows)==153 and not mismatches,mismatches
    result={
        'id':'irene_crest','size':[1536,1024],
        'before_sha256':sha(SOURCE),'canonical_sha256':sha(REFERENCE),
        'candidate_sha256':sha(candidate),'master_sha256':sha(master),'webp_sha256':sha(shipped),
        'changed_rgb_pixels':int(difference.sum()),'zones':zones,
        'outside_regions_rgb_identical':True,'outside_regions_pixels':int((~allowed).sum()),
        'all_153_current_hashes_match':True,
        'visual_review':'額と肘の既存位置で正本の角張った掌、左親指1本、右指3本、短い手首、独立した炎1つを確認。顔・髪・肘の位置・手指・関節・胸の灯を保持。WebPの目視比較はREADMEに記録。',
        'previous_pr':{'number':988,'merge_commit':'1dbb8a60da3a924fb40153dba1f99b13f2ff7465','pages_verified':True},
        'pending':'今回の1枚はユーザー確認・mainへのマージ待ち。要確認9枚とch5_endの盾・irene_restの蓋の金の図形は従来の理由で保留。',
    }
    (HERE/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()

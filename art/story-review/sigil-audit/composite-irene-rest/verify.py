"""局所合成・採用原画・出荷物・全153枚の現在ハッシュを検査する。"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
from make_candidate import SOURCE, REFERENCE, EXPECTED, EXPECTED_REFERENCE

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    master = ROOT / 'art/story-review/chapter9/irene_rest.png'
    shipped = ROOT / 'art/story/chapter9/irene_rest.webp'
    candidate = HERE / 'candidate.png'
    before = np.asarray(Image.open(SOURCE).convert('RGB'))
    after = np.asarray(Image.open(master).convert('RGB'))
    assert sha(SOURCE) == EXPECTED and sha(REFERENCE) == EXPECTED_REFERENCE
    assert before.shape == after.shape == (1024, 1536, 3)
    assert sha(master) == sha(candidate), '採用原画と再現候補が異なります'
    allowed = np.asarray(Image.open(HERE / 'allowed-region.png')) > 0
    changed = np.any(before != after, axis=2)
    assert not changed[~allowed].any()
    assert int(changed.sum()) == 352
    assert np.array_equal(before[326:], after[326:]), "脚・胸・蓋など額より下の画素が変わっています"
    ys, xs = np.where(changed)
    rows = json.loads((ROOT / 'art/story-review/sigil-audit/progress.json').read_text())
    mismatches = [r['id'] for r in rows if sha(ROOT / r['master']) != r['current_sha256']]
    assert len(rows) == 153 and not mismatches, mismatches
    webp = Image.open(shipped).convert('RGB')
    assert webp.size == (1536, 1024)
    for name, im in [('master', Image.open(master)), ('webp', webp)]:
        im.crop((425, 285, 480, 340)).resize((440, 440), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-8x.png')
    comp = Image.new('RGB', (880, 440))
    comp.paste(Image.open(HERE / 'master-detail-8x.png'), (0, 0))
    comp.paste(Image.open(HERE / 'webp-detail-8x.png'), (440, 0))
    comp.save(HERE / 'comparison-master-webp-8x.png')
    small = Image.new('RGB', (768, 256))
    small.paste(Image.open(HERE / 'before-small.jpg'), (0, 0))
    small.paste(Image.open(HERE / 'candidate-small.jpg'), (384, 0))
    small.save(HERE / 'comparison-small.jpg', quality=92)
    result = {
        'id': 'irene_rest', 'size': [1536, 1024],
        'before_sha256': sha(SOURCE), 'canonical_sha256': sha(REFERENCE),
        'master_sha256': sha(master), 'candidate_sha256': sha(candidate),
        'webp_sha256': sha(shipped), 'changed_rgb_pixels': int(changed.sum()),
        'allowed_region_xyxy_exclusive': [441, 296, 467, 326],
        'changed_bbox_xyxy_exclusive': [int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1],
        'outside_region_rgb_identical': True,
        'outside_region_pixels': int((~allowed).sum()),
        'all_153_current_hashes_match': True,
        'below_y326_rgb_identical_including_legs_chest_lid': True,
        'initial_main_updated_ids_rechecked': [], 'previous_pr': 995, 'previous_merge_commit': 'ad43ced918e9b26566d9c0cfbe56b995d6a05537',
        'visual_review': '正本の角張った掌・左親指1本・右指3本・短い手首・独立した炎1つ。額中央の小さい金の印。旧印を除去、顔・目・髪・手・胸の灯を保持。WebPも原画と拡大比較し、右指3本と独立した炎を保持していることを目視確認。',
        'pending': 'ユーザー確認・mainへのマージ待ち。要確認9枚とch5_endの盾・irene_restの蓋の金の図形は従来の根拠不足の理由で保留。'
    }
    (HERE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

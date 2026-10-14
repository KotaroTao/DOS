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
    master = ROOT / 'art/story-review/dungeons/lore_w07.png'
    shipped = ROOT / 'art/story/dungeons/lore_w07.webp'
    candidate = HERE / 'candidate.png'
    before = np.asarray(Image.open(SOURCE).convert('RGB'))
    after = np.asarray(Image.open(master).convert('RGB'))
    assert sha(SOURCE) == EXPECTED and sha(REFERENCE) == EXPECTED_REFERENCE
    assert before.shape == after.shape == (1024, 1536, 3)
    assert sha(master) == sha(candidate), '採用原画と再現候補が異なります'
    allowed = np.asarray(Image.open(HERE / 'allowed-region.png')) > 0
    changed = np.any(before != after, axis=2)
    assert not changed[~allowed].any()
    assert int(changed.sum()) == 800
    assert np.array_equal(before[225:360, 600:710], after[225:360, 600:710]), "壁の印が変わっています"
    Image.open(master).crop((600,225,710,360)).resize((330,405), Image.Resampling.NEAREST).save(HERE / "wall-preserved-detail-3x.png")
    ys, xs = np.where(changed)
    rows = json.loads((ROOT / 'art/story-review/sigil-audit/progress.json').read_text())
    mismatches = [r['id'] for r in rows if sha(ROOT / r['master']) != r['current_sha256']]
    assert len(rows) == 153 and not mismatches, mismatches
    webp = Image.open(shipped).convert('RGB')
    assert webp.size == (1536, 1024)
    for name, im in [('master', Image.open(master)), ('webp', webp)]:
        im.crop((640, 510, 705, 575)).resize((520, 520), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-8x.png')
    comp = Image.new('RGB', (1040, 520))
    comp.paste(Image.open(HERE / 'master-detail-8x.png'), (0, 0))
    comp.paste(Image.open(HERE / 'webp-detail-8x.png'), (520, 0))
    comp.save(HERE / 'comparison-master-webp-8x.png')
    small = Image.new('RGB', (768, 256))
    small.paste(Image.open(HERE / 'before-small.jpg'), (0, 0))
    small.paste(Image.open(HERE / 'candidate-small.jpg'), (384, 0))
    small.save(HERE / 'comparison-small.jpg', quality=92)
    result = {
        'id': 'lore_w07', 'size': [1536, 1024],
        'before_sha256': sha(SOURCE), 'canonical_sha256': sha(REFERENCE),
        'master_sha256': sha(master), 'candidate_sha256': sha(candidate),
        'webp_sha256': sha(shipped), 'changed_rgb_pixels': int(changed.sum()),
        'allowed_region_xyxy_exclusive': [652, 519, 691, 564],
        'changed_bbox_xyxy_exclusive': [int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1],
        'outside_region_rgb_identical': True,
        'outside_region_pixels': int((~allowed).sum()),
        'all_153_current_hashes_match': True,
        'wall_crest_rgb_identical': True,
        'wall_checked_box_xyxy_exclusive': [600,225,710,360],
        'initial_main_updated_ids_rechecked': [], 'previous_pr': 997, 'previous_merge_commit': '3d25f624ecf6b8f08758b9bfdfc2e1cfae7b1247', 'previous_publication': {'original_run_cancelled_by_successor': 38623810050, 'successful_successor_run': 38623938046, 'published_commit_prefix': '507e3f00dbd9', 'comparison_from_previous_merge': 'ahead'},
        'visual_review': '正本の角張った掌・左親指1本・右指3本・短い手首・独立した炎1つ。額中央の小さい金の印。旧印を除去、顔・目・髪・布・壁・牢の構図と光を保持。WebPも原画と拡大比較し、右指3本と独立した炎を保持していることを目視確認。',
        'pending': 'ユーザー確認・mainへのマージ待ち。要確認9枚とch5_endの盾・irene_restの蓋の金の図形は従来の根拠不足の理由で保留。'
    }
    (HERE / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

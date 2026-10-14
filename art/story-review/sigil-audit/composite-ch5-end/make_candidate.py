"""ch5_endの額だけを局所合成する。現在原画には書き込まない。"""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageChops
from scipy.ndimage import gaussian_filter
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
# 再実行も今回保存した修正前だけを入力する。現在原画には書き込まない。
SOURCE = ROOT / 'art/story-review/fixes/ch5_end-sigil-back-python-before.png'
REFERENCE = ROOT / 'docs/art/story-refs/sigil.png'
EXPECTED = 'ec3777ae67fa8a1164096a6d60aad70bc9a6f9d467e9ab395ab888f179a1daf0'
EXPECTED_REFERENCE = '7dfeb2dbb8eb7091557e1dd3f387b963b64b2fa4a20848c1c18734167fe47b6b'


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED, '修正前の更新を再確認してください'
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_REFERENCE, '正本の更新を再確認してください'
    original = Image.open(SOURCE).convert('RGB')
    pixels = np.asarray(original).copy()
    mask_image = Image.new('L', original.size)
    ImageDraw.Draw(mask_image).polygon(
        [(803, 501), (807, 503), (809, 506), (811, 511), (811, 515),
         (809, 521), (805, 524), (800, 521), (800, 515), (801, 510)], fill=255)
    mask = (np.asarray(mask_image) > 0) & (pixels[:, :, 0] > 110) & (pixels[:, :, 1] > 50)
    mask_image = Image.fromarray(mask.astype(np.uint8) * 255)
    ys, xs = np.where(mask)
    index = np.full(mask.shape, -1, dtype=int)
    index[ys, xs] = np.arange(len(xs))
    matrix = lil_matrix((len(xs), len(xs)), dtype=float)
    rhs = np.zeros((len(xs), 3))
    for i, (y, x) in enumerate(zip(ys, xs)):
        matrix[i, i] = 4
        for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            yy, xx = y + dy, x + dx
            j = index[yy, xx]
            if j >= 0:
                matrix[i, j] = -1
            else:
                rhs[i] += pixels[yy, xx]
    restored = spsolve(matrix.tocsr(), rhs)
    pixels[ys, xs] = np.clip(np.rint(restored), 0, 255).astype(np.uint8)
    cleaned = Image.fromarray(pixels)

    reference = np.asarray(Image.open(REFERENCE).convert('RGB'))
    r, g, b = [reference[:, :, i].astype(float) for i in range(3)]
    alpha = (r > 40) & (r - b > 10) & (g - b > 8)
    ry, rx = np.where(alpha)
    box = (int(rx.min()), int(ry.min()), int(rx.max()) + 1, int(ry.max()) + 1)
    rgba = np.dstack((reference, alpha.astype(np.uint8) * 255))
    crest = Image.fromarray(rgba).crop(box)
    color = np.asarray(crest).copy()
    tone = np.clip((color[:, :, 0].astype(float) - 130) / 120, 0, 1)
    color[:, :, 0] = 210 + 40 * tone
    color[:, :, 1] = 134 + 50 * tone
    color[:, :, 2] = 43 + 35 * tone
    # 横顔の額の面に合わせる。4倍解像度で変換して指間の隙間を保つ。
    crest = Image.fromarray(color).resize((52, 76), Image.Resampling.LANCZOS)
    crest = crest.rotate(-8, Image.Resampling.BICUBIC, expand=True)
    crest = crest.resize((crest.width // 4, crest.height // 4), Image.Resampling.LANCZOS)
    candidate = cleaned.copy()
    # ごく薄い補間の外縁を除いて、髪際へのにじみを避ける。
    crest.putalpha(crest.getchannel('A').point(lambda value: value if value >= 8 else 0))
    candidate.paste(crest, (801, 505), crest)
    # ユーザー追記：背中の魂火とその金枠・取り付け部分を除去。
    back_mask_image = Image.new('L', original.size)
    draw = ImageDraw.Draw(back_mask_image)
    draw.polygon([(874, 594), (880, 600), (886, 609), (894, 619),
                  (894, 630), (889, 637), (883, 644), (875, 643),
                  (868, 637), (862, 624), (862, 613), (868, 603)], fill=255)
    draw.polygon([(873, 587), (877, 587), (880, 600), (873, 601)], fill=255)
    back_mask = np.asarray(back_mask_image) > 0
    bys, bxs = np.where(back_mask)
    current = np.asarray(candidate).copy()
    source_pixels = np.asarray(original)
    # 木肌・髪・白布の境界を周囲へつなぎ、それぞれ近傍の同じ面を参照。
    guide = source_pixels.astype(float).copy()
    smooth_source = gaussian_filter(source_pixels.astype(float), sigma=(1.2, 1.2, 0))
    for y in range(585, 647):
        for x in range(859, 898):
            if y >= 633 + (x - 860) * 0.12:
                xx, yy = x - 21, y + 7
            elif x > 876 + (y - 600) * 0.30:
                xx, yy = x + 23, y
            else:
                xx, yy = 860, min(629, max(608, y - 3))
                grain = source_pixels[yy, xx].astype(float) - smooth_source[yy, xx]
                guide[y, x] = (np.array([164, 109, 66])
                               + (y - 615) * np.array([-0.25, -0.18, -0.10])
                               + (x - 871) * np.array([-0.35, -0.30, -0.18]) + grain * 0.25)
                continue
            guide[y, x] = source_pixels[yy, xx]
    bindex = np.full(back_mask.shape, -1, dtype=int)
    bindex[bys, bxs] = np.arange(len(bxs))
    bm = lil_matrix((len(bxs), len(bxs)), dtype=float)
    brhs = np.zeros((len(bxs), 3))
    for i, (y, x) in enumerate(zip(bys, bxs)):
        bm[i, i] = 4
        for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            yy, xx = y + dy, x + dx
            brhs[i] += guide[y, x] - guide[yy, xx]
            j = bindex[yy, xx]
            if j >= 0:
                bm[i, j] = -1
            else:
                brhs[i] += current[yy, xx]
    current[bys, bxs] = np.clip(np.rint(spsolve(bm.tocsr(), brhs)), 0, 255).astype(np.uint8)
    candidate = Image.fromarray(current)
    back_mask_image.crop((830, 558, 930, 680)).save(HERE / 'back-removal-mask.png')
    for name, image in [('before', original), ('candidate', candidate)]:
        detail = image.crop((830, 558, 930, 680))
        detail.save(HERE / f'{name}-back-detail.png')
        detail.resize((500, 610), Image.Resampling.NEAREST).save(HERE / f'{name}-back-detail-5x.png')
    comparison_back = Image.new('RGB', (1000, 610))
    comparison_back.paste(Image.open(HERE / 'before-back-detail-5x.png'), (0, 0))
    comparison_back.paste(Image.open(HERE / 'candidate-back-detail-5x.png'), (500, 0))
    comparison_back.save(HERE / 'comparison-back-detail-5x.png')
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)
    allowed = np.zeros(difference.shape, dtype=bool)
    allowed[502:526, 801:816] = True
    allowed[587:645, 862:895] = True
    assert not (difference & ~allowed).any(), '指定した2領域外に変更があります'
    assert not difference[680:910, 860:1010].any(), '盾に変更があります'
    assert not difference[:470].any(), '旗に変更があります'
    candidate.save(HERE / 'candidate.png')
    crest.save(HERE / 'placed-crest.png')
    plain = Image.new('RGB', crest.size, 'white')
    plain.paste((0, 0, 0), (0, 0, crest.width, crest.height), crest.getchannel('A'))
    plain.resize((plain.width * 12, plain.height * 12), Image.Resampling.NEAREST).save(HERE / 'placed-shape-12x.png')
    Image.fromarray(rgba).crop(box).save(HERE / 'reference-extracted.png')
    cleaned.crop((786, 485, 837, 545)).save(HERE / 'cleaned-detail.png')
    mask_image.crop((786, 485, 837, 545)).save(HERE / 'removal-mask.png')
    for name, image in [('before', original), ('candidate', candidate)]:
        image.resize((384, 256), Image.Resampling.LANCZOS).save(HERE / f'{name}-small.jpg', quality=90)
        detail = image.crop((786, 485, 837, 545))
        detail.save(HERE / f'{name}-detail.png')
        detail.resize((612, 720), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-12x.png')
    comparison = Image.new('RGB', (1224, 720))
    comparison.paste(Image.open(HERE / 'before-detail-12x.png'), (0, 0))
    comparison.paste(Image.open(HERE / 'candidate-detail-12x.png'), (612, 0))
    comparison.save(HERE / 'comparison-detail-12x.png')
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)
    print('正本切り出し:', box)
    print('変更画素:', int(difference.sum()))
    print('変更範囲:', ImageChops.difference(original, candidate).getbbox())


if __name__ == '__main__':
    main()

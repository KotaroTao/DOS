"""許可された irene_torso 1枚だけの局所合成。原画は上書きしない。"""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
# 再実行も今回保存した修正前だけを入力する。現在原画へは書き込まない。
SOURCE = ROOT / 'art/story-review/fixes/irene_torso-sigil-python-before.png'
REFERENCE = ROOT / 'docs/art/story-refs/sigil.png'
EXPECTED = '27bd1735b06870385cfdda81c90122d54b25a99fc588d12848719eec7165d0eb'
EXPECTED_REFERENCE = '7dfeb2dbb8eb7091557e1dd3f387b963b64b2fa4a20848c1c18734167fe47b6b'


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED, '修正前の更新を再確認してください'
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_REFERENCE, '正本の更新を再確認してください'
    original = Image.open(SOURCE).convert('RGB')
    pixels = np.asarray(original).copy()

    # 旧印の輪郭とごく近くの陰だけ。顔や髪には触れない。
    mask_image = Image.new('L', original.size)
    ImageDraw.Draw(mask_image).polygon(
        [(331, 719), (334, 717), (342, 720), (349, 720),
         (356, 728), (355, 745), (350, 748), (332, 742), (330, 732)], fill=255)
    mask = np.asarray(mask_image) > 0
    ys, xs = np.where(mask)
    index = np.full(mask.shape, -1, dtype=int)
    index[ys, xs] = np.arange(len(xs))
    matrix = lil_matrix((len(xs), len(xs)), dtype=float)
    rhs = np.zeros((len(xs), 3), dtype=float)
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
    # 同じ額の近傍の細かな木肌を、明るさの変化を除いて補う。
    from scipy.ndimage import gaussian_filter
    donor = np.asarray(original, dtype=float)[ys + 2, xs + 29]
    smooth = gaussian_filter(np.asarray(original, dtype=float), sigma=(1.2, 1.2, 0))
    texture = donor - smooth[ys + 2, xs + 29]
    pixels[ys, xs] = np.clip(np.rint(restored + texture * 0.45), 0, 255).astype(np.uint8)
    cleaned = Image.fromarray(pixels)

    # 正本の金色と暗い背景から形を抽出する。輪郭は描き直さない。
    reference = np.asarray(Image.open(REFERENCE).convert('RGB'))
    r, g, b = [reference[:, :, i].astype(float) for i in range(3)]
    alpha = (r > 40) & (r - b > 10) & (g - b > 8)
    ry, rx = np.where(alpha)
    box = (int(rx.min()), int(ry.min()), int(rx.max()) + 1, int(ry.max()) + 1)
    rgba = np.dstack((reference, alpha.astype(np.uint8) * 255))
    crest = Image.fromarray(rgba).crop(box)
    # 周囲の金に合わせた色調。形と正本の細かな金の質感は維持する。
    color = np.asarray(crest).copy()
    tone = np.clip((color[:, :, 0].astype(float) - 130) / 120, 0, 1)
    color[:, :, 0] = 220 + 35 * tone
    color[:, :, 1] = 147 + 50 * tone
    color[:, :, 2] = 43 + 52 * tone
    crest = Image.fromarray(color).resize((22, 31), Image.Resampling.LANCZOS)
    crest = crest.rotate(18, Image.Resampling.BICUBIC, expand=True)
    candidate = cleaned.copy()
    # 金の小さな浮き彫りの陰。正本の輪郭に沿うだけで別の突起を作らない。
    shadow = Image.new('RGBA', crest.size, (92, 48, 26, 0))
    shadow.putalpha(crest.getchannel('A').point(lambda value: round(value * 0.30)))
    candidate.paste(shadow, (329, 715), shadow)
    candidate.paste(crest, (328, 714), crest)
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)
    assert not difference[:717].any() and not difference[749:].any()
    assert not difference[:, :330].any() and not difference[:, 357:].any()
    print('変更画素:', int(difference.sum()))
    candidate.save(HERE / 'candidate.png')
    cleaned.crop((310, 695, 390, 765)).save(HERE / 'cleaned-detail.png')
    mask_image.crop((310, 695, 390, 765)).save(HERE / 'removal-mask.png')
    Image.fromarray(rgba).crop(box).save(HERE / 'reference-extracted.png')
    for name, image in [('before', original), ('candidate', candidate)]:
        image.resize((384, 256), Image.Resampling.LANCZOS).save(HERE / f'{name}-small.jpg', quality=90)
        detail = image.crop((310, 695, 390, 765))
        detail.save(HERE / f'{name}-detail.png')
        detail.resize((640, 560), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-8x.png')
    from PIL import ImageChops
    print('正本切り出し:', box)
    print('変更範囲:', ImageChops.difference(original, candidate).getbbox())


if __name__ == '__main__':
    main()

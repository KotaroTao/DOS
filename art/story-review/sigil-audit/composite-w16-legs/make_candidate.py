"""w16_legsの局所合成候補を保存する。現在原画には書き込まない。"""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageChops
from scipy.ndimage import gaussian_filter
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
# 再実行は今回保存した修正前だけを入力する。現在原画には触れない。
SOURCE = ROOT / 'art/story-review/fixes/w16_legs-sigil-python-before.png'
REFERENCE = ROOT / 'docs/art/story-refs/sigil.png'
EXPECTED = 'd7f9144b5d66577517c79e26f5202c806bbee6099821694e0edc53ff67659f6d'
EXPECTED_REFERENCE = '7dfeb2dbb8eb7091557e1dd3f387b963b64b2fa4a20848c1c18734167fe47b6b'


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED, '修正前の更新を再確認してください'
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_REFERENCE, '正本の更新を再確認してください'
    original = Image.open(SOURCE).convert('RGB')
    pixels = np.asarray(original).copy()
    mask_image = Image.new('L', original.size)
    ImageDraw.Draw(mask_image).polygon(
        [(846, 769), (855, 772), (857, 780), (865, 778),
         (868, 784), (866, 795), (859, 803), (859, 810),
         (851, 811), (847, 804), (837, 797), (837, 786), (842, 780)], fill=255)
    mask = np.asarray(mask_image) > 0
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
    smooth = gaussian_filter(np.asarray(original, dtype=float), sigma=(1.2, 1.2, 0))
    # 同じ足の甲の、旧印から離れた木肌を補修に使う。
    donor = np.asarray(original, dtype=float)[ys - 11, xs + 20]
    texture = donor - smooth[ys - 11, xs + 20]
    pixels[ys, xs] = np.clip(np.rint(restored + texture * 0.45), 0, 255).astype(np.uint8)
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
    # 木に彫った小さな暗い印。輪郭は正本をそのまま使う。
    color[:, :, 0] = 18 + 10 * tone
    color[:, :, 1] = 9 + 7 * tone
    color[:, :, 2] = 4 + 5 * tone
    # 拡大した作業解像度で回転してから縮め、右指間の隙間を保つ。
    crest = Image.fromarray(color).resize((72, 100), Image.Resampling.LANCZOS)
    crest = crest.rotate(25, Image.Resampling.BICUBIC, expand=True)
    crest = crest.resize((crest.width // 4, crest.height // 4), Image.Resampling.LANCZOS)
    crest.save(HERE / 'placed-crest.png')
    plain = Image.new('RGB', crest.size, 'white')
    plain.paste((0, 0, 0), (0, 0, crest.width, crest.height), crest.getchannel('A'))
    plain.resize((plain.width * 12, plain.height * 12), Image.Resampling.NEAREST).save(HERE / 'placed-shape-12x.png')
    candidate = cleaned.copy()
    # 平らな足の甲ではなく、関節横に露出している側面の木に配置する。
    candidate.paste(crest, (807, 788), crest)
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)
    allowed = np.zeros(difference.shape, dtype=bool)
    allowed[769:812, 837:869] = True
    allowed[792:816, 812:831] = True
    assert not (difference & ~allowed).any(), '指定した2領域外に変更があります'
    candidate.save(HERE / 'candidate.png')
    cleaned.crop((800, 750, 885, 825)).save(HERE / 'cleaned-detail.png')
    mask_image.crop((800, 750, 885, 825)).save(HERE / 'removal-mask.png')
    Image.fromarray(rgba).crop(box).save(HERE / 'reference-extracted.png')
    for name, image in [('before', original), ('candidate', candidate)]:
        image.resize((384, 256), Image.Resampling.LANCZOS).save(HERE / f'{name}-small.jpg', quality=90)
        detail = image.crop((780, 725, 945, 850))
        detail.save(HERE / f'{name}-detail.png')
        detail.resize((660, 500), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-4x.png')
        image.crop((804, 783, 839, 822)).resize((420, 468), Image.Resampling.NEAREST).save(HERE / f'{name}-ankle-12x.png')
    comparison = Image.new('RGB', (1320, 500))
    comparison.paste(Image.open(HERE / 'before-detail-4x.png'), (0, 0))
    comparison.paste(Image.open(HERE / 'candidate-detail-4x.png'), (660, 0))
    comparison.save(HERE / 'comparison-detail-4x.png')
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)
    print('正本切り出し:', box)
    print('変更画素:', int(difference.sum()))
    print('変更範囲:', ImageChops.difference(original, candidate).getbbox())


if __name__ == '__main__':
    main()

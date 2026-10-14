"""許可された irene_rest 1枚だけの局所合成。原画は上書きしない。"""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
# 再実行も今回保存した修正前だけを入力する。現在原画へは書き込まない。
SOURCE = ROOT / 'art/story-review/fixes/irene_rest-sigil-python-before.png'
REFERENCE = ROOT / 'docs/art/story-refs/sigil.png'
EXPECTED = '733173d82570de84c72a21a01f02c525e8675a30b43d0f2945003fe79e7b294d'
EXPECTED_REFERENCE = '7dfeb2dbb8eb7091557e1dd3f387b963b64b2fa4a20848c1c18734167fe47b6b'


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED, '修正前の更新を再確認してください'
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_REFERENCE, '正本の更新を再確認してください'
    original = Image.open(SOURCE).convert('RGB')
    pixels = np.asarray(original).copy()

    # 旧印の輪郭とごく近くの陰だけ。顔や髪には触れない。
    mask_image = Image.new('L', original.size)
    ImageDraw.Draw(mask_image).polygon(
        [(448, 299), (451, 299), (455, 304), (456, 308),
         (459, 304), (462, 304), (463, 308), (462, 320),
         (463, 323), (457, 324), (453, 319), (449, 317),
         (443, 314), (443, 309), (447, 309), (448, 308)], fill=255)
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
    pixels[ys, xs] = np.clip(np.rint(restored), 0, 255).astype(np.uint8)
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
    color[:, :, 0] = 216 + 35 * tone
    color[:, :, 1] = 148 + 48 * tone
    color[:, :, 2] = 51 + 40 * tone
    # 4倍の作業解像度で額の傾きへ合わせる。
    crest = Image.fromarray(color).resize((68, 96), Image.Resampling.LANCZOS)
    crest = crest.rotate(22, Image.Resampling.BICUBIC, expand=True)
    crest = crest.resize((crest.width // 4, crest.height // 4), Image.Resampling.LANCZOS)
    crest.putalpha(crest.getchannel('A').point(lambda value: value if value >= 8 else 0))
    crest.save(HERE / 'placed-crest.png')
    plain = Image.new('RGB', crest.size, 'white')
    plain.paste((0, 0, 0), (0, 0, crest.width, crest.height), crest.getchannel('A'))
    plain.resize((plain.width * 8, plain.height * 8), Image.Resampling.NEAREST).save(HERE / 'placed-shape-8x.png')
    candidate = cleaned.copy()
    # 金の小さな浮き彫りの陰。正本の輪郭に沿うだけで別の突起を作らない。
    shadow = Image.new('RGBA', crest.size, (92, 48, 26, 0))
    shadow.putalpha(crest.getchannel('A').point(lambda value: round(value * 0.30)))
    candidate.paste(shadow, (441, 297), shadow)
    candidate.paste(crest, (440, 296), crest)
    difference = np.any(np.asarray(candidate) != np.asarray(original), axis=2)

    allowed = np.zeros(mask.shape, dtype=bool)
    allowed[296:326, 441:467] = True
    assert not difference[~allowed].any(), '許可領域外のRGBが変わっています'
    Image.fromarray(allowed.astype(np.uint8)*255).save(HERE / 'allowed-region.png')
    Image.fromarray(difference.astype(np.uint8)*255).save(HERE / 'changed-pixels.png')
    print('変更画素:', int(difference.sum()))
    candidate.save(HERE / 'candidate.png')
    cleaned.crop((425, 285, 480, 340)).save(HERE / 'cleaned-detail.png')
    mask_image.crop((425, 285, 480, 340)).save(HERE / 'removal-mask.png')
    Image.fromarray(rgba).crop(box).save(HERE / 'reference-extracted.png')
    for name, image in [('before', original), ('candidate', candidate)]:
        image.resize((384, 256), Image.Resampling.LANCZOS).save(HERE / f'{name}-small.jpg', quality=90)
        detail = image.crop((425, 285, 480, 340))
        detail.save(HERE / f'{name}-detail.png')
        detail.resize((440, 440), Image.Resampling.NEAREST).save(HERE / f'{name}-detail-8x.png')
    comparison = Image.new('RGB', (880, 440))
    comparison.paste(Image.open(HERE / 'before-detail-8x.png'), (0, 0))
    comparison.paste(Image.open(HERE / 'candidate-detail-8x.png'), (440, 0))
    comparison.save(HERE / 'comparison-detail-8x.png')
    from PIL import ImageChops
    print('正本切り出し:', box)
    print('変更範囲:', ImageChops.difference(original, candidate).getbbox())


if __name__ == '__main__':
    main()

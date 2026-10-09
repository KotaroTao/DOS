#!/usr/bin/env python3
"""物語の原画 (PNG) を、出荷する WebP (品質88) に変換する。

原画は art/story-review/ に置き (デプロイで外れる)、ゲームが読むのは art/story/ の WebP だけ。
GitHub Pages の容量 (1GB・800MBで止まる) と、遊ぶ人の端末へ裏で集める量を抑えるため。

  python3 tools/storyart/to-webp.py --all            # 下の対応表どおり全部を変換し直す
  python3 tools/storyart/to-webp.py SRC.png DST.webp  # 1枚だけ

品質88は、細かな粒が拡大すればわずかに柔らかくなる程度で、ゲームの表示幅 (最大576px) では見分けられない
(2026-10 ユーザーの確認済み)。1枚 3MB 前後 → 0.4〜0.6MB。
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
QUALITY = 88
# 原画のフォルダ → 出荷先のフォルダ
PAIRS = [
    ("art/story-review/prologue", "art/story"),
    ("art/story-review/chapter1", "art/story/chapter1"),
    ("art/story-review/chapter2", "art/story/chapter2"),
    ("art/story-review/chapter3", "art/story/chapter3"),
    ("art/story-review/chapter4", "art/story/chapter4"),
    ("art/story-review/dungeons", "art/story/dungeons"),
]
# 物語の絵ではないもの (一覧の見本・制作の参照に使うだけの原画) は出荷しない
SKIP = {"gallery.png", "morden-at-throne.png"}


def convert(src: Path, dst: Path) -> None:
    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    print(f"{src.relative_to(ROOT)} {src.stat().st_size // 1024}KB -> {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB")


def main(argv):
    if argv[1:] == ["--all"]:
        n = 0
        for s, d in PAIRS:
            for src in sorted((ROOT / s).glob("*.png")):
                if src.name in SKIP:
                    continue
                convert(src, ROOT / d / (src.stem + ".webp"))
                n += 1
        print(f"{n}枚を変換")
    elif len(argv) == 3:
        convert(Path(argv[1]).resolve(), Path(argv[2]).resolve())
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""物語の原画 (PNG) を、出荷する WebP (品質88) に変換する。

ふだんは tools/storyart/build.py を使う (変わった原画だけを変換し、登録・確認まで済ませる)。
このファイルは変換の部品と、1枚だけ・全部を手で変換し直す入口。

  python3 tools/storyart/to-webp.py --all            # 原画を全部変換し直す (hold / skip を除く)
  python3 tools/storyart/to-webp.py SRC.png DST.webp  # 1枚だけ

置き場所 (原画 art/story-review/ → 出荷 art/story/):
  prologue/<名前>.png → <名前>.webp / chapterN/<場面ID>.png → chapterN/<場面ID>.webp / dungeons/lore_<迷宮ID>.png → dungeons/lore_<迷宮ID>.webp
原画は art/story-review/ に置き (デプロイで外れる)、ゲームが読むのは art/story/ の WebP だけ。
品質88は、ゲームの表示幅 (最大576px) では原画と見分けられない (2026-10 ユーザーの確認済み)。1枚 3MB 前後 → 0.4〜0.7MB。
"""
import json
import re
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / "art/story-review"
SHIP = ROOT / "art/story"
QUALITY = 88
_LISTS = json.loads((ROOT / "tools/storyart/hold.json").read_text(encoding="utf-8"))
HOLD = set(_LISTS["hold"])  # 直しを待つ原画
SKIP = set(_LISTS["skip"])  # 物語の絵ではない原画


def shipped_for(master: Path) -> Path:
    """原画のパス → 出荷する WebP のパス"""
    rel = master.relative_to(REVIEW)
    folder = rel.parts[0]
    if folder == "prologue":
        return SHIP / (master.stem + ".webp")
    return SHIP / folder / (master.stem + ".webp")


def masters():
    """変換の対象になる原画 (hold / skip を除く) を、置き場所の順に"""
    dirs = [REVIEW / "prologue"]
    dirs += sorted((d for d in REVIEW.glob("chapter*") if re.fullmatch(r"chapter\d+", d.name)), key=lambda d: int(d.name[7:]))
    dirs += [REVIEW / "dungeons"]
    for d in dirs:
        for src in sorted(d.glob("*.png")):
            key = str(src.relative_to(REVIEW).with_suffix(""))
            if key in SKIP or key in HOLD:
                continue
            yield src


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
        for src in masters():
            convert(src, shipped_for(src))
            n += 1
        print(f"{n}枚を変換。続けて python3 tools/storyart/build.py で登録と確認を済ませる")
    elif len(argv) == 3:
        convert(Path(argv[1]).resolve(), Path(argv[2]).resolve())
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

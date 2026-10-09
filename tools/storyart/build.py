#!/usr/bin/env python3
"""物語の絵を描いた・直した後に回す、ただ一つのコマンド (変換 → 登録 → 確認ページ → 検査)。

  python3 tools/storyart/build.py          変わった原画だけを WebP にして、登録と確認まで済ませる
  python3 tools/storyart/build.py --all    原画を全部変換し直す (画質の設定を変えた時など)

すること:
  1. art/story-review/{prologue,chapterN,dungeons}/ の原画 PNG のうち、新しい・直したもの (tools/storyart/masters.json の
     ハッシュと違うもの) だけを art/story/ の WebP (品質88) にする。hold / skip (tools/storyart/hold.json) は飛ばす
  2. node tools/storyart/register.mjs — src/storyimages.js と sw.js の ASSETS の絵の欄を書き直す
  3. node tools/storyart/review.mjs — 確認ページ art/story-review/review/chapterN.md と進み具合 status.md
  4. 縮小の見本 art/story-review/review/chapterN-small.jpg (ゲームの小さな表示 384×256 で主題が読めるか)
  5. 検査: register.mjs --check / prompt.mjs --check / tools/journal/check.mjs (どれかが落ちたら 1 で終わる)

Pillow (pip install pillow) と Node 22 が要る。ゲームのコードもコミットも触らない (git add / PR は自分で)。
"""
import importlib.util
import json
import subprocess
import sys
sys.dont_write_bytecode = True  # to-webp.py を読み込んでも __pycache__ を作らない
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "tools/storyart"
MASTERS = HERE / "masters.json"
REVIEW_OUT = ROOT / "art/story-review/review"

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow が無い: pip install pillow")

_spec = importlib.util.spec_from_file_location("towebp", HERE / "to-webp.py")
towebp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(towebp)


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def git_hashes(paths):
    if not paths:
        return []
    out = subprocess.run(["git", "hash-object", "--stdin-paths"], cwd=ROOT, input="\n".join(rel(p) for p in paths) + "\n",
                         capture_output=True, text=True, check=True).stdout.split()
    return out


def node(*args, check=True):
    r = subprocess.run(["node", *args], cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if out:
        print("   " + out.replace("\n", "\n   "))
    if check and r.returncode != 0:
        return False
    return True


def chapter_key(master: Path) -> str:
    folder = master.relative_to(towebp.REVIEW).parts[0]
    return "0" if folder == "prologue" else ("dungeons" if folder == "dungeons" else folder[7:])


def contact_sheet(key: str):
    """その章の出荷する絵を 384×256 に縮めて並べた見本 (ゲームで小さく出た時に主題が読めるかを見る)"""
    if key == "dungeons":
        files = sorted((towebp.SHIP / "dungeons").glob("*.webp"))
    elif key == "0":
        files = sorted(towebp.SHIP.glob("*.webp"))
    else:
        files = sorted((towebp.SHIP / f"chapter{key}").glob("*.webp"))
    if not files:
        return None
    W, H, PAD, LAB, COLS = 384, 256, 8, 18, 3
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD), (24, 22, 28))
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        x, y = PAD + (i % COLS) * (W + PAD), PAD + (i // COLS) * (H + LAB + PAD)
        im = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
        sheet.paste(im, (x, y + LAB))
        draw.text((x + 2, y + 3), f.stem, fill=(230, 220, 190))
    name = "dungeons-small.jpg" if key == "dungeons" else f"chapter{key}-small.jpg"
    REVIEW_OUT.mkdir(parents=True, exist_ok=True)
    out = REVIEW_OUT / name
    sheet.save(out, quality=85, optimize=True)  # 確認用なので JPEG で軽く (リポジトリを太らせない)
    return out


def main(argv):
    every = "--all" in argv
    rec = json.loads(MASTERS.read_text(encoding="utf-8")) if MASTERS.exists() else {}
    masters = list(towebp.masters())
    hashes = dict(zip((rel(m) for m in masters), git_hashes(masters)))

    print("1. 原画 → WebP")
    touched = set()
    for m in masters:
        key, dst = rel(m), towebp.shipped_for(m)
        if every or not dst.exists() or rec.get(key) != hashes[key]:
            towebp.convert(m, dst)
            touched.add(chapter_key(m))
        rec[key] = hashes[key]
    gone = [k for k in rec if k not in hashes]
    for k in gone:
        del rec[k]
    MASTERS.write_text(json.dumps(dict(sorted(rec.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if not touched:
        print("   変わった原画は無い")

    print("2. 登録 (src/storyimages.js・sw.js)")
    ok = node("tools/storyart/register.mjs")

    print("3. 確認ページ (art/story-review/review/)")
    node("tools/storyart/review.mjs", *(sorted(touched) if touched and not every else []))

    print("4. 縮小の見本")
    for key in sorted(touched) if not every else ["0", *sorted({chapter_key(m) for m in masters} - {"0"})]:
        out = contact_sheet(key)
        if out:
            print(f"   {rel(out)}")

    print("5. 検査")
    ok = node("tools/storyart/register.mjs", "--check") and ok
    ok = node("tools/storyart/prompt.mjs", "--check") and ok
    ok = node("tools/journal/check.mjs") and ok
    if not ok:
        print("\n✗ 検査が落ちた。上の ✗ の行を直してから、もう一度 python3 tools/storyart/build.py")
        return 1
    print("\n✓ できあがり。次: git add art/story art/story-review src/storyimages.js sw.js tools/storyart/masters.json して PR を出す")
    print("  PR の本文には art/story-review/review/chapterN.md (絵と本文の見比べ) と chapterN-small.jpg (縮小の見本) を載せる")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

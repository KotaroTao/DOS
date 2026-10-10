#!/usr/bin/env python3
"""タイトル画面の原画 (PNG) を出荷する WebP にし、ゲームへ登録する。

  python3 tools/titleart/build.py          # 原画を変換して登録する
  python3 tools/titleart/build.py --check  # 登録と原画・出荷物が食い違っていないかだけ調べる

原画 (デプロイで外れる)            → 出荷
  docs/art/title/keyart-wide.png   → art/title/keyart-wide.webp (横長の画面)
  docs/art/title/keyart-tall.png   → art/title/keyart-tall.webp (縦長の画面)
  docs/art/title/points.json       = 光を重ねる位置 (原画の幅・高さに対する割合。書式は docs/art/title/README.md)

書くもの (手で直さない): src/titlekeyart.js の <<TITLE_KEYART>> 欄、sw.js の ASSETS の <<TITLE_ART>> 欄。
片方の原画だけでもよい (もう片方の画面にはある方を切り取って出す)。どちらも無ければ従来のドット絵のまま。
"""
import json
import re
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "docs/art/title"
SHIP = ROOT / "art/title"
JS = ROOT / "src/titlekeyart.js"
SW = ROOT / "sw.js"
QUALITY = 90
MAX_SIDE = 2560  # 大きな画面 (iPad の縦 2000px 前後) でも引き伸ばしが目立たない上限
KINDS = ("wide", "tall")


def load_points():
    p = MASTER / "points.json"
    pts = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return pts


def check_point(kind, pt):
    def frac(v, name):
        if not (isinstance(v, (int, float)) and 0 <= v <= 1):
            sys.exit(f"points.json の {kind}.{name} は 0〜1 の割合で書く: {v!r}")
    if "gate" not in pt:
        sys.exit(f"points.json に {kind}.gate (門の魂火の中心) がありません")
    for k in ("gate", "lamp"):
        if k in pt:
            if not (isinstance(pt[k], list) and len(pt[k]) == 2):
                sys.exit(f"points.json の {kind}.{k} は [x, y]")
            frac(pt[k][0], k + "[0]"); frac(pt[k][1], k + "[1]")
    for k in ("gateR", "lampR", "fogY"):
        if k in pt:
            frac(pt[k], k)


def entries():
    pts = load_points()
    out = {}
    for kind in KINDS:
        src = MASTER / f"keyart-{kind}.png"
        if not src.exists():
            continue
        pt = pts.get(kind)
        if not pt:
            sys.exit(f"{src.relative_to(ROOT)} があるのに points.json に {kind} がありません")
        check_point(kind, pt)
        out[kind] = (src, SHIP / f"keyart-{kind}.webp", pt)
    return out


def convert(src, dst):
    im = Image.open(src).convert("RGB")
    if max(im.size) > MAX_SIDE:
        k = MAX_SIDE / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    print(f"{src.relative_to(ROOT)} {src.stat().st_size // 1024}KB -> {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB")


def js_block(es):
    lines = ["export const TITLE_KEYART = {"]
    for kind in KINDS:
        if kind not in es:
            lines.append(f"  {kind}: null,")
            continue
        _, dst, pt = es[kind]
        w, h = Image.open(dst).size
        info = {"src": "./" + dst.relative_to(ROOT).as_posix(), "w": w, "h": h}
        for k in ("gate", "gateR", "lamp", "lampR", "fogY"):
            if k in pt:
                info[k] = pt[k]
        lines.append(f"  {kind}: {json.dumps(info, ensure_ascii=False)},")
    lines.append("};")
    return "\n".join(lines)


def sw_block(es):
    return "".join(f'  "./{es[k][1].relative_to(ROOT).as_posix()}",\n' for k in KINDS if k in es)


def replace(text, head, tail, body, name):
    m = re.search(re.escape(head) + r"[^\n]*\n(.*?)([ \t]*)" + re.escape(tail), text, re.S)
    if not m:
        sys.exit(f"{name} に {head} 〜 {tail} の欄がありません")
    return text[: m.start(1)] + body + text[m.start(2):]


def main():
    check = "--check" in sys.argv
    es = entries()
    if not check:
        for kind, (src, dst, _) in es.items():
            convert(src, dst)
    for kind, (src, dst, _) in es.items():
        if not dst.exists():
            sys.exit(f"{dst.relative_to(ROOT)} がありません (build.py を回す)")
    js_new = replace(JS.read_text(encoding="utf-8"), "// <<TITLE_KEYART>>", "// <</TITLE_KEYART>>", js_block(es) + "\n", "src/titlekeyart.js")
    sw_new = replace(SW.read_text(encoding="utf-8"), "// <<TITLE_ART>>", "// <</TITLE_ART>>", sw_block(es), "sw.js")
    if check:
        bad = [n for n, p, t in (("src/titlekeyart.js", JS, js_new), ("sw.js", SW, sw_new)) if p.read_text(encoding="utf-8") != t]
        if bad:
            sys.exit("登録が原画と食い違っています: " + ", ".join(bad) + " (python3 tools/titleart/build.py を回す)")
        print("タイトルの原画の登録: 食い違いなし (" + (", ".join(es) or "原画なし — ドット絵") + ")")
        return
    JS.write_text(js_new, encoding="utf-8")
    SW.write_text(sw_new, encoding="utf-8")
    print("登録: " + (", ".join(es) or "原画なし — ドット絵のまま"))


if __name__ == "__main__":
    main()

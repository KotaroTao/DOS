#!/usr/bin/env python3
"""街の施設の情景 (酒場・宿屋・赤い魂の祠) の原画 (PNG) を出荷する WebP にし、ゲームへ登録する。

  python3 tools/townart/build.py          # 原画を変換して登録する
  python3 tools/townart/build.py --check  # 登録と原画・出荷物が食い違っていないかだけ調べる

原画 (デプロイで外れる)       → 出荷
  docs/art/town/<鍵>.png      → art/town/<鍵>.webp   (鍵 = tavern / inn / shrine)
  docs/art/town/points.json   = 切り取りの中心と、揺らぐ明かりの位置 (書式は docs/art/town/README.md)

書くもの (手で直さない): src/townkeyart.js の <<TOWN_KEYART>> 欄、sw.js の ASSETS の <<TOWN_ART>> 欄。
原画の無い鍵は従来のドット絵のまま。
"""
import json
import re
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "docs/art/town"
SHIP = ROOT / "art/town"
JS = ROOT / "src/townkeyart.js"
SW = ROOT / "sw.js"
QUALITY = 90
MAX_W = 1600  # 情景は最大でも画面幅ほど (約800px × 2)
KEYS = ("tavern", "inn", "shrine")
TONES = ("fire", "lamp", "candle", "crystal", "moon")


def frac(v, name):
    if not (isinstance(v, (int, float)) and 0 <= v <= 1):
        sys.exit(f"points.json の {name} は 0〜1 の割合で書く: {v!r}")


def check_point(key, pt):
    if "focus" in pt:
        if not (isinstance(pt["focus"], list) and len(pt["focus"]) == 2):
            sys.exit(f"points.json の {key}.focus は [x, y]")
        frac(pt["focus"][0], f"{key}.focus[0]"); frac(pt["focus"][1], f"{key}.focus[1]")
    lights = pt.get("lights")
    if not isinstance(lights, list) or not lights:
        sys.exit(f"points.json の {key}.lights (揺らぐ明かり) を1つ以上書く")
    for i, L in enumerate(lights):
        n = f"{key}.lights[{i}]"
        if not (isinstance(L.get("at"), list) and len(L["at"]) == 2):
            sys.exit(f"points.json の {n}.at は [x, y]")
        frac(L["at"][0], n + ".at[0]"); frac(L["at"][1], n + ".at[1]")
        if "r" in L:
            frac(L["r"], n + ".r")
        if L.get("tone") not in TONES:
            sys.exit(f"points.json の {n}.tone は {' / '.join(TONES)} のどれか: {L.get('tone')!r}")


def entries():
    p = MASTER / "points.json"
    pts = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    out = {}
    for key in KEYS:
        src = MASTER / f"{key}.png"
        if not src.exists():
            continue
        pt = pts.get(key)
        if not pt:
            sys.exit(f"{src.relative_to(ROOT)} があるのに points.json に {key} がありません")
        check_point(key, pt)
        out[key] = (src, SHIP / f"{key}.webp", pt)
    return out


def convert(src, dst):
    im = Image.open(src).convert("RGB")
    if im.width > MAX_W:
        k = MAX_W / im.width
        im = im.resize((MAX_W, round(im.height * k)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    print(f"{src.relative_to(ROOT)} {src.stat().st_size // 1024}KB -> {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB")


def js_block(es):
    lines = ["export const TOWN_KEYART = {"]
    for key in KEYS:
        if key not in es:
            lines.append(f"  {key}: null,")
            continue
        _, dst, pt = es[key]
        info = {"src": "./" + dst.relative_to(ROOT).as_posix()}
        if "focus" in pt:
            info["focus"] = pt["focus"]
        info["lights"] = [{k: L[k] for k in ("at", "r", "tone") if k in L} for L in pt["lights"]]
        lines.append(f"  {key}: {json.dumps(info, ensure_ascii=False)},")
    lines.append("};")
    return "\n".join(lines)


def sw_block(es):
    return "".join(f'  "./{es[k][1].relative_to(ROOT).as_posix()}",\n' for k in KEYS if k in es)


def replace(text, head, tail, body, name):
    m = re.search(re.escape(head) + r"[^\n]*\n(.*?)([ \t]*)" + re.escape(tail), text, re.S)
    if not m:
        sys.exit(f"{name} に {head} 〜 {tail} の欄がありません")
    return text[: m.start(1)] + body + text[m.start(2):]


def main():
    check = "--check" in sys.argv
    es = entries()
    if not check:
        for src, dst, _ in es.values():
            convert(src, dst)
    for _, dst, _ in es.values():
        if not dst.exists():
            sys.exit(f"{dst.relative_to(ROOT)} がありません (build.py を回す)")
    js_new = replace(JS.read_text(encoding="utf-8"), "// <<TOWN_KEYART>>", "// <</TOWN_KEYART>>", js_block(es) + "\n", "src/townkeyart.js")
    sw_new = replace(SW.read_text(encoding="utf-8"), "// <<TOWN_ART>>", "// <</TOWN_ART>>", sw_block(es), "sw.js")
    if check:
        bad = [n for n, p, t in (("src/townkeyart.js", JS, js_new), ("sw.js", SW, sw_new)) if p.read_text(encoding="utf-8") != t]
        if bad:
            sys.exit("登録が原画と食い違っています: " + ", ".join(bad) + " (python3 tools/townart/build.py を回す)")
        print("街の情景の原画の登録: 食い違いなし (" + (", ".join(es) or "原画なし — ドット絵") + ")")
        return
    JS.write_text(js_new, encoding="utf-8")
    SW.write_text(sw_new, encoding="utf-8")
    print("登録: " + (", ".join(es) or "原画なし — ドット絵のまま"))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""街の情景・人物・紋章 の原画 (PNG) を出荷する WebP にし、ゲームへ登録する。

  python3 tools/townart/build.py          # 原画を変換して登録する
  python3 tools/townart/build.py --check  # 登録と原画・出荷物が食い違っていないかだけ調べる

原画 (デプロイで外れる)       → 出荷
  docs/art/town/<鍵>.png      → art/town/<鍵>.webp   (施設・図鑑など15種類)
  docs/art/town/points.json   = 切り取りの中心と、揺らぐ明かりの位置 (書式は docs/art/town/README.md)

書くもの (手で直さない): src/townkeyart.js の <<TOWN_KEYART>> 欄、sw.js の ASSETS の <<TOWN_ART>> 欄。
人物の胸像: docs/art/town/keepers/<鍵>.png → art/town/keepers/<鍵>.webp (最大幅640px)。
紋章: docs/art/town/icons/<鍵>.png → art/town/icons/<鍵>.webp (最大幅384px・透明度を維持)。
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
KEYS = ("tavern", "inn", "shrine", "palace", "mansion", "shop",
        "altar", "party", "manage", "codexMon", "codexItem", "codexJob", "codexAch", "treasury", "abyss")
KEEPER_KEYS = ("barkeep", "innkeeper", "maiden", "king", "minister", "binder", "merchant")
ICON_KEYS = ("gate", "gateOpen", "gateDone", "gateSealed", "dive", "lock", "abyss")
TONES = ("fire", "lamp", "candle", "crystal", "moon", "soul")


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


def keeper_entries():
    return {k: (MASTER / "keepers" / f"{k}.png", SHIP / "keepers" / f"{k}.webp")
            for k in KEEPER_KEYS if (MASTER / "keepers" / f"{k}.png").exists()}


def icon_entries():
    return {k: (MASTER / "icons" / f"{k}.png", SHIP / "icons" / f"{k}.webp")
            for k in ICON_KEYS if (MASTER / "icons" / f"{k}.png").exists()}


def convert(src, dst, max_w=MAX_W):
    im = Image.open(src)
    im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    if im.width > max_w:
        k = max_w / im.width
        im = im.resize((max_w, round(im.height * k)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=QUALITY, method=6)
    print(f"{src.relative_to(ROOT)} {src.stat().st_size // 1024}KB -> {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB")


def js_block(es, keepers, icons):
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
    lines.append("export const TOWN_KEEPERART = {")
    for key in KEEPER_KEYS:
        src = "./" + keepers[key][1].relative_to(ROOT).as_posix() if key in keepers else None
        lines.append(f"  {key}: {json.dumps(src)},")
    lines.append("};")
    lines.append("export const TOWN_ICONART = {")
    for key in ICON_KEYS:
        src = "./" + icons[key][1].relative_to(ROOT).as_posix() if key in icons else None
        lines.append(f"  {key}: {json.dumps(src)},")
    lines.append("};")
    return "\n".join(lines)


def sw_block(es, keepers, icons):
    paths = [es[k][1] for k in KEYS if k in es] + [keepers[k][1] for k in KEEPER_KEYS if k in keepers] + [icons[k][1] for k in ICON_KEYS if k in icons]
    return "".join(f'  "./{p.relative_to(ROOT).as_posix()}",\n' for p in paths)


def replace(text, head, tail, body, name):
    m = re.search(re.escape(head) + r"[^\n]*\n(.*?)([ \t]*)" + re.escape(tail), text, re.S)
    if not m:
        sys.exit(f"{name} に {head} 〜 {tail} の欄がありません")
    return text[: m.start(1)] + body + text[m.start(2):]


def main():
    check = "--check" in sys.argv
    es = entries()
    keepers = keeper_entries()
    icons = icon_entries()
    if not check:
        for src, dst, _ in es.values():
            convert(src, dst)
        for src, dst in keepers.values():
            convert(src, dst, max_w=640)
        for src, dst in icons.values():
            convert(src, dst, max_w=384)
    for dst in [v[1] for v in es.values()] + [v[1] for v in keepers.values()] + [v[1] for v in icons.values()]:
        if not dst.exists():
            sys.exit(f"{dst.relative_to(ROOT)} がありません (build.py を回す)")
    js_new = replace(JS.read_text(encoding="utf-8"), "// <<TOWN_KEYART>>", "// <</TOWN_KEYART>>", js_block(es, keepers, icons) + "\n", "src/townkeyart.js")
    sw_new = replace(SW.read_text(encoding="utf-8"), "// <<TOWN_ART>>", "// <</TOWN_ART>>", sw_block(es, keepers, icons), "sw.js")
    if check:
        bad = [n for n, p, t in (("src/townkeyart.js", JS, js_new), ("sw.js", SW, sw_new)) if p.read_text(encoding="utf-8") != t]
        if bad:
            sys.exit("登録が原画と食い違っています: " + ", ".join(bad) + " (python3 tools/townart/build.py を回す)")
        print("街の原画の登録: 食い違いなし (" + (", ".join([*es, *keepers, *icons]) or "原画なし — ドット絵") + ")")
        return
    JS.write_text(js_new, encoding="utf-8")
    SW.write_text(sw_new, encoding="utf-8")
    print("登録: " + (", ".join([*es, *keepers, *icons]) or "原画なし — ドット絵のまま"))


if __name__ == "__main__":
    main()

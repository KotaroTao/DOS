#!/usr/bin/env python3
# 職業キャラの「ドット絵風の原画」(ユーザー提供の画像) を、本物のドット絵 (1ドット = 1升) に起こす開発用ツール。
# 原画のドットの升目は AI 生成のため大きさが少しずつ揺れている (全体で一定の周期にならない) ので、
# 縦横それぞれ「色の境目が並ぶ位置」を動的計画法で選んで升目の切れ目を決め、各升の中ほどの色の中央値を1ドットにする。
#
#   python3 tools/jobdot.py <job> <rank1.jpg> ... <rank5.jpg> [--period 16.5] [--colors 32]
#                          [--head cx,crown,chin ...] [--preview out.png] [--apply]
#
# --apply で src/jobart.js の <job> 項目を書き換え (無ければ末尾に追加)、src/jobphotos.js の <job> 項目と
# art/jobs/<job>_*.webp・sw.js の該当行を外す (原画そのまま版からの切り替え)。
# 顔アイコン (胸像) は head = [顔の中心x, 頭頂y, あご先y] (ドット座標) で切り出す。省くと肌色から推し量る。
# 全ランクの頭が原画の同じ位置に描かれていれば、--head-px cx,crown,chin (原画の画素) で一度に与えられる。
# 測り方は tools/jobimg.py と同じ (頬の左右の輪郭の真ん中・髪の塊の上端・顔の肌のいちばん下)。
# 必ず --preview の胸像欄 (頭頂が水色の線・あご先が桃色の線に乗るか) を見て、ずれていれば --head で直す。
# 要 Pillow / numpy。
import sys, os, re, argparse
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUST, BUST_HEAD, BUST_TOP = 36, 20.5, 1  # souls.js と同じ値
CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def is_white(c):
    return c.min() > 222 and (c.max() - c.min()) < 30


def content_box(a):
    mn = a.min(axis=2); sp = a.max(axis=2) - mn
    ink = ~((mn > 222) & (sp < 30))
    ys, xs = np.nonzero(ink)
    return xs.min(), xs.max(), ys.min(), ys.max()


def edge_profile(a, axis):
    b = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float)
    d = np.abs(np.diff(b, axis=axis)).sum(axis=2)
    d = np.minimum(d, np.percentile(d, 99.5))
    e = d.sum(axis=0 if axis == 1 else 1)
    e = np.concatenate([[0], e])  # e[i] = 位置 i (画素 i-1 と i の間) の境目の強さ
    return e / (np.percentile(e, 95) + 1e-9)


def cut_positions(e, p0, lo, hi, lam=0.08, base=0.25):
    """位置 lo..hi の範囲で、間隔が p0 前後の切れ目の列を選ぶ (境目の強さの和 − 間隔の歪みの罰)。"""
    pmin, pmax = int(p0 * 0.7), int(np.ceil(p0 * 1.35))
    n = hi - lo + 1
    sc = e[lo:hi + 1] - base
    best = np.full(n, -1e18); prev = np.full(n, -1, int)
    best[:pmax] = sc[:pmax]
    for i in range(n):
        for g in range(pmin, pmax + 1):
            j = i - g
            if j < 0: break
            v = best[j] + sc[i] - lam * (g - p0) ** 2
            if v > best[i]: best[i] = v; prev[i] = j
    end = n - 1 - int(np.argmax(best[::-1][:pmax]))
    cuts = []
    i = end
    while i >= 0:
        cuts.append(i + lo); i = prev[i]
    return cuts[::-1]


def uniform_cuts(e, p0, lo, hi):
    """周期 p0 固定の升目。位相だけを境目に合わせる (ランク違いで背丈が揃う)。"""
    best = None
    for ph in np.arange(0, p0, 0.25):
        pos = np.arange(lo + ph, hi + p0, p0)
        sc = sum(e[min(len(e) - 1, int(round(v)))] for v in pos)
        if best is None or sc > best[0]: best = (sc, pos)
    return [int(round(v)) for v in best[1] if v < len(e)]


def dotify(path, period, uniform=False):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    x0, x1, y0, y1 = content_box(a)
    m = int(period * 1.5)
    H, W = a.shape[:2]
    cut = uniform_cuts if uniform else cut_positions
    xs = cut(edge_profile(a, 1), period, max(0, x0 - m), min(W - 1, x1 + m))
    ys = cut(edge_profile(a, 0), period, max(0, y0 - m), min(H - 1, y1 + m))
    gh, gw = len(ys) - 1, len(xs) - 1
    cells = np.zeros((gh, gw, 3)); bg = np.zeros((gh, gw), bool)
    for j in range(gh):
        for i in range(gw):
            ya, yb, xa, xb = ys[j], ys[j + 1], xs[i], xs[i + 1]
            sy, sx = (yb - ya) * 0.28, (xb - xa) * 0.28
            blk = a[int(ya + sy):max(int(ya + sy) + 1, int(yb - sy)), int(xa + sx):max(int(xa + sx) + 1, int(xb - sx))]
            c = np.median(blk.reshape(-1, 3), axis=0)
            cells[j, i] = c
            bg[j, i] = is_white(c)
    # 背景 = 縁から繋がる白。輪郭線に囲まれた白も、囲みの過半が暗い輪郭なら背景 (刀身・瞳の光は残す)
    out = np.zeros((gh, gw), bool)
    q = deque((j, i) for j in range(gh) for i in range(gw) if bg[j, i] and (j in (0, gh - 1) or i in (0, gw - 1)))
    for j, i in q: out[j, i] = True
    while q:
        j, i = q.popleft()
        for nj, ni in ((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)):
            if 0 <= nj < gh and 0 <= ni < gw and bg[nj, ni] and not out[nj, ni]:
                out[nj, ni] = True; q.append((nj, ni))
    seen = out.copy()
    for j in range(gh):
        for i in range(gw):
            if not bg[j, i] or seen[j, i]: continue
            comp, rim = [], []
            q = deque([(j, i)]); seen[j, i] = True
            while q:
                y, x = q.popleft(); comp.append((y, x))
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if not (0 <= ny < gh and 0 <= nx < gw): continue
                    if bg[ny, nx]:
                        if not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
                    else: rim.append(cells[ny, nx])
            dark = sum(1 for c in rim if c.mean() < 90)
            if rim and dark / len(rim) > 0.5:
                for y, x in comp: out[y, x] = True
    # 縁のにじみ: 背景に3方以上囲まれた明るい升 (原画の白地との混じり) と、孤立した1升を背景にする
    for _ in range(2):
        nb = np.zeros((gh, gw), int)
        pad = np.pad(out, 1, constant_values=True)
        nb = pad[:-2, 1:-1].astype(int) + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
        light = cells.min(axis=2) > 175
        pale = cells.min(axis=2) > 190  # 白地との混じり (輪郭線の外に出た明るい升)
        out = out | ((~out) & ((nb >= 4) | ((nb >= 3) & light) | ((nb >= 2) & pale)))
    # 余白を切る
    rows = np.nonzero((~out).any(axis=1))[0]; cols = np.nonzero((~out).any(axis=0))[0]
    cells = cells[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
    out = out[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
    origin = (xs[cols[0]], ys[rows[0]])  # 切り出した左上の升の、原画での画素位置
    return cells, out, origin


def quantize(cells, mask, ncol):
    pts = cells[~mask].astype(np.uint8)
    img = Image.fromarray(pts.reshape(1, -1, 3))
    qi = img.quantize(colors=ncol, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(qi.getpalette()[:ncol * 3]).reshape(-1, 3)
    idx = np.array(qi).reshape(-1)
    used = sorted(set(idx.tolist()), key=lambda k: pal[k].sum())  # 暗い順に 0,1,2…
    remap = {k: n for n, k in enumerate(used)}
    h, w = mask.shape
    grid = np.full((h, w), -1, int)
    grid[~mask] = [remap[k] for k in idx]
    palette = {CHARS[remap[k]]: "#%02x%02x%02x" % tuple(pal[k]) for k in used}
    art = ["".join("." if v < 0 else CHARS[v] for v in row) for row in grid]
    return palette, art


def skin_head(cells, mask):
    """肌色の塊から顔の中心x・あご先y、頭頂 = 顔の列の不透明の上端 を推し量る (目安)。"""
    c = cells
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    skin = (~mask) & (r > 200) & (g > 150) & (g < 225) & (b > 110) & (b < 200) & (r - b > 40)
    ys, xs = np.nonzero(skin)
    top_half = ys < mask.shape[0] * 0.45
    ys, xs = ys[top_half], xs[top_half]
    cx = float(np.median(xs)); chin = float(ys.max()) + 1
    col = int(round(cx))
    crown = float(np.nonzero(~mask[:, col])[0].min())
    return [round(cx, 1), crown, chin]


def preview(results, path):
    S = 8
    W = sum(len(r["art"][0]) for r in results) * S + 20 * len(results)
    H = max(len(r["art"]) for r in results) * S + BUST * 4 + 40
    im = Image.new("RGB", (W, H), (40, 40, 48)); d = ImageDraw.Draw(im)
    x = 10
    for r in results:
        pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in r["palette"].items()}
        for y, row in enumerate(r["art"]):
            for i, ch in enumerate(row):
                if ch != ".": d.rectangle([x + i * S, y * S, x + i * S + S - 1, y * S + S - 1], fill=pal[ch])
        # 胸像
        hx, top, chin = r["head"]
        fs = BUST * max(1, chin - top) / BUST_HEAD
        Sx = max(8, round(fs)); bx = round(hx - Sx / 2); by = round(top - BUST_TOP * Sx / BUST)
        k = 4 * BUST / Sx; oy = len(r["art"]) * S + 20
        for y in range(Sx):
            for i in range(Sx):
                yy, xx = by + y, bx + i
                if 0 <= yy < len(r["art"]) and 0 <= xx < len(r["art"][yy]) and r["art"][yy][xx] != ".":
                    d.rectangle([x + i * k, oy + y * k, x + (i + 1) * k - 1, oy + (y + 1) * k - 1], fill=pal[r["art"][yy][xx]])
        d.line([x, oy + BUST_TOP * 4, x + BUST * 4, oy + BUST_TOP * 4], fill=(0, 255, 255))
        d.line([x, oy + (BUST_TOP + BUST_HEAD) * 4, x + BUST * 4, oy + (BUST_TOP + BUST_HEAD) * 4], fill=(255, 0, 255))
        x += len(r["art"][0]) * S + 20
    im.save(path)


def js_entry(job, results):
    out = [f"  {job}: {{"]
    for n, r in enumerate(results, 1):
        pal = "{" + ",".join(f'"{k}":"{v}"' for k, v in r["palette"].items()) + "}"
        hd = ", ".join(str(round(v, 2)) for v in r["head"])
        out.append(f"    {n}: {{")
        out.append(f"      face: [{r['face'][0]},{r['face'][1]}],")
        out.append(f"      head: [{hd}],")
        out.append(f"      palette: {pal},")
        out.append("      art: [")
        out += [f'        "{row}",' for row in r["art"]]
        out.append("      ],")
        out.append("    },")
    out.append("  },")
    return "\n".join(out) + "\n"


def apply(job, results):
    p = os.path.join(ROOT, "src/jobart.js"); s = open(p, encoding="utf-8").read()
    entry = js_entry(job, results)
    m = re.search(rf"^  {job}: \{{\n.*?^  \}},\n", s, re.S | re.M)
    if m: s = s[:m.start()] + entry + s[m.end():]
    else:
        end = s.rindex("};")
        s = s[:end] + entry + s[end:]
    open(p, "w", encoding="utf-8").write(s)
    p = os.path.join(ROOT, "src/jobphotos.js"); s = open(p, encoding="utf-8").read()
    s = re.sub(rf"^  {job}: \{{\n.*?^  \}},\n", "", s, flags=re.S | re.M)
    open(p, "w", encoding="utf-8").write(s)
    p = os.path.join(ROOT, "sw.js"); s = open(p, encoding="utf-8").read()
    s = re.sub(rf'^  "\./art/jobs/{job}_\d\.webp",\n', "", s, flags=re.M)
    open(p, "w", encoding="utf-8").write(s)
    for n in range(1, 6):
        f = os.path.join(ROOT, f"art/jobs/{job}_{n}.webp")
        if os.path.exists(f): os.remove(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("job"); ap.add_argument("images", nargs="+")
    ap.add_argument("--period", type=float, default=16.5)
    ap.add_argument("--colors", type=int, default=32)
    ap.add_argument("--uniform", action="store_true", help="升目を周期一定にする (背丈がランク間で揃う)")
    ap.add_argument("--head", nargs="*", default=[])
    ap.add_argument("--head-px", help="顔の中心x,頭頂y,あご先y を原画の画素で (全ランク共通)")
    ap.add_argument("--preview"); ap.add_argument("--apply", action="store_true")
    o = ap.parse_args()
    results = []
    for n, f in enumerate(o.images):
        cells, mask, (ox, oy) = dotify(f, o.period, o.uniform)
        palette, art = quantize(cells, mask, o.colors)
        if o.head_px:
            # 原画の画素で測った頭 (全ランク同じ位置に描かれた原画向け) を、この絵の升目に換算
            hx, top, chin = (float(v) for v in o.head_px.split(","))
            head = [round((hx - ox) / o.period, 2), round((top - oy) / o.period, 2), round((chin - oy) / o.period, 2)]
        elif n < len(o.head): head = [float(v) for v in o.head[n].split(",")]
        else: head = skin_head(cells, mask)
        face = [int(round(head[0])), int(round((head[1] + head[2]) / 2))]
        w = max(len(r) for r in art)
        art = [r.ljust(w, ".") for r in art]
        results.append({"palette": palette, "art": art, "head": head, "face": face})
        print(f"rank{n + 1}: {w}x{len(art)} colors={len(palette)} head={head} face={face}")
    if o.preview: preview(results, o.preview)
    if o.apply: apply(o.job, results)


if __name__ == "__main__":
    main()

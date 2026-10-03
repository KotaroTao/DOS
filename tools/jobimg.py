#!/usr/bin/env python3
# 職業キャラの原画 (ユーザー提供の画像) を、ドット化せずにゲームで使える形へ整える開発用ツール。
# 加工は「背景抜き・トリミング・縮小」だけ (絵そのものには手を入れない)。
#
#   python3 tools/jobimg.py <job> <rank1.jpg> ... <rank5.jpg> [--per-dot 14] [--face x,y ...] [--preview out.png]
#
# 出力: art/jobs/<job>_<rank>.webp (透明背景・WebP) と、src/jobphotos.js の <job> 項目 (自動で書き換え)。
# 要 Pillow (pip install pillow numpy)。
#
# 寸法の考え方: ゲーム内の配置はこれまでの「ドット絵の升目」(1ドット) を単位に組まれている
# (全職共通の枠 IMG_BOX・顔の位置 face・胸像の切り出し BUST_FIT)。原画の画素で --per-dot px を
# 1ドットと見なし、絵の大きさを「何ドット分か」で記録する。画像は 1ドット = RES px に縮めて保存
# (RES=4: 大きな額でも端末の画素密度3倍まで粗く見えない解像度)。
import sys, os, re, json, argparse
from collections import deque
import numpy as np
from PIL import Image

RES = 4  # 保存する画像の 1ドットあたりの px
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def background_mask(a, white_min=200, white_spread=40, enclosed=600):
    """縁から繋がる白っぽい画素を背景とする。輪郭線の内側に閉じた白は大きい塊だけ背景扱い
    (白い布のハイライトは残す)。"""
    h, w, _ = a.shape
    mn = a.min(axis=2)
    spread = a.max(axis=2) - mn
    near = (mn > white_min) & (spread < white_spread)
    bg = np.zeros((h, w), bool)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # 閉じた白: 純白に近い大きな塊 (腕と胴の隙間など) だけ
    pure = (mn > 236) & (spread < 16) & ~bg
    seen = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.where(pure)):
        if seen[y0, x0]:
            continue
        comp = [(y0, x0)]; seen[y0, x0] = True; q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and pure[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; comp.append((ny, nx)); q.append((ny, nx))
        if len(comp) >= enclosed:
            ys, xs = zip(*comp)
            bg[list(ys), list(xs)] = True
    return bg


def cut_out(path):
    """背景を抜いた RGBA と、絵のある範囲 (bbox) を返す"""
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    bg = background_mask(a)
    # JPEG の白いにじみ: 背景に接する明るい縁を1px削る
    fg = ~bg
    edge = fg.copy()
    edge[1:, :] &= fg[:-1, :]; edge[:-1, :] &= fg[1:, :]
    edge[:, 1:] &= fg[:, :-1]; edge[:, :-1] &= fg[:, 1:]
    light = a.min(axis=2) > 170
    fg = np.where(light & ~edge, False, fg)
    alpha = (fg * 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    ys = np.where(fg.any(axis=1))[0]; xs = np.where(fg.any(axis=0))[0]
    return Image.fromarray(rgba, "RGBA"), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


def build(job, paths, per_dot, faces, preview):
    out_dir = os.path.join(ROOT, "art", "jobs")
    os.makedirs(out_dir, exist_ok=True)
    entries = {}
    previews = []
    for r, path in enumerate(paths, 1):
        im, (x0, y0, x1, y1) = cut_out(path)
        im = im.crop((x0, y0, x1, y1))
        # ドット数 (升目の数) に切り上げ、余りは右・下に透明を足す
        wd = int(np.ceil(im.width / per_dot))
        hd = int(np.ceil(im.height / per_dot))
        k = RES / per_dot
        small = im.convert("RGBa").resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert("RGBA")
        canvas = Image.new("RGBA", (wd * RES, hd * RES), (0, 0, 0, 0))
        canvas.paste(small, (0, 0))
        name = f"{job}_{r}.webp"
        canvas.save(os.path.join(out_dir, name), "WEBP", quality=90, method=6)
        face = faces[r - 1] if faces else [wd // 2, hd // 4]
        entries[r] = {"src": f"art/jobs/{name}", "w": wd, "h": hd, "face": face}
        previews.append(canvas)
        kb = os.path.getsize(os.path.join(out_dir, name)) / 1024
        print(f"{job} R{r}: {wd}x{hd} ドット / {canvas.width}x{canvas.height}px / {kb:.0f}KB / face {face}")
    write_manifest(job, entries)
    if preview:
        S = 2
        W = sum(p.width * S for p in previews) + 12 * len(previews)
        H = max(p.height * S for p in previews)
        sheet = Image.new("RGB", (W, H), (36, 34, 40))
        x = 0
        for p, e in zip(previews, entries.values()):
            big = p.resize((p.width * S, p.height * S), Image.NEAREST)
            sheet.paste(big, (x, H - big.height), big)
            fx, fy = e["face"]
            from PIL import ImageDraw
            d = ImageDraw.Draw(sheet)
            cx, cy = x + fx * RES * S, H - big.height + fy * RES * S
            d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), outline=(0, 255, 0), width=2)
            x += big.width + 12
        sheet.save(preview)
        print("preview:", preview)


def write_manifest(job, entries):
    path = os.path.join(ROOT, "src", "jobphotos.js")
    src = open(path, encoding="utf-8").read()
    body = f"  {job}: {{\n" + "".join(
        f"    {r}: {{ src: {json.dumps(e['src'])}, w: {e['w']}, h: {e['h']}, face: [{e['face'][0]}, {e['face'][1]}] }},\n"
        for r, e in entries.items()) + "  },\n"
    pat = re.compile(r"^  " + re.escape(job) + r": \{\n(?:    .*\n)*?  \},\n", re.M)
    if pat.search(src):
        src = pat.sub(lambda m: body, src)
    else:
        src = src.replace("  // <<JOB_PHOTOS>>\n", body + "  // <<JOB_PHOTOS>>\n")
    open(path, "w", encoding="utf-8").write(src)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("job")
    ap.add_argument("images", nargs="+")
    ap.add_argument("--per-dot", type=float, default=14, help="原画の何 px を1ドットと見なすか")
    ap.add_argument("--face", nargs="*", help="ランクごとの顔の中心 (ドット座標) x,y")
    ap.add_argument("--preview")
    o = ap.parse_args()
    faces = [list(map(int, f.split(","))) for f in o.face] if o.face else None
    build(o.job, o.images, o.per_dot, faces, o.preview)

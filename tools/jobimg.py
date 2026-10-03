#!/usr/bin/env python3
# 職業キャラの原画 (ユーザー提供の画像) を、ドット化せずにゲームで使える形へ整える開発用ツール。
# 加工は「軽いにじみ取り・背景抜き・トリミング・縮小」だけ (ドット化・減色はしない)。
#
#   python3 tools/jobimg.py <job> <rank1.jpg> ... <rank5.jpg> --head left,right,eye ... [--per-dot 14] [--preview out.png]
#
# 出力: art/jobs/<job>_<rank>.webp (透明背景・WebP) と、src/jobphotos.js の <job> 項目 (自動で書き換え)。
# 要 Pillow (pip install pillow numpy)。
#
# ── 顔アイコン (胸像) の大きさを全職で揃える基準 ──
# --head はランクごとの「顔の左の輪郭x・右の輪郭x・瞳の中心y」(原画の画素座標)。左右は目とあごの中ほどの高さで、
# 頬の輪郭 (肌の端) を読む。耳・髪は含めない。瞳の中心 = 目の暗い塊 (まつげ〜下まぶた) の上下の真ん中。
# 胸像は「顔の幅」が額の中で常に同じ長さ・瞳が同じ高さに来るよう切り出す (souls.js jobBust)。
# 髪型・兜・フードに左右されない顔そのものの寸法なので、描かれた縮尺が職ごとに違っても顔の大きさが揃う
# (「瞳〜あご先」の長さは顔立ちで比が違い、揃えても見た目の大きさが揃わなかったので使わない)。
# --head を省くと肌色から推し量った値を使う (傷や化粧・影で途切れてずれやすいので、必ず --preview の
# 胸像の検査欄で、全ランクの瞳が水色の線に、頬の輪郭が2本の縦線に乗っているかを見て、ずれていれば --head で直す)。
#
# 寸法の考え方: ゲーム内の配置はこれまでの「ドット絵の升目」(1ドット) を単位に組まれている
# (全職共通の枠 IMG_BOX・顔の位置 face・胸像 head)。原画の画素で --per-dot px を
# 1ドットと見なし、絵の大きさを「何ドット分か」で記録する。画像は 1ドット = RES px に縮めて保存
# (RES=4: 大きな額でも端末の画素密度3倍まで粗く見えない解像度)。
import sys, os, re, json, argparse
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RES = 4  # 保存する画像の 1ドットあたりの px
# 胸像の基準 (souls.js の BUST / BUST_FACE_W / BUST_EYE と同じ値にする)
BUST, BUST_FACE_W, BUST_EYE = 36, 10.2, 13.6
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
    # 閉じた白: 輪郭線に囲まれた背景 (腕と胴の隙間・髪の房のあいだ・剣と腕のあいだなど)。
    # 「ほぼ純白」で「周りの過半が黒い輪郭線」の塊は背景。周りが肌・灰・布の白 (瞳の光・刀身・鎧の光沢) は残す
    cand = (mn > 215) & (spread < 40) & ~bg
    pure = (mn > 236) & (spread < 16)
    dark = a.sum(axis=2) < 250
    seen = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.where(cand)):
        if seen[y0, x0]:
            continue
        comp = [(y0, x0)]; seen[y0, x0] = True; q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; comp.append((ny, nx)); q.append((ny, nx))
        if len(comp) < 12:
            continue
        ys, xs = map(np.array, zip(*comp))
        if pure[ys, xs].mean() < 0.7 and len(comp) < enclosed:
            continue
        # 塊の外側 3px の輪
        ya, yb, xa, xb = max(ys.min() - 3, 0), min(ys.max() + 4, h), max(xs.min() - 3, 0), min(xs.max() + 4, w)
        m = np.zeros((yb - ya, xb - xa), bool); m[ys - ya, xs - xa] = True
        d = m.copy()
        for _ in range(3):
            e = d.copy(); e[1:] |= d[:-1]; e[:-1] |= d[1:]; e[:, 1:] |= d[:, :-1]; e[:, :-1] |= d[:, 1:]; d = e
        ring = d & ~m & ~cand[ya:yb, xa:xb]
        if not ring.any():
            continue
        dark_ring = dark[ya:yb, xa:xb][ring].mean()
        if (pure[ys, xs].mean() >= 0.7 and dark_ring >= 0.55) or (len(comp) >= enclosed and pure[ys, xs].mean() >= 0.85):
            bg[ys, xs] = True
    return bg


def cut_out(path):
    """背景を抜いた RGBA と、絵のある範囲 (bbox) を返す"""
    # 原画の一部修正: JPEG のブロックノイズ・色のにじみを 3×3 の中央値で均す (ドットの角は崩れない)
    a = np.asarray(Image.open(path).convert("RGB").filter(ImageFilter.MedianFilter(3))).astype(int)
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


def guess_head(rgba):
    """肌色の塊から 顔の左x・右x・瞳y を推し量る (下書き。--head で必ず確かめる)"""
    a = np.asarray(rgba).astype(int)
    R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (A > 0) & (R > 200) & (G > 140) & (G < 225) & (B > 100) & (B < 195) & (R - B > 40) & (R - G > 15)
    skin[int(a.shape[0] * 0.5):] = False
    ys, xs = np.where(skin)
    if not len(ys): return [a.shape[1] * 0.4, a.shape[1] * 0.6, a.shape[0] * 0.2]
    rows, cnt = np.unique(ys, return_counts=True)
    chin = rows[cnt >= 0.3 * cnt.max()].max() + 1
    top = rows.min()
    mid = int(top + (chin - top) * 0.7)
    run = np.where(skin[mid])[0]
    return [float(run.min()), float(run.max() + 1), float(top + (chin - top) * 0.45)]


def bust_crop(e):
    """souls.js jobBust と同じ切り出し (升目単位の正方形 x0, y0, S)"""
    cx, eye, fw = e["head"]
    S = BUST * fw / BUST_FACE_W
    return cx - S / 2, eye - BUST_EYE * S / BUST, S


def build(job, paths, per_dot, heads, preview):
    out_dir = os.path.join(ROOT, "art", "jobs")
    os.makedirs(out_dir, exist_ok=True)
    entries = {}
    previews = []
    for r, path in enumerate(paths, 1):
        im, (x0, y0, x1, y1) = cut_out(path)
        head_px = heads[r - 1] if heads and r - 1 < len(heads) else None
        guessed = head_px is None
        if guessed: head_px = guess_head(im)
        l, r_, eye = head_px
        head_px = [(l + r_) / 2 - x0, eye - y0, r_ - l]  # 原画の座標 → 切り抜いた絵の座標の [中心x, 瞳y, 幅]
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
        head = [round(v / per_dot, 2) for v in head_px]
        face = [round(head[0]), round(head[1])]
        entries[r] = {"src": f"art/jobs/{name}", "w": wd, "h": hd, "face": face, "head": head}
        previews.append(canvas)
        kb = os.path.getsize(os.path.join(out_dir, name)) / 1024
        note = " ※推定値: --preview で確かめること" if guessed else ""
        print(f"{job} R{r}: {wd}x{hd} ドット / {canvas.width}x{canvas.height}px / {kb:.0f}KB / head {[float(v) for v in head]}{note}")
    write_manifest(job, entries)
    if preview:
        S = 2
        # 上段: 全身像 (緑の丸 = face)。下段: 胸像の検査欄 (水色 = 瞳の線、桃色 = 頬の輪郭の線。全ランク同じ位置に乗るはず)
        W = sum(p.width * S for p in previews) + 12 * len(previews)
        H = max(p.height * S for p in previews)
        BP = 144
        sheet = Image.new("RGB", (max(W, (BP + 12) * len(previews)), H + BP + 12), (36, 34, 40))
        d = ImageDraw.Draw(sheet)
        x = 0
        for p, e in zip(previews, entries.values()):
            big = p.resize((p.width * S, p.height * S), Image.NEAREST)
            sheet.paste(big, (x, H - big.height), big)
            fx, fy = e["face"]
            cx, cy = x + fx * RES * S, H - big.height + fy * RES * S
            d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), outline=(0, 255, 0), width=2)
            x += big.width + 12
        for i, (p, e) in enumerate(zip(previews, entries.values())):
            bx, by, bs = bust_crop(e)
            crop = p.crop(tuple(round(v * RES) for v in (bx, by, bx + bs, by + bs))).resize((BP, BP), Image.LANCZOS)
            ox, oy = i * (BP + 12), H + 12
            sheet.paste((54, 52, 60), (ox, oy, ox + BP, oy + BP))
            sheet.paste(crop, (ox, oy), crop)
            yy = oy + BUST_EYE / BUST * BP
            d.line((ox, yy, ox + BP, yy), fill=(0, 220, 255), width=1)
            for v in (-BUST_FACE_W / 2, BUST_FACE_W / 2):
                xx = ox + BP / 2 + v / BUST * BP
                d.line((xx, oy, xx, oy + BP), fill=(255, 0, 220), width=1)
        sheet.save(preview)
        print("preview:", preview)


def write_manifest(job, entries):
    path = os.path.join(ROOT, "src", "jobphotos.js")
    src = open(path, encoding="utf-8").read()
    body = f"  {job}: {{\n" + "".join(
        f"    {r}: {{ src: {json.dumps(e['src'])}, w: {e['w']}, h: {e['h']}, face: [{e['face'][0]}, {e['face'][1]}], head: [{', '.join(str(v) for v in e['head'])}] }},\n"
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
    ap.add_argument("--head", nargs="*", help="ランクごとの 顔の左x,右x,瞳の中心y (原画の画素座標)")
    ap.add_argument("--preview")
    o = ap.parse_args()
    heads = [list(map(float, f.split(","))) for f in o.head] if o.head else None
    build(o.job, o.images, o.per_dot, heads, o.preview)

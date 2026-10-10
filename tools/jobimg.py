#!/usr/bin/env python3
# 職業キャラの原画 (ユーザー提供の画像) を、ドット化せずにゲームで使える形へ整える開発用ツール。
# 加工は「軽いにじみ取り・背景抜き・トリミング・縮小」だけ (ドット化・減色はしない)。
#
#   python3 tools/jobimg.py <job> <rank1.jpg> ... <rank5.jpg> --head left,right,top,chin ... [--per-dot 14[,14,…]] [--preview out.png]
#
# 出力: art/jobs/<job>_<rank>.webp (透明背景・WebP) と、src/jobphotos.js の <job> 項目 (自動で書き換え)。
# 要 Pillow (pip install pillow numpy)。
#
# ── 顔アイコン (胸像) の大きさを全職で揃える基準 ──
# --head はランクごとの「顔の左の輪郭x・右の輪郭x・頭頂y・あご先y」(原画の画素座標)。
#   左右 = 目とあごの中ほどの高さの頬の輪郭 (肌の端。耳・髪は含めない)。この真ん中が胸像の中心になる。
#   頭頂 = 髪の塊の上端 (跳ね毛・アホ毛・角や飾りの先は含めない。とげとげの髪は先と付け根のあいだ)。
#   あご先 = 顔の肌のいちばん下。
# 胸像は「頭の高さ (頭頂〜あご先)」が額の中で常に同じ長さ・頭頂が同じ高さに来るよう切り出す (souls.js jobBust)。
# 描かれた縮尺が職ごとに違っても頭の大きさが揃う。「瞳〜あご」(顔立ちで比が違う) と「顔の幅」(髪が頬に
# 掛かると狭く測れる) は、揃えても見た目の大きさが揃わなかったので使わない。
# --head を省くと肌色と輪郭から推し量った値を使う (跳ね毛や髪の掛かり方でずれやすいので、必ず --preview の
# 胸像の検査欄で、全ランクの頭頂とあご先が2本の案内線に乗っているかを見て、ずれていれば --head で直す)。
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
# 胸像の基準 (souls.js の BUST / BUST_HEAD / BUST_TOP と同じ値にする)
BUST, BUST_HEAD, BUST_TOP = 36, 20.5, 1
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


def cut_out(path, alpha_floor=1):
    """背景を抜いた RGBA と、絵のある範囲 (bbox) を返す"""
    original = Image.open(path)
    if "A" in original.getbands() or "transparency" in original.info:
        rgba = original.convert("RGBA")
        alpha = rgba.getchannel("A")
        if alpha.getextrema()[0] < 255:
            # 透明な原画は白背景の除去に通さず、元の輪郭と透過を保つ。
            # 生成時のほぼ不可視な外周だけを除き、枠が広がるのを防ぐ。
            alpha = alpha.point(lambda v: 0 if v <= alpha_floor else v)
            rgba.putalpha(alpha)
            bbox = alpha.getbbox()
            if bbox is None:
                raise ValueError(f"人物が見つからない透明画像: {path}")
            return rgba, bbox
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
    """肌色の塊と輪郭から 顔の左x・右x・頭頂y・あご先y を推し量る (下書き。--head で必ず確かめる)"""
    a = np.asarray(rgba).astype(int)
    R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (A > 0) & (R > 200) & (G > 140) & (G < 225) & (B > 100) & (B < 195) & (R - B > 40) & (R - G > 15)
    skin[int(a.shape[0] * 0.5):] = False
    ys, xs = np.where(skin)
    if not len(ys): return [a.shape[1] * 0.4, a.shape[1] * 0.6, a.shape[0] * 0.05, a.shape[0] * 0.3]
    rows, cnt = np.unique(ys, return_counts=True)
    chin = rows[cnt >= 0.3 * cnt.max()].max() + 1
    top = rows.min()
    mid = int(top + (chin - top) * 0.7)
    run = np.where(skin[mid])[0]
    l, r = float(run.min()), float(run.max() + 1)
    cx = int((l + r) / 2)
    tops = [int(np.argmax(A[:, x] > 0)) for x in range(max(0, cx - 100), min(a.shape[1], cx + 101))]
    return [l, r, float(np.percentile(tops, 70)), float(chin)]


def bust_crop(e):
    """souls.js jobBust と同じ切り出し (升目単位の正方形 x0, y0, S)"""
    cx, top, chin = e["head"]
    S = BUST * (chin - top) / BUST_HEAD
    return cx - S / 2, top - BUST_TOP * S / BUST, S


# 全身像の最大の大きさ (升目): 顔の中心から左右 CLIP_HALF_W・高さ CLIP_H まで。全職共通の枠 IMG_BOX
# (souls.js) はいちばん大きな絵に合わせて広がり、全職の全身像が縮むので、背景の魔法陣・炎のような
# 大きな飾りはこの外を切り、切り口は CLIP_FADE 升目かけて透明へぼかす (キャラの体は通常この内に収まる)。
# 背景の飾りが大きい絵は、原画の中でキャラが小さく描かれている。--per-dot をランクごとに変えて
# 「頭頂〜足裏」を他のランクと同じ升目数にする (例: 14,14,14,12.1,11.2)
CLIP_HALF_W, CLIP_H, CLIP_FADE = 45, 88, 5


def build(job, paths, per_dots, heads, preview, frame=None, frame_top=None, alpha_floor=1, asset_suffix=""):
    out_dir = os.path.join(ROOT, "art", "jobs")
    os.makedirs(out_dir, exist_ok=True)
    entries = {}
    previews = []
    for r, path in enumerate(paths, 1):
        per_dot = per_dots[min(r - 1, len(per_dots) - 1)]
        im, (x0, y0, x1, y1) = cut_out(path, alpha_floor)
        head_px = heads[r - 1] if heads and r - 1 < len(heads) else None
        guessed = head_px is None
        if guessed: head_px = guess_head(im)
        l, r_, top, chin = head_px[:4]
        sole = head_px[4] if len(head_px) > 4 else None
        # 大きすぎる絵は枠に収める (顔の中心から左右・足元から上)。足裏 sole を指定すると、
        # その下 (足元の渦・魔法陣) も切る
        cxs = (l + r_) / 2
        cx0, cx1 = max(x0, int(cxs - CLIP_HALF_W * per_dot)), min(x1, int(np.ceil(cxs + CLIP_HALF_W * per_dot)))
        cy1 = min(y1, int(sole + 2 * per_dot)) if sole else y1
        clip_h = frame[1] if frame and frame_top is not None else CLIP_H
        cy0 = max(y0, int(cy1 - clip_h * per_dot))
        clipped = (cx0 > x0, cx1 < x1, cy0 > y0, cy1 < y1)
        x0, x1, y0, y1 = cx0, cx1, cy0, cy1
        head_px = [cxs - x0, top - y0, chin - y0]  # 原画の座標 → 切り抜いた絵の座標の [中心x, 頭頂y, あご先y]
        im = im.crop((x0, y0, x1, y1))
        if any(clipped):
            a = np.asarray(im).copy()
            h, w = a.shape[:2]
            f = CLIP_FADE * per_dot
            ramp = np.ones((h, w))
            xs, ys = np.arange(w)[None, :], np.arange(h)[:, None]
            if clipped[0]: ramp = np.minimum(ramp, np.clip(xs / f, 0, 1))
            if clipped[1]: ramp = np.minimum(ramp, np.clip((w - 1 - xs) / f, 0, 1))
            if clipped[2]: ramp = np.minimum(ramp, np.clip(ys / f, 0, 1))
            if clipped[3]: ramp = np.minimum(ramp, np.clip((h - 1 - ys) / (2 * per_dot), 0, 1))
            a[..., 3] = (a[..., 3] * ramp).astype(np.uint8)
            im = Image.fromarray(a, "RGBA")
            # ぼかしで消えた外周を詰める
            bb = im.getbbox()
            if bb:
                im = im.crop(bb)
                head_px = [head_px[0] - bb[0], head_px[1] - bb[1], head_px[2] - bb[1]]
        # ドット数 (升目の数) に切り上げ、余りは右・下に透明を足す
        wd = int(np.ceil(im.width / per_dot))
        hd = int(np.ceil(im.height / per_dot))
        k = RES / per_dot
        small = im.convert("RGBa").resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert("RGBA")
        canvas = Image.new("RGBA", (wd * RES, hd * RES), (0, 0, 0, 0))
        canvas.paste(small, (0, 0))
        name = f"{job}_{r}{('-' + asset_suffix) if asset_suffix else ''}.webp"
        head = [round(v / per_dot, 3 if frame else 2) for v in head_px]
        face = [round(head[0]), round((head[1] + head[2]) / 2)]
        if frame:
            # ランク間で人物の倍率を変えず、顔の列と足元を共通の透明枠へ揃える。
            fw, fh = frame
            ox, oy = fw / 2 - head[0], fh - hd
            if frame_top is not None:
                # ポニーテールなど頭頂より上の飾りがあっても、人体の頭頂を共通位置へ合わせる。
                oy = frame_top - head[1]
            bbox = canvas.getbbox()
            if bbox and (bbox[0] + ox * RES < 0 or bbox[2] + ox * RES > fw * RES
                         or bbox[1] + oy * RES < 0 or bbox[3] + oy * RES > fh * RES):
                raise ValueError(f"{job} R{r}: 指定した共通枠では人物が欠けます")
            canvas = canvas.transform((fw * RES, fh * RES), Image.Transform.AFFINE,
                                      (1, 0, -ox * RES, 0, 1, -oy * RES), Image.Resampling.BICUBIC)
            wd, hd = fw, fh
            head = [fw / 2, round(head[1] + oy, 3), round(head[2] + oy, 3)]
            face = [round(head[0]), round((head[1] + head[2]) / 2)]
        canvas.save(os.path.join(out_dir, name), "WEBP", quality=90, method=6)
        entries[r] = {"src": f"art/jobs/{name}", "w": wd, "h": hd, "face": face, "head": head}
        previews.append(canvas)
        kb = os.path.getsize(os.path.join(out_dir, name)) / 1024
        note = " ※推定値: --preview で確かめること" if guessed else ""
        print(f"{job} R{r}: 1ドット={per_dot}px{' (枠外を切った)' if any(clipped) else ''} / {wd}x{hd} ドット / {canvas.width}x{canvas.height}px / {kb:.0f}KB / head {[float(v) for v in head]}{note}")
    write_manifest(job, entries)
    if preview:
        S = 2
        # 上段: 全身像 (緑の丸 = face)。下段: 胸像の検査欄 (水色 = 頭頂の線、桃色 = あご先の線、緑 = 顔の中心。全ランク同じ位置に乗るはず)
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
            for v in (BUST_TOP, BUST_TOP + BUST_HEAD):
                yy = oy + v / BUST * BP
                d.line((ox, yy, ox + BP, yy), fill=(0, 220, 255) if v == BUST_TOP else (255, 0, 220), width=1)
            d.line((ox + BP / 2, oy, ox + BP / 2, oy + BP), fill=(0, 255, 0), width=1)
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
    ap.add_argument("--per-dot", default="14", help="原画の何 px を1ドットと見なすか。ランクごとに変える時は 14,14,14,9.4,7 のようにカンマ区切り "
                    "(キャラが小さく描かれたランクは、頭頂〜足裏の長さの比で小さくして全ランクの背丈を揃える。胸像は head で別に揃うので頭の大きさは気にしなくてよい)")
    ap.add_argument("--head", nargs="*", help="ランクごとの 顔の左x,右x,頭頂y,あご先y[,足裏y] (原画の画素座標)。足裏を付けると、その下の飾りを切る")
    ap.add_argument("--preview")
    ap.add_argument("--alpha-floor", type=int, choices=range(0, 256), default=1,
                    help="透明原画の外周に残る、この値以下のアルファを除去する (既定1)")
    ap.add_argument("--frame", help="共通の透明枠の幅,高さ (ドット単位)。人物は縮めず顔の列と足元を揃える")
    ap.add_argument("--frame-top", type=float, help="共通枠で人体の頭頂を置く高さ (ドット単位)。--frame と --head が必要")
    ap.add_argument("--asset-suffix", default="", help="画像の更新時に古いキャッシュと区別するファイル名の接尾辞")
    o = ap.parse_args()
    if o.asset_suffix and not re.fullmatch(r"[a-zA-Z0-9_-]+", o.asset_suffix):
        ap.error("--asset-suffix は英数字・ハイフン・アンダースコアで指定してください")
    heads = [list(map(float, f.split(","))) for f in o.head] if o.head else None
    frame = tuple(map(int, o.frame.split(","))) if o.frame else None
    if frame and (len(frame) != 2 or min(frame) <= 0):
        ap.error("--frame は正の幅,高さを指定してください")
    if o.frame_top is not None and (not frame or not heads or not np.isfinite(o.frame_top)
                                    or not 0 <= o.frame_top < frame[1] or len(heads) != len(o.images)):
        ap.error("--frame-top は --frame と全画像の --head、枠内の有限な高さが必要です")
    build(o.job, o.images, [float(v) for v in o.per_dot.split(",")], heads, o.preview, frame, o.frame_top, o.alpha_floor, o.asset_suffix)

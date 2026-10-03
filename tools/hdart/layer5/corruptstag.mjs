import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_corruptstag", key: "hd_corruptstag", w: 96, h: 96,
  note: "角の魔獣: 霧の瘴気に呑まれて変じた大鹿。捻れ尖った巨大な枝角、肋の浮いた痩せた体、赤く光る眼と瘴気を吐く口。前脚を跳ね上げて疾駆し、背後に残像と速度の筋を引く" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030303", "#0b0908", "#171210", "#231c17", "#312820", "#41352a", "#544536", "#6a5844"], 8), dither: 0.6, spec: 0.3, pow: 18,
      // 肋の浮き (胴の側面に縦の筋)
      shade: p => (p.x > 44 && p.x < 62 && p.y > 44 && p.y < 60 ? 0.16 * Math.sin(p.x * 1.5 - p.y * 0.2) : 0) + 0.06 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    antler: { ramp: ramp(["#060504", "#14110d", "#262019", "#3c3427", "#564b38", "#74664c", "#968660"], 7), spec: 0.6, pow: 22, dither: 0.45,
      shade: p => 0.1 * Math.sin((p.x + p.y) * 1.8) },
    hoof: { ramp: ramp(["#020202", "#09090a", "#141416", "#202024"], 4), spec: 0.8, pow: 30, dither: 0.4 },
    eye: { ramp: ["#5a0404", "#c01810", "#ff6a40"], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0e0306", "#1e070c"], amb: 0.1, dif: 0.2, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 痩せた胴: 張り出した胸と、えぐれた腹、尖った腰骨
  const body = U(3, ellipsoid([44, 50, 0], [10, 9.5, 8], "hide", -8), ellipsoid([58, 51, 0], [11, 7, 7], "hide", 4), ellipsoid([68, 49, 0], [7, 7.5, 7], "hide"),
    sphere([70, 44, 2], 3.2, "hide"), sphere([45, 41, 0], 3, "hide"));
  // 首と頭: 前へ突き出し、口を開けて瘴気を吐く
  const neck = tube([[44, 46, 0, 6], [36, 38, 1, 4.6], [29, 32, 2, 3.8]], "hide", { seg: 3 });
  const skull = U(1.4, ellipsoid([26, 30, 2], [5, 4.4, 4], "hide", -15), ellipsoid([18, 34, 3], [5.4, 2.6, 3], "hide", 24));
  const jaw = ellipsoid([19, 38, 3], [4.4, 1.4, 2.4], "hide", 34);
  const ears = [ellipsoid([33, 28, -1], [4.4, 1.5, 1.4], "hide", -10), ellipsoid([32, 29, 5], [4.2, 1.4, 1.3], "hide", 5)];
  const mouth = ellipsoid([17, 37, 4], [4, 1.2, 2.4], "maw", 28);
  const eyes = [ellipsoid([24, 29.3, 5.6], [1.7, 1.1, 1.2], "eye", -15), ellipsoid([24.5, 29.3, -1.2], [1.2, 0.9, 1], "eye", -15)];
  // 捻れた枝角: 主幹は後ろ上へうねり、前と上へ鋭い枝を出す
  const antler = (ox, oy, z, seed, k = 1) => {
    const Ra = rand(seed);
    const P = (x, y, zz, r) => [27 + (x - 27) * k + ox, 25 + (y - 25) * k + oy, zz, r];
    // 主幹: 頭頂から後ろ上へうねり、背の上まで伸びる
    const main = [P(27, 25, z, 2.8), P(31, 18, z, 2.4), P(27, 12, z - 1, 2.1), P(33, 7, z - 2, 1.8), P(44, 6.5, z - 3, 1.5), P(54, 9, z - 4, 1.1), P(63, 8, z - 5, 0.4)];
    const w = main.map(([x, y, zz, r], i) => [x + Math.sin(i * 2.3) * 1.2, y + Math.cos(i * 1.7) * 0.6, zz, r]);
    const parts = [tube(w, "antler", { seg: 3 })];
    // 枝: 前へ鋭く突き出す枝と、上へ反る枝。途中で捻れて先は針のよう
    const tines = [[1, -13, -4], [2, -13, -4], [2, -5, -8], [3, -2, -5], [4, 2, -5], [5, 3, -6], [5, 7, 4]];
    for (const [i, dx, dy] of tines) {
      const [x, y, zz, r] = w[i];
      const m = [x + dx * 0.45 + (Ra() - 0.5) * 2, y + dy * 0.55 + (Ra() - 0.5), zz + 1, r * 0.7];
      parts.push(tube([[x, y, zz, r * 0.9], m, [x + dx * k, y + dy * k, zz + 1, 0.3]], "antler", { seg: 2 }));
    }
    return U(0.6, ...parts);
  };
  // 脚: 前脚は跳ね上げて折り、後脚は後ろへ蹴り伸ばす
  const leg = (pts, hoofAt) => U(0.8, tube(pts.map(p => [...p]), "hide", { seg: 3 }), ellipsoid(hoofAt.slice(0, 3), [1.6, 2, 1.6], "hoof", hoofAt[3] || 0));
  const legs = [
    leg([[42, 55, 5, 3.8], [31, 47, 7, 2.2], [30, 54, 7, 1.5], [32, 60, 7, 1.1]], [32.5, 61.5, 7, -20]),
    leg([[46, 57, -4, 3.4], [35, 53, -4, 2], [34, 60, -4, 1.4], [36, 66, -4, 1]], [36.5, 67.5, -4, -20]),
    leg([[68, 53, 5, 4.4], [72, 63, 6, 2.6], [80, 73, 6, 1.6], [86, 83, 6, 1.1]], [87, 85, 6, -40]),
    leg([[66, 55, -4, 4], [64, 66, -4, 2.4], [70, 76, -4, 1.5], [72, 86, -4, 1.1]], [72.5, 88, -4, 0])];
  const tailT = cone([74, 46, 0], [80, 42, 0], 1.6, 0.6, "hide");
  // ぼさぼさに逆立つ首の毛
  const ruff = []; for (let i = 0; i < 6; i++) { const t = i / 5; ruff.push(cone([42 - t * 10, 44 - t * 8, 2], [46 - t * 9, 49 - t * 6, 4], 2.4, 0.4, "hide")); }
  const beast = Disp(U(1.6, body, neck, skull, jaw, ...ears, ...legs, tailT, ...ruff), (x, y, z) => 0.3 * fbm(x * 0.6, y * 0.6, z * 0.6) + 0.18 * Math.abs(Math.sin(x * 1.1 + y * 0.7)));
  const scene = U(0, forestFloor(64, 91, 32, 12, { n: 4, roots: 2, seed: 1401 }), Sub(beast, mouth, 0.4), ...eyes, antler(0, 0, 2, 1403), antler(6, 1, -6, 1407, 0.85));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 残像: 魔獣の輪郭を後ろ (右) へずらして、空いている所に薄く重ねる
  const isBeast = (x, y) => { if (x < 0 || y < 0 || x >= 96 || y >= 96) return false; const p = C.pix[y * 96 + x]; return p && ["hide", "antler", "hoof"].includes(p.m); };
  const mask = []; for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) if (isBeast(x, y)) mask.push([x, y]);
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const GH = [["#2e2230", "#4a3446"], ["#1e1820", "#30242e"]];
  [[7, 2], [14, 3]].forEach(([dx, every], gi) => {
    for (const [x, y] of mask) {
      const X = x + dx; if (X >= 96 || C.get(X, y)) continue;
      if (y % every !== 0) continue;
      C.set(X, y, GH[gi][isBeast(x + 1, y) ? 0 : 1]);
    }
  });
  // 速度の筋: 胴と脚の後ろへ横に流れる線
  const SL = ["#3a2a34", "#5a4050", "#7a5a6a"];
  const Rs = rand(1409);
  for (let i = 0; i < 9; i++) {
    const y = 20 + Math.floor(Rs() * 62);
    let x0 = -1; for (let x = 95; x >= 0; x--) if (isBeast(x, y)) { x0 = x; break; }
    if (x0 < 0) continue;
    const s = x0 + 3 + Math.floor(Rs() * 6), l = 6 + Math.floor(Rs() * 12);
    for (let k = 0; k < l; k++) { const X = s + k; if (X < 96 && !C.get(X, y)) C.set(X, y, SL[k < 2 ? 2 : k < l * 0.5 ? 1 : 0]); }
  }
  // 口から吐く瘴気: 後ろへたなびく紫緑のもや
  const MI = ["#24182e", "#3a2648", "#583a62", "#7a5a78"];
  for (let y = 30; y < 58; y++) for (let x = 2; x < 50; x++) {
    if (C.get(x, y)) continue;
    const t = (x - 6) / 40, yc = 41 + t * 12 + Math.sin(x * 0.25) * 2.5 - Math.max(0, 0.25 - t) * 8, th = 2.5 + Math.max(0, t) * 6 + Math.max(0, 0.2 - t) * 14;
    const d = Math.abs(y - yc) / th; if (d > 1 || x < 6) continue;
    const a = (1 - d) * (1 - Math.abs(t - 0.15) * 1.0) * (0.7 + 0.7 * fbm(x * 0.15, y * 0.25, 7));
    if (a > (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, MI[Math.max(0, Math.min(3, Math.floor(a * 4)))]);
  }
  // 牙のような歯
  C.set(15, 36, "#7a6a50"); C.set(17, 36, "#7a6a50");
  leaves(C, 1411, 64, 90, 28, 14);
  return C.toArt();
}

import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves, bark } from "../forest.mjs";
export const meta = { id: "bs_forestlord", key: "hd_forestlord", w: 112, h: 128,
  note: "霧の森の主 (層ボス): 霧そのものが森の意思を得て宿った巨大な古木。幹に刻まれた威厳ある老人の顔は深い眼窩の奥に緑の燐光を灯し、苔の髭を垂らす。枝は王冠のように頭上へ広がり、両腕の太枝を広げて霧の渦と緑に光る呪文の輪をめぐらせる。足元からは絞め蔦が何本も這い出す" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    bark: { ramp: ramp(["#020302", "#080906", "#10110c", "#191a13", "#23241b", "#2f3024", "#3d3e30", "#4e4f3e", "#62624e"], 9), dither: 0.5, spec: 0.25, pow: 14,
      shade: p => 0.16 * Math.sin(p.x * 1.15 + 2.4 * fbm(p.x * 0.12, p.y * 0.05, p.z * 0.12)) + 0.07 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    vine: { ramp: ramp(["#020301", "#081207", "#10200c", "#1a3214", "#26441b", "#365a24", "#4a7230"], 7), spec: 0.6, pow: 20, dither: 0.5 },
    eye: { ramp: ["#0e3010", "#2a7a20", "#6ad040", "#c8ff90", "#f4ffe0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    rune: { ramp: ["#163a14", "#2e7424", "#5ab83c", "#a8f070"], emit: p => 0.45 + 0.4 * Math.max(0, p.nz) + 0.15 * vnoise(p.x * 0.5, p.z * 0.5) },
    hole: { ramp: ["#000000", "#000000", "#020402"], amb: 0, dif: 0.1, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const R = rand(5101);
  // 幹: 根元で大きく張り出し、上へ細る。頭頂で枝の王冠へ分かれる
  const trunk = U(6, cone([56, 116, -4], [56, 34, -2], 22, 12, "bark"), ellipsoid([56, 52, -3], [22, 12, 15], "bark"));
  const flare = [];
  for (const [dx, dz, s] of [[-1, 4, 1], [1, 4, 1], [-0.6, -6, 0.8], [0.6, -6, 0.8], [0, 10, 0.7]]) {
    flare.push(tube([[56 + dx * 10, 96, dz * 0.4, 9 * s], [56 + dx * 22, 112, dz, 6 * s], [56 + dx * 30, 120, dz * 1.4, 3 * s]], "bark", { seg: 3 }));
  }
  // 胸の高さで左右に広げた太い腕の枝 (やや持ち上げて呪を編む)
  const armL = tube([[46, 52, 0, 8], [30, 46, 4, 6.4], [16, 38, 6, 4.6], [7, 28, 6, 3]], "bark", { seg: 4 });
  const armR = tube([[66, 52, 0, 8], [82, 46, 4, 6.4], [96, 38, 6, 4.6], [105, 28, 6, 3]], "bark", { seg: 4 });
  const handL = fingers([7, 28, 6], -105, "bark", { n: 4, len: 9, spread: 34, r: 1.4, curl: -0.4, z: 2 });
  const handR = fingers([105, 28, 6], -75, "bark", { n: 4, len: 9, spread: 34, r: 1.4, curl: 0.4, z: 2 });
  const twigs = [tube([[24, 44, 5, 2.4], [20, 52, 8, 1.4], [16, 56, 9, 0.6]], "bark"), tube([[88, 44, 5, 2.4], [92, 52, 8, 1.4], [96, 56, 9, 0.6]], "bark"),
    tube([[34, 46, 4, 2], [32, 38, 6, 1.2], [34, 32, 6, 0.6]], "bark"), tube([[78, 46, 4, 2], [80, 38, 6, 1.2], [78, 32, 6, 0.6]], "bark")];
  // 枝の王冠: 頭頂から放射して上へ反り、先で二股に
  const crown = [];
  for (const [a, L, r0] of [[-70, 30, 4.6], [-44, 32, 4.8], [-16, 30, 4.2], [16, 30, 4.2], [44, 32, 4.8], [70, 30, 4.6]]) {
    const ra = a * Math.PI / 180, bx = 56 + Math.sin(ra) * 6, by = 36;
    const mx = bx + Math.sin(ra) * L * 0.55, my = by - Math.cos(ra) * L * 0.55 - 2;
    const ex = bx + Math.sin(ra * 1.15) * L, ey = Math.max(3, by - Math.cos(ra * 0.8) * L - 4);
    crown.push(tube([[bx, by, -2, r0], [mx, my, -1, r0 * 0.6], [ex, ey, 0, 1.2]], "bark", { seg: 3 }));
    const fx = mx + Math.sin(ra + (a < 0 ? -0.7 : 0.7)) * 9, fy = my - Math.cos(ra + (a < 0 ? -0.7 : 0.7)) * 9;
    crown.push(tube([[mx, my, -1, r0 * 0.5], [fx, Math.max(2.5, fy), 0, 0.7]], "bark", { seg: 2 }));
  }
  // 顔: 眉の張り出し・鼻梁・頬骨・口の裂け目・深い眼窩
  const brow = [ellipsoid([48, 50, 15], [8, 3.4, 5], "bark", 14), ellipsoid([64, 50, 15], [8, 3.4, 5], "bark", -14)];
  const nose = U(1.2, cone([56, 51, 17], [56, 64, 21], 3.4, 2.6, "bark"), ellipsoid([56, 64, 19.5], [4.2, 2.6, 3], "bark"));
  const cheeks = [ellipsoid([46, 62, 14], [5, 4, 4], "bark"), ellipsoid([66, 62, 14], [5, 4, 4], "bark")];
  const lip = ellipsoid([56, 70, 17], [9, 2.4, 4], "bark");
  const sockets = U(0, ellipsoid([48.5, 55, 20], [3.8, 3, 5], "hole"), ellipsoid([63.5, 55, 20], [3.8, 3, 5], "hole"));
  const mouth = ellipsoid([56, 73.5, 18.5], [7, 2.6, 5], "hole");
  const body = Disp(U(2.2, trunk, ...flare, armL, armR, ...handL, ...handR, ...twigs, ...crown, ...brow, nose, ...cheeks, lip), bark(0.55, 1.3));
  const lord = Paint(Sub(body, U(0, sockets, mouth), 0.8),
    (x, y, z, m) => (m === "bark" && (fbm(x * 0.12 + 7, y * 0.12, z * 0.12, 3) > 0.22 || (y < 30 && fbm(x * 0.3, y * 0.3, 3) > 0.1))) ? "moss" : m);
  const eyes = [sphere([48.5, 55.5, 16.6], 1.5, "eye"), sphere([63.5, 55.5, 16.6], 1.5, "eye")];
  // 苔の長い髭と、枝から垂れる苔の房
  const beard = [];
  for (let i = 0; i < 9; i++) {
    const x = 47 + i * 2.2, L = 12 + R() * 12 - Math.abs(i - 4) * 1.5;
    beard.push(tube([[x, 73, 17, 1.6], [x + (R() - 0.5) * 3, 73 + L * 0.5, 18.5, 1.3], [x + (R() - 0.5) * 4, 73 + L, 18, 0.5]], "moss", { seg: 2 }));
  }
  const hang = [];
  for (const [x, y, L] of [[22, 44, 10], [14, 40, 8], [30, 48, 7], [90, 44, 10], [98, 40, 8], [82, 48, 7]]) hang.push(tube([[x, y, 7, 1.4], [x + 0.5, y + L * 0.6, 8, 1], [x, y + L, 8, 0.4]], "moss", { seg: 2 }));
  // 呪文の輪: 腰の高さを水平に回る燐光の二重環
  const ring1 = torus([56, 90, 0], 47, 1.1, "rune", 0, -13);
  const ring2 = torus([56, 90, 0], 41, 0.7, "rune", 0, -13);
  // 絞め蔦: 床から這い出して身をよじり、先が鉤に巻く
  const vines = [], vineTips = [];
  for (const [x0, z0, s, h] of [[20, 10, -1, 38], [34, 18, -1, 30], [80, 18, 1, 32], [94, 10, 1, 40], [10, 2, -1, 26], [104, 2, 1, 24]]) {
    const pts = [[x0, 122, z0, 2.4]];
    for (let k = 1; k <= 5; k++) pts.push([x0 + Math.sin(k * 1.4 + x0) * 5 + s * k * 0.8, 122 - h * k / 5, z0 + k * 1.2, 2.4 - k * 0.36]);
    const e = pts[pts.length - 1];
    pts.push([e[0] - s * 4, e[1] - 3, e[2] + 1, 0.5], [e[0] - s * 5, e[1] + 1, e[2] + 1.5, 0.35]);
    vines.push(tube(pts, "vine", { seg: 3 }));
    vineTips.push([e[0] - s * 5, e[1] + 1]);
  }
  // 幹の根元を絞め上げる蔦
  const wrap = [];
  for (const [y0, ph] of [[118, 0], [108, 2.2]]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) { const a = ph + k * 0.62, rr = 23.5 - (y0 - 100) * 0.05 - k * 0.45; pts.push([56 + Math.cos(a) * rr, y0 - k * 2.6, -3 + Math.sin(a) * rr * 0.9, 1.7]); }
    wrap.push(tube(pts, "vine", { seg: 3 }));
  }
  const scene = U(0, ...wrap, forestFloor(56, 122, 56, 20, { n: 8, roots: 6, seed: 5103 }), lord, ...eyes, ...beard, ...hang, ring1, ring2, ...vines);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 56, 30], r: 22, k: 0.35 }, { p: [56, 86, 36], r: 40, k: 0.25 }] });
  const C = new Canvas(r);
  // 眼の芯
  C.set(48, 55, "#f4ffe0"); C.set(63, 55, "#f4ffe0");
  // 呪文の輪に刻まれた燐光の文字 (二重環の間)
  const RU = ["#2e7424", "#5ab83c", "#a8f070"];
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2, rr = 44, x = 56 + Math.cos(a) * rr, y = 90 + Math.sin(a) * rr * Math.sin(13 * Math.PI / 180), front = Math.sin(a) > 0;
    const X = Math.round(x), Y = Math.round(y);
    if (!front && C.get(X, Y)) continue;
    const g = i % 3;
    C.set(X, Y, RU[front ? 2 : 1]);
    if (g === 0) C.set(X, Y - 1, RU[front ? 1 : 0]); else if (g === 1) C.set(X + 1, Y, RU[front ? 1 : 0]);
  }
  // 霧の渦: 古木を巻いて昇る淡い螺旋の帯 (空いた所だけ)
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let t = 0; t < 1; t += 0.0016) {
    const a = t * Math.PI * 2 * 2.3 + 0.6, rr = 50 - t * 16, y0 = 112 - t * 92;
    const x = 56 + Math.cos(a) * rr, yc = y0 + Math.sin(a) * 6;
    for (let k = -2; k <= 2; k++) {
      const X = Math.round(x), Y = Math.round(yc + k);
      if (X < 0 || X >= W || Y < 0 || Y >= H || C.get(X, Y)) continue;
      const v = (1 - Math.abs(k) / 3) * (0.55 + 0.45 * fbm(X * 0.1, Y * 0.1, 3));
      if (v * 0.5 > (BY[Y & 3][X & 3] + 0.5) / 16) C.set(X, Y, MIST[Math.min(5, 2 + (v > 0.55 ? 2 : v > 0.35 ? 1 : 0))]);
    }
  }
  mist(C, 5107, 2, [0, 4, W, 60], 0.25);
  // 指先に灯る呪の燐光
  for (const [x, y] of [[6, 12], [106, 12]]) {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (!C.get(Math.round(x + Math.cos(a) * 4.5), Math.round(y + Math.sin(a) * 4.5))) C.set(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, i % 2 ? "#2e7424" : "#5ab83c"); }
    C.disc(x, y, 2.2, "#2e7424"); C.disc(x - 0.4, y - 0.4, 1.3, "#5ab83c"); C.set(x - 1, y - 1, "#a8f070");
  }
  // 絞め蔦の棘
  const TH = ["#26441b", "#4a7230"];
  for (let y = 90; y < 122; y += 3) for (let x = 0; x < W; x++) { const p = C.pix[y * W + x]; if (p && p.m === "vine" && !C.pix[y * W + x + 1] && (x + y) % 2 === 0) { C.set(x + 1, y, TH[1]); C.set(x + 2, y - 1, TH[0]); break; } }
  // 燐光の粒
  spores(C, 5109, 40, [2, 2, W - 4, 100], true);
  leaves(C, 5111, 56, 121, 50, 30);
  return C.toArt();
}

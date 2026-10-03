import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves, bark } from "../forest.mjs";
export const meta = { id: "bs_misttreant", key: "hd_misttreant", w: 96, h: 96,
  note: "霧の古木: 根の脚で歩く苔むした古木。洞の眼と口が刻まれた太い幹から、枝の腕を左右いっぱいに広げて仲間の前に立ちはだかる。幹と枝は苔と地衣類に覆われ、枝先から霧が垂れる" };
export function build() {
  const mats = {
    bark: { ramp: ramp(["#030302", "#0a0907", "#14120e", "#1f1c16", "#2b271f", "#39342a", "#4a4436", "#5d5644"], 8), dither: 0.6,
      shade: p => 0.16 * Math.sin(p.x * 1.3 + 2.4 * fbm(p.x * 0.15, p.y * 0.12, p.z * 0.15)) + 0.06 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    lichen: { ramp: ramp(["#0e120e", "#252c22", "#3e4836", "#5a6650", "#78846a"], 5), dither: 0.6 },
    hollow: { ramp: ["#000000", "#020201", "#060504"], amb: 0.05, dif: 0.15, noRim: true },
    eye: { ramp: ["#2a3010", "#6a7a24", "#b8c860"], emit: p => 0.35 + 0.6 * Math.max(0, p.nz) },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const cx = 48;
  // 幹: 根元が太く、上で枝分かれする瘤だらけの柱
  const trunk = U(3, cone([cx, 70, 0], [cx, 44, 0], 12.5, 11.5, "bark"), cone([cx, 44, 0], [cx + 1, 14, -1], 11.5, 9, "bark"),
    ellipsoid([cx - 7, 56, 6], [4, 5, 4], "bark"), ellipsoid([cx + 7, 62, 5], [4, 5, 4], "bark"), ellipsoid([cx, 26, 3], [10, 9, 7.5], "bark"));
  // 眉の瘤と、洞の眼と口
  const brow = [ellipsoid([cx - 5, 21.5, 9], [5, 2.2, 3], "bark", 18), ellipsoid([cx + 5, 21.5, 9], [5, 2.2, 3], "bark", -18)];
  const nose = ellipsoid([cx, 28, 10.5], [2.2, 4.4, 2.8], "bark");
  const holes = U(0, ellipsoid([cx - 5.2, 25, 10], [3.4, 2.8, 3.4], "hollow", -14), ellipsoid([cx + 5.2, 25, 10], [3.4, 2.8, 3.4], "hollow", 14),
    Disp(ellipsoid([cx, 37.5, 10], [6, 4.4, 4.4], "hollow"), (x, y, z) => 0.6 * Math.sin(x * 1.4)));
  // 枝の腕: 肩から左右へ大きく張り出し、先で上下に枝分かれ
  const arm = s => {
    const X = d => cx + s * d;
    const main = [[X(8), 46, 0, 6.6], [X(20), 43, 2, 5.2], [X(32), 42, 3, 4], [X(42), 37, 2, 2.8]];
    const br = [
      tube(main, "bark", { seg: 3 }),
      tube([[X(30), 42, 3, 2.8], [X(36), 50, 4, 1.9], [X(40), 59, 3, 1], [X(43), 64, 3, 0.5]], "bark", { seg: 3 }),
      tube([[X(42), 37, 2, 2.3], [X(45), 29, 1, 1.4], [X(44), 21, 0, 0.7]], "bark", { seg: 2 }),
      tube([[X(42), 37, 2, 1.9], [X(46), 42, 3, 1.1], [X(46.5), 50, 3, 0.5]], "bark", { seg: 2 }),
      tube([[X(22), 43, 2, 2.6], [X(25), 33, 1, 1.6], [X(30), 25, 0, 0.8], [X(31), 19, 0, 0.4]], "bark", { seg: 2 }),
      tube([[X(16), 45, 2, 2.6], [X(18), 54, 4, 1.5], [X(22), 61, 4, 0.7]], "bark", { seg: 2 }),
    ];
    return U(1.2, ...br);
  };
  // 頭頂の枯れ枝の冠
  const crown = [tube([[cx - 3, 16, -1, 3], [cx - 9, 7, -3, 1.6], [cx - 14, 3, -4, 0.6]], "bark", { seg: 2 }),
    tube([[cx + 3, 16, -1, 3], [cx + 7, 6, -2, 1.6], [cx + 6, 1, -3, 0.6]], "bark", { seg: 2 }),
    tube([[cx, 15, -2, 2.4], [cx + 1, 6, -4, 1.2], [cx - 2, 1, -5, 0.5]], "bark", { seg: 2 }),
    tube([[cx + 6, 18, -1, 2], [cx + 14, 12, -3, 1], [cx + 19, 11, -4, 0.4]], "bark", { seg: 2 })];
  // 根の脚: 二股に開いて踏ん張り、先で根に分かれる
  const legs = [];
  for (const s of [-1, 1]) {
    legs.push(tube([[cx + s * 6, 64, 0, 7.4], [cx + s * 13, 76, 3, 5.4], [cx + s * 18, 87, 5, 3.6]], "bark", { seg: 3 }));
    for (const [dx, dz] of [[8, -2], [6, 7], [-1, 9]]) legs.push(tube([[cx + s * 17, 87, 5, 2.4], [cx + s * (18 + dx), 90, 5 + dz, 1.2], [cx + s * (19 + dx * 1.4), 90.5, 5 + dz * 1.3, 0.5]], "bark", { seg: 2 }));
  }
  const tree = Disp(U(2.2, trunk, ...brow, nose, arm(-1), arm(1), ...crown, ...legs), (x, y, z) => bark(0.55, 1.3)(x, y, z) * 0.8 + 0.25 * fbm(x * 0.5, y * 0.5, z * 0.5));
  // 苔 (上を向いた面) と地衣類の斑
  const crotch = Disp(cone([cx, 92, 6], [cx, 72, 6], 7, 0.5, "hollow"), (x, y, z) => 0);
  const clad = Paint(Sub(Sub(tree, holes, 0.8), crotch, 1.5), (x, y, z, m) => {
    if (m !== "bark") return m;
    const n = fbm(x * 0.22, y * 0.22, z * 0.22), l = vnoise(x * 0.6, y * 0.6, z * 0.6);
    if (l > 0.55) return "lichen";
    if (n > 0.12 + (y > 70 ? 0.1 : 0)) return "moss";
    return m;
  });
  // 苔の房 (肩と腕の上に乗る塊)
  const R = rand(1301);
  const tufts = [];
  for (const [x, y, z, r] of [[cx - 11, 42, 5, 4], [cx + 11, 42, 5, 4], [cx - 22, 39.5, 4, 3], [cx + 22, 39.5, 4, 3], [cx - 33, 39, 5, 2.4], [cx + 33, 39, 5, 2.4], [cx, 13, 4, 4]])
    tufts.push(Disp(ellipsoid([x, y, z], [r * 1.4, r * 0.8, r], "moss"), (X, Y, Z) => 0.5 * fbm(X * 0.8, Y * 0.8, Z * 0.8)));
  const eyes = [sphere([cx - 5, 26, 9], 0.9, "eye"), sphere([cx + 5, 26, 9], 0.9, "eye")];
  const scene = U(0, forestFloor(cx, 91, 44, 14, { n: 6, roots: 2, seed: 1303 }), clad, ...tufts, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 枝先から垂れる霧の滴 (細く下へ流れるディザ)
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const drip = (x0, y0, len, w, seed) => {
    for (let y = y0; y < y0 + len; y++) {
      const t = (y - y0) / len, xc = x0 + Math.sin(y * 0.3 + seed) * 1.2, ww = w * (1 - t * 0.5);
      for (let x = Math.floor(xc - ww); x <= xc + ww; x++) {
        if (C.get(x, y)) continue;
        const a = (1 - Math.abs(x - xc) / (ww + 0.5)) * (1 - t) * 0.85;
        if (a > (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, MIST[Math.min(5, 2 + Math.floor(a * 4))]);
      }
    }
  };
  for (const [x, y, l, w, s] of [[6, 52, 20, 2, 1], [90, 52, 20, 2, 2], [26, 62, 14, 1.4, 5], [70, 62, 14, 1.4, 6], [17, 20, 9, 1.2, 7], [79, 20, 9, 1.2, 8]]) drip(x, y, l, w, s);
  mist(C, 1307, 2, [0, 66, 96, 18], 0.28);
  spores(C, 1309, 10);
  leaves(C, 1311, cx, 90, 40, 20);
  return C.toArt();
}

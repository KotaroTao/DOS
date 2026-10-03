import { torus, tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, tri } from "../forest.mjs";
export const meta = { id: "bs_stranglevine", key: "hd_stranglevine", w: 96, h: 96,
  note: "絞め蔦の魔: 樹冠から垂れ下がる太い蔦の塊。何本ものつるが蛇のように鎌首をもたげ、棘の鉤を先に獲物へ伸びる。塊の中心には花弁のように開いた口と細い牙、つるには痺れの黄色い火花と毒の滴" };
export function build() {
  const mats = {
    vine: { ramp: ramp(["#030402", "#0a0e06", "#121a0b", "#1c2810", "#283716", "#36481d", "#465a26", "#5a6e32"], 8), spec: 0.5, pow: 22, specCol: "#8a9c5a", dither: 0.55,
      shade: p => 0.1 * Math.sin(p.x * 1.1 + p.y * 1.4 + 3 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2)) },
    root: ROOT, moss: MOSS, mould: MOULD,
    petal: { ramp: ramp(["#050203", "#140609", "#260b10", "#3a1218", "#501a20", "#6a262a", "#843a34"], 7), spec: 0.6, pow: 25, specCol: "#b06a58", dither: 0.5,
      shade: p => 0.1 * Math.sin(Math.atan2(p.y - 46, p.x - 48) * 9) },
    thorn: { ramp: ramp(["#050403", "#1a150c", "#332a18", "#524428", "#76643c", "#a08c5c"], 6), spec: 0.8, pow: 30, specCol: "#d0c090", dither: 0.4 },
    maw: { ramp: ["#000000", "#080203", "#120406"], amb: 0.15, dif: 0.15, noRim: true },
    gland: { ramp: ["#3a3008", "#7a6a10", "#c8b020", "#f0e070"], emit: p => 0.5 + 0.45 * Math.max(0, p.nz) },
  };
  const R = rand(5103);
  // 樹冠: 上端にかかる太い枝と苔の房
  const branch = Disp(tube([[-4, 6, -10, 6], [24, 4, -8, 6.5], [52, 7, -9, 7], [78, 3, -10, 6], [100, 6, -12, 5.5]], "root", { seg: 4 }), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const canopy = [];
  for (const [x, y, r] of [[6, 2, 7], [20, -1, 8], [36, 1, 7], [50, -1, 8], [64, 1, 7], [80, -1, 8], [92, 2, 6], [14, 9, 4], [72, 10, 4.5], [42, 10, 4]])
    canopy.push(sphere([x, y, -4 + R() * 6], r, "moss"));
  const leafy = Disp(U(2, ...canopy), (x, y, z) => 0.9 * fbm(x * 0.35, y * 0.35, z * 0.35));
  // 垂れ下がる蔦の束: 枝から塊まで、ねじれた太いつる
  const hang = [];
  for (const [x0, x1, z, r] of [[34, 40, -4, 3.4], [44, 46, -2, 3.8], [54, 52, -3, 3.4], [60, 56, -6, 2.6], [28, 36, -6, 2.4]]) {
    const pts = []; for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([x0 + (x1 - x0) * t + Math.sin(t * 6 + x0) * 2.2, 8 + t * 28, z + Math.cos(t * 5 + x0) * 2, r * (1 - 0.15 * t)]); }
    hang.push(tube(pts, "vine", { seg: 3 }));
  }
  // 塊: 絡まったつるのこぶ
  const knot = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    knot.push(torus3(48 + Math.cos(a) * 3, 46 + Math.sin(a) * 4, 0, 11 + R() * 3, 3 + R() * 1.2, a * 57 + R() * 40, 30 + R() * 50));
  }
  const mass = Disp(U(2.2, ellipsoid([48, 45, -2], [16, 17, 12], "vine"), ...knot, ...hang), (x, y, z) => 0.7 * Math.abs(Math.sin(x * 0.9 + y * 0.5 + 2 * fbm(x * 0.2, y * 0.2, z * 0.2))) - 0.3);
  // 花弁状に開いた口: 中央手前に八枚の厚い花弁
  const petals = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2, c = Math.cos(a), s = Math.sin(a);
    const L = 16.5, w = 4.4;
    const tip = [48 + c * L * 1.05, 47 + s * L, 0];
    const poly = [[48 + c * 3 - s * w * 0.6, 47 + s * 3 + c * w * 0.6], [48 + c * L * 0.6 - s * w, 47 + s * L * 0.6 + c * w], [tip[0], tip[1]], [48 + c * L * 0.6 + s * w, 47 + s * L * 0.6 - c * w], [48 + c * 3 + s * w * 0.6, 47 + s * 3 - c * w * 0.6]];
    petals.push(Disp(slab(poly, 14, 1.3, "petal", 0.7, 0.8), (x, y, z) => 0.22 * Math.hypot(x - 48, y - 47) - 1.5));
  }
  const maw = ellipsoid([48, 47, 15], [6.6, 7, 8], "maw");
  // 鎌首をもたげるつる: 塊から出て S 字に曲がり、先端が獲物 (手前下) を向く
  const heads = [
    [[36, 44, 0, 3.4], [22, 48, 4, 3], [12, 40, 7, 2.6], [8, 30, 9, 2.2], [14, 24, 11, 1.8], [22, 26, 13, 1.4]],
    [[60, 44, 0, 3.4], [74, 48, 4, 3], [84, 40, 7, 2.6], [88, 30, 9, 2.2], [82, 23, 11, 1.8], [74, 25, 13, 1.4]],
    [[40, 58, 2, 3.4], [30, 66, 6, 3], [18, 68, 9, 2.6], [12, 76, 12, 2.2], [18, 82, 15, 1.8], [26, 79, 17, 1.4]],
    [[56, 58, 2, 3.4], [66, 66, 6, 3], [78, 66, 9, 2.6], [86, 74, 12, 2.2], [82, 82, 15, 1.8], [74, 80, 17, 1.4]],
    [[48, 60, 3, 3], [47, 70, 7, 2.6], [52, 78, 11, 2.2], [48, 84, 14, 1.8], [42, 82, 16, 1.4]],
  ];
  const tendrils = [], hooks = [], spikes = [];
  for (const pts of heads) {
    tendrils.push(tube(pts, "vine", { seg: 4 }));
    const a = pts[pts.length - 1], b = pts[pts.length - 2];
    const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    // 蛇の頭のように膨らんだ先端 (棘の蕾)
    hooks.push(Disp(ellipsoid([a[0] - ux * 0.5, a[1] - uy * 0.5, a[2]], [4.4, 2.9, 3], "vine", Math.atan2(uy, ux) * 180 / Math.PI), (x, y, z) => 0.2 * fbm(x, y, z)));
    // 棘の鉤: 先端から伸びて内へ曲がる
    hooks.push(tube([[a[0] + ux * 2, a[1] + uy * 2, a[2], 1.9], [a[0] + ux * 4.5, a[1] + uy * 4.5, a[2] + 1, 1.3], [a[0] + ux * 6.5 - uy * 2.2, a[1] + uy * 6.5 + ux * 2.2, a[2] + 1.5, 0.55], [a[0] + ux * 6 - uy * 4.4, a[1] + uy * 6 + ux * 4.4, a[2] + 1.6, 0.15]], "thorn", { seg: 2 }));
    // 鉤の反り返し
    hooks.push(cone([a[0] + ux * 1.5, a[1] + uy * 1.5, a[2] + 0.5], [a[0] + ux * 2 + uy * 3, a[1] + uy * 2 - ux * 3, a[2] + 1], 0.9, 0.15, "thorn"));
    // つる沿いの棘
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.hypot(tx, ty) || 1;
      const side = i % 2 ? 1 : -1, nx = -ty / tl * side, ny = tx / tl * side;
      spikes.push(cone([p[0] + nx * p[3] * 0.7, p[1] + ny * p[3] * 0.7, p[2] + 0.5], [p[0] + nx * (p[3] + 2.6) + tx / tl, p[1] + ny * (p[3] + 2.6) + ty / tl, p[2] + 1], 0.8, 0.12, "thorn"));
    }
  }
  // 痺れの毒腺: つるの節に光る黄色い瘤
  const glands = [];
  for (const pts of heads) { const p = pts[2]; glands.push(sphere([p[0], p[1], p[2] + p[3] * 0.7], 1.1, "gland")); }
  for (const [x, y, z] of [[38, 34, 9], [58, 36, 9], [42, 58, 9], [57, 56, 9]]) glands.push(sphere([x, y, z], 1.0, "gland"));
  const floor = forestFloor(48, 93, 40, 12, { n: 4, roots: 2, seed: 51 });
  const scene = U(0, floor, branch, leafy, Sub(U(0, mass, ...petals), maw, 0.8), U(1.2, ...tendrils), ...hooks, ...spikes, ...glands);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 47, 20], r: 16, k: 0.2 }] });
  const C = new Canvas(r);
  // 口の奥の細い牙 (花弁の内側から中心へ)
  const F = ["#4a4030", "#a89c78", "#e4dcc0"];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a);
    const x0 = 48 + c * 6.2, y0 = 47 + s * 6.6, x1 = 48 + c * 3.4, y1 = 47 + s * 3.6;
    tri(C, [x0 - s * 0.9, y0 + c * 0.9], [x0 + s * 0.9, y0 - c * 0.9], [x1, y1], F[0]);
    C.line(x0, y0, x1, y1, F[1]); C.set(x1, y1, F[2]);
  }
  // 花弁の筋: 中心から先端へ明るい筋、花弁の付け根の間は暗く
  for (let y = 28; y < 66; y++) for (let x = 28; x < 68; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "petal") continue;
    const a = Math.atan2(y + 0.5 - 47, x + 0.5 - 48) - 0.2, f = ((a / (Math.PI * 2) * 8) % 1 + 1) % 1, d = Math.hypot(x + 0.5 - 48, y + 0.5 - 47);
    if (Math.abs(f - 0.5) > 0.44 && d > 7) C.set(x, y, mats.petal.ramp[1]);
    else if (Math.abs(f) < 0.05 || Math.abs(f - 1) < 0.05) C.shift(x, y, mats.petal.ramp, 2);
  }
  // 床は霧で薄く: 床の画素をディザで間引く
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 84; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || !C.get(x, y)) continue;
    if (p.m === "mould" || p.m === "moss" || p.m === "root") {
      const a = 0.9 - Math.abs(x - 48) / 46 + 0.3 * fbm(x * 0.2, y * 0.3, 3);
      if (a < (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
    }
  }
  mist(C, 71, 4, [0, 60, 96, 34], 0.45);
  // 痺れの火花: つるに沿って黄色い小さな十字/ジグザグ
  const Y = ["#7a6a10", "#d8c020", "#fff490"];
  const spark = (x, y, big) => {
    C.set(x, y, Y[2]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) C.set(x + dx, y + dy, Y[1]);
    if (big) { C.set(x + 2, y - 1, Y[0]); C.set(x - 2, y + 1, Y[0]); C.set(x + 1, y + 2, Y[0]); }
  };
  for (const pts of heads) {
    const p = pts[3]; spark(Math.round(p[0] + 3), Math.round(p[1] - 2), true);
  }
  // 宙のジグザグ (つる先と塊の間)
  const zig = (x, y, n, dx, dy, seed) => { const Rz = rand(seed); let px = x, py = y; for (let i = 0; i < n; i++) { const nx = px + dx + (Rz() - 0.5) * 3, ny = py + dy + (Rz() - 0.5) * 3; C.line(px, py, nx, ny, i === n - 1 ? Y[1] : Y[2]); px = nx; py = ny; } };
  zig(15, 21, 3, 2, -1.6, 3); zig(81, 20, 3, -2, -1.6, 4); zig(30, 84, 2, 2, 1.2, 5); zig(70, 85, 2, -2, 1.2, 6);
  // 毒の滴: 鉤と花弁から垂れる
  const G = ["#2a3a0a", "#5a8014", "#a0d030"];
  for (const [x, y, l] of [[23, 30, 4], [73, 29, 4], [45, 58, 6], [52, 59, 4], [27, 84, 3]]) { for (let i = 0; i < l; i++) C.set(x, y + i, i < l - 1 ? G[1] : G[2]); C.set(x, y + l + 1, G[0]); }
  spores(C, 77, 14, [2, 14, 92, 70], true);
  return C.toArt();
}
// 絡まったつるの輪
function torus3(x, y, z, R, r, rot, tilt) { return torus([x, y, z], R, r, "vine", rot, tilt); }

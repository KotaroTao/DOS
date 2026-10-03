import { tube, sphere, ellipsoid, cone, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, leaves } from "../forest.mjs";
export const meta = { id: "bs_thornhound", key: "hd_thornhound", w: 96, h: 96,
  note: "茨の猟犬: 肋の浮いた痩せ犬が全身に茨を巻きつけ、低く身構えて今にも跳びかかる。赤く光る眼とむき出しの牙。後ろには走り抜けた残像と速さの筋が尾を引く" };
// 組んだ犬を床の一点を中心に拡大する (葉の距離関数と Disp/Paint の関数ごと)
function scaleAt(n, k, ax, ay) {
  const X = x => ax + (x - ax) / k, Y = y => ay + (y - ay) / k;
  if (n.leaf) { const f = n.f, b = n.bound; return { leaf: true, f: (x, y, z) => f(X(x), Y(y), z / k) * k, mat: n.mat, bound: [ax + (b[0] - ax) * k, ay + (b[1] - ay) * k, b[2] * k, b[3] * k] }; }
  const o = { ...n, kids: n.kids.map(c => scaleAt(c, k, ax, ay)) };
  if (n.fn) { const f0 = n.fn; o.fn = n.op === "D" ? (x, y, z) => f0(X(x), Y(y), z / k) * k : (x, y, z, m) => f0(X(x), Y(y), z / k, m); }
  return o;
}
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030303", "#0a0909", "#141211", "#1f1b19", "#2b2522", "#39302b", "#4a3e37", "#5f5047"], 8), spec: 0.4, pow: 18, specCol: "#9a8270", dither: 0.6, amb: 0.2,
      shade: p => 0.1 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    vine: { ramp: ramp(["#030402", "#0c1206", "#18220c", "#253414", "#34461c", "#465c26"], 6), spec: 0.6, pow: 25, specCol: "#7a9050", dither: 0.45 },
    thorn: { ramp: ramp(["#0c0805", "#2a1e12", "#4e3a24", "#7a6040", "#a88c64"], 5), spec: 1, pow: 30, specCol: "#d8c8a0", dither: 0.3 },
    eye: { ramp: ["#4a0602", "#9a1406", "#e8300c", "#ff7a50"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0e0202", "#200606", "#340c0a"], amb: 0.12, dif: 0.3, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 骨格: 左向きに低く構え、前肢を折り、後肢を縮めて溜める
  const spine = tube([[22, 48, 2, 4.2], [33, 52, 2, 7], [44, 51, 1, 5.2], [53, 48, 0, 4.6], [61, 46, 0, 6.2]], "hide", { seg: 4, k: 1.5 });
  const chest = ellipsoid([33, 56, 2], [8.6, 8.6, 7], "hide", -10);
  const belly = ellipsoid([46, 53, 1], [7, 4.4, 5], "hide", -8);
  const haunch = ellipsoid([62, 50, 0], [7.4, 8, 6.6], "hide", 25);
  const neck = tube([[30, 52, 3, 5.4], [22, 52, 4, 4.4], [16, 55, 5, 3.6]], "hide");
  const skull = ellipsoid([13.5, 54.5, 6], [5.8, 4.8, 4.6], "hide", 10);
  const snoutU = cone([10, 55, 6.5], [3, 57.5, 7.5], 3.3, 1.5, "hide");
  const jawL = cone([11, 59.5, 6], [5, 65, 7], 2.2, 1.1, "hide");
  const maw = ellipsoid([7, 60.6, 8.5], [4.6, 2.4, 2.6], "maw", 32);
  const earL = cone([16.5, 50.5, 2], [21, 40, -1], 2.4, 0.3, "hide"), earR = cone([14, 50.5, 7], [17, 40.5, 7], 2.2, 0.3, "hide");
  // 脚: 細い骨と腱
  const legs = [
    tube([[30, 60, 7, 3], [25, 70, 8, 1.8], [24, 78, 8, 1.3], [18, 84, 9, 1.1]], "hide", { seg: 3 }),
    tube([[36, 61, -4, 2.8], [38, 71, -4, 1.6], [34, 79, -4, 1.2], [29, 84, -4, 1.0]], "hide", { seg: 3 }),
    tube([[62, 53, 6, 4.6], [71, 64, 7, 2.4], [70, 75, 7, 1.4], [64, 84, 8, 1.2]], "hide", { seg: 3 }),
    tube([[60, 54, -5, 4], [67, 66, -5, 2.1], [64, 76, -5, 1.3], [57, 84, -5, 1.0]], "hide", { seg: 3 }),
  ];
  const paws = [ellipsoid([16, 85, 9], [2.8, 1.3, 2], "hide"), ellipsoid([27, 85, -4], [2.5, 1.2, 1.8], "hide"), ellipsoid([62, 85, 8], [2.8, 1.3, 2], "hide"), ellipsoid([55, 85, -5], [2.5, 1.2, 1.8], "hide")];
  const tail = tube([[66, 45, 0, 2.6], [71, 38, -1, 1.8], [72, 31, -2, 1.2], [70, 26, -3, 0.6]], "hide", { seg: 3 });
  // 肋: 胸の脇に浮く骨の筋 (凹凸)
  const ribs = (x, y, z) => (x > 27 && x < 46 && y > 49 && y < 62 ? -0.7 * Math.max(0, Math.sin((x - 27) * 1.15 + (y - 49) * 0.25)) * Math.min(1, (62 - y) / 4) : 0);
  const body = Disp(U(0.7, U(2, spine, chest, belly, haunch, neck, skull, snoutU, jawL, ...legs, ...paws, tail), earL, earR), (x, y, z) => ribs(x, y, z) + 0.15 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const head = Sub(body, maw, 0.4);
  // 茨: 胴・首・脚に螺旋に巻きつく蔓と、外へ突き出る棘
  const R = rand(881);
  const vines = [], thorns = [];
  function wrap(path, rad, turns, r0 = 0.9) {
    const pts = [];
    const n = turns * 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = t * (path.length - 1), k = Math.min(path.length - 2, Math.floor(s)), f = s - k;
      const c = path[k].map((v, j) => v + (path[k + 1][j] - v) * f), a = t * turns * Math.PI * 2;
      const rr = rad[0] + (rad[1] - rad[0]) * t + 0.9;
      // 道筋に直交する yz 平面で回す (左右に走る胴・首)
      pts.push([c[0], c[1] + Math.cos(a) * rr, c[2] + Math.sin(a) * rr, r0]);
      if (i % 3 === 1 && Math.sin(a) > -0.2) {
        const ox = (R() - 0.5) * 2, oy = Math.cos(a) * 3.2, oz = Math.sin(a) * 3.2;
        thorns.push(cone([c[0], c[1] + Math.cos(a) * rr, c[2] + Math.sin(a) * rr], [c[0] + ox, c[1] + Math.cos(a) * rr + oy, c[2] + Math.sin(a) * rr + oz], 0.7, 0.05, "thorn"));
      }
    }
    vines.push(tube(pts, "vine", { seg: 1 }));
  }
  wrap([[60, 47, 0], [46, 51, 1], [32, 53, 2], [22, 51, 3]], [6.2, 5], 3.2, 1.3);
  wrap([[17, 54, 5], [24, 52, 4]], [4, 4.4], 1.2, 1.1);
  // 脚の茨 (縦に走る脚は xz 平面で回す)
  function wrapV(a0, b0, rad, turns) {
    const pts = []; const n = turns * 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * Math.PI * 2, c = a0.map((v, j) => v + (b0[j] - v) * t), rr = rad + 0.8;
      pts.push([c[0] + Math.cos(a) * rr, c[1], c[2] + Math.sin(a) * rr, 1]);
      if (i % 4 === 2 && Math.sin(a) > 0) thorns.push(cone([c[0] + Math.cos(a) * rr, c[1], c[2] + Math.sin(a) * rr], [c[0] + Math.cos(a) * (rr + 2.6), c[1] - 1.2, c[2] + Math.sin(a) * (rr + 2.6)], 0.6, 0.05, "thorn"));
    }
    vines.push(tube(pts, "vine", { seg: 1 }));
  }
  wrapV([28, 63, 7], [24, 76, 8], 2.4, 2);
  wrapV([68, 60, 6], [70, 74, 7], 2.8, 2);
  // 尾の茨
  for (const [x, y] of [[69, 41], [71.5, 35], [71.5, 30]]) thorns.push(cone([x, y, 1.6], [x + 3, y - 1.5, 2.4], 0.6, 0.05, "thorn"), cone([x, y, 1.2], [x - 2.6, y - 1.6, 2], 0.5, 0.05, "thorn"));
  const eyes = [ellipsoid([11.4, 53.4, 10], [1.8, 0.75, 0.9], "eye", 22)];
  const floor = forestFloor(44, 89, 44, 12, { n: 5, roots: 3, seed: 883 });
  const dogN = scaleAt(U(0, head, ...vines, ...thorns, ...eyes), 1.08, 2, 86);
  const scene = U(0, floor, dogN);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.5, lights: [{ p: [12, 50, 18], r: 12, k: 0.35 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 5, 14, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#4a4436", "#b0a888", "#ece6cc"], seed: 7 });
  
  // 茨の棘 (2D): 蔓の画素から外向き (法線の向き) に短く鋭く突き出す
  const TH = ["#4e3a24", "#8a7050", "#c8b088"];
  const Rt = rand(889);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "vine" || Rt() > 0.2) continue;
    const l = Math.hypot(p.nx, p.ny); if (l < 0.55) continue;
    const ux = p.nx / l, uy = p.ny / l, L = 2 + Math.floor(Rt() * 2);
    for (let k = 1; k <= L; k++) { const X = Math.round(x + ux * k), Y = Math.round(y + uy * k); const q = C.pix[Y * 96 + X]; if (q && q.m === "vine") continue; C.set(X, Y, TH[k === L ? 2 : k === 1 ? 0 : 1]); }
  }
  // 残像: 犬の形を右後ろへずらし、空いている所に暗い写しを塊のまま置く (後ろほどほどけて消える)
  const dog = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && !["mould", "moss", "root"].includes(p.m) && C.get(x, y)) dog.push([x, y, p.m === "eye" ? 3 : p.nx < -0.2 ? 2 : p.nx < 0.3 ? 1 : 0]); }
  const rightEdge = new Array(96).fill(-1);
  for (const [x, y] of dog) rightEdge[y] = Math.max(rightEdge[y], x);
  const ghosts = [[12, -11, ["#2a2230", "#352b3b", "#433647", "#b02a14"], 0.0], [24, -22, ["#211c27", "#28212e", "#2f2735", "#701c10"], 0.3]];
  for (const [dx, dy, G, cut] of ghosts.reverse()) {
    for (const [x, y, k] of dog) {
      const X = x + dx, Y = y + dy; if (X > 95 || Y < 0 || C.get(X, Y)) continue;
      // 前 (左) 側は残り、後ろ (右) 側へ横筋に裂けて消えていく
      const tear = (x - 30) / 60 + cut + 0.55 * vnoise(Y * 0.8, dx, 3) - 0.3;
      if (tear > 0.35) continue;
      C.set(X, Y, G[k]);
    }
  }
  // 速さの筋: 走り抜けてきた向き (右上) へ伸びる細い斜線
  const SL = ["#2a2430", "#3a3240", "#524858"];
  const ux = 12 / Math.hypot(12, 11), uy = -11 / Math.hypot(12, 11);
  for (const [x0, y0, len] of [[60, 32, 16], [68, 44, 18], [74, 58, 16], [46, 30, 12], [78, 70, 12], [36, 34, 10]]) {
    for (let i = 0; i < len; i++) { const X = Math.round(x0 + ux * i), Y = Math.round(y0 + uy * i); if (X > 95 || Y < 0) break; if (C.get(X, Y)) continue; C.set(X, Y, SL[i < len * 0.3 ? 2 : i < len * 0.7 ? 1 : 0]); }
  }
  leaves(C, 887, 44, 89, 38, 18);
  // 跳ねた落ち葉: 後ろ足のあたりに舞い上がる
  for (const [x, y] of [[74, 80], [79, 76], [85, 82], [70, 72]]) { if (!C.get(x, y)) { C.set(x, y, "#4e3616"); C.set(x + 1, y, "#3a2a12"); } }
  return C.toArt();
}

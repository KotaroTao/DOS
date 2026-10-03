import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves } from "../forest.mjs";
export const meta = { id: "bs_willowwitch", key: "hd_willowwitch", w: 96, h: 96,
  note: "柳の魔女: 枝垂れ柳と一体化した老婆。垂れた枝葉の帳の奥に皺だらけの顔と緑に光る眼。枝の腕を掲げ、頭上に緑の燐光の魔法陣と霧の渦を巡らせて霧の嵐を呼ぶ。足元からは蔦が這い出す" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040403", "#0c0d09", "#171812", "#23241b", "#313226", "#424232", "#555540", "#6a6950"], 8), dither: 0.5, spec: 0.3, pow: 16,
      shade: p => 0.14 * Math.sin(p.y * 2.6 + Math.sin(p.x * 0.7) * 1.4) * (p.y < 46 ? 1 : 0.4) },
    bark: { ramp: ramp(["#030302", "#0a0907", "#14110d", "#1f1a14", "#2b241b", "#3a3024", "#4a3e2e"], 7), dither: 0.6,
      shade: p => 0.16 * Math.sin(p.x * 1.4 + 2 * fbm(p.x * 0.15, p.y * 0.1, p.z * 0.15)) },
    leaf: { ramp: ramp(["#020302", "#071006", "#0e1a0b", "#162611", "#203417", "#2c441e", "#3a5626"], 7), dither: 0.75,
      shade: p => 0.16 * fbm(p.x * 0.6, p.y * 0.35, p.z * 0.6) },
    eye: { ramp: ["#2a5a10", "#7ad030", "#e0ffa0"], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#050604", "#0c0e08"], amb: 0.1, dif: 0.2, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const cx = 48;
  // 顔: 皺だらけの細長い老婆の顔、鉤鼻と尖った顎、落ち窪んだ眼
  const face = U(1.6, ellipsoid([cx, 37, 3], [7, 8.6, 6], "skin"), ellipsoid([cx, 46, 4], [4, 3.6, 4], "skin"), ellipsoid([cx - 5, 41, 5], [2.4, 2, 2.4], "skin"), ellipsoid([cx + 5, 41, 5], [2.4, 2, 2.4], "skin"),
    tube([[cx, 34, 8.6, 1.6], [cx + 0.3, 39, 11.6, 1.4], [cx - 0.6, 43, 10.6, 0.6]], "skin", { seg: 2 }),
    ellipsoid([cx - 3.6, 32.4, 8], [3.2, 1.2, 1.6], "skin", 14), ellipsoid([cx + 3.6, 32.4, 8], [3.2, 1.2, 1.6], "skin", -14));
  const holes = U(0, ellipsoid([cx - 3.4, 35, 8.4], [2.3, 1.7, 1.6], "maw"), ellipsoid([cx + 3.4, 35, 8.4], [2.3, 1.7, 1.6], "maw"),
    Disp(ellipsoid([cx, 46.4, 7.6], [3.4, 1.4, 2], "maw"), (x, y, z) => 0.4 * Math.sin(x * 2)));
  const eyes = [sphere([cx - 3.4, 35.2, 7.8], 1.15, "eye"), sphere([cx + 3.4, 35.2, 7.8], 1.15, "eye")];
  // 顔の両脇に垂れる、髪のような枝葉
  const hair = [];
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const x0 = cx + s * (5 + j * 2.2); hair.push(Disp(tube([[x0, 28, 2 - j, 1.6], [x0 + s * (2.5 + j), 38, 4 - j, 1.4], [x0 + s * (3 + j * 1.5), 50, 4 - j, 1.1], [x0 + s * (4 + j * 1.6), 60 + j * 4, 3 - j, 0.5]], "leaf", { seg: 3 }), (x, y, z) => 0.6 * vnoise(x * 1.1, y * 0.9, z))); }
  // 胴: 樹皮のローブのように裾が広がり、根となって床へ
  const body = Disp(U(2.4, ellipsoid([cx, 55, 0], [10, 8, 6.5], "bark"), cone([cx, 58, 0], [cx, 86, 0], 8, 15, "bark")),
    (x, y, z) => 0.6 * Math.abs(Math.sin(Math.atan2(z, x - cx) * 6 + y * 0.1)) * Math.max(0, (y - 60) / 24) + 0.2 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const neck = tube([[cx, 46, 1, 2.6], [cx, 50, 0, 3.6]], "skin");
  // 掲げた枝の腕: 肩から上外へ、細い枝指を開いて魔法陣を支える
  const arm = s => {
    const X = d => cx + s * d;
    const a = tube([[X(8), 50, 2, 3.2], [X(17), 42, 6, 2.4], [X(21), 30, 7, 1.7], [X(22), 22, 6, 1.2]], "bark", { seg: 3 });
    return U(0.8, a, ...fingers([X(22), 22, 6], s > 0 ? -60 : -120, "bark", { n: 4, len: 7, spread: 26, r: 0.7, curl: 0.3 * -s }));
  };
  // 柳の帳: 頭上の枝の冠から、細い枝葉の房が幾筋も垂れる
  const R = rand(1501);
  const strands = [];
  for (let i = 0; i < 30; i++) {
    const t = i / 29, x0 = 14 + t * 68, dx = x0 - cx;
    const front = Math.abs(dx) > 13 && R() < 0.5;
    const z0 = front ? 4 + R() * 3 : -6 - R() * 4;
    const y0 = 24 + Math.abs(dx) * 0.28 + R() * 2, len = 34 + R() * 26 - Math.abs(dx) * 0.2;
    const sw = (R() - 0.5) * 4, pts = [];
    for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([x0 + Math.sign(dx) * u * 4 + Math.sin(u * 3 + i) * 1.2 + sw * u, y0 + len * u, z0 + u * 1.5, 1.6 - u * 1.1]); }
    strands.push(Disp(tube(pts, "leaf", { seg: 3 }), (x, y, z) => 0.6 * vnoise(x * 1.1, y * 0.9, z)));
  }
  const crown = Disp(U(2.4, ellipsoid([cx, 27, -7], [20, 4.5, 6], "leaf"), ellipsoid([cx - 16, 30, -7], [9, 4.5, 6], "leaf"), ellipsoid([cx + 16, 30, -7], [9, 4.5, 6], "leaf"), ellipsoid([cx, 28, -1], [7.5, 4, 5], "leaf")),
    (x, y, z) => 1.0 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 足元から這い出す蔦
  const vines = [];
  for (const [s, z, l] of [[-1, 6, 30], [1, 5, 30], [-1, -2, 22], [1, 9, 18]]) {
    const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([cx + s * (8 + u * l), 87 - Math.sin(u * 6) * 1.6 + u * 2, z + Math.cos(u * 5) * 3, 1.5 - u * 1.0]); }
    vines.push(tube(pts, "moss", { seg: 3 }));
  }
  const witch = U(0, Sub(face, holes, 0.4), ...eyes, ...hair, U(1.2, body, neck, arm(-1), arm(1)), crown, ...strands, ...vines);
  const scene = U(0, forestFloor(cx, 91, 42, 13, { n: 5, roots: 2, seed: 1503 }), witch);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [cx, 10, 10], r: 40, k: 0.55 }] });
  const C = new Canvas(r);
  // 頭上の魔法陣: 傾いた二重の輪と、回る印、渦巻く霧
  const G = ["#1a3a10", "#3a7a1c", "#7ad030", "#c8f878", "#f0ffd0"];
  const ell = (cxx, cyy, rx, ry, col, step = 0.01, gap = 0) => { for (let a = 0; a < Math.PI * 2; a += step) { if (gap && Math.sin(a * gap) > 0.85) continue; const x = cxx + Math.cos(a) * rx, y = cyy + Math.sin(a) * ry; if (!C.get(Math.round(x), Math.round(y)) || y < cyy) C.set(x, y, col); } };
  // 霧の渦 (外側): 輪の周りを巡る淡い霧の腕
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < 26; y++) for (let x = 2; x < 94; x++) {
    if (C.get(x, y)) continue;
    const u = (x - cx) / 40, v = (y - 12) / 10, rr = Math.hypot(u, v), an = Math.atan2(v, u);
    const arm = Math.cos(an * 2 - rr * 7 + 0.5);
    const a = Math.max(0, arm) * Math.max(0, 1 - Math.abs(rr - 0.75) * 2.2) * 0.9;
    if (a > (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, a > 0.5 ? "#3e5a48" : a > 0.3 ? "#2c4236" : "#1e2e26");
  }
  ell(cx, 12, 26, 6.5, G[2]);
  ell(cx, 12, 22, 5.2, G[1], 0.01, 9);
  ell(cx, 12, 13, 3.2, G[2]);
  // 輪の上の印 (小さな縦棒と点)
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = cx + Math.cos(a) * 17.5, y = 12 + Math.sin(a) * 4.2; C.set(x, y, G[3]); C.set(x, y - 1, G[2]); }
  // 中心の光と、陣から魔女の掌へ降りる燐光
  for (const [dx, dy, c] of [[0, 0, 4], [-1, 0, 3], [1, 0, 3], [0, -1, 3], [0, 1, 3], [-2, 0, 2], [2, 0, 2], [0, -2, 2]]) C.set(cx + dx, 12 + dy, G[c]);
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) C.set(cx + s * (22 + (k % 2)), 15 + k, G[k < 3 ? 2 : 1]);
  // 帳の奥の燐光の胞子
  spores(C, 1507, 22, [4, 20, 88, 60], true);
  mist(C, 1509, 2, [0, 70, 96, 16], 0.3);
  leaves(C, 1511, cx, 90, 38, 16);
  return C.toArt();
}

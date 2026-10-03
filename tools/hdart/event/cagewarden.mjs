import { tube, sphere, ellipsoid, cone, cyl, torus, box, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_cagewarden", key: "hd_cagewarden", w: 96, h: 96,
  note: "檻番の獄卒: 鳥籠のような鉄の檻兜に頭を封じた猫背の巨躯。籠の格子の奥に熾火の眼、鉄の首枷と手枷、右手に大きな鍵束、左手に鋲打ちの棍棒を引きずる" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030102", "#0a0405", "#140808", "#200d0c", "#2e1411", "#3e1c16", "#52261c", "#6c3424"], 8), spec: 0.5, pow: 18, specCol: "#8c5440", dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) - (Math.abs(p.y - 47) < 0.9 && Math.abs(p.x - 46) < 12 ? 0.18 : 0) - (Math.abs(p.x - 46.5) < 0.6 && p.y > 40 && p.y < 58 ? 0.14 : 0) },
    iron: { ramp: ramp(["#020203", "#08090c", "#121418", "#1e2127", "#2c3038", "#3e434c", "#565c66", "#737a84"], 8), spec: 1.1, pow: 40, specCol: "#aab4c0", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    rust: { ramp: ramp(["#030202", "#0e0705", "#1e0f08", "#30180c", "#462412", "#5e321a"], 6), spec: 0.4, pow: 20, dither: 0.6,
      shade: p => 0.14 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    brass: { ramp: ramp(["#040302", "#140e04", "#2a1e08", "#44310e", "#634a16", "#866822", "#ab8a36"], 7), spec: 1.2, pow: 30, specCol: "#e6cc80", dither: 0.4 },
    wood: { ramp: ramp(["#040302", "#110b07", "#20150c", "#301f12", "#432c19", "#583a22"], 6), spec: 0.3, pow: 20, dither: 0.5,
      shade: p => 0.12 * Math.sin(p.y * 0.4 + p.x * 2.2) },
    leather: { ramp: ramp(["#030202", "#0b0705", "#16100a", "#22180f", "#302215", "#40301d"], 6), spec: 0.4, pow: 20, dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5) },
    maw: { ramp: ["#000000", "#080203", "#120405"], amb: 0.2, dif: 0.1, dither: 0.3 },
    stone: { ramp: ramp(["#030303", "#0a0a0b", "#131315", "#1c1c1f", "#26262a"], 5), dither: 0.8, amb: 0.4, dif: 0.45, noRim: true,
      shade: p => 0.12 * fbm(p.x * 0.3, p.z * 0.3) },
  };
  // 猫背の巨躯: 頭は肩より前で低く、腕は長く膝下まで垂れる
  const J = { head: [44, 22, 10], neck: [45, 29, 6], chest: [46, 40, 2], waist: [47, 54, 2], hip: [47, 63, 0],
    shL: [30, 34, 4], elL: [22, 52, 8], haL: [20, 68, 12], shR: [62, 34, 0], elR: [72, 50, 6], haR: [74, 64, 10],
    hpL: [40, 66, 0], knL: [36, 77, 6], ftL: [35, 88, 6], hpR: [55, 66, -2], knR: [59, 77, 4], ftR: [61, 88, 2] };
  const body = humanoid(J, { skin: "hide", torso: "hide", hip: "leather", leg: "hide", arm: "hide", head: "maw" }, {
    w: { chestX: 15, chestY: 11, chestZ: 9, waistX: 11, waistY: 8, waistZ: 8, hipX: 10, hipY: 6, hipZ: 7, arm: 5.2, arm2: 4.2, wrist: 3.2,
      thigh: 5, knee: 4, ankle: 3.4, headX: 5, headY: 6, headZ: 5, neck: 4.5 }, k: 2.6 });
  // 背の瘤 (猫背の盛り上がり)
  const hump = ellipsoid([45, 32, -4], [13, 8, 8], "hide", 0);
  const torso = Disp(U(2.5, body, hump), (x, y, z) => 0.35 * fbm(x * 0.4, y * 0.4, z * 0.4));
  // 鳥籠の檻兜: 縦格子 + 輪 + 頂の吊り環
  const HC = [44, 20, 10];
  const bars = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, ang = t * Math.PI * 0.55; // 頂から裾へ
      const R = 8.6 * Math.sin(ang + 0.35), y = HC[1] - 9 * Math.cos(ang + 0.35) + t * 6;
      pts.push([HC[0] + cx * R, y, HC[2] + cz * R, 0.9]);
    }
    bars.push(tube(pts, "iron", { seg: 2 }));
  }
  const rings = [torus([HC[0], HC[1] + 6, HC[2]], 8.4, 1.1, "iron", 0, 0), torus([HC[0], HC[1] - 1, HC[2]], 8.2, 0.9, "rust", 0, 0)];
  const topRing = torus([HC[0], HC[1] - 10.5, HC[2]], 2.2, 0.8, "iron", 0, 90);
  const finial = sphere([HC[0], HC[1] - 8.2, HC[2]], 1.6, "iron");
  // 首枷: 厚い鉄の輪と蝶番
  const collar = torus([45, 29, 6], 7.5, 2.2, "iron", 0, 8);
  const hinge = box([38, 30, 12], [1.6, 2.2, 1.6], "rust", 0.4);
  // 手枷 (両手首) と千切れた鎖
  const cuffL = cyl([21, 63, 11], [20, 67, 12], 4.2, "iron", 0.6);
  const cuffR = cyl([74, 59, 9], [74, 63, 10], 4.2, "iron", 0.6);
  const links = [];
  const chain = (a, b, n, r = 1.5) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const p = a.map((v, c) => v + (b[c] - v) * t);
      links.push(torus(p, r, 0.75, "iron", Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, i % 2 ? 0 : 90));
    }
  };
  chain([19, 67, 12], [12, 80, 14], 5);
  chain([38, 33, 13], [44, 44, 15.5], 5, 1.9);
  chain([44, 44, 15.5], [55, 58, 14], 6, 1.9);
  chain([76, 63, 10], [84, 72, 12], 4);
  // 左手: 鋲打ちの棍棒を引きずる (先端は床に)
  const club = cone([22, 69, 13], [6, 90, 18], 2.0, 5.2, "wood");
  // 棍棒の頭に打たれた鉄鋲: 軸に垂直な2方向へ放射状に
  const studs = [];
  const A0 = [22, 69, 13], A1 = [6, 90, 18];
  const D = A1.map((v, i) => v - A0[i]), DL = Math.hypot(...D), d = D.map(v => v / DL);
  const P1 = [-d[1], d[0], 0].map(v => v / Math.hypot(d[0], d[1])), P2 = [d[1] * P1[2] - d[2] * P1[1], d[2] * P1[0] - d[0] * P1[2], d[0] * P1[1] - d[1] * P1[0]];
  for (let i = 0; i < 10; i++) {
    const t = 0.5 + (i >> 1) * 0.1, a = i * 2.4 + (i & 1) * 1.2, r = 2.0 + 3.2 * t;
    const c = A0.map((v, k) => v + D[k] * t), o = P1.map((v, k) => Math.cos(a) * v + Math.sin(a) * P2[k]);
    studs.push(cone(c.map((v, k) => v + o[k] * (r - 0.6)), c.map((v, k) => v + o[k] * (r + 2.2)), 1.2, 0.15, "iron"));
  }
  const clubBand = [torus([16.5, 76.5, 15], 3.8, 0.9, "iron", -37, 90 - 50), torus([9.5, 85.5, 17], 5.0, 1.0, "iron", -37, 90 - 50)];
  const handL = fingers([20, 69, 13], 95, "hide", { n: 4, len: 5, spread: 18, r: 1.4, curl: 1.0, z: 2 });
  // 右手: 大きな鍵束 (鉄の環に真鍮の鍵)
  const keyRing = torus([75, 75, 13], 5.8, 1.0, "iron", 0, 75);
  const keys = [];
  const kd = [[-3, 4, -14], [0, 6, 0], [3, 5, 12], [5, 3, 26]];
  for (const [dx, dl, rot] of kd) {
    const x0 = 75 + dx, y0 = 80;
    const a = (90 - rot) * Math.PI / 180, ex = x0 + Math.cos(a) * (6 + dl), ey = y0 + Math.sin(a) * (6 + dl);
    keys.push(cyl([x0, y0, 13], [ex, ey, 13], 0.8, "brass", 0.2));
    keys.push(box([ex + 0.8, ey - 1, 13], [1.4, 1.1, 0.7], "brass", 0.3, -rot));
    keys.push(torus([x0, y0 - 1, 13], 1.3, 0.55, "brass", 0, 90));
  }
  const handR = [ellipsoid([74, 67.5, 11], [3.6, 3.2, 3.4], "hide")];
  // 腰帯と腰布 (前垂れは短く、膝上で裂ける)
  const belt = Disp(torus([47, 60, 2], 10.5, 1.8, "leather", 0, 6), (x, y, z) => 0);
  const buckle = box([47, 60, 13.2], [2.2, 2.2, 0.8], "rust", 0.3);
  const loin = Disp(slab([[38, 61], [56, 61], [54, 74], [50, 71], [46, 76], [42, 71], [40, 73]], 10, 1.4, "leather", 0.6), (x, y, z) => 0.3 * Math.sin(x * 1.2));
  // 足の鉄靴
  const bootL = ellipsoid([34, 88, 9], [5.5, 3.2, 6], "iron"), bootR = ellipsoid([62, 88, 5], [5.5, 3.2, 6], "iron");
  const floor = ellipsoid([48, 92, 0], [42, 2.6, 16], "stone");
  const scene = U(0, floor, torso, collar, hinge, ...bars, ...rings, topRing, finial, cuffL, cuffR, ...links, club, ...studs, ...clubBand, ...handL, keyRing, ...keys, ...handR, belt, buckle, loin, bootL, bootR);
  const r = render(scene, mats, { w: 96, h: 96, rim: "#5a4e62", zTop: 60 });
  const C = new Canvas(r);
  // 籠の奥の顔: 闇の中に熾火の双眸と、歯の覗く裂け口
  const E1 = "#ff8a2a", E2 = "#ffd27a", E0 = "#7a2408";
  for (const ex of [41, 47]) { C.only(ex, 21, E1); C.only(ex + 1, 21, E2); C.only(ex, 22, E0); C.only(ex + 1, 22, E1); }
  for (let x = 41; x <= 48; x++) C.only(x, 26, x % 2 ? "#3a1a10" : "#a89878");
  // 床に引きずった棍棒の擦り跡
  for (let x = 2; x < 10; x++) if (C.get(x, 91)) C.set(x, 91, x % 2 ? "#26262a" : "#1c1c1f");
  return C.toArt();
}

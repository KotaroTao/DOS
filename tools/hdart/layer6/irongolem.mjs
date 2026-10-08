import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, PHOS, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_irongolem", key: "hd_irongolem", w: 96, h: 96,
  note: "青銅の神兵: 神殿の門を守っていた青銅の兵の像。緑青に覆われた鎧と、たてがみの飾りの兜。身を沈めて長い矛を大きく引き絞り、穂先と兜の眼窩に青緑の光を溜めている (溜め)。盾は背に回す" };
export function build() {
  const mats = {
    bronze: { ramp: ramp(["#040403", "#0e0c08", "#1c180e", "#2c2614", "#3e361c", "#544a26", "#6e6232", "#8c7e44"], 8), spec: 1.4, pow: 32, specCol: "#d0c088", dither: 0.45, amb: 0.16,
      shade: p => 0.07 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    verdi: { ramp: ramp(["#030605", "#08140f", "#0f2219", "#173224", "#224430", "#30583e", "#426e50"], 7), dither: 0.65, amb: 0.22,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    plume: { ramp: ramp(["#060203", "#140608", "#240c0e", "#361416", "#4a1e1e"], 5), dither: 0.6, amb: 0.2, shade: p => 0.14 * Math.sin(p.x * 1.6 + p.y * 0.3) },
    glow: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) },
    void: { ramp: ["#000000", "#010202", "#030505"], amb: 0.05, dif: 0.1, noRim: true },
    wood: { ramp: ramp(["#030202", "#0b0806", "#160f09", "#22180e", "#302214"], 5), dither: 0.5 },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const ver = (x, y, z, m) => m === "bronze" && fbm(x * 0.2, y * 0.2, z * 0.2) > 0.12 - 0.006 * (y - 40) ? "verdi" : m;
  // 低く構えた体: 胴を前へ傾け、左脚を前、右脚を後ろへ大きく開く
  const torso = U(1.6, ellipsoid([46, 43, 0], [10, 9.6, 7.5], "bronze", -14), ellipsoid([48, 55, 0], [8, 6, 6.5], "bronze", -8));
  const skirt = [];
  for (let i = -2; i <= 2; i++) skirt.push(box([48 + i * 3.4, 63, 2 + (2 - Math.abs(i)) * 0.8], [1.6, 4.6, 1], "bronze", 0.4, i * 6));
  const helm = U(1, ellipsoid([41, 26, 4], [6, 6.6, 6], "bronze", -10), ellipsoid([40, 31.5, 7], [4.6, 2.6, 4.4], "bronze", -10));
  const plume = Disp(tube([[42, 20, 2, 1.8], [48, 15, -1, 2.4], [56, 15, -4, 2.6], [64, 20, -7, 2], [70, 28, -9, 1]], "plume", { seg: 4 }), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 1.5)));
  const crest = cyl([41, 19.4, 3], [52, 16, 0], 1.2, "bronze", 0.4);
  const eyeholes = U(0, ellipsoid([38.5, 26, 9.2], [1.8, 1, 1.4], "void", -10), ellipsoid([43.6, 25.4, 9.6], [1.8, 1, 1.4], "void", -10));
  const eyes = [ellipsoid([38.5, 26, 8.9], [1.3, 0.6, 0.8], "glow", -10), ellipsoid([43.6, 25.4, 9.3], [1.3, 0.6, 0.8], "glow", -10)];
  // 肩当て
  const pL = ellipsoid([36, 35, 4], [6.6, 4.2, 6], "bronze", -30), pR = ellipsoid([56, 37, -2], [6.6, 4.2, 6], "bronze", 20);
  // 腕: 両手で矛を後ろへ引き絞る (前の手は胸元、後ろの手は腰の後ろ)
  const armF = tube([[36, 37, 5, 2.8], [33, 46, 9, 2.4], [40, 51, 12, 2.2]], "bronze", { seg: 3 });
  const armB = tube([[57, 39, -1, 2.8], [63, 47, 2, 2.4], [70, 53, 6, 2.2]], "bronze", { seg: 3 });
  const gauntlets = [ellipsoid([40.5, 51.5, 12.6], [2.8, 2.6, 2.6], "bronze"), ellipsoid([70.5, 53.2, 6.6], [2.8, 2.6, 2.6], "bronze")];
  // 脚: 前の左脚は膝を曲げ、後ろの右脚は伸ばす
  const legs = [tube([[42, 62, 2, 4], [32, 70, 5, 3.4], [28, 84, 6, 3]], "bronze", { seg: 3 }), tube([[54, 62, -1, 4], [64, 72, -2, 3.4], [74, 84, -3, 3]], "bronze", { seg: 3 })];
  const greaves = [cyl([31.5, 73, 6], [28.5, 82, 6.4], 3.4, "bronze", 1), cyl([65.5, 74, -2], [72, 82, -3], 3.4, "bronze", 1)];
  const feet = [ellipsoid([26, 86, 8], [5, 2, 3.4], "bronze"), ellipsoid([76, 86, -2], [5, 2, 3.4], "bronze")];
  // 長い矛: 柄は後ろ下から前上へ、穂先は前 (左) へ突き出す
  const shaft = cyl([90, 60, 4], [12, 44, 14], 0.9, "wood");
  const head = slab([[12, 41.6], [3, 43.6], [12, 46.4], [15, 44]], 14.2, 0.8, "bronze", 0.3, 0.3);
  const ferrule = cyl([15, 44.6, 14], [18, 45.2, 13.8], 1.4, "bronze", 0.4);
  // 背の円盾
  const shield = Disp(cyl([58, 44, -7], [60, 44, -10], 10, "bronze", 1.2), (x, y, z) => 0.3 * Math.abs(Math.sin(Math.hypot(x - 59, y - 44) * 1.4)));
  const statue = Paint(Sub(U(1.2, torso, ...skirt, helm, crest, pL, pR, armF, armB, ...gauntlets, ...legs, ...greaves, ...feet), eyeholes, 0.3), ver);
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 3, seed: 663 }), statue, plume, ...eyes, shaft, head, ferrule, Paint(shield, ver));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.12, lights: [{ p: [8, 44, 20], r: 18, k: 0.45 }] });
  const C = new Canvas(r);
  // 穂先に溜まる光: 渦巻く粒と光の輪
  const P = PHOS;
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = 6 + (i % 3); const x = 8 + Math.cos(a) * rr, y = 44 + Math.sin(a) * rr * 0.8; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, P[i % 2 ? 1 : 2]); }
  for (const [dx, dy, c] of [[0, 0, 4], [1, 0, 3], [-1, 0, 3], [0, -1, 3], [0, 1, 2], [2, 0, 2]]) C.set(6 + dx, 44 + dy, P[c]);
  // 引き絞りの気配: 体の後ろに流れる線
  for (const [y, x0, l] of [[32, 72, 10], [40, 76, 12], [50, 80, 10]]) for (let k = 0; k < l; k++) if (!C.get(x0 + k, y)) C.set(x0 + k, y, k < l * 0.4 ? "#2a4a4c" : "#16282a");
  C.set(38, 25, P[4]); C.set(43, 24, P[4]);
  ripples(C, 665);
  bubbles(C, 667, 8, [4, 4, 88, 60]);
  motes(C, 669, 14);
  return C.toArt();
}

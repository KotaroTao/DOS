import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, PHOS, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_sunkenbell", key: "hd_sunkenbell", w: 96, h: 96,
  note: "たたりの大鐘: 水没した鐘楼から落ちて床に据わった、緑青の大鐘。胴に苦悶する顔が浮き出し、口の割れ目の奥で舌 (撞木の玉) が眼のように光る。鳴り続けて魂を痺れさせる音の輪が幾重にも広がり、表面の古い文字は呪文をはね返す。縁には貝と藻" };
const TILT = Number(17);
export function build() {
  const mats = {
    bronze: { ramp: ramp(["#030504", "#09110d", "#101c16", "#182a20", "#223a2c", "#2e4c3a", "#3c604a", "#4e765c"], 8), spec: 1.2, pow: 30, specCol: "#a8d8b8", dither: 0.5, amb: 0.18,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    old: { ramp: ramp(["#060402", "#160e06", "#2a1c0c", "#423014", "#5c4620", "#7a6030"], 6), spec: 1.4, pow: 34, specCol: "#e0c890", dither: 0.45 },
    shell: { ramp: ramp(["#0a0908", "#24201a", "#423a2e", "#645a48", "#887c66"], 5), dither: 0.5, amb: 0.3 },
    algae: { ramp: ramp(["#020403", "#06100a", "#0c1c12", "#14281a"], 4), dither: 0.75, amb: 0.25 },
    tongue: { ramp: ["#3a3008", "#9a8018", "#f0d850", "#fffac0"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020302"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const R = rand(841);
  // 鐘の胴: 細い肩から裾へ大きく広がる釣鐘形。床に落ちて口を少し手前へ傾け、内の闇がのぞく
  const AX = t => [48, 22 + 55 * t, -9 + 17 * t];
  const prof = [[0, 11], [0.11, 12.6], [0.25, 13], [0.39, 13.8], [0.54, 15.4], [0.68, 17.6], [0.8, 20.2], [0.91, 22.6], [1, 24.4]];
  const bellBody = Disp(U(1.4, ellipsoid([48, 23, -9], [11.6, 5.6, 11], "bronze", 0, 17), tube(prof.map(([t, r]) => [...AX(t), r]), "bronze", { seg: 2 }), torus(AX(1), 24, 2.4, "bronze", 0, TILT)),
    (x, y, z) => 0.2 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const inside = cone(AX(0.72), AX(1.25), 15, 25, "hole");
  // 頭の吊り金具の輪と、胴を巡る帯の段
  const crownLoop = U(0.6, torus([48, 12.5, -11], 4.6, 1.8, "bronze", 0, 90), cyl([48, 15, -10.5], [48, 18.5, -10], 4.2, "bronze", 1));
  const bands = [torus(AX(0.27), 13.4, 1.1, "bronze", 0, TILT), torus(AX(0.34), 13.8, 0.9, "bronze", 0, TILT), torus(AX(0.86), 21.4, 1.3, "bronze", 0, TILT)];
  const nubs = [];
  // 胴の顔: 落ち窪んだ眼と、叫ぶ口の割れ目
  const fz = (y, r) => -9 + 17 * (y - 22) / 55 + r;
  const face = U(0, Disp(ellipsoid([42.6, 50, fz(50, 15)], [3.6, 2.6, 3.4], "hole", 15), (x, y, z) => 0.3 * vnoise(x, y)), Disp(ellipsoid([53.4, 50, fz(50, 15)], [3.6, 2.6, 3.4], "hole", -15), (x, y, z) => 0.3 * vnoise(x, y)),
    Disp(ellipsoid([48, 60, fz(60, 17.6)], [5.4, 4.6, 4.4], "hole"), (x, y, z) => 0.5 * vnoise(x * 0.8, y * 0.8)));
  const brows = [ellipsoid([42.2, 47, fz(47, 15.4)], [4, 1.2, 2], "bronze", 18), ellipsoid([53.8, 47, fz(47, 15.4)], [4, 1.2, 2], "bronze", -18)];
  const cheeks = [ellipsoid([42.8, 55.5, fz(55, 16.4)], [3, 2.4, 2.4], "bronze"), ellipsoid([53.2, 55.5, fz(55, 16.4)], [3, 2.4, 2.4], "bronze")];
  const tongue = sphere([48, 61, fz(61, 16.4)], 2.4, "tongue");
  // 古い文字の帯 (肩の帯の間) と、裾の貝・藻
  const script = (x, y, z, m) => {
    if (m !== "bronze") return m;
    if (y > 29 && y < 35 && z > -6) { const u = Math.floor((x + 40) * 0.8); return (u % 3 !== 0 && Math.sin(x * 2.4 + y * 3) > 0.2) ? "old" : m; }
    if (y > 69 && fbm(x * 0.3, y * 0.3, z * 0.3) > 0.12) return "algae";
    return m;
  };
  const shells = [];
  for (let i = 0; i < 12; i++) { const a = -0.3 + R() * 3.7, rr = 23.4 + R() * 1.2, c = AX(0.9 + R() * 0.08); shells.push(ellipsoid([c[0] + Math.cos(a) * rr, c[1] - Math.sin(a) * 2, c[2] + Math.sin(a) * rr * 0.8], [1.6, 1.2, 1.2], "shell", R() * 90)); }
  const bell = Paint(Sub(U(1, bellBody, ...brows, ...cheeks), U(0, inside, face), 0.5), script);
  const scene = U(0, templeFloor(48, 91, 46, 14, { n: 4, seed: 843, cols: 1 }), bell, crownLoop, ...bands, ...nubs, tongue, ...shells);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.12, lights: [{ p: [48, 60, 30], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 鳴り続ける音の輪 (麻痺の響き): 鐘から外へ広がる弧を左右に三重
  const S = ["#2a2a0e", "#4e4a18", "#8a8030", "#d0c060"];
  for (const [rr, c] of [[32, 3], [37, 2], [42, 1], [47, 0]]) {
    for (let a = -1.25; a <= 1.25; a += 0.01) {
      for (const side of [-1, 1]) {
        const X = Math.round(48 + side * Math.cos(a) * rr), Y = Math.round(54 + Math.sin(a) * rr * 0.9);
        if (!C.get(X, Y) && Math.sin(a * 9 + rr) > -0.6) C.set(X, Y, S[c]);
      }
    }
  }
  C.disc(48, 60.5, 1.7, "#9a8018"); C.disc(48, 60.5, 1.1, "#f0d850"); C.set(47, 60, "#fffac0");
  ripples(C, 845);
  bubbles(C, 847, 8);
  motes(C, 849, 8);
  return C.toArt();
}

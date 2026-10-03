import { tube, sphere, ellipsoid, cone, slab, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_cultist", key: "hd_cultist", w: 96, h: 96,
  note: "邪神の僧: 禁忌の印を縫い込んだ尖りフードの黒い法衣の生身の僧。顔は影に沈み、病んだ紫の眼だけが光る。痩せた手を前へ伸ばして魂を喰らおうとし、もう片手の吊り香炉から紫の煙がたなびく" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#020203", "#060508", "#0c0a10", "#141119", "#1d1824", "#272030", "#332a3e"], 7), spec: 0.35, pow: 18, dither: 0.6,
      shade: p => 0.12 * Math.sin((p.x - 46) * 0.8 + p.y * 0.06) + 0.05 * fbm(p.x * 0.4, p.y * 0.4) },
    sigil: { ramp: ramp(["#12061a", "#2c0f3e", "#4c1c68", "#7432a0", "#a05ccc"], 5), emit: p => 0.25 + 0.45 * Math.max(0, p.nz) + 0.15 * Math.max(0, -p.nx), dither: 0.5 },
    skin: { ramp: ramp(["#040504", "#121510", "#22271d", "#353b2c", "#4a503e", "#626852", "#7c8268"], 7), spec: 0.4, pow: 22, dither: 0.45 },
    iron: { ramp: ramp(["#030202", "#0e0a07", "#1c150c", "#2e2414", "#43361e", "#5c4c2c"], 6), spec: 1.3, pow: 30, specCol: "#a08860", dither: 0.4 },
    glow: { ramp: ["#2a0e3a", "#6a2a92", "#b06ae0", "#ecc8ff"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020103"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE,
  };
  // 尖りフード: 後ろへ垂れる先端。開口は深い闇
  const hood = Disp(U(2, ellipsoid([46, 23, 1], [8, 9, 7.5], "robe", -6), cone([48, 20, -3], [56, 8, -8], 6, 1, "robe")), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5));
  const cowl = ellipsoid([44.5, 25, 8], [5, 6.2, 4.6], "hole", -6);
  // 法衣: 肩から裾へ広がる。前へわずかに傾ぐ
  const shoulders = ellipsoid([47, 38, 0], [11, 7, 7], "robe");
  const robeBody = Disp(cone([47, 38, 0], [48, 88, 0], 9.5, 17, "robe"), (x, y, z) => 1.1 * Math.sin(Math.atan2(z, x - 48) * 6 + y * 0.08) * Math.max(0, (y - 50) / 38));
  const hemCut = (x, y, z) => 0;
  // 前へ伸ばした痩せた手 (広い袖から)
  const sleeveA = Disp(cone([39, 38, 2], [27, 45, 8], 3.6, 5, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.4));
  const sleeveHole = ellipsoid([26.4, 45.4, 8.4], [1.2, 3.6, 3.6], "hole", 30);
  const armA = tube([[29, 44, 8, 1.4], [22, 45, 10, 1.1]], "skin");
  const palm = ellipsoid([20.5, 45, 10.5], [2.4, 2.8, 1.6], "skin", 10);
  const fing = [];
  for (const [dx, dy, a] of [[-1, -2, 200], [-1.5, -0.6, 185], [-1.5, 0.8, 172], [-1, 2, 158]]) {
    const r = a * Math.PI / 180;
    fing.push(tube([[20 + dx * 0.5, 45 + dy, 10.6, 0.7], [20 + dx + Math.cos(r) * 4.6, 45 + dy * 1.3 + Math.sin(r) * 4.6, 11.4, 0.65], [20 + dx + Math.cos(r) * 8, 45 + dy * 1.3 + Math.sin(r) * 8 + 1.6, 12, 0.35]], "skin", { seg: 2 }));
  }
  const thumb = tube([[21.5, 47, 11, 0.7], [19, 49.5, 12, 0.55], [17, 50, 12.4, 0.35]], "skin", { seg: 2 });
  // もう片手: 垂らした袖と吊り香炉
  const sleeveB = Disp(cone([56, 38, 0], [63, 54, 4], 3.6, 5.2, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.4));
  const handB = U(0.6, ellipsoid([64, 56.5, 5], [2, 2.2, 2], "skin"), tube([[63, 57, 6, 0.7], [62.4, 59.6, 6.8, 0.5]], "skin"));
  const chain = [];
  for (let k = 0; k < 6; k++) chain.push(torus([65 + k * 0.9, 59.5 + k * 2.2, 6], 0.9, 0.35, "iron", 70, k % 2 ? 0 : 90));
  const censer = U(0.6, Sub(sphere([70.5, 75.5, 6], 4.6, "iron"), U(0, ...[[-3, 0.2], [-1.5, 0.5], [0, 0.6], [1.5, 0.5], [3, 0.2]].map(([dx, dy]) => sphere([70.5 + dx, 75.5 + dy, 10.4 - Math.abs(dx) * 0.7], 1.05, "glow"))), 0.2),
    cone([70.5, 71, 6], [70.5, 67.6, 6], 3.2, 0.8, "iron"), cyl([70.5, 79.4, 6], [70.5, 81, 6], 2.2, "iron", 0.4));
  const ember = sphere([70.5, 75.5, 6], 3.6, "glow");
  // 法衣に縫い込んだ禁忌の印: 胸の円環と三角、前垂れの文字列、裾の帯
  const sig = (x, y, z, m) => {
    if (m !== "robe" || z < 2) return m;
    const dx = x - 47, dy = y - 47, rr = Math.hypot(dx, dy);
    if (rr > 4.8 && rr < 5.8) return "sigil";
    if (rr < 4.8 && (Math.abs(dx) < 0.55 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.6)) return "sigil";
    if (rr > 5.8 && rr < 7.6 && Math.abs(dx) < 0.55) return "sigil";
    if (Math.abs(x - 47.6) < 1.3 && y > 56 && y < 82) {
      const g = Math.floor((y - 56) / 4.5), fy = (y - 56) % 4.5, ax = x - 47.6;
      if (fy > 3.4) return m;
      const k = g % 3;
      if (k === 0) return (Math.abs(ax) < 0.5 || fy < 0.9) ? "sigil" : m;
      if (k === 1) return Math.abs(ax + (fy - 1.7) * 0.7) < 0.55 ? "sigil" : m;
      return (Math.abs(ax) > 0.6 && fy > 1) || fy < 0.8 ? "sigil" : m;
    }
    if (y > 83.5 && y < 85.6) return ((Math.floor(x / 2.5)) % 3 === 0) ? m : "sigil";
    return m;
  };
  const robe = Paint(Sub(U(1.6, hood, shoulders, robeBody), cowl, 0.8), sig);
  const eyes = [sphere([42.6, 24.6, 7.4], 0.9, "glow"), sphere([46.6, 24.4, 7.4], 0.9, "glow")];
  const feet = [ellipsoid([42, 88.6, 9], [3.4, 1.8, 3.4], "robe"), ellipsoid([53, 88.6, 9], [3.4, 1.8, 3.4], "robe")];
  const scene = U(0, flagstones(48, 92, 40, 13, { n: 5, seed: 461, big: 3 }), robe, ...eyes, Sub(sleeveA, sleeveHole, 0.4), armA, palm, ...fing, thumb, sleeveB, handB, ...chain, censer, ember, ...feet);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [70, 76, 14], r: 22, k: 0.55 }, { p: [44, 25, 12], r: 9, k: 0.3 }] });
  const C = new Canvas(r);
  // 病んだ紫の眼光
  C.set(42, 24, "#ecc8ff"); C.set(46, 24, "#ecc8ff");
  // 香炉から立ちのぼる紫の煙: 右上へうねる筋
  const Sm = ["#1a0c24", "#2c1440", "#44205e", "#64347e"];
  const R = rand(463);
  for (let s = 0; s < 3; s++) {
    let x = 70 + (s - 1) * 2.5, y = 66;
    for (let k = 0; k < 34; k++) {
      x += 0.25 + Math.sin(k * 0.3 + s * 2.1) * 1.1; y -= 1.1;
      if (y < 14) break;
      const c = Sm[Math.max(0, 3 - Math.floor(k / 9))];
      if (!C.get(Math.round(x), Math.round(y)) && R() < 0.75 - k * 0.012) C.set(x, y, c);
    }
  }
  // 伸ばした手へ引き寄せられる魂のかけら
  const Sv = ["#2c0f3e", "#7432a0", "#ecc8ff"];
  for (let k = 0; k < 7; k++) { const x = 4 + k * 1.6, y = 44 + Math.sin(k * 0.9) * 3; if (k % 2 === 0 && !C.get(Math.round(x), Math.round(y))) C.set(x, y, Sv[Math.min(2, Math.floor(k / 3))]); }
  grit(C, 467, 48, 91, 36, 18);
  ash(C, 469, 3, [4, 56, 26, 30]);
  return C.toArt();
}

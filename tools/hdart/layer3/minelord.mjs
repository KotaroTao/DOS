import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri, cracks } from "../mine.mjs";
export const meta = { id: "bs_minelord", key: "hd_minelord", w: 112, h: 128,
  note: "坑道の主 (層ボス): 崩れた坑道の岩を寄せ集めて立ち上がった巨人。折れた坑木と捩れた軌条を冠に戴き、髑髏めいた岩の顔に裂けた大口。胸の岩殻が割れて燃える鉱脈の心臓が脈打ち、両腕には坑の鎖が巻きつく。足元の瓦礫からは岩喰いの蟲が首をもたげる" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    rock: { ramp: ramp(["#030302", "#090807", "#110f0d", "#1a1714", "#24201c", "#2f2a24", "#3c352d", "#4c4338", "#5e5345"], 9), spec: 0.5, pow: 25, specCol: "#8c7c66", dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) },
    ore: { ramp: ramp(["#040404", "#0c0e10", "#161b1f", "#222a30", "#303c44", "#425260", "#5a6e7c"], 7), spec: 1.8, pow: 60, specCol: "#c8dce8", dither: 0.4 },
    heart: { ramp: ["#2a0602", "#5a1404", "#9a3008", "#d8600e", "#f8a030", "#ffd070", "#fff4c0"], emit: p => 0.12 + 0.62 * Math.max(0, p.nz) ** 2 + 0.3 * fbm(p.x * 0.45, p.y * 0.45, 2) },
    melt: { ramp: ["#3a0a02", "#7a2006", "#c04a0c", "#f08a20", "#ffc860"], emit: p => 0.35 + 0.5 * Math.max(0, p.nz) },
    wood: { ramp: ramp(["#030201", "#0d0805", "#1a110a", "#281a0f", "#372415", "#48301c", "#5a3c24"], 7), dither: 0.55, shade: p => 0.12 * Math.sin(p.x * 0.4 + p.y * 1.8) },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66"], 7), spec: 1.2, pow: 40, specCol: "#a0a8b4", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    worm: { ramp: ramp(["#030302", "#0d0b08", "#1a1610", "#28221a", "#373024", "#4a4030", "#5e5240"], 7), spec: 0.5, pow: 25, dither: 0.55 },
    maw: { ramp: ["#000000", "#000000", "#100303", "#200606"], amb: 0.1, dif: 0.4, noRim: true },
    eye: { ramp: ["#3a1000", "#8a3004", "#e07010", "#fff0a0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    gravel: GRAVEL,
  };
  const R = rand(201);
  const lumpy = (k = 0.9, f = 0.22) => (x, y, z) => cracks(k, f)(x, y, z) + 0.35 * fbm(x * 0.35, y * 0.35, z * 0.35);
  // 体: 前のめりの巨躯。胸の岩殻、盛り上がる肩、瓦礫に沈む腰
  const chest = ellipsoid([56, 60, -2], [30, 24, 18], "rock");
  const belly = ellipsoid([56, 84, -4], [24, 14, 16], "rock");
  const shL = ellipsoid([24, 46, -2], [15, 13, 14], "rock", 20), shR = ellipsoid([88, 46, -4], [15, 13, 14], "rock", -20);
  const bould = [];
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, rr = 0.7 + R() * 0.35; bould.push(box([56 + Math.cos(a) * 30 * rr, 64 + Math.sin(a) * 22 * rr, 6 + R() * 6], [4 + R() * 5, 3 + R() * 4, 5], R() < 0.25 ? "ore" : "rock", 2, R() * 90)); }
  const armL = tube([[22, 52, 2, 11], [12, 74, 8, 9.5], [12, 94, 14, 9]], "rock"), armR = tube([[90, 52, 0, 11], [100, 74, 6, 9.5], [100, 94, 12, 9]], "rock");
  const fistL = box([12, 102, 16], [10, 8, 9], "rock", 4, 6), fistR = box([100, 102, 14], [10, 8, 9], "rock", 4, -6);
  const head = ellipsoid([56, 32, 12], [14, 13, 12], "rock");
  const brow = ellipsoid([56, 26, 21], [13, 4, 5], "rock");
  const jaw = ellipsoid([56, 42, 18], [12, 6, 8], "rock");
  const body = Paint(Disp(U(4, chest, belly, shL, shR, ...bould, armL, armR, fistL, fistR, head, brow, jaw), lumpy()),
    (x, y, z, m) => (m === "rock" && Math.abs(vnoise(x * 0.075, y * 0.06, z * 0.075) + 0.2 * vnoise(x * 0.3, y * 0.3, z * 0.3)) < 0.03 && y > 48) ? "melt" : m);
  // 胸の割れ目と、燃える鉱脈の心臓
  const rift = Disp(ellipsoid([54, 62, 22], [9, 13, 12], "maw", 12), (x, y, z) => 1.2 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const heart = Disp(sphere([54, 63, 8], 9, "heart"), (x, y, z) => 0.8 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const mouth = ellipsoid([56, 40, 27], [8, 3.4, 6], "maw");
  const sockets = U(0, ellipsoid([50, 31, 24], [3.2, 2.6, 4], "maw"), ellipsoid([62, 31, 24], [3.2, 2.6, 4], "maw"));
  const lord = Sub(body, U(0, rift, mouth, sockets), 1.2);
  const eyes = [sphere([50, 31.5, 21.5], 1.6, "eye"), sphere([62, 31.5, 21.5], 1.6, "eye")];
  // 冠: 折れた坑木の枠と、捩れた軌条
  const crown = [box([56, 16, 8], [16, 2.2, 2.4], "wood", 0.6, -6), box([42, 10, 7], [2.2, 9, 2.2], "wood", 0.5, -14), box([70, 8, 7], [2.2, 10, 2.2], "wood", 0.5, 12), box([56, 6, 5], [2, 8, 2], "wood", 0.5, 4)];
  const rail = tube([[30, 22, 12, 1.4], [34, 12, 14, 1.4], [44, 4, 12, 1.4], [58, 2, 10, 1.4], [74, 6, 12, 1.4], [84, 14, 14, 1.4], [86, 24, 12, 1.4]], "iron");
  // 腕の鎖
  const links = [];
  const chain = (pts, n) => { const s = arcParam(pts); for (let i = 0; i < n; i++) { const t = i / (n - 1); const k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), f = t * (pts.length - 1) - k; const p = pts[k].map((v, c) => v + (pts[k + 1][c] - v) * f); links.push(torus(p, 2.2, 0.8, "iron", 30 + i * 40, i % 2 ? 0 : 90)); } };
  chain([[4, 78, 14], [12, 74, 20], [22, 80, 16], [16, 88, 22]], 8);
  chain([[108, 70, 10], [100, 66, 18], [92, 74, 16], [100, 84, 20], [108, 92, 16]], 9);
  // 足元の瓦礫と、首をもたげる岩喰いの蟲
  // 蟲: 瓦礫から立ち上がり、口を手前へ向ける (体節の溝つき)
  const worm = (pts) => { const e = pts[pts.length - 1]; const s = arcParam(pts.map(p => p.slice(0, 3)));
    return [Sub(Disp(U(1, tube(pts, "worm", { seg: 4 }), sphere([e[0], e[1], e[2]], e[3] * 1.15, "worm")), (x, y, z) => 0.9 * Math.max(0, Math.cos(s(x, y, z) * 0.8)) ** 10), sphere([e[0], e[1], e[2] + e[3] * 1.4], e[3] * 0.75, "maw"), 0.5)]; };
  const W1 = [[24, 126, 6, 5], [20, 114, 10, 5], [24, 104, 16, 5.2], [32, 100, 22, 5.6]], W2 = [[92, 126, 8, 4.6], [96, 116, 12, 4.6], [92, 108, 18, 4.8], [84, 106, 24, 5]];
  const worms = [...worm(W1), ...worm(W2)];
  const scene = U(0, rubble(56, 120, 56, 20, { n: 14, seed: 203, big: 5 }), lord, ...eyes, heart, ...crown, rail, ...links, ...worms);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [54, 62, 30], r: 34, k: 0.55 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 48, 64, { step: 2, top: [2, 4], bot: [2, 3], cols: ["#2a2418", "#6a5e44", "#a89a74"], seed: 7 });
  // 蟲の口の歯の輪
  for (const [mx, my, rr] of [[32, 100, 3.6], [84, 106, 3.2]]) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; C.set(mx + Math.cos(a) * rr, my + Math.sin(a) * rr, "#a89a74"); C.set(mx + Math.cos(a) * (rr - 1), my + Math.sin(a) * (rr - 1), "#5e5240"); }
  // 心臓の表面を走る黒い割れ目
  for (const [x0, y0, x1, y1] of [[48, 58, 54, 63], [54, 63, 52, 70], [54, 63, 61, 60], [57, 66, 60, 70]]) C.line(x0, y0, x1, y1, "#5a1404");
  // 心臓から漏れる火の粉と、瓦礫の上の熱の照り
  const M = ["#5a1404", "#9a3008", "#d8600e", "#f8a030"];
  for (let i = 0; i < 24; i++) { const x = 30 + R() * 52, y = 4 + R() * 70; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, M[1 + Math.floor(R() * 3)]); }
  pebbles(C, 211, 56, 118, 52, 36);
  return C.toArt();
}

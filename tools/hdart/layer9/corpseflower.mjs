import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes } from "../swamp.mjs";
export const meta = { id: "bs_corpseflower", key: "hd_corpseflower", w: 96, h: 96,
  note: "屍肉花: 骨の山に根を下ろした、赤黒い肉厚の花びらの巨大な食人花。花の中心は牙の並ぶ穴になっていて、その上に甘い光を放つ雌しべが揺れ、死臭とともに漂う桃色の花粉が心を奪う (魅了・多用)。まわりの太いつるは刈られても刈られても伸び直す (再生)" };
export function build() {
  const mats = {
    petal: { ramp: ramp(["#060203", "#140508", "#24090e", "#360e15", "#4a161c", "#601f24", "#7a2c2e", "#94403a"], 8), spec: 0.6, pow: 20, dither: 0.5, amb: 0.24,
      shade: p => 0.1 * Math.sin(Math.atan2(p.y - 58, p.x - 48) * 9) },
    spot: { ramp: ramp(["#1a1608", "#3a3216", "#5e5228", "#8a7c44"], 4), dither: 0.4 },
    vine: { ramp: ramp(["#020301", "#070b05", "#0e1609", "#16210e", "#1f2d13", "#2a3b19"], 6), dither: 0.5, amb: 0.22, spec: 0.4, pow: 18 },
    bone: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054"], 5), dither: 0.45, amb: 0.3 },
    maw: { ramp: ["#000000", "#100204", "#240608", "#3a0c10"], dither: 0.4, amb: 0.05 },
    lure: { ramp: ["#4a1a3a", "#8a3a6a", "#d07ab0", "#ffd0ec"], noRim: true, emit: p => 0.5 + 0.45 * Math.max(0, p.nz) },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 五枚の花びら (中心 48, 60 の周り、手前へ倒れる)
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5, cx = 48 + Math.cos(a) * 15, cy = 62 + Math.sin(a) * 9;
    petals.push(Disp(ellipsoid([cx, cy, 2 + Math.sin(a) * 2], [12, 7.4, 10], "petal", a * 180 / Math.PI, 30 + Math.sin(a) * 20), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3, z * 0.3)));
  }
  const throat = U(2, ellipsoid([48, 62, 6], [10, 6, 9], "petal"));
  const maw = ellipsoid([48, 60, 13], [6.4, 4, 5], "maw");
  const style = tube([[48, 58, 6, 1.4], [46, 46, 8, 1.1], [50, 36, 9, 0.8]], "vine");
  const lure = sphere([50, 34, 9], 3, "lure");
  // つる
  const R = rand(10301);
  const vines = [];
  for (const [x0, x1, x2, y2, z] of [[34, 22, 8, 60, 6], [62, 76, 88, 56, 4], [38, 20, 6, 82, 12], [60, 78, 90, 84, 12], [44, 30, 18, 40, -6]]) vines.push(tube([[x0, 70, z, 3], [x1, 66 + (y2 - 66) * 0.4, z + 2, 2.2], [x2, y2, z + 2, 1]], "vine", { seg: 4 }));
  const thorns = vines.length ? [] : [];
  // 骨の山
  const bones = [ellipsoid([24, 88, 8], [4, 3.6, 3.4], "bone", 20), tube([[60, 90, 10, 1.4], [74, 88, 12, 1.2]], "bone"), tube([[30, 92, 14, 1.2], [40, 90, 16, 1]], "bone"), ellipsoid([70, 86, -6], [3.6, 3.4, 3], "bone")];
  const stem = cone([48, 92, -2], [48, 70, 0], 8, 6, "vine");
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 2, seed: 10303, wet: 0, logs: 0 }), stem, Sub(U(1.2, ...petals, throat), maw, 0.6), style, lure, ...vines, ...bones);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [50, 34, 18], r: 22, k: 0.45 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 42, 54, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#3a3424", "#8a8064", "#d0c8a8"], seed: 10305 });
  // 花びらの黄ばんだ斑点
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "petal" && Math.sin(p.x * 1.3) * Math.sin(p.y * 1.4 + p.z) > 0.75) C.set(x, y, p.sh > 0.5 ? "#5e5228" : "#3a3216"); }
  // つるの棘
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "vine" && p.ny < -0.5 && (x * 5 + y * 3) % 11 === 0 && !C.get(x, y - 1)) C.set(x, y - 1, "#2a3b19"); }
  // 心を奪う桃色の花粉 (雌しべから漂う)
  const pc = ["#2a1024", "#4a1a3a", "#8a3a6a", "#d07ab0", "#ffd0ec"];
  for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, d = 4 + R() * R() * 34, x = 50 + Math.cos(a) * d * 1.2, y = 30 + Math.sin(a) * d * 0.7; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, pc[Math.max(0, Math.min(4, 4 - Math.floor(d / 8) - (R() < 0.5 ? 1 : 0)))]); }
  // ハートに似た小さな光の形を二つ
  for (const [hx, hy] of [[24, 22], [74, 18]]) for (const [dx, dy] of [[0, 0], [2, 0], [-1, -1], [3, -1], [1, 1], [0, 1], [2, 1], [1, 2]]) if (!C.get(hx + dx, hy + dy)) C.set(hx + dx, hy + dy, dy === -1 ? pc[3] : pc[2]);
  scum(C, 10307);
  motes(C, 10309, 10, [2, 60, 92, 30], true);
  return C.toArt();
}

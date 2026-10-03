import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
export const meta = { id: "bs_ratking", key: "hd_ratking", w: 96, h: 96,
  note: "溝鼠の王: 尾が固く結ばれ一つの塊になった溝鼠の群れ。手前の結び目から四方へ這い出そうと頭を突き出し、黄ばんだ前歯を剥く。赤い眼、濡れて逆立つ毛" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030303", "#090807", "#120f0c", "#1c1712", "#28201a", "#362c22", "#4a3c2e", "#625040"], 8), spec: 0.4, pow: 18, specCol: "#8a7a66", dither: 0.7,
      shade: p => 0.12 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    skin: { ramp: ramp(["#060404", "#170f0f", "#2a1b1a", "#3e2a26", "#583c34", "#745248"], 6), spec: 0.8, pow: 30, specCol: "#d0a898", dither: 0.4 },
    fur2: { ramp: ramp(["#030303", "#080808", "#0f0f0e", "#181816", "#22221e", "#2e2e28", "#3e3e36", "#54544a"], 8), spec: 0.4, pow: 18, specCol: "#8a8a7a", dither: 0.7,
      shade: p => 0.12 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    tail: { ramp: ramp(["#050404", "#150e0d", "#281b18", "#3e2c26", "#584034", "#765848"], 6), spec: 1, pow: 35, specCol: "#c8a898", dither: 0.4,
      shade: p => 0.1 * Math.sin(p.x * 2.4 + p.y * 2.4) },
    eye: { ramp: ["#200000", "#701008", "#c02a10", "#ff6a30"], emit: p => 0.5 + 0.5 * p.nz },
    water: WATER,
  };
  const K = [48, 70, 10]; // 結び目
  // 鼠: [頭の向き(度), 体の付け根からの距離, 奥行き, 大きさ]
  const RATS = [[-168, 0, -4, 0.92], [-124, 0, -10, 0.86], [-84, 0, -14, 0.86], [-44, 0, -10, 0.86], [-8, 0, -4, 0.92], [150, 0, 10, 1.0], [30, 0, 10, 1.0]];
  const rats = [];
  const ends = [];
  for (const [ri, [deg, , z0, k]] of RATS.entries()) {
    const F = ri % 2 ? "fur2" : "fur";
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const P = (d, h = 0, dz = 0) => [K[0] + (ca * d - sa * h) * k * 1.3, K[1] + (sa * d + ca * h) * k * 1.25, K[2] + z0 + dz * k * 1.3];
    const hips = ellipsoid(P(10, 0, -2), [7.8 * k, 7.1 * k, 7.1 * k], F, deg);
    const body = ellipsoid(P(17, 0, 0), [10.4 * k, 8.4 * k, 8.4 * k], F, deg);
    const head = ellipsoid(P(26, 0, 3), [7.1 * k, 5.6 * k, 6.2 * k], F, deg);
    const snout = cone(P(28, 0, 3.5), P(36, 0, 4), 4.6 * k, 1.3 * k, F);
    const nose = sphere(P(36.2, 0, 4.2), 1.5 * k, "skin");
    const ears = [ellipsoid(P(24, -4.5, 7), [2.6 * k, 3.0 * k, 0.8 * k], "skin", deg + 30), ellipsoid(P(24, 4.5, 7), [2.6 * k, 3.0 * k, 0.8 * k], "skin", deg - 30)];
    const eyes = [sphere(P(29.5, -2.8, 6.5), 1.35 * k, "eye"), sphere(P(29.5, 2.8, 6.5), 1.35 * k, "eye")];
    const paws = [tube([[...P(21, 5, 2), 1.5 * k], [...P(25, 8, 4), 1.1 * k], [...P(27, 8.5, 5), 0.8 * k]], "skin"), tube([[...P(21, -5, 2), 1.5 * k], [...P(25, -8, 4), 1.1 * k], [...P(27, -8.5, 5), 0.8 * k]], "skin")];
    rats.push({ deg, z0, node: [Disp(U(2, hips, body, head, snout), (x, y, z) => 0.25 * fbm(x * 0.9, y * 0.9, z * 0.9)), nose, ...ears, ...eyes], tip: P(35, 0, 4), k });
    ends.push(P(5, 0, -2));
  }
  // 尾: 各鼠の尻から結び目へ、絡み合いながら集まる
  const R = rand(3);
  const tails = ends.map((e, i) => { const m = [(e[0] + K[0]) / 2 + (R() - 0.5) * 8, (e[1] + K[1]) / 2 + (R() - 0.5) * 6, (e[2] + K[2]) / 2 + 8]; return tube([[...e, 2.2], [...m, 1.8], [K[0] + Math.cos(i * 0.8) * 3, K[1] + Math.sin(i * 0.8) * 2, K[2] + 2, 1.4]], "tail", { seg: 4 }); });
  const knot = []; for (let i = 0; i < 6; i++) { const pts = []; for (let t = 0; t <= 1.001; t += 0.1) { const a = i * 1.1 + t * 7, r = 3.5 + 2 * Math.sin(t * 9 + i); pts.push([K[0] + Math.cos(a) * r * 1.4, K[1] + Math.sin(a) * r, K[2] + 6 + Math.sin(a * 1.5) * 3, 1.6]); } knot.push(tube(pts, "tail", { seg: 2 })); }
  const scene = U(0, puddle(48, 90, 40, 14), ...rats.flatMap(r => r.node), ...tails, ...knot);
  const rr = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(rr);
  // 前歯と髭
  for (const r of rats) { const a = r.deg * Math.PI / 180; const [x, y] = r.tip; const nx = -Math.sin(a), ny = Math.cos(a);
    C.set(x + nx * 1.2 + Math.cos(a), y + ny * 1.2 + 1, "#d8c890"); C.set(x + nx * 1.2 + Math.cos(a) * 1.5, y + ny * 1.2 + 2, "#a8985c");
    for (const s of [-1, 1]) for (let i = 1; i < 6; i++) { const wx = x - Math.cos(a) * 2 + s * nx * i * 0.9 + Math.cos(a) * i * 0.6, wy = y - Math.sin(a) * 2 + s * ny * i * 0.6 + i * 0.25; if (!C.get(Math.round(wx), Math.round(wy)) && i % 2) C.set(wx, wy, "#4a3c2e"); } }
  // 逆立つ毛先
  for (let i = 0; i < 260; i++) { const x = Math.floor(R() * 96), y = Math.floor(R() * 96); const p = C.pix[y * 96 + x]; if (!p || (p.m !== "fur" && p.m !== "fur2")) continue; for (const [dx, dy] of [[0, -1], [1, -1], [-1, -1]]) if (!C.get(x + dx, y + dy)) { C.set(x + dx, y + dy, "#1c1712"); break; } }
  ripples(C, 48, 90, 42);
  return C.toArt();
}

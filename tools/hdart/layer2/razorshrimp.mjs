import { tube, sphere, ellipsoid, cone, slab, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { arcParam } from "../arc.mjs";
export const meta = { id: "bs_razorshrimp", key: "hd_razorshrimp", w: 96, h: 96,
  note: "鎌首の大蝦: 身を起こして鎌の前肢を畳み構える大蝦蛄。柄の先の縞の入った眼、節ごとの甲板の縁は錆色、尾扇を床に突く" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#020304", "#050c0b", "#0a1614", "#11221d", "#1a3027", "#264232", "#36583e", "#4e7450"], 8), spec: 2, pow: 50, specCol: "#d0ecc0", dither: 0.5 },
    edge: { ramp: ramp(["#030202", "#100705", "#200e08", "#34160a", "#4c200e", "#682e14", "#8a421e"], 7), spec: 1.6, pow: 45, specCol: "#ffd0a8", dither: 0.5 },
    claw: { ramp: ramp(["#030303", "#0c0a08", "#1a1610", "#2c2418", "#423624", "#5e4e34", "#82704a", "#b4a274"], 8), spec: 2.2, pow: 60, specCol: "#fff0d4", dither: 0.45 },
    eye: { ramp: ramp(["#020606", "#0a2222", "#144040", "#24605a", "#40887a", "#78bca4"], 6), spec: 2.5, pow: 70, specCol: "#ffffff", amb: 0.3,
      shade: p => ((Math.floor(p.y * 1.2) % 2) ? -0.2 : 0.05) },
    leg: { ramp: ramp(["#030303", "#0c0908", "#1a130e", "#2a1e16", "#3e2c20"], 5), dither: 0.5 },
    water: WATER,
  };
  // 体: 尾扇 (右下) から腹節が弧を描いて上り、胸と頭 (左上) で前へ屈む
  const spine = [[78, 84, -2, 5], [82, 74, 0, 6.5], [80, 63, 1, 7.5], [74, 53, 2, 8.5], [66, 45, 3, 9], [57, 39, 4, 9], [48, 34, 5, 8.5], [40, 30, 6, 7.5], [33, 27, 7, 6]];
  const s = arcParam(spine);
  const groove = (x, y, z) => { const f = Math.abs(Math.sin(s(x, y, z) * Math.PI / 7.5)); return 1.3 * Math.pow(1 - f, 5) - 0.2 + 0.15 * fbm(x * 0.7, y * 0.7, z * 0.7); };
  const edgeFn = (x, y, z, m) => { if (m !== "shell") return m; const f = (s(x, y, z) / 7.5) % 1; return (f > 0.08 && f < 0.22 && s(x, y, z) < 64) ? "edge" : m; };
  const body = Paint(Disp(tube(spine, "shell", { seg: 6, k: 1 }), groove), edgeFn);
  const rostrum = cone([30, 26, 8], [22, 24, 9], 2.4, 0.4, "edge");
  const stalks = [tube([[34, 23, 9, 1.4], [32, 15, 11, 1.2]], "leg"), tube([[38, 23, 3, 1.4], [40, 14, 3, 1.2]], "leg")];
  const eyes = [ellipsoid([32, 12, 11], [2.6, 3.8, 2.6], "eye", -10), ellipsoid([40, 11, 3], [2.6, 3.8, 2.6], "eye", 10)];
  // 鎌の前肢: 前へ突き出した上腕、肘で折れて鎌 (指節) を胸へ畳む
  const armA = tube([[40, 36, 12, 3.2], [26, 44, 18, 3.6], [16, 38, 22, 4.2]], "claw");
  const club = ellipsoid([16, 37, 22], [5, 4, 4.4], "claw", -30);
  const blade = slab([[18, 33], [22, 26], [28, 22], [34, 22], [38, 24], [32, 25], [26, 29], [21, 35]], 22, 2.4, "claw", 0.9, 0.8);
  const spikes = []; for (let i = 0; i < 4; i++) spikes.push(cone([25 + i * 3, 27 - i * 0.9, 22], [25.5 + i * 3, 30.5 - i * 0.9, 22], 0.8, 0.1, "claw"));
  const armB = tube([[46, 38, -4, 2.8], [34, 46, -2, 3], [26, 42, 0, 3.4]], "claw");
  const bladeB = slab([[28, 40], [32, 33], [38, 30], [42, 32], [36, 34], [30, 40]], 0, 2, "claw", 0.8, 0.6);
  const legs = []; for (let i = 0; i < 4; i++) legs.push(tube([[50 + i * 5, 40 + i * 3, 8, 1.4], [46 + i * 6, 50 + i * 3, 10, 1.1], [44 + i * 6, 58 + i * 3, 10, 0.6]], "leg"));
  const swim = []; for (let i = 0; i < 4; i++) swim.push(slab([[70 + i * 2, 50 + i * 7], [62 + i * 3, 56 + i * 7], [64 + i * 3, 60 + i * 7], [72 + i * 2, 56 + i * 7]], 8, 0.8, "leg", 0.3));
  const fan = slab([[74, 84], [64, 88], [60, 93], [70, 93], [78, 89], [84, 94], [94, 92], [90, 86], [82, 81]], 0, 1.4, "edge", 0.6);
  const scene = U(0, puddle(74, 92, 22, 10), fan, armB, bladeB, ...swim, body, ...legs, rostrum, ...stalks, ...eyes, armA, club, blade, ...spikes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  const A = ["#2a1e16", "#4e3a28"];
  let x = 30, y = 24; for (let i = 0; i < 24; i++) { x -= 1.0; y -= 0.9 - i * 0.05; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, A[i < 8 ? 1 : 0]); }
  x = 31; y = 22; for (let i = 0; i < 22; i++) { x -= 0.5; y -= 0.9 - i * 0.02; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, A[0]); }
  const R = rand(6); const S = ["#2c4446", "#4e6c6e", "#86a4a4"];
  for (let i = 0; i < 16; i++) { const sx = 4 + R() * 16, sy = 30 + R() * 22; if (!C.get(Math.round(sx), Math.round(sy))) C.set(sx, sy, S[Math.floor(R() * 3)]); }
  ripples(C, 74, 92, 22);
  return C.toArt();
}

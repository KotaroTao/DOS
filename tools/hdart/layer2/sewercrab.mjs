import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { WATER, puddle, ripples, RIM } from "../lib.mjs";
export const meta = { id: "bs_sewercrab", key: "hd_sewercrab", w: 96, h: 96,
  note: "鋏の大蟹: 鋼のような甲羅の大蟹を正面から。鋸歯の縁と棘、両の大鋏を拳のように構え、汚水に錆が浮く" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#030304", "#090b0d", "#11161a", "#1b2227", "#273036", "#384348", "#55625f"], 7), spec: 1.1, pow: 60, specCol: "#a8b8b4", dither: 0.5 },
    rust: { ramp: ramp(["#050302", "#170b05", "#2c1508", "#44200c", "#5e3012", "#7e4820"], 6), spec: 0.3, pow: 20, dither: 0.6 },
    joint: { ramp: ramp(["#040304", "#140e10", "#271c1c", "#3c2c28", "#564036"], 5), spec: 0.4, pow: 20, dither: 0.5 },
    tip: { ramp: ramp(["#040404", "#141210", "#2a2622", "#484038", "#786c5c"], 5), spec: 1.2, pow: 50, specCol: "#e8e0cc", dither: 0.4 },
    eye: { ramp: ["#000000", "#1a0404", "#3e0a08", "#6a1a10"], spec: 2, pow: 60, specCol: "#ffd8c0", amb: 0.3 },
    water: WATER,
  };
  const rust = (x, y, z, m) => (m === "shell") && fbm(x * 0.11 + 3, y * 0.11, z * 0.11, 4) > 0.22 ? "rust" : m;
  const pit = (x, y, z) => 0.9 * Math.max(0, vnoise(x * 0.4, y * 0.4, z * 0.4) - 0.3) + 0.3 * fbm(x * 0.8, y * 0.8, z * 0.8);
  const cara = Disp(ellipsoid([48, 42, 0], [26, 13, 15], "shell"), pit);
  const brow = ellipsoid([48, 36, 9], [15, 5, 6], "shell");
  const spikes = [];
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) spikes.push(cone([48 + s * (15 + i * 2.5), 33 + i * 2.8, 5 - i], [48 + s * (20 + i * 3), 29 + i * 3.2, 5 - i], 2.2, 0.2, "shell"));
  const front = []; for (let i = -3; i <= 3; i++) front.push(cone([48 + i * 4, 30, 11], [48 + i * 4, 26 - (i % 2 ? 0 : 1.5), 12], 1.7, 0.2, "shell"));
  const stalkL = tube([[43, 32, 12, 1.5], [41, 24, 14, 1.2]], "joint"), stalkR = tube([[53, 32, 12, 1.5], [55, 24, 14, 1.2]], "joint");
  const eyeL = sphere([41, 23, 14], 2.3, "eye"), eyeR = sphere([55, 23, 14], 2.3, "eye");
  // 脚: 甲羅の脇から一度持ち上がり (膝が甲羅より高い)、鋭い爪先で床を突く
  const legs = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const bx = 48 + s * (19 + i * 1.5), by = 44 + i * 2.5, z = 2 - i * 4;
    const kx = 48 + s * ([26, 31, 35, 37][i]), ky = [40, 32, 29, 34][i], fx = 48 + s * ([36, 44, 47, 47][i]), fy = [86, 76, 60, 48][i];
    legs.push(tube([[bx, by, z, 3.0], [kx, ky, z - 1, 2.6]], "shell"), tube([[kx, ky, z - 1, 2.6], [(kx + fx) / 2 + s * 1, (ky + fy) / 2 - 1, z - 1, 2.0], [fx, fy, z, 0.5]], "shell"), sphere([kx, ky, z - 1], 2.7, "joint"));
  }
  // 大鋏: 甲羅の前に構え、鋏先は内側を向いて噛み合う
  function chela(s, k) {
    const X = dx => 48 + s * dx, Y = dy => dy;
    const arm = tube([[X(14), 50, 6, 4], [X(27), 56, 12, 4.4], [X(24), 66, 18, 4.6]], "shell");
    const palm = Disp(ellipsoid([X(24), 68, 20], [11 * k, 9 * k, 8 * k], "shell", s * 15), pit);
    const ox = X(24 - 7 * k), oy = 68;
    const P = pts => pts.map(([dx, dy]) => [ox - s * dx * k, oy + dy * k]);
    const upper = slab(P([[0, -8], [6, -10], [12, -9], [17, -5], [19, -1], [14, -3], [8, -3], [0, -1]]), 21, 3.6 * k, "tip", 1.3, 1);
    const lower = slab(P([[0, 2], [7, 2], [13, 2.5], [18, 1.5], [15, 6], [8, 8], [0, 7]]), 21, 3.6 * k, "tip", 1.3, 1);
    return [Paint(U(1.5, arm, palm), rust), upper, lower];
  }
  const crab = Paint(U(1.4, cara, brow, ...spikes, ...front), rust);
  const scene = U(0, puddle(48, 88, 46, 16), ...legs, crab, stalkL, stalkR, eyeL, eyeR, ...chela(-1, 1), ...chela(1, 0.86));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.06 });
  const C = new Canvas(r);
  // 甲羅の下の口器と、吹き出す泡
  for (let i = 0; i < 7; i++) { C.only(42 + i * 2, 51 + (i % 2), "#000000"); C.only(42 + i * 2, 52, "#1a1416"); }
  const R = rand(5);
  for (let i = 0; i < 14; i++) { const x = 40 + R() * 16, y = 52 + R() * 6; if (!C.get(Math.round(x), Math.round(y)) || R() < 0.6) C.set(x, y, R() < 0.5 ? "#5e767c" : "#a8bcbc"); }
  ripples(C, 48, 88, 46);
  return C.toArt();
}

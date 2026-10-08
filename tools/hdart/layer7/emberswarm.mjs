import { sphere, ellipsoid, cone, slab, tube, U, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { RIM, EMBER, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_emberswarm", key: "hd_emberswarm", w: 96, h: 96,
  note: "火の粉の蟲群: 灼けた腹を灯のように光らせる羽虫の群れが渦を巻いて飛ぶ。黒い甲殻と煤けた透ける翅、赤熱した尾の針。群れの後ろには火の粉の筋が尾を引き、何匹もが一斉に刺しにかかる" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#030202", "#0c0707", "#170d0b", "#241410", "#331d16", "#46281d"], 6), spec: 1.1, pow: 30, specCol: "#c06a3a", dither: 0.5 },
    belly: { ramp: ["#4e0e04", "#a8300a", "#f07a1c", "#ffc04a", "#fff0b0"], emit: p => 0.35 + 0.6 * Math.max(0, p.nz) + 0.1 * fbm(p.x * 0.5, p.y * 0.5, 4) },
    wing: { ramp: ramp(["#0a0606", "#1a100e", "#2c1c18", "#3e2a24"], 4), amb: 0.5, dif: 0.4, dither: 0.9, noRim: true },
    sting: { ramp: ["#7a1a06", "#d24e10", "#ffae3a"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: ["#5a0a02", "#c42a08", "#ff8a40"], emit: () => 0.8 },
  };
  const R = rand(7201);
  // 一匹: 頭 → 胸 → 光る腹 (尾の針)、背に二対の翅。dir = 進む向き (度, 0 = 左)
  function bug(x, y, z, s, dir) {
    const a = dir * Math.PI / 180, dx = -Math.cos(a), dy = -Math.sin(a); // 前
    const px = -dy, py = dx; // 横
    const P = (f, g = 0, h = 0) => [x + dx * f * s + px * g * s, y + dy * f * s + py * g * s, z + h * s];
    const parts = [
      sphere(P(3.2), 1.5 * s, "shell"),
      ellipsoid(P(0.6), [2.2 * s, 1.9 * s, 1.9 * s], "shell", dir),
      ellipsoid(P(-3.8), [3.6 * s, 2.3 * s, 2.3 * s], "belly", dir),
      cone(P(-7), P(-9.6), 0.7 * s, 0.1, "sting"),
      sphere(P(3.9, 0.9, 1), 0.55 * s, "eye"), sphere(P(3.9, -0.9, 1), 0.55 * s, "eye"),
    ];
    const wings = [];
    for (const [side, len, ang] of [[1, 7.5, 0.5], [1, 5.5, 1.0], [-1, 7.5, 0.5], [-1, 5.5, 1.0]]) {
      const b = P(1, side * 0.8, 1), t = P(-ang * 3, side * len, 2.4), m = P(-ang * 3 - 2.5, side * len * 0.75, 2.4);
      wings.push(slab([[b[0], b[1]], [t[0], t[1]], [m[0], m[1]]], b[2] + 1.2 * s, 0.25, "wing", 0.2));
    }
    return [...parts, ...wings];
  }
  // 群れ: 渦を巻く。[x, y, z, 大きさ, 向き]
  const SW = [[46, 48, 6, 2.3, 200], [22, 26, 0, 1.45, 160], [72, 22, -4, 1.35, 230], [80, 56, 2, 1.5, 280], [60, 80, 4, 1.4, 330],
    [24, 74, 0, 1.3, 20], [10, 50, -6, 1.0, 60], [50, 10, -8, 0.95, 190]];
  const scene = U(0, ...SW.flatMap(b => bug(...b)));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, inner: 2.5 });
  const C = new Canvas(r);
  // 翅は透ける: 一つおきに抜いて後ろの火の粉を見せる
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "wing" && (x + y) % 3 === 0) C.set(x, y, null); }
  // 渦に沿った火の粉の筋 (群れの後ろ)
  for (let t = 0; t < 1; t += 0.004) {
    const a = t * Math.PI * 2 * 1.3 + 0.4, rr = 40 - t * 22;
    const x = Math.round(48 + Math.cos(a) * rr), y = Math.round(46 + Math.sin(a) * rr * 0.85);
    if (x < 1 || x > 94 || y < 1 || y > 94 || C.get(x, y)) continue;
    if (fbm(x * 0.3, y * 0.3, 7) > 0.05) continue;
    C.set(x, y, EMBER[Math.min(4, Math.floor(t * 3 + R() * 1.6))]);
  }
  // 腹の灯の照り (周りの空気をかすかに赤く)
  for (const [x, y, z, s] of SW) if (s > 0.8) flame2d(C, x + 4 * s, y + 5 * s, 1.2 * s, 4 * s, { seed: x, cols: ["#3a0c06", "#5a1408"] });
  embers(C, 7203, 40, [2, 2, 92, 92]);
  return C.toArt();
}

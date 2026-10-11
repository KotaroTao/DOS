import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, ashfall, sandDust, puffs, spikes } from "../arena.mjs";
export const meta = { id: "bs_sandlurker", key: "hd_sandlurker", w: 96, h: 96,
  note: "砂中の顎: 闘技場の砂の下に潜み、足音を待つ大顎の魔物。砂から飛び出した瞬間の姿 — 砂色の硬い甲羅の板が重なる頭と、上下に大きく開いた顎、ずらりと並ぶ鉤の牙、甲羅の縁に小さな眼が四つ。舞い上がる砂の飛沫。噛みつくたびに流れた血で傷がふさがる (吸血) — 牙から赤い滴が垂れる。砂をまとった甲羅は刃をほとんど通さない (物理抵抗75)" };
export function build() {
  const mats = {
    shell: { ramp: ["#040302", "#0e0b07", "#1c160e", "#2c2316", "#3e321f", "#52432a", "#6a5838", "#86724a"], spec: 0.6, pow: 24, dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) + (Math.sin(p.y * 0.55 + p.x * 0.1) > 0.9 ? -0.2 : 0) },
    flesh: { ramp: ["#100405", "#26090b", "#3e1214", "#5a1e1e", "#7a2e2a"], dither: 0.45, amb: 0.3 },
    maw: { ramp: ["#000000", "#100304", "#260809"], amb: 0.05, dif: 0.3, noRim: true },
    eye: { ramp: ["#4a3a06", "#b0921a", "#ffe27a"], emit: () => 0.9 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 右下の砂の山から斜めに飛び出す甲羅の頭: 顎は左上へ大きく開く
  const mound = Disp(ellipsoid([70, 92, 0], [30, 12, 18], "sand"), (x, y, z) => 0.8 * fbm(x * 0.2, z * 0.2));
  const neck = Disp(ellipsoid([70, 74, 0], [16, 16, 14], "shell", -30), (x, y, z) => 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3) - 0.5 * Math.max(0, Math.sin((x + y) * 0.4) - 0.75));
  const upper = Disp(U(3, ellipsoid([56, 44, 2], [22, 11, 15], "shell", -35), ellipsoid([34, 28, 6], [12, 6, 10], "shell", -40)), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3) - 0.6 * Math.max(0, Math.sin((x - y) * 0.35) - 0.7));
  const lower = Disp(U(3, ellipsoid([50, 68, 6], [20, 7, 12], "shell", -12), ellipsoid([28, 62, 8], [11, 4.4, 9], "shell", -18)), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const mouth = U(3, ellipsoid([38, 50, 10], [15, 10, 9], "maw", -24), ellipsoid([54, 56, 8], [10, 9, 8], "maw", -20));
  const tongue = ellipsoid([40, 60, 9], [11, 3, 6], "flesh", -10);
  const gums = [tube([[22, 34, 12, 1.8], [38, 44, 13, 2], [56, 50, 11, 1.8]], "flesh"), tube([[20, 60, 12, 1.8], [36, 63, 13, 2], [56, 64, 11, 1.8]], "flesh")];
  const ridge = spikes([[[62, 34, 2], [64, 22, -2], 2.6], [[54, 38, 4], [50, 28, 2], 2.4], [[72, 44, -2], [80, 34, -6], 2.6], [[80, 58, -4], [90, 52, -8], 2.4]], "shell");
  const eyes = [sphere([36, 22, 14], 1.2, "eye"), sphere([42, 21, 14], 1.1, "eye"), sphere([31, 25, 13], 0.9, "eye"), sphere([47, 22, 14], 0.9, "eye")];
  const scene = U(0, sandFloor(48, 95, 46, 14, { seed: 12101, blood: 0.12, ash: 0.08, flags: 1, helms: 1 }), mound, Sub(U(2.6, neck, upper, lower), mouth, 0.6), tongue, ...gums, ...ridge, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 22, 62, { step: 3, top: [4, 6], bot: [3, 5], cols: ["#3a352a", "#a8a088", "#e8e0c8"], seed: 12103, lean: -0.2 });
  // 牙から垂れる血
  for (const [x, y] of [[24, 62], [32, 66], [44, 66]]) for (let k = 0; k < 4; k++) if (!C.get(x, y + k) || k > 0) C.set(x, y + k, k === 3 ? "#7a2e2a" : "#3e1214");
  // 砂の中へ続く体 (下顎の下を砂に沈める) と舞い上がる砂の飛沫
  puffs(C, [[50, 84, 8], [86, 80, 9], [58, 78, 6], [92, 88, 6]], ["#0d0a07", "#1a150e", "#2a2217", "#3a2f20", "#4a3c2a"], { dens: 0.9, seed: 7, own: ["shell"] });
  sandDust(C, 12105, 70, [30, 56, 66, 34]);
  ashfall(C, 12107, 30, [0, 0, 96, 50]);
  return C.toArt();
}

import { tube, sphere, ellipsoid, cone, cyl, torus, box, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, PHOS, bubbles, motes, afterimage } from "../temple.mjs";
export const meta = { id: "bs_soulharvester", key: "hd_soulharvester", w: 96, h: 96,
  note: "魂刈り: 水底で溺れた魂を集めて回る、ぼろ布の頭巾の刈り手。顔は闇に沈み青白い双眼だけが光る。大鎌を振り抜いた構えで、腰の籠の灯に刈り取った魂が青く揺れる。目にも止まらぬ速さで二度斬りかかり、背後に残像と鎌の軌跡が尾を引く" };
export function build() {
  const mats = {
    rag: { ramp: ramp(["#030304", "#08090c", "#0e1015", "#15181f", "#1e222b", "#282d38", "#343a46"], 7), dither: 0.65, amb: 0.2,
      shade: p => 0.14 * Math.sin(p.x * 0.8 + p.y * 0.1) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    ghost: { ramp: ramp(["#05090c", "#0a1418", "#101e24", "#172a30"], 4), dither: 0.85, amb: 0.3, dif: 0.3, noRim: true },
    bone: { ramp: ramp(["#05060a", "#151820", "#272c34", "#3c424a", "#565c62", "#72787c", "#90968e"], 7), spec: 0.4, pow: 20, dither: 0.4, amb: 0.22 },
    steel: { ramp: ramp(["#030405", "#0b0f12", "#161d22", "#232c33", "#323e46", "#46545c", "#5e6e76", "#7c8e94"], 8), spec: 1.8, pow: 50, specCol: "#d8f0f0", dither: 0.3 },
    wood: { ramp: ramp(["#030202", "#0b0806", "#160f09", "#22180e", "#302214"], 5), dither: 0.45, spec: 0.3, pow: 16 },
    iron: { ramp: ramp(["#030303", "#0c0c0d", "#18191b", "#26282b", "#36393d"], 5), spec: 1.2, pow: 30, specCol: "#7a8a8e", dither: 0.4 },
    soul: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) + 0.15 * vnoise(p.x, p.y) },
    eye: { ramp: ["#1a4a5a", "#5ac0e0", "#e0fbff"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#010203"], amb: 0, dif: 0.05, noRim: true },
  };
  // ぼろの頭巾と外套: 前傾し、裾は千切れて宙に流れる
  const hood = Disp(U(1.6, ellipsoid([40, 24, 2], [7.4, 8.4, 7], "rag", -14), cone([43, 21, -3], [54, 14, -7], 5.4, 1, "rag")), (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5));
  const cowl = ellipsoid([37.6, 26, 8.6], [4.6, 6, 4.4], "hole", -14);
  const eyes = [sphere([36, 25.6, 8], 0.9, "eye"), sphere([40, 25, 8], 0.9, "eye")];
  const cloak = Disp(U(2.4, ellipsoid([46, 38, 0], [11, 7.4, 7.6], "rag"), cone([47, 40, 0], [58, 76, -2], 10, 15, "rag")),
    (x, y, z) => 1.1 * Math.sin(Math.atan2(z, x - 50) * 6 + y * 0.12) * Math.max(0, (y - 44) / 30) + 0.25 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const tatter = Disp(cyl([60, 96, 0], [56, 66, 0], 20, "rag"), (x, y, z) => -8 * Math.max(0, Math.sin(x * 0.7) * 0.6 + vnoise(x * 0.35, 3) * 0.7));
  // 腕: 両手で大鎌の柄を握り、右下から左上へ振り抜いた構え
  const arms = [tube([[40, 36, 5, 2.6], [34, 44, 10, 2.2], [30, 50, 13, 1.8]], "rag", { seg: 3 }), tube([[54, 37, 0, 2.6], [56, 47, 6, 2.2], [48, 56, 12, 1.8]], "rag", { seg: 3 })];
  const hands = [ellipsoid([29.5, 50.5, 13.5], [1.8, 2, 1.8], "bone"), ellipsoid([47, 56.5, 12.6], [1.8, 2, 1.8], "bone")];
  // 大鎌: 長い柄 (右下→左上) と、上端から前へ大きく弧を描く刃
  const snath = tube([[62, 72, 11, 0.9], [44, 54, 12.5, 0.95], [28, 38, 13.4, 0.9], [20, 24, 14, 0.85]], "wood", { seg: 3 });
  const blade = slab([[20, 23], [26, 16], [36, 10], [50, 7], [62, 9], [72, 14], [62, 12], [50, 12], [38, 15], [28, 21], [22, 27]], 14, 0.55, "steel", 0.25, 0.4);
  const tang = cyl([18.6, 22, 14], [22, 25.6, 14], 1.4, "iron", 0.4);
  // 腰の籠の灯: 鉄の籠に魂の火が三つ
  const cage = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cage.push(cyl([66 + Math.cos(a) * 4.2, 54, 2 + Math.sin(a) * 4.2], [66 + Math.cos(a) * 4.2, 64, 2 + Math.sin(a) * 4.2], 0.45, "iron")); }
  cage.push(torus([66, 54, 2], 4.4, 0.7, "iron", 0, 0), torus([66, 64, 2], 4.4, 0.7, "iron", 0, 0), cyl([66, 50, 2], [66, 54, 2], 0.6, "iron"), tube([[66, 50, 2, 0.5], [61, 46, 1, 0.5], [55, 44, 1, 0.5]], "iron"));
  const souls = [sphere([65, 58.6, 3], 2, "soul"), sphere([67.4, 61.2, 1.4], 1.6, "soul"), sphere([66.6, 56, 0], 1.4, "soul")];
  const reaper = U(0, Sub(Sub(U(1.2, hood, cloak, ...arms), U(0, cowl), 0.6), tatter, 1), ...eyes, ...hands, snath, blade, tang, ...cage, ...souls);
  // 残像: 後ろへずれた同じ姿の淡い影 (神速)
  const ghostOf = (dx, dz) => U(1.4, ellipsoid([40 + dx, 24, 2 + dz], [7.4, 8.4, 7], "ghost", -14), ellipsoid([46 + dx, 38, dz], [11, 7.4, 7.6], "ghost"),
    Sub(cone([47 + dx, 40, dz], [58 + dx, 72, dz - 2], 10, 14, "ghost"), Disp(cyl([60 + dx, 96, dz], [56 + dx, 64, dz], 20, "ghost"), (x, y, z) => -8 * Math.max(0, Math.sin(x * 0.7) * 0.6)), 1));
  const scene = reaper;
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [66, 58, 14], r: 16, k: 0.5 }] });
  const C = new Canvas(r);
  // 残像 (神速): 後ろへずれた淡い影を二重に
  afterimage(C, [[8, 1, 0.55, "#14202a"], [16, 2, 0.3, "#0c141a"]]);
  // 刃の軌跡 (振り抜いた弧の残光)
  const Rt = rand(741);
  const T = ["#122a30", "#1e4650", "#3a7a88", "#8ad0dc"];
  for (let a = Math.PI * 1.05; a < Math.PI * 1.9; a += 0.008) {
    for (let k = 0; k < 3; k++) {
      const rr = 34 + k * 2.2, x = 50 + Math.cos(a) * rr, y = 44 + Math.sin(a) * rr * 0.9;
      const X = Math.round(x), Y = Math.round(y);
      const t = (a - Math.PI * 1.05) / (Math.PI * 0.85);
      if (!C.get(X, Y) && Rt() < 0.15 + 0.85 * t) C.set(X, Y, T[Math.min(3, Math.floor(t * 3 + (k === 0 ? 1 : 0)))]);
    }
  }
  C.set(35, 25, "#e0fbff"); C.set(39, 24, "#e0fbff");
  bubbles(C, 743, 8);
  motes(C, 745, 18, [4, 4, 88, 88], true);
  return C.toArt();
}

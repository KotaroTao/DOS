import { sphere, ellipsoid, cone, tube, slab, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_demon", key: "hd_demon", w: 96, h: 96,
  note: "獄炎のデーモン: 暗い赤銅の肌の大柄な悪魔。山羊のように巻いた角、皮膜の翼を半ば広げ、腰から下は炎の腰布。突き出した右手の先で、隊の加護を剥ぎ取る禍言の輪が割れて砕け散り、左手は爪を立てて構える" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#050102", "#120405", "#200808", "#300c0a", "#42120e", "#561a12", "#6c2418", "#86321f"], 8), spec: 0.7, pow: 22, specCol: "#c8705a", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    wing: { ramp: ramp(["#030102", "#0c0406", "#16080a", "#220c0e", "#301214"], 5), dither: 0.6, amb: 0.3, spec: 0.3 },
    horn: { ramp: ramp(["#040302", "#120e0a", "#262018", "#40362a", "#5e5240", "#80725a"], 6), spec: 0.8, pow: 24, dither: 0.4,
      shade: p => 0.12 * Math.sin((p.x + p.y) * 1.8) },
    claw: { ramp: ["#100808", "#3a2a26", "#78605a", "#c0a8a0"], spec: 1, pow: 30, dither: 0.3 },
    eye: { ramp: ["#7a4a04", "#f0b020", "#ffe880", "#fffce0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    sigil: { ramp: ["#3a0a3a", "#7a1a7a", "#c050c0", "#f0a8f0"], noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#140404", "#2a0806"], amb: 0.1, dif: 0.2, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const J = { head: [50, 24, 3], neck: [50, 30, 2], chest: [50, 39, 1], waist: [51, 50, 0], hip: [52, 58, 0],
    shL: [40, 34, 4], elL: [30, 40, 9], haL: [20, 38, 13], shR: [60, 34, -2], elR: [68, 46, 2], haR: [70, 56, 6],
    hpL: [47, 60, 4], knL: [44, 72, 6], ftL: [42, 86, 6], hpR: [57, 60, -4], knR: [60, 72, -5], ftR: [62, 86, -5] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 4.8, headY: 5.4, chestX: 10, chestY: 8, waistX: 7, hipX: 7.5, arm: 3.4, arm2: 2.8, wrist: 2, thigh: 4.2, knee: 3, ankle: 2.2 } });
  const brute = Disp(U(1.5, body, ellipsoid([50, 29, 6], [3.6, 2.4, 3], "skin")), (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5) + (y > 34 && y < 48 ? -0.4 * Math.max(0, Math.sin(x * 0.9)) : 0));
  const maw = ellipsoid([50, 29.5, 8.5], [2.4, 1, 1.5], "maw");
  // 巻いた角
  const hornL = tube([[46, 19, 3, 2.2], [40, 14, 3, 1.9], [36, 17, 4, 1.5], [37, 22, 5, 1.1], [41, 23, 6, 0.6]], "horn", { seg: 3 });
  const hornR = tube([[54, 19, 1, 2.2], [60, 14, 1, 1.9], [64, 17, 0, 1.5], [63, 22, 0, 1.1], [59, 23, 0, 0.6]], "horn", { seg: 3 });
  // 皮膜の翼 (背から左右へ)
  const wingL = slab([[44, 32], [24, 10], [10, 6], [14, 16], [8, 24], [16, 28], [10, 38], [28, 36]], -8, 0.6, "wing", 0.4);
  const wingR = slab([[56, 32], [74, 10], [88, 4], [84, 16], [92, 22], [82, 28], [90, 38], [70, 36]], -10, 0.6, "wing", 0.4);
  const bonesW = [tube([[44, 31, -6, 1.6], [26, 11, -7, 1.1], [10, 6, -8, 0.5]], "skin"), tube([[56, 31, -8, 1.6], [74, 11, -9, 1.1], [88, 4, -10, 0.5]], "skin")];
  const claws = [...fingers(J.haL, 180, "claw", { n: 4, len: 6, spread: 40, r: 0.9, curl: 0.3, z: 1 }), ...fingers(J.haR, 80, "claw", { n: 4, len: 6, spread: 30, r: 0.9, curl: 0.5, z: 1 })];
  const eyes = [sphere([48, 23, 7.4], 0.95, "eye"), sphere([52.2, 23, 7.4], 0.95, "eye")];
  const brow = ellipsoid([50, 21.4, 6.6], [4.4, 1.2, 1.4], "skin", 0);
  // 禍言の輪 (割れて砕ける): 突き出した左手の先
  const ring = Sub(torus([12, 38, 14], 8, 1, "sigil", 0, 70), U(0, sphere([12, 30, 14], 2.6, "sigil"), sphere([18, 44, 14], 2.2, "sigil")));
  const scene = U(0, lavaFloor(52, 91, 42, 13, { n: 3, seed: 7801 }), Sub(brute, maw, 0.3), brow, hornL, hornR, wingL, wingR, ...bonesW, ...claws, ...eyes, ring);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  C.set(48, 22, "#fffce0"); C.set(52, 22, "#fffce0");
  // 砕けた輪のかけら
  const R = rand(7803);
  for (let i = 0; i < 12; i++) { const a = R() * 6.28, d = 9 + R() * 6; const x = 12 + Math.cos(a) * d * 0.5, y = 38 + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#7a1a7a", "#c050c0", "#f0a8f0"][Math.floor(R() * 3)]); }
  // 炎の腰布
  for (const [x, w, h, s] of [[44, 3.5, 12, 1], [50, 4, 15, 2], [56, 3.5, 12, 3], [47, 2.5, 9, 4], [53, 2.5, 10, 5]]) flame2d(C, x, 66, w, h, { seed: s, own: ["skin"] });
  underglow(C, { skip: ["eye", "sigil"] });
  embers(C, 7805, 26, [4, 2, 88, 70]);
  return C.toArt();
}

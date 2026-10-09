import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, REED, ROTWOOD, RIM, ROT, MIASMA, bogFloor, reeds, reedTips, scum, slime, miasma, motes } from "../swamp.mjs";
export const meta = { id: "bs_bogdrowned", key: "hd_bogdrowned", w: 96, h: 96,
  note: "沼の溺者: 腰まで沼に沈んだ、水を吸って膨れた溺死者。頭から藻と泥が垂れ、白く濁った眼。両腕を前へ突き出して生者の手足をつかもうとし (弱体・多用)、まわりの水面からも何本もの手と頭が浮かび上がる (群棲)。背後には枯れた葦" };
export function build() {
  const mats = {
    flesh: { ramp: ramp(["#030403", "#0b0f0c", "#151c17", "#212b23", "#2f3b31", "#404d41", "#556252", "#6e7a68"], 8), dither: 0.55, amb: 0.26,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    weed: { ramp: ramp(["#020301", "#071006", "#0e1c0b", "#162a10", "#203816"], 5), dither: 0.5, spec: 0.6, pow: 20 },
    rag: { ramp: ramp(["#030302", "#0b0a07", "#15130d", "#211e15", "#2e2a1d"], 5), dither: 0.6 },
    hole: { ramp: ["#000000", "#020302"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#4e5a48", "#9aa894", "#dce6d4"], emit: () => 0.75 },
    mud: MUD, pool: POOL, reed: REED, rotwood: ROTWOOD,
  };
  const J = { head: [46, 30, 4], neck: [46, 37, 3], chest: [46, 50, 2], waist: [47, 64, 2], hip: [47, 74, 2],
    shL: [36, 44, 6], elL: [26, 52, 14], haL: [14, 52, 20], shR: [57, 44, 2], elR: [66, 52, 10], haR: [72, 48, 18] };
  const body = Disp(humanoid(J, { skin: "flesh", torso: "rag" }, { w: { headX: 6.6, headY: 7.6, headZ: 6.4, chestX: 12, chestY: 10, chestZ: 8, waistX: 11, hipX: 12, arm: 3.8, arm2: 3.4, wrist: 2.6 } }),
    (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const handL = [ellipsoid([12, 52, 21], [3, 2.6, 2], "flesh"), ...fingers([11, 52, 21], 190, "flesh", { n: 4, len: 7, spread: 40, r: 1, curl: 0.5, z: 0.5 })];
  const handR = [ellipsoid([74, 47, 19], [3, 2.6, 2], "flesh"), ...fingers([75, 46, 19], -20, "flesh", { n: 4, len: 7, spread: 40, r: 1, curl: -0.5, z: 0.5 })];
  const eyes = [sphere([43, 29, 10], 1.3, "eye"), sphere([49, 29, 10], 1.3, "eye")];
  const mouth = ellipsoid([46, 35, 9.6], [2.4, 2, 1.6], "hole");
  // 頭と肩から垂れる藻
  const R = rand(9301);
  const weed = [];
  for (let i = 0; i < 9; i++) { const x = 38 + i * 2, l = 10 + R() * 14; weed.push(tube([[x, 24 + Math.abs(i - 4) * 0.6, 4 + (4 - Math.abs(i - 4)) * 1.2, 1.4], [x + (R() - 0.5) * 3, 24 + l * 0.6, 8, 1], [x + (R() - 0.5) * 4, 24 + l, 9, 0.4]], "weed", { seg: 2 })); }
  // 水面から浮かぶ別の手と頭 (群れ)
  const others = [
    U(1, ellipsoid([16, 78, 6], [4.6, 5, 4.4], "flesh"), tube([[22, 84, 4, 2], [24, 74, 6, 1.6], [26, 68, 8, 1.2]], "flesh")),
    U(1, tube([[78, 86, 8, 2.2], [82, 74, 10, 1.8], [80, 66, 12, 1.4]], "flesh"), ...fingers([80, 65, 12], -95, "flesh", { n: 4, len: 6, spread: 30, r: 0.9, curl: 0.4 })),
    ellipsoid([64, 82, -10], [4, 4.4, 4], "flesh"),
  ];
  const reedList = [[8, 86, -12, 30, 3], [12, 86, -14, 36, -2], [86, 86, -12, 34, -4], [90, 86, -14, 28, 2], [70, 84, -16, 30, 1]];
  const man = Sub(U(1.4, body, ...handL, ...handR), mouth, 0.3);
  const scene = U(0, bogFloor(48, 94, 48, 16, { n: 1, seed: 9303, wet: 0.6, logs: 0 }), man, ...eyes, ...weed, ...others, ...reeds(reedList));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  reedTips(C, reedList);
  // 水面より下は沈めて暗くする (沼の水位 y=80)
  for (let y = 80; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "flesh" || p.m === "rag")) C.set(x, y, (x + y) % 2 ? "#070d06" : "#0d160b"); }
  for (let x = 4; x < 92; x++) { const p = C.pix[80 * 96 + x]; if (p && (p.m === "flesh" || p.m === "rag")) C.set(x, 80, "#3a4c24"); }
  C.set(43, 29, "#dce6d4"); C.set(49, 29, "#dce6d4");
  slime(C, 9305, ["weed", "flesh"], 0.12, ["#071006", "#162a10", "#2c4418"]);
  scum(C, 9307);
  miasma(C, 9309, 3, [0, 50, 96, 30], 0.28);
  motes(C, 9311, 14, [2, 2, 92, 60], true);
  return C.toArt();
}

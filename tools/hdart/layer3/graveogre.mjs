import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "d04_ogre", key: "hd_graveogre", w: 96, h: 96,
  note: "墓所の巨人: 屍肉で異形に肥え太った人喰い鬼。垂れた太鼓腹、肩に埋もれた小さな頭に涎を垂らす大口、髑髏を連ねた首飾り。巨獣の大腿骨を棍棒に担ぐ" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040303", "#0d0a09", "#181210", "#241b17", "#32251f", "#413029", "#523d34", "#664c41", "#7c5e50"], 9), spec: 0.9, pow: 30, specCol: "#b08878", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    bone: { ramp: ramp(["#060504", "#18140e", "#2e2618", "#463a26", "#625238", "#806e4e", "#a08e6a"], 7), spec: 0.8, pow: 30, specCol: "#e0d0b0", dither: 0.45 },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216"], 5), dither: 0.55 },
    eye: { ramp: ["#2a0600", "#6a1402", "#b0300a", "#f06a20"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0e0304", "#1c0607"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const J = { head: [46, 22, 8], neck: [47, 28, 4], chest: [48, 38, 0], waist: [48, 54, 2], hip: [48, 64, -1],
    shL: [32, 32, 2], elL: [22, 46, 8], haL: [24, 60, 14], shR: [64, 32, 0], elR: [72, 24, 4], haR: [66, 16, 8],
    hpL: [40, 66, 0], knL: [36, 78, 4], ftL: [34, 90, 4], hpR: [56, 66, -1], knR: [60, 78, 3], ftR: [62, 90, 2] };
  const body = humanoid(J, { skin: "skin", hip: "leather" }, { w: { headX: 5.6, headY: 6, headZ: 5.6, neck: 5, chestX: 15, chestY: 10, chestZ: 10, waistX: 13, waistY: 9, waistZ: 10, hipX: 13, hipY: 6, hipZ: 9,
    arm: 5.6, arm2: 4.8, wrist: 3.6, thigh: 6.4, knee: 5, ankle: 4 }, k: 3 });
  // 垂れた太鼓腹と、たるんだ胸
  const belly = Disp(ellipsoid([48, 54, 8], [15, 13, 12], "skin"), (x, y, z) => 0.3 * Math.max(0, Math.sin(y * 0.9)) * (y > 52 ? 1 : 0));
  const jaw = ellipsoid([46, 27, 12], [6, 3.6, 4], "skin");
  const mouth = ellipsoid([46, 27, 16], [4.4, 1.8, 2.4], "maw");
  const eyes = [sphere([43.5, 20.5, 13], 0.9, "eye"), sphere([48.5, 20.5, 13], 0.9, "eye")];
  const ogre = Disp(U(3, body, belly, jaw), (x, y, z) => 0.15 * fbm(x * 0.6, y * 0.6, z * 0.6));
  // 首飾りの髑髏
  const skulls = [];
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.18 + i * 0.16); const x = 48 + Math.cos(a) * 12, y = 32 + Math.sin(a) * 7, z = 10 + Math.sin(a) * 4;
    skulls.push(Sub(U(0.6, ellipsoid([x, y, z], [2.3, 2.4, 2.2], "bone"), ellipsoid([x, y + 1.8, z + 0.6], [1.4, 1.2, 1.4], "bone")), U(0, sphere([x - 0.9, y - 0.1, z + 2.1], 0.7, "maw"), sphere([x + 0.9, y - 0.1, z + 2.1], 0.7, "maw")))); }
  const cord = torus([48, 33, 4], 12.5, 0.5, "leather", 0, 30);
  // 大腿骨の棍棒 (右肩に担ぐ)
  const femur = U(1, cyl([60, 22, 8], [86, 8, 2], 2.6, "bone", 0.5), sphere([88, 7, 2], 4.4, "bone"), sphere([84, 5, 3], 3.4, "bone"), sphere([58, 23, 9], 3.6, "bone"), sphere([61, 26, 9], 3, "bone"));
  const handR = fingers([66, 16, 8], 40, "skin", { n: 4, len: 4.5, spread: 18, r: 1.3, curl: 1.4, z: 1 });
  const handL = fingers([24, 60, 14], 100, "skin", { n: 4, len: 5, spread: 22, r: 1.4, curl: 0.5, z: 1 });
  const loin = Disp(slab([[38, 66], [58, 66], [56, 78], [48, 75], [40, 78]], 9, 1.4, "leather", 0.6), (x, y, z) => 0.3 * Math.sin(x * 1.1));
  const scene = U(0, rubble(48, 92, 44, 14, { n: 7, seed: 171, big: 3.2 }), Sub(ogre, mouth, 0.6), ...eyes, cord, ...skulls, femur, ...handR, ...handL, loin);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 歯と垂れる涎
  for (const x of [43, 45, 48]) C.only(x, 26, "#a08e6a");
  for (let i = 0; i < 6; i++) C.set(47, 29 + i, i < 5 ? "#3a3428" : "#8a8670");
  pebbles(C, 73, 48, 91, 40);
  return C.toArt();
}

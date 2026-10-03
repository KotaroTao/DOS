import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "d03_orc", key: "hd_orc3", w: 96, h: 96,
  note: "奈落のオーク: 瘴気で膨れ上がった大型のオーク。盛り上がった肩と猫背、下顎から突き出す牙、岩塊のような拳。肌に紫の瘴気の筋、千切れた鎖を腰に巻く" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030302", "#090a07", "#11140d", "#1a1f13", "#242b19", "#2f3820", "#3c4628", "#4c5832", "#626e40"], 9), spec: 0.7, pow: 25, specCol: "#90a070", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    vein: { ramp: ramp(["#060309", "#140a1c", "#241232", "#361c4a", "#4a2862"], 5), dither: 0.4 },
    tusk: { ramp: ramp(["#060504", "#1c180f", "#3a3222", "#5e5438", "#8a7e58", "#b4a87c"], 6), spec: 1.2, pow: 40, specCol: "#ece2c0", dither: 0.4 },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216", "#422d1d"], 6), dither: 0.55, shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6) },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66"], 7), spec: 1, pow: 40, specCol: "#9aa2ae", dither: 0.45 },
    eye: { ramp: ["#2a0a00", "#6a1c02", "#b0400a", "#f08020"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0e0304", "#1c0607"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 猫背の巨体: 頭は肩の間に沈み、両の拳を低く構える
  const J = { head: [48, 30, 12], neck: [48, 35, 6], chest: [48, 44, 2], waist: [48, 58, 0], hip: [48, 66, -1],
    shL: [32, 38, 4], elL: [20, 54, 8], haL: [22, 70, 14], shR: [64, 38, 2], elR: [76, 54, 6], haR: [74, 70, 12],
    hpL: [40, 68, 0], knL: [36, 79, 6], ftL: [34, 90, 4], hpR: [56, 68, -1], knR: [60, 79, 5], ftR: [62, 90, 2] };
  const body = humanoid(J, { skin: "skin", hip: "leather" }, { w: { headX: 7, headY: 7, headZ: 7, neck: 6, chestX: 17, chestY: 11, chestZ: 10, waistX: 12, waistY: 9, waistZ: 8, hipX: 12, hipY: 6, hipZ: 8,
    arm: 6.6, arm2: 5.4, wrist: 4, thigh: 6, knee: 4.8, ankle: 3.8 }, k: 3 });
  // 盛り上がった僧帽筋と、岩塊のような拳
  const traps = [ellipsoid([38, 33, 0], [9, 6, 7], "skin", 25), ellipsoid([58, 33, 0], [9, 6, 7], "skin", -25)];
  const fists = [Disp(ellipsoid([22, 73, 15], [7, 6.5, 6.5], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(x * 1.3))), Disp(ellipsoid([74, 73, 13], [7, 6.5, 6.5], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(x * 1.3)))];
  const brow = ellipsoid([48, 26.5, 17], [7.5, 2.4, 3.5], "skin");
  const jaw = ellipsoid([48, 35, 16], [7.5, 4, 4.5], "skin");
  const mouth = ellipsoid([48, 34, 21], [5, 1.3, 2.5], "maw");
  const orcBody = Paint(Disp(U(2.4, body, ...traps, ...fists, brow, jaw), (x, y, z) => 0.18 * fbm(x * 0.5, y * 0.5, z * 0.5)),
    (x, y, z, m) => (m === "skin" && Math.abs(vnoise(x * 0.22, y * 0.16, z * 0.22)) < 0.045 && y > 36) ? "vein" : m);
  const tusks = [cone([43.5, 35.5, 19], [41, 27, 21], 1.6, 0.4, "tusk"), cone([52.5, 35.5, 19], [55, 27, 21], 1.6, 0.4, "tusk")];
  const ears = [cone([41, 28, 9], [32, 23, 6], 2.2, 0.3, "skin"), cone([55, 28, 9], [64, 23, 6], 2.2, 0.3, "skin")];
  const eyes = [sphere([44.5, 29, 17.4], 1.2, "eye"), sphere([51.5, 29, 17.4], 1.2, "eye")];
  // 腰巻きと、腰に巻いた千切れた鎖
  const belt = torus([48, 62, 0], 12.5, 2, "leather", 0, 6);
  const links = [];
  for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.32; links.push(torus([48 + Math.cos(a + 1.4) * 13, 64 + Math.sin(i * 0.9) * 1.2 + i * 0.6, Math.sin(a + 1.4) * 9 + 3], 1.7, 0.6, "iron", 20 * i, i % 2 ? 0 : 90)); }
  const loin = Disp(slab([[38, 63], [58, 63], [56, 76], [50, 73], [46, 78], [40, 73]], 9, 1.5, "leather", 0.6), (x, y, z) => 0.3 * Math.sin(x * 1.1));
  const scene = U(0, rubble(48, 92, 46, 14, { n: 6, seed: 71, big: 3.2 }), Sub(orcBody, mouth, 0.6), ...tusks, ...ears, ...eyes, belt, ...links, loin);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  C.set(44, 28, "#ffd080"); C.set(51, 28, "#ffd080");
  for (const x of [45, 47, 49, 51]) C.only(x, 34, "#8a7e58");
  pebbles(C, 23, 48, 91, 40);
  return C.toArt();
}

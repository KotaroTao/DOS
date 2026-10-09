import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, CLOUD, towerFloor, bolt2d, crackle, sparks, rain, clouds } from "../storm.mjs";
export const meta = { id: "bs_cloudgiant", key: "hd_cloudgiant", w: 96, h: 96,
  note: "雲の巨人: 塔の吹き抜けを埋めるほどの、雲をまとった石肌の巨人。肩から上は雷雲に呑まれ、雲の奥に眼だけが二つ光る。組んだ両の拳を頭上へ振り上げ、雷を集めてためてから叩きつける (溜め・多用)。拳のまわりで稲妻がうなる。傷を負うと雲が荒れて手がつけられなくなる (激昂)" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030306", "#09080f", "#121119", "#1c1b26", "#272635", "#343346", "#43425a", "#56556e"], 8), dither: 0.55, amb: 0.2, spec: 0.4, pow: 18,
      shade: p => 0.1 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) + (Math.pow(1 - Math.abs(fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2 + 4)), 8) > 0.7 ? -0.15 : 0) },
    cloud: { ramp: ramp(["#05050a", "#0c0b16", "#151424", "#201f34", "#2c2b44", "#3b3a56", "#4e4e6c"], 7), dither: 0.8, amb: 0.34,
      shade: p => 0.12 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2) },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  const J = { head: [48, 22, -2], neck: [48, 28, -1], chest: [48, 42, 0], waist: [48, 58, 0], hip: [48, 66, 0],
    shL: [32, 34, 2], elL: [26, 20, 8], haL: [40, 8, 12], shR: [64, 34, 2], elR: [70, 20, 8], haR: [56, 8, 12],
    hpL: [40, 68, 2], knL: [34, 80, 6], ftL: [30, 90, 6], hpR: [56, 68, 0], knR: [62, 80, 4], ftR: [66, 90, 2] };
  const body = Disp(humanoid(J, { skin: "skin" }, { w: { headX: 6, headY: 6, chestX: 17, chestY: 12, chestZ: 10, waistX: 11, waistY: 8, hipX: 13, arm: 6, arm2: 5, wrist: 4, thigh: 7, knee: 5.6, ankle: 4.6 }, k: 3 }),
    (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 組んだ両の拳
  const fists = U(1.4, ellipsoid([43, 9, 13], [6.4, 5.4, 5.4], "skin"), ellipsoid([53, 9, 13], [6.4, 5.4, 5.4], "skin"));
  const knuckles = [];
  for (const x of [39, 42, 45, 51, 54, 57]) knuckles.push(sphere([x, 5.4, 15], 1.6, "skin"));
  const feet = [box([28, 90, 9], [6, 2.4, 5], "skin", 1.6), box([68, 90, 5], [6, 2.4, 5], "skin", 1.6)];
  // 肩から上を呑む雷雲
  const shroud = Disp(U(3, ellipsoid([48, 24, -2], [10, 9, 9], "cloud"), ellipsoid([48, 32, -4], [14, 4, 8], "cloud")),
    (x, y, z) => 1.4 * fbm(x * 0.2, y * 0.2, z * 0.2));
  const eyes = [sphere([45, 24, 7.2], 1.1, "eye"), sphere([51, 24, 7.2], 1.1, "eye")];
  const loin = Disp(box([48, 66, 6], [12, 6, 4], "cloud", 2), (x, y, z) => 1 * fbm(x * 0.3, y * 0.3));
  const scene = U(0, towerFloor(48, 95, 46, 13, { n: 3, seed: 10301, wet: 0.1, big: 4 }), body, fists, ...knuckles, ...feet, shroud, loin, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 4, 24], r: 26, k: 0.6 }] });
  const C = new Canvas(r);
  // 拳のまわりで集まる稲妻 (溜め)
  for (const [x1, y1, s] of [[20, 4, 1], [76, 2, 2], [30, 0, 3], [66, 14, 4], [24, 14, 5]]) bolt2d(C, 48, 6, x1, y1, { seed: s, jag: 2, branch: 1 });
  for (let a = 0; a < Math.PI * 2; a += 0.12) { const x = 48 + Math.cos(a) * 13, y = 7 + Math.sin(a) * 7; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 5) > 0) C.set(x, y, BOLT[2]); }
  crackle(C, 10303, ["skin"], 0.01);
  // 肩と腰にまとわりつく雲
  clouds(C, [[22, 36, 12, 6], [74, 36, 12, 6], [48, 30, 18, 4], [10, 60, 8, 5], [88, 62, 8, 5]], { dens: 0.75, seed: 4, own: ["skin"] });
  rain(C, 10305, 40);
  sparks(C, 10307, 16, [10, 0, 76, 30]);
  return C.toArt();
}

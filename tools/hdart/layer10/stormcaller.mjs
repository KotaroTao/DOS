import { sphere, ellipsoid, cone, tube, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, CLOUD, SOULS, towerFloor, chain, bolt2d, sparks, rain, clouds, dissolve, puffs } from "../storm.mjs";
export const meta = { id: "bs_stormcaller", key: "hd_stormcaller", w: 96, h: 96,
  note: "雷を呼ぶ司祭: 塔の鐘楼で祈りを続けてきた司祭の霊。高い僧帽と長い法衣、骨ばった手。片手で鎖の香炉を振ると、甘く重い煙が流れ、吸った者はまぶたが落ちて眠りこむ (眠り・多用)。もう片手を雷雲へ差し上げて唱えると、頭上の雲が渦を巻いて嵐の精が降りてくる (招来)" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#040306", "#0b080f", "#140f1a", "#1f1827", "#2c2236", "#3a2e46", "#4a3c58"], 7), dither: 0.6, amb: 0.24,
      shade: p => 0.12 * Math.sin(p.x * 1.3 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    trim: { ramp: ramp(["#0e0a04", "#2a200c", "#4e3e1a", "#7a6430", "#a48c50"], 5), spec: 1, pow: 26, dither: 0.4 },
    pale: { ramp: ramp(["#06080c", "#10161e", "#1c2632", "#2c3a48", "#3e5262", "#566e80"], 6), dither: 0.5, amb: 0.3 },
    hole: { ramp: ["#000000", "#010103"], amb: 0, dif: 0.05, noRim: true },
    ember: { ramp: ["#4a2a8a", "#8a6ad8", "#d0c0ff"], noRim: true, emit: () => 0.8 },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  const J = { head: [50, 28, 2], neck: [50, 34, 1], chest: [50, 44, 0], waist: [50, 56, 0], hip: [50, 64, 0],
    shL: [42, 39, 4], elL: [34, 48, 8], haL: [26, 54, 10], shR: [58, 39, -2], elR: [64, 28, 0], haR: [68, 16, 0] };
  const body = humanoid(J, { skin: "robe", head: "pale" }, { w: { headX: 4.4, headY: 5.4, chestX: 9, chestY: 8, chestZ: 6, waistX: 8, waistY: 7, hipX: 10, arm: 2.8, arm2: 2.4, wrist: 1.6 } });
  const robe = Disp(cone([50, 90, 0], [50, 50, 0], 17, 9, "robe"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.8)) + 0.4 * fbm(x * 0.3, y * 0.3));
  const mitre = U(0.8, cone([50, 26, 0], [50, 6, -1], 6, 1.6, "trim"), ellipsoid([50, 25, 0], [6, 2, 5.6], "trim"));
  const face = ellipsoid([50, 30, 4], [3.6, 4.4, 3], "pale");
  const sockets = U(0, ellipsoid([48.4, 29, 6.6], [1.2, 1.1, 0.8], "hole"), ellipsoid([51.6, 29, 6.6], [1.2, 1.1, 0.8], "hole"), ellipsoid([50, 33, 6.4], [1.2, 0.7, 0.8], "hole"));
  const stole = [tube([[46, 36, 6, 1.6], [44, 56, 9, 1.6], [42, 84, 12, 1.8]], "trim"), tube([[54, 36, 6, 1.6], [56, 56, 9, 1.6], [58, 84, 12, 1.8]], "trim")];
  const handUp = fingers([68, 15, 0], -80, "pale", { n: 4, len: 6, spread: 30, r: 0.7, curl: -0.2 });
  // 鎖で吊った香炉
  const links = chain([26, 55, 10], [22, 72, 12], 1.1, "iron", 0.4);
  const censer = U(0.6, ellipsoid([22, 76, 12], [4.6, 4, 4.6], "trim"), cone([22, 72, 12], [22, 68, 12], 2.6, 0.6, "trim"));
  const glowHoles = [sphere([20, 76, 16.2], 0.9, "ember"), sphere([24, 77, 16], 0.9, "ember")];
  const eyes = [sphere([48.4, 29, 6.4], 0.6, "eye"), sphere([51.6, 29, 6.4], 0.6, "eye")];
  const scene = U(0, towerFloor(50, 95, 40, 12, { n: 1, seed: 11801, wet: 0.2 }), Sub(U(1.6, body, robe), sockets, 0.2), Sub(face, sockets, 0.2), mitre, ...stole, ...handUp, ...links, censer, ...glowHoles, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [22, 76, 18], r: 14, k: 0.35 }, { p: [70, 6, 16], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  dissolve(C, 84, 93, { seed: 6, x0: 32, x1: 70, darken: mats.robe.ramp });
  // 香炉から流れる眠りの煙 (紫の淡い渦)
  puffs(C, [[16, 70, 6], [10, 62, 7], [8, 52, 6], [14, 44, 5], [6, 40, 4]], ["#110c1c", "#1c1430", "#2a1e48", "#3c2c66", "#56428a"], { dens: 0.85, seed: 7 });
  // 差し上げた手の上で渦を巻く雷雲と、降りてくる嵐の精
  clouds(C, [[74, 8, 20, 6], [86, 14, 10, 6]], { dens: 0.9, seed: 9 });
  for (let a = 0; a < Math.PI * 2; a += 0.04) { const x = 76 + Math.cos(a) * 12, y = 8 + Math.sin(a) * 4; if (Math.sin(a * 3) > 0) C.set(x, y, CLOUD[5]); }
  bolt2d(C, 76, 10, 70, 16, { seed: 3, jag: 1.2, branch: 0, all: true });
  bolt2d(C, 90, 8, 94, 30, { seed: 5, jag: 2, branch: 1 });
  rain(C, 11803, 40);
  sparks(C, 11805, 8, [56, 0, 40, 30]);
  return C.toArt();
}

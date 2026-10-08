import { sphere, ellipsoid, cone, box, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, puffs } from "../lava.mjs";
import { tri } from "../mine.mjs";
export const meta = { id: "bs_brimstonegolem", key: "hd_brimstonegolem", w: 96, h: 96,
  note: "硫黄の鋳像: 黄色い硫黄を煮固めて鋳た、角張った巨像。胸と肩は硫黄の結晶の塊で、継ぎ目と肩の煙突から黄緑の毒煙が渦を巻いて噴き上がる (嗅げば正気を失う)。顔は仮面のような平板に細い眼の切れ込みが二つ、結晶の殻が打撃を受け流す" };
export function build() {
  const mats = {
    sulfur: { ramp: ramp(["#060502", "#151105", "#272009", "#3b310d", "#524412", "#6c5a18", "#8a7420", "#ab9230", "#cdb24a"], 9), spec: 0.6, pow: 18, specCol: "#ecd890", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    crystal: { ramp: ramp(["#0c0a02", "#2c2608", "#54480e", "#806e18", "#b09a2a", "#dccc5a", "#f8f0b0"], 7), spec: 1.4, pow: 40, specCol: "#fffce0", dither: 0.35 },
    slit: { ramp: ["#2a3a04", "#5a7a0a", "#a8d420", "#e8ff80"], emit: () => 0.8 },
    vent: { ramp: ["#000000", "#060802"], amb: 0, dif: 0.1, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 角張った体: 胴の大箱、肩の塊、短い脚、太い腕
  const torso = box([48, 46, 0], [15, 15, 10], "sulfur", 3, 4);
  const pelvis = box([48, 64, 0], [11, 6, 8], "sulfur", 2);
  const head = box([47, 25, 3], [7, 7, 6.5], "sulfur", 2, -3);
  const shL = box([30, 36, 2], [7, 7, 7], "sulfur", 2, 15), shR = box([66, 36, -2], [7, 7, 7], "sulfur", 2, -15);
  const armL = U(1.5, box([26, 52, 4], [5, 11, 5], "sulfur", 2, 8), box([24, 68, 6], [6.5, 6.5, 6], "sulfur", 2.5));
  const armR = U(1.5, box([70, 52, -2], [5, 11, 5], "sulfur", 2, -8), box([72, 68, -2], [6.5, 6.5, 6], "sulfur", 2.5));
  const legs = [box([40, 78, 2], [5.5, 9, 5.5], "sulfur", 2), box([56, 78, -2], [5.5, 9, 5.5], "sulfur", 2)];
  const chunky = (x, y, z) => 0.6 * fbm(x * 0.2, y * 0.2, z * 0.2) + 0.5 * Math.pow(1 - Math.abs(vnoise(x * 0.25, y * 0.25, z * 0.25)), 8);
  const body = Disp(U(1.5, torso, pelvis, head, shL, shR, armL, armR, ...legs), chunky);
  // 胸と肩に生えた硫黄の結晶
  const R = rand(7701);
  const xtals = [];
  for (const [x, y, z, n] of [[42, 40, 9, 4], [56, 44, 9, 3], [30, 30, 6, 3], [66, 30, 4, 3], [48, 54, 9, 2]]) for (let i = 0; i < n; i++) {
    const a = (R() - 0.5) * 1.8 - 1.57, L = 4 + R() * 5;
    xtals.push(cone([x + (R() - 0.5) * 6, y + (R() - 0.5) * 5, z], [x + Math.cos(a) * L * 0.6 + (R() - 0.5) * 4, y + Math.sin(a) * L, z + 2], 1.8, 0.2, "crystal"));
  }
  // 肩の煙突 (噴気孔) と仮面の細い眼
  const stacks = [cone([30, 30, 0], [28, 18, -1], 3.2, 2.6, "sulfur"), cone([66, 30, -3], [69, 18, -4], 3.2, 2.6, "sulfur")];
  const holes = U(0, cyl0([28, 17, -1], 1.8), cyl0([69, 17, -4], 1.8));
  function cyl0(p, r) { return ellipsoid([p[0], p[1], p[2]], [r, 2.4, r], "vent"); }
  const eyes = [box([44, 25, 9.5], [2.2, 0.6, 0.6], "slit", 0.2, 8), box([51, 25, 9.3], [2.2, 0.6, 0.6], "slit", 0.2, -8)];
  const scene = U(0, lavaFloor(48, 91, 44, 13, { n: 4, seed: 7703 }), Sub(U(1, body, ...stacks), holes), ...xtals, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  underglow(C, { skip: ["slit"] });
  // 黄緑の毒煙: 煙突から上へ渦巻く
  const FM = ["#1a2006", "#28300a", "#3a4610", "#506018", "#6a7c22"];
  puffs(C, [[27, 12, 3.5], [25, 7, 4], [27, 2, 4.5], [70, 12, 3.5], [72, 7, 4], [70, 2, 4.5]], FM, { dens: 0.75, seed: 7705 });
  // 継ぎ目から漏れる煙
  puffs(C, [[12, 50, 4], [86, 48, 4], [14, 40, 3]], FM.slice(0, 3), { dens: 0.8, seed: 7707 });
  embers(C, 7709, 16, [4, 30, 88, 50]);
  return C.toArt();
}

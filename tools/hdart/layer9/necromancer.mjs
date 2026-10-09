import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, miasma, lampHand } from "../swamp.mjs";
export const meta = { id: "bs_necromancer", key: "hd_necromancer", w: 96, h: 96,
  note: "死霊術師: 沼のほとりで、捨てられた器を拾い集めては沼の腐った魂を詰めて起こす、痩せた骸の術師。ぼろぼろの黒い法衣にフード、骨の指で腐った魂の灯る鉤杖をかかげる。足元の泥から、胸に印のある壊れた器が一体、引き起こされて立ち上がりかけている (招来)。生者の命を喰らう (吸命)。痩せた身は呪文に脆い (魔法弱点)" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#020202", "#070608", "#0e0c10", "#161319", "#201c24", "#2c2632"], 6), dither: 0.6, amb: 0.2,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + 2 * fbm(p.x * 0.1, p.y * 0.08)) },
    bone: { ramp: ramp(["#0c0a08", "#221e18", "#3a352c", "#56503f", "#787058", "#9c9478"], 6), dither: 0.45, amb: 0.3 },
    wood: { ramp: ramp(["#040302", "#0e0a06", "#1a130b", "#281e12", "#382a19", "#4a3822", "#5e4a2e"], 7), dither: 0.5, amb: 0.24 },
    iron: { ramp: ramp(["#020203", "#0a0a0c", "#16161a", "#24242a", "#36363e"], 5), spec: 1, pow: 28, dither: 0.4 },
    hole: { ramp: ["#000000", "#020102"], amb: 0, dif: 0.05, noRim: true },
    soul: { ramp: ROT, noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [34, 22, 4], neck: [35, 28, 3], chest: [36, 38, 2], waist: [37, 50, 2], hip: [38, 58, 2],
    shL: [28, 33, 6], elL: [22, 42, 10], haL: [20, 50, 14], shR: [44, 33, 0], elR: [54, 26, 6], haR: [60, 16, 8] };
  const body = humanoid(J, { skin: "bone", torso: "robe", arm: "robe" }, { w: { headX: 4.6, headY: 5.6, chestX: 8, chestY: 8, waistX: 7, hipX: 8, arm: 2.6, arm2: 2.2, wrist: 1.4 } });
  const robe = Disp(slab([[24, 30], [46, 30], [52, 60], [56, 90], [44, 88], [36, 92], [26, 88], [20, 60]], 0, 6, "robe", 2, 2), (x, y, z) => 0.8 * Math.sin(x * 0.9 + fbm(x * 0.2, y * 0.2) * 2) * Math.max(0, (y - 50) / 40) + 0.6 * Math.max(0, fbm(x * 0.4, y * 0.4) - 0.1) * Math.max(0, y - 84) / 4);
  const hood = Sub(Disp(U(2, ellipsoid([34, 21, 2], [8, 9, 8], "robe"), cone([34, 16, -2], [30, 6, -6], 5, 0.6, "robe")), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4)), ellipsoid([33, 23, 8], [5, 6.4, 5], "hole"), 0.4);
  const skull = ellipsoid([33, 23, 3], [4, 5, 4], "bone");
  const eyes = [sphere([31.4, 22, 6.4], 0.8, "eye"), sphere([34.6, 22, 6.6], 0.8, "eye")];
  // 鉤杖: 右手でかかげ、先に腐った魂の灯
  const staff = cyl([58, 90, 6], [62, 6, 8], 1.1, "wood");
  const hook = tube([[62, 8, 8, 1.1], [68, 4, 8, 1], [72, 8, 8, 0.8], [70, 13, 8, 0.6]], "iron");
  const lamp = U(0.5, sphere([70, 17, 8], 2.6, "soul"), torus([70, 17, 8], 2.8, 0.5, "iron", 0, 0));
  const handR = [ellipsoid([60, 16, 9], [2, 2.2, 1.8], "bone"), ...fingers([61, 16, 9], 170, "bone", { n: 4, len: 3.4, spread: 18, r: 0.55, curl: 1.4, z: 0.4 })];
  const handL = [ellipsoid([20, 51, 15], [1.8, 2, 1.6], "bone"), ...fingers([20, 52, 15], 70, "bone", { n: 4, len: 5, spread: 30, r: 0.55, curl: 0.4, z: 0.4 })];
  // 引き起こされる器 (左下、泥から上半身)
  const doll = U(1, ellipsoid([14, 76, 10], [6, 7, 5], "wood", 10), sphere([12, 64, 11], 5, "wood"), cyl([16, 72, 12], [22, 62, 14], 1.6, "wood", 0.5), torus([13, 69.4, 10.6], 2, 0.8, "iron", 0, 80));
  const scene = U(0, bogFloor(44, 94, 46, 14, { n: 2, seed: 10401, wet: 0.2, logs: 1 }), robe, U(1, body, hood), skull, ...eyes, staff, hook, lamp, ...handR, ...handL, doll);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [70, 17, 16], r: 26, k: 0.45 }, { p: [16, 60, 22], r: 14, k: 0.2 }] });
  const C = new Canvas(r);
  // 器の胸の印 (泥に汚れた)
  lampHand(C, 14, 76, ["#2a1c0c", "#140c05", "#a8c040"]);
  // 器へ流れ込む腐った魂の糸 (術師の左手から)
  for (let t = 0; t <= 1; t += 0.03) { const x = 19 - t * 4, y = 56 + t * 16 + Math.sin(t * 10) * 1.4; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ROT[2 + Math.floor(t * 2.9)]); }
  // 器の空っぽの眼の穴に灯る黄緑
  C.set(10, 63, ROT[4]); C.set(13, 63, ROT[3]);
  // 灯の光の輪
  for (let a = 0; a < Math.PI * 2; a += 0.1) { const x = 70 + Math.cos(a) * 6, y = 17 + Math.sin(a) * 6; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 5) > 0.3) C.set(x, y, ROT[1]); }
  scum(C, 10403);
  miasma(C, 10405, 2, [0, 60, 96, 26], 0.25);
  motes(C, 10407, 20, [2, 2, 92, 70], true);
  return C.toArt();
}

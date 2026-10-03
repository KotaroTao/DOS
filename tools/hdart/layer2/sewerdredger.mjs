import { tube, sphere, ellipsoid, cone, slab, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_sewerdredger", key: "hd_sewerdredger", w: 96, h: 96,
  note: "溝浚いの骸: 破れた笠と襤褸の作業着の干からびた人夫の骸。笠の陰に燐の眼、錆びた鉤竿を両手で構え、背に泥の籠、脛まで汚水に浸かる" };
export function build() {
  const mats = {
    bone: { ramp: ramp(["#040302", "#100c08", "#1e1810", "#2e2618", "#423822", "#5a4e32", "#766a46", "#9a8e64"], 8), spec: 0.7, pow: 25, specCol: "#c8bc98", dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    cloth: { ramp: ramp(["#030302", "#0a0907", "#15120d", "#211c14", "#2e271b", "#3e3424", "#524530"], 7), spec: 0.3, pow: 20, dither: 0.65,
      shade: p => 0.12 * Math.sin(p.y * 1.3 + p.x * 0.4) + 0.08 * fbm(p.x * 0.4, p.y * 0.4) },
    straw: { ramp: ramp(["#050402", "#140f06", "#241a0a", "#382a10", "#4e3c18", "#685222", "#86702e"], 7), spec: 0.4, pow: 20, dither: 0.5,
      shade: p => 0.14 * Math.sin(Math.atan2(p.y - 20, p.x - 46) * 18) },
    iron: { ramp: ramp(["#030202", "#0e0806", "#1c100a", "#2c1a0e", "#422614", "#5a361e", "#76482a"], 7), spec: 0.9, pow: 30, specCol: "#b89878", dither: 0.5 },
    wood: { ramp: ramp(["#040302", "#120c08", "#22160e", "#342214", "#48301c", "#5e4026"], 6), spec: 0.4, pow: 20, dither: 0.4 },
    basket: { ramp: ramp(["#040302", "#100c06", "#1e160c", "#2e2212", "#40301a", "#544022"], 6), dither: 0.5, shade: p => 0.16 * ((Math.floor(p.x * 0.7) + Math.floor(p.y * 0.7)) % 2 ? 1 : -1) },
    water: WATER,
  };
  const J = { head: [42, 26, 6], neck: [44, 33, 4], chest: [46, 42, 2], waist: [48, 52, 0], hip: [49, 60, -1],
    shL: [38, 37, 6], elL: [32, 48, 12], haL: [36, 54, 16], shR: [55, 36, 0], elR: [60, 46, 8], haR: [52, 44, 14],
    hpL: [44, 62, 0], knL: [41, 74, 4], ftL: [42, 88, 2], hpR: [54, 62, -2], knR: [57, 74, 0], ftR: [58, 88, -2] };
  const body = humanoid(J, { skin: "bone", torso: "cloth", hip: "cloth", leg: "cloth", arm: "cloth" }, { w: { chestX: 8, chestY: 7.5, chestZ: 5, waistX: 6.5, hipX: 7.5, arm: 2.6, arm2: 2.2, wrist: 1.2, thigh: 3.3, knee: 2.6, headX: 4.4, headY: 5.4 } });
  const coat = Disp(U(1.5, body, tube([[44, 56, 0, 9], [46, 66, 0, 10.5], [48, 72, 0, 11]], "cloth")), (x, y, z) => 0.5 * Math.max(0, Math.sin(x * 0.9 + y * 0.2)) + 0.2 * fbm(x * 0.5, y * 0.5, z * 0.5));
  // 笠: 破れた大きな笠
  const hat = Disp(U(1, ellipsoid([42, 21, 6], [15, 2.2, 13], "straw", -6), ellipsoid([42, 17, 6], [6, 4.5, 6], "straw", -6)), (x, y, z) => (Math.hypot(x - 42, z - 6) > 11 && vnoise(x * 0.5, z * 0.5) > 0.3 ? 3 : 0));
  // 鉤竿: 両手で斜めに構え、先の鉤は右上
  const pole = cyl([24, 86, 22], [78, 4, 4], 1.3, "wood", 0.3);
  const hook = Sub(torus([80, 8, 4], 5, 1.1, "iron", 30, 90), box2());
  function box2() { return ellipsoid([76, 13, 4], [5, 4, 4], "iron"); }
  const spike = cone([80, 4, 4], [86, -1, 4], 1.3, 0.2, "iron");
  const handsL = fingers([36, 54, 16], -60, "bone", { n: 3, len: 4, spread: 16, r: 0.8, curl: 0.8, z: 2 });
  const handsR = fingers([52, 44, 14], -60, "bone", { n: 3, len: 4, spread: 16, r: 0.8, curl: 0.8, z: 2 });
  const basket = ellipsoid([60, 44, -8], [9, 11, 6], "basket", 10);
  const scene = U(0, puddle(48, 90, 40, 14), basket, Paint(coat, (x, y, z, m) => m), hat, pole, hook, spike, ...handsL, ...handsR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 笠の陰の顔: 燐の眼、歯の並ぶ顎
  C.set(40, 26, "#a8f0c0"); C.set(45, 26, "#a8f0c0"); C.set(40, 27, "#3a7a5a"); C.set(45, 27, "#3a7a5a");
  for (let x = 40; x <= 45; x++) C.only(x, 30, x % 2 ? "#5a4e32" : "#000000");
  // 籠からこぼれる泥と滴
  const M = ["#141008", "#2a2012", "#3e301a"];
  for (const [x, y0, l] of [[56, 54, 6], [62, 56, 9], [66, 54, 5], [36, 72, 5], [52, 76, 6]]) for (let i = 0; i < l; i++) C.set(x, y0 + i, M[i < l - 1 ? 1 : 2]);
  ripples(C, 48, 90, 40);
  return C.toArt();
}

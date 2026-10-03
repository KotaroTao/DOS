import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_drownedcorpse", key: "hd_drownedcorpse", w: 96, h: 96,
  note: "水死体: 水を吸って膨れ、青ざめた溺死者。濡れた黒髪が顔に貼りつき、片目だけが白く濁って覗く。ふやけた両手を前へ伸ばし、裂けた衣と藻を引きずる" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030405", "#0a0f12", "#141c22", "#202c32", "#2e3e44", "#425458", "#5c6e6e", "#7e8e88", "#a8b2a6"], 9), spec: 1.2, pow: 35, specCol: "#d4dcd0", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) - 0.1 },
    bruise: { shade: p => -0.05, ramp: ramp(["#040306", "#0e0a14", "#1a1222", "#281c30", "#382840", "#4a3850"], 6), spec: 0.8, pow: 30, dither: 0.6 },
    cloth: { ramp: ramp(["#030303", "#0b0a09", "#171512", "#24201a", "#342e24", "#463e30", "#5e5440"], 7), spec: 0.6, pow: 25, specCol: "#8a8068", dither: 0.6,
      shade: p => 0.1 * Math.sin(p.x * 0.9 + p.y * 0.3) },
    hair: { ramp: ramp(["#000000", "#030405", "#08090c", "#0e1014", "#16181e", "#22262c"], 6), spec: 1.6, pow: 50, specCol: "#5a6670", dither: 0.4,
      shade: p => 0.12 * Math.sin(p.x * 2.2) },
    weed: { ramp: ramp(["#020402", "#081008", "#10200e", "#1a3216", "#284620"], 5), dither: 0.6 },
    water: WATER,
  };
  // 前のめりに傾き、両腕をこちらへ突き出す (膝下は水の中)
  const J = { head: [44, 20, 8], neck: [46, 28, 6], chest: [47, 38, 4], waist: [49, 50, 2], hip: [49, 60, 0],
    shL: [38, 33, 6], elL: [30, 42, 13], haL: [23, 50, 19], shR: [56, 31, 4], elR: [64, 40, 11], haR: [71, 47, 17],
    hpL: [43, 62, 0], knL: [41, 76, 3], ftL: [42, 90, 0], hpR: [53, 62, 0], knR: [56, 76, 1], ftR: [57, 90, -2] };
  const body = humanoid(J, { skin: "skin", torso: "cloth", hip: "cloth", leg: "cloth" }, { w: { chestX: 10.5, chestY: 8.5, chestZ: 7, waistX: 9.5, waistZ: 7, hipX: 9, arm: 3.4, arm2: 3, wrist: 2.3, thigh: 4.4, knee: 3.4, headX: 5.4, headY: 6.2 }, headRot: -12 });
  const bloat = (x, y, z) => -0.5 * Math.max(0, vnoise(x * 0.25, y * 0.25, z * 0.25) - 0.1) + 0.2 * fbm(x * 0.8, y * 0.8, z * 0.8);
  const bruise = (x, y, z, m) => (m === "skin" && fbm(x * 0.2 + 5, y * 0.2, z * 0.2) > 0.25) ? "bruise" : m;
  const palmL = ellipsoid(J.haL, [2.6, 3.2, 1.8], "skin", 20), palmR = ellipsoid(J.haR, [2.6, 3.2, 1.8], "skin", -20);
  const handsL = fingers(J.haL.map((v, i) => i === 1 ? v + 1.5 : v), 112, "skin", { n: 4, len: 8, spread: 26, r: 1.25, curl: 0.3, z: 2 });
  const handsR = fingers(J.haR.map((v, i) => i === 1 ? v + 1.5 : v), 68, "skin", { n: 4, len: 8, spread: 26, r: 1.25, curl: -0.3, z: 2 });
  // 衣の裂け目: 胸元をはだけ、裾が襤褸に
  const torn = Paint(body, (x, y, z, m) => (m === "cloth" && y < 52 && y > 30 && Math.abs(x - 47 + (y - 40) * 0.2) < 5 + fbm(x * 0.3, y * 0.3) * 3 && z > 4) ? "skin" : m);
  // 髪: 頭から肩へ垂れる濡れた束
  const hair = [];
  const R = rand(8);
  for (const [x0, z0, l, dx] of [[38.5, 8, 18, -1], [40, 10, 14, -0.5], [41.5, 12, 22, 0.3], [47, 11, 11, 0.8], [49, 9, 16, 1.2], [50, 6, 20, 1.5]]) hair.push(tube([[x0 + 0.5, 14, z0, 1.1], [x0 + dx, 14 + l * 0.5, z0 + 1, 0.85], [x0 + dx * 1.6 + (R() - 0.5), 14 + l, z0 + 1, 0.45]], "hair", { seg: 3 }));
  const cap = Sub(ellipsoid([44, 16.5, 7], [6, 4.6, 5.6], "hair", -12), ellipsoid([45, 22, 12], [3.2, 4.5, 4], "hair"));
  const scene = U(0, puddle(50, 90, 40, 14), Paint(Disp(U(1.5, torn, palmL, palmR, ...handsL, ...handsR), bloat), bruise), cap, ...hair);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 片目: 髪の隙間から覗く白濁した眼と、だらりと開いた口
  C.set(46, 20, "#c8d0c4"); C.set(47, 20, "#9aa49a"); C.set(46, 21, "#5c6660"); C.set(43, 20, "#0a0f12");
  C.set(45, 25, "#000000"); C.set(46, 25, "#000000"); C.set(45, 26, "#000000"); C.set(46, 26, "#0a0f12");
  // 藻と滴: 腕と裾から垂れる
  const Wd = ["#081008", "#10200e", "#1a3216", "#284620"];
  for (const [x, y0, l] of [[30, 46, 7], [27, 50, 5], [64, 46, 7], [66, 50, 9], [40, 66, 9], [54, 66, 7], [36, 52, 6]]) { let y = y0; for (let i = 0; i < l; i++) { C.set(x + Math.sin(i * 0.8) * 0.8, y + i, Wd[1 + (i % 3)]); } }
  const D = ["#2c4446", "#56767a"];
  for (const [x, y] of [[21, 62], [25, 66], [72, 62], [69, 67], [45, 72]]) { C.set(x, y, D[0]); C.set(x, y + 1, D[1]); }
  ripples(C, 50, 90, 40);
  return C.toArt();
}

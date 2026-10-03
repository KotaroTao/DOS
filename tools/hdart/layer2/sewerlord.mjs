import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_sewerlord", key: "hd_sewerlord", w: 112, h: 128,
  note: "水路の主 (層ボス): 汚泥の海に半身を沈めた巨大な両生の主。錆びた鉄格子を打ち付けた冠、三対の濁った黄眼、裂けた大口に不揃いの牙と垂れる舌。分厚い粘膜の背に鎖と土管が埋もれ、足元の泥から汚泥の眷属が湧く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#030303", "#080a07", "#0f130d", "#161c12", "#1f2717", "#29321c", "#363f22", "#4a522e", "#666c42"], 9), spec: 1.4, pow: 45, specCol: "#d8e4b0", dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) },
    belly: { ramp: ramp(["#060605", "#151410", "#26241a", "#3a3626", "#504a34", "#6a6244", "#8a805a"], 7), spec: 1.2, pow: 40, specCol: "#ecdcb0", dither: 0.55, shade: p => (Math.floor(p.y * 0.4) % 2 ? -0.05 : 0.03) },
    wart: { ramp: ramp(["#060604", "#161408", "#2a250e", "#3e3614", "#56481a", "#6e5c24"], 6), spec: 0.8, pow: 30, dither: 0.4 },
    maw: { ramp: ["#000000", "#000000", "#120406", "#26080c", "#3e1014"], amb: 0.1, dif: 0.5 },
    tongue: { ramp: ramp(["#080204", "#24080c", "#420e14", "#64181c", "#8c2a26", "#b04434"], 6), spec: 1.6, pow: 45, specCol: "#ffc8b8", dither: 0.4 },
    eye: { ramp: ["#3a2800", "#6a5006", "#a07c14", "#d0a830", "#f4dc70"], emit: p => 0.35 + 0.6 * Math.max(0, p.nz - 0.2 * p.ny) },
    iron: { ramp: ramp(["#030202", "#0c0806", "#1a100a", "#2a1a0e", "#3e2614", "#56361c", "#704a28"], 7), spec: 1, pow: 30, specCol: "#c09878", dither: 0.5 },
    clay: { ramp: ramp(["#040302", "#120c08", "#22160e", "#342214", "#4a321e", "#624428"], 6), dither: 0.5 },
    hole: { ramp: ["#000000", "#000000", "#040302"], amb: 0, dif: 0.1, noRim: true },
    sludge: { ramp: ramp(["#020302", "#070906", "#0e120a", "#161c10", "#202818", "#2c3620"], 6), spec: 1.4, pow: 60, specCol: "#7a8a5a", dither: 0.7, amb: 0.3, noRim: true },
  };
  const bump = (x, y, z) => -0.9 * Math.max(0, vnoise(x * 0.32, y * 0.32, z * 0.32) - 0.35) + 0.25 * fbm(x * 0.6, y * 0.6, z * 0.6);
  // 体: 泥に沈んだ巨大な胴、前へ突き出す大きな頭
  const torso = ellipsoid([56, 74, -6], [44, 28, 26], "skin");
  const head = ellipsoid([56, 58, 12], [34, 20, 22], "skin");
  const jaw = ellipsoid([56, 76, 18], [32, 11, 20], "skin");
  const cheekL = ellipsoid([26, 62, 8], [10, 12, 12], "skin"), cheekR = ellipsoid([86, 62, 8], [10, 12, 12], "skin");
  const brow = [ellipsoid([41, 47, 22], [10, 5, 8], "skin", -15), ellipsoid([71, 47, 22], [10, 5, 8], "skin", 15)];
  const armL = tube([[18, 78, 10, 8], [10, 92, 18, 7], [10, 104, 24, 6]], "skin"), armR = tube([[94, 78, 10, 8], [102, 92, 18, 7], [102, 104, 24, 6]], "skin");
  const claws = []; for (const [hx, s] of [[10, -1], [102, 1]]) for (const a of [-50, -15, 20, 55]) { const r = (a + s * 10) * Math.PI / 180; claws.push(cone([hx, 104, 25], [hx + Math.sin(r) * 9, 109, 25 + Math.cos(r) * 7], 2.4, 0.5, "skin")); }
  const skin = Paint(Disp(U(5, torso, head, jaw, cheekL, cheekR, ...brow, armL, armR, ...claws), bump), (x, y, z, m) => {
    if (m !== "skin") return m; if (vnoise(x * 0.32, y * 0.32, z * 0.32) > 0.55) return "wart"; if (y > 80 && z > 22 && Math.abs(x - 56) < 22) return "belly"; return m; });
  const mouth = Sub(skin, ellipsoid([56, 72, 34], [27, 7.5, 14], "maw"), 2);
  const tongue = tube([[60, 76, 30, 4], [64, 84, 34, 3.4], [62, 94, 36, 2.8], [66, 102, 37, 2], [64, 106, 37, 1]], "tongue");
  // 眼: 三対、上の大きな一対と頬の小さな眼
  const eyes = [sphere([42, 52, 30], 5, "eye"), sphere([70, 52, 30], 5, "eye"), sphere([28, 60, 24], 3.2, "eye"), sphere([84, 60, 24], 3.2, "eye"), sphere([33, 46, 27], 2.6, "eye"), sphere([79, 46, 27], 2.6, "eye")];
  // 冠: 錆びた鉄格子の切れ端を頭に打ち付け、杭が上へ突き出す
  const crown = [cyl([30, 40, 16], [82, 40, 16], 2, "iron", 0.5)];
  for (let i = 0; i < 7; i++) { const x = 32 + i * 8, h = 12 + (i % 2) * 6 + (i === 3 ? 8 : 0); crown.push(cyl([x, 42, 16], [x + (i - 3) * 1.2, 40 - h, 14], 1.4, "iron", 0.4), cone([x + (i - 3) * 1.2, 40 - h, 14], [x + (i - 3) * 1.5, 36 - h, 14], 1.8, 0.2, "iron")); }
  // 背に埋もれた土管と鎖
  const pipe = Sub(cyl([96, 56, -14], [104, 46, 2], 6, "clay", 0.6), cyl([95, 57, -20], [105, 45, 6], 4, "hole"));
  const chain = []; for (let i = 0; i < 6; i++) chain.push(torus([14 + i * 4.2, 70 + i * 3.5, 18 + i], 2.2, 0.8, "iron", 40 + (i % 2) * 70, i % 2 ? 90 : 20));
  // 汚泥の海と、湧き出す眷属
  const sea = Disp(ellipsoid([56, 112, 0], [58, 9, 44], "sludge"), (x, y, z) => 0.8 * fbm(x * 0.15, z * 0.15) + 0.4 * Math.sin(x * 0.3));
  const spawn = [Disp(ellipsoid([16, 108, 30], [8, 7, 6], "sludge"), (x, y, z) => 0.8 * fbm(x * 0.4, y * 0.4, z * 0.4)), Disp(ellipsoid([96, 109, 30], [7, 6, 6], "sludge"), (x, y, z) => 0.8 * fbm(x * 0.4, y * 0.4, z * 0.4))];
  const scene = U(0, sea, mouth, tongue, ...eyes, ...crown, ...chain, ...spawn);
  const r = render(scene, mats, { w: W, h: H, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 32, 80, { step: 3, top: [3, 6], bot: [2, 5], cols: ["#3a3424", "#9a8c64", "#d8ceaa"], seed: 4 });
  // 瞳孔: 横に裂けた黒
  for (const [x, y, w] of [[42, 53, 3], [70, 53, 3], [28, 61, 2], [84, 61, 2], [33, 47, 1], [79, 47, 1]]) { C.line(x - w, y, x + w - 1, y, "#000000"); C.set(x - w + 1, y - 2, "#fff4c0"); }
  // 粘液の滴りと、眷属の眼
  const G = ["#161c10", "#2c3620", "#4a5a30", "#7a8a52"];
  for (const [x, y0, l] of [[30, 82, 10], [38, 84, 6], [74, 84, 8], [84, 80, 12], [20, 96, 6], [92, 96, 7]]) { let y = y0; for (let i = 0; i < l; i++) C.set(x, y + i, G[i < l - 2 ? 1 : 2]); C.set(x, y + l, G[3]); }
  for (const [x, y] of [[14, 106], [18, 106], [94, 107], [98, 107]]) C.set(x, y, "#e8bc38");
  const R = rand(5);
  for (let i = 0; i < 30; i++) { const x = 4 + R() * 104, y = 108 + R() * 16; if (C.get(Math.round(x), Math.round(y)) && R() < 0.5) C.set(x, y, R() < 0.5 ? "#2c3620" : "#4a5a30"); }
  return C.toArt();
}

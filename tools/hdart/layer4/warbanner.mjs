import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit, flutter, tri } from "../fort.mjs";
export const meta = { id: "el_warbanner", key: "hd_warbanner", w: 112, h: 128,
  note: "軍旗の亡将 (強敵): 落城の日、軍旗を握ったまま焼け死んだ将の亡霊。焼け焦げた鎧の割れ目と継ぎ目から炎が舐め出し、尾の長い兜の下には黒焦げの髑髏と炎の眼窩。右手で掲げた旗竿の先には、紋の褪せた藍の軍旗が穴だらけに燃えながらはためき、くすぶるマントと共に火の粉を撒く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    char: { ramp: ramp(["#020202", "#080706", "#110e0c", "#1b1714", "#27211c", "#342c25", "#453a30", "#5a4c3e", "#74624e"], 9), spec: 1.3, pow: 30, specCol: "#a88a66", dither: 0.5,
      shade: p => 0.12 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) },
    bone: { ramp: ramp(["#040302", "#16100a", "#2a2015", "#433422", "#5e4c32", "#7e6a48"], 6), dither: 0.5, spec: 0.5, pow: 20 },
    cloth: { ramp: ramp(["#020205", "#070810", "#0e111e", "#161b2e", "#202840", "#2c3654"], 6), dither: 0.6, amb: 0.18,
      shade: p => 0.1 * Math.sin(p.y * 0.5 + 2 * fbm(p.x * 0.1, p.y * 0.1)) + 0.05 * fbm(p.x * 0.5, p.y * 0.5) },
    cape: { ramp: ramp(["#020101", "#070504", "#0d0a08", "#15100c", "#1e1711"], 5), dither: 0.7, amb: 0.1,
      shade: p => 0.12 * Math.sin(p.x * 0.6 + 2 * fbm(p.x * 0.1, p.y * 0.1)) },
    fire: { ramp: ["#5a1404", "#a83a08", "#e8761a", "#ffb84a", "#fff0b0"], emit: p => 0.25 + 0.55 * Math.max(0, p.nz) + 0.35 * fbm(p.x * 0.5, p.y * 0.5, 3) },
    ember: { ramp: ["#3a0a02", "#8a2a06", "#d86414", "#ffa840"], emit: p => 0.35 + 0.55 * Math.max(0, p.nz) },
    iron: { ramp: ramp(["#020203", "#0a0a0c", "#16161a", "#24242a", "#36363e", "#4c4c56"], 6), spec: 1.4, pow: 40, specCol: "#c0a888", dither: 0.45 },
    hole: { ramp: ["#000000", "#000000", "#030202"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  const J = { head: [68, 25, 5], neck: [68, 32, 2], chest: [68, 45, 1], waist: [68, 59, 0], hip: [68, 67, -1],
    shL: [54, 39, 3], elL: [44, 50, 9], haL: [41, 38, 14], shR: [82, 39, 2], elR: [88, 55, 6], haR: [89, 69, 9],
    hpL: [61, 69, 0], knL: [57, 92, 4], ftL: [53, 116, 4], hpR: [75, 69, -1], knR: [80, 92, 3], ftR: [84, 116, 2] };
  const body = humanoid(J, { skin: "char" }, { w: { headX: 6.4, headY: 7.4, headZ: 6.6, neck: 4, chestX: 15, chestY: 11, chestZ: 9, waistX: 11, waistY: 8, waistZ: 8, hipX: 12, hipY: 5.5, hipZ: 8,
    arm: 5.2, arm2: 4.6, wrist: 3.6, thigh: 6, knee: 5, ankle: 4.2 }, k: 2.2 });
  const pauld = [ellipsoid([52, 38, 4], [10, 7, 8], "char", 25), ellipsoid([84, 38, 3], [10, 7, 8], "char", -25),
    ellipsoid([51, 43, 6], [8.6, 3, 7], "char", 25), ellipsoid([85, 43, 5], [8.6, 3, 7], "char", -25)];
  const cuirass = ellipsoid([68, 47, 8], [12, 9.5, 5], "char");
  const fauld = []; for (let i = 0; i < 3; i++) fauld.push(ellipsoid([68, 62 + i * 4, 6], [12 - i * 0.4, 2.5, 7], "char"));
  const knees = [sphere([57, 92, 8], 4.6, "char"), sphere([80, 92, 7], 4.6, "char")];
  const boots = [ellipsoid([52, 117, 7], [6, 3.6, 8], "char"), ellipsoid([85, 117, 5], [6, 3.6, 8], "char")];
  const fistR = Disp(ellipsoid([89, 72, 10], [4.4, 4.4, 4.4], "char"), (x, y, z) => 0.3 * Math.max(0, Math.sin(x * 1.4)));
  const fistL = ellipsoid([41, 38, 15], [4.2, 4, 4.2], "char");
  // 継ぎ目からのぞく熾火 (首・腰・肘・膝)
  const seams = [cyl([68, 31, 1], [68, 34, 1], 4.2, "ember"), torus([68, 56.5, 0], 10, 0.9, "ember", 0, 10), sphere(J.elL, 3.6, "ember"), sphere(J.elR, 3.6, "ember"),
    torus([57, 97, 4], 4.6, 1.1, "ember", 0, 80), torus([80, 97, 3], 4.6, 1.1, "ember", 0, 80)];
  // 兜: 丸いサレットに長い尾、正面は開いて黒焦げの髑髏
  const sallet = Sub(U(1.2, ellipsoid([68, 19, 4], [9.6, 8.4, 9.4], "char"), cone([68, 22, 0], [76, 32, -9], 7, 3, "char")), ellipsoid([68, 26, 14], [6.2, 7.2, 6], "hole"), 0.6);
  const skull = Sub(U(0.8, ellipsoid([68, 26, 9], [5.2, 5.8, 5], "bone"), ellipsoid([68, 31, 10], [3.8, 2.4, 3.6], "bone")),
    U(0, ellipsoid([65.6, 25, 13.5], [2, 1.8, 2.4], "hole"), ellipsoid([70.4, 25, 13.5], [2, 1.8, 2.4], "hole"), ellipsoid([68, 28.6, 14], [0.9, 1.3, 1.4], "hole"), box([68, 32.2, 13.5], [2.8, 0.6, 2], "hole")), 0.3);
  const brim = torus([68, 20, 4], 9.4, 1.3, "char", 0, 8);
  const crest = slab([[66.5, 6], [69.5, 6], [70, 12], [66, 12]], 4, 1.1, "char", 0.4);
  const eyeF = [sphere([65.6, 25.2, 12], 1.2, "fire"), sphere([70.4, 25.2, 12], 1.2, "fire")];
  // 旗竿: 右手 (画面左) で握り、石突きを床へ
  const pb = [46, 120, 12], pt = [36.5, 6, 14];
  const pole = cyl(pb, pt, 1.5, "wood", 0.3);
  const finial = U(0, cone([36.4, 6, 14], [36, -2, 14], 2, 0.2, "iron"), sphere([36.6, 7, 14], 1.8, "iron"));
  const bar = cyl([37, 10, 13], [5, 12, 11], 1.1, "wood", 0.3);
  const barEnd = sphere([5, 12, 11], 1.6, "iron");
  // 軍旗: 横木から垂れ、風で左へはためく。焼け穴と燃える裾
  const holes = [[11, 24, 2.6], [31, 44, 2.2]];
  const bannerPoly = [[4, 12], [36, 10], [36, 58], [32, 64], [28, 57], [23, 66], [18, 58], [12, 67], [8, 59], [4, 63]];
  const bannerRaw = Disp(slab(bannerPoly, 11, 0.9, "cloth", 0.5), (x, y, z) => 1.3 * Math.sin(x * 0.55 + 0.08 * y + 1.5 * fbm(x * 0.12, y * 0.12)));
  const bannerCut = U(0, ...holes.map(([x, y, r]) => sphere([x, y, 11], r, "hole")));
  const banner = Paint(Sub(bannerRaw, bannerCut, 0.2), (x, y, z, m) => {
    for (const [hx, hy, hr] of holes) { const d = Math.hypot(x - hx, y - hy); if (d < hr + 0.9) return "ember"; }
    // 燃える裾: 下端に近いほど焦げ
    const hem = 58 + 5 * Math.sin(x * 0.75) + 2 * vnoise(x * 0.4, 1);
    if (y > hem + 1.5) return "ember";
    if (y > hem - 4) return "char";
    return m;
  });
  // 炎の舌 (旗の裾・竿先・肩・拳)
  const flames = [];
  const tongue = (x, y, z, h, r, lean = 0) => flames.push(Disp(cone([x, y, z], [x + lean, y - h, z], r, 0.3, "fire"), (X, Y, Z) => 0.6 * Math.sin(Y * 0.9 + X)));
  for (const [x, y, h, r, l] of [[31, 64, 8, 2, 2], [23, 66, 7, 1.8, 1], [13, 66, 7, 1.8, 2], [6, 62, 5, 1.4, 1]]) tongue(x, y, 13, h, r, l);
  for (const [x, y, z, h, r, l] of [[52, 33, 9, 6, 1.8, 1], [84, 33, 8, 6, 1.8, 2], [89, 68, 13, 6, 1.6, 1], [36.5, -1, 14, 5, 1.4, 1]]) tongue(x, y, z, h, r, l);
  // くすぶるマント: 背中から裾が裂け、端が赤く燃える
  const capePoly = [[52, 36], [86, 36], [98, 66], [102, 112], [94, 106], [90, 118], [82, 108], [74, 116], [62, 110], [56, 116], [50, 104]];
  const cape = Paint(Disp(slab(capePoly, -10, 1.4, "cape", 0.7), flutter(1.2, 0.3)), (x, y, z, m) => (y > 111 + 3 * Math.sin(x * 0.7) + 2 * vnoise(x * 0.5, 2)) ? "ember" : m);
  // 焼け焦げの割れ目: 鎧の表面に熾火の筋
  const cracked = (x, y, z, m) => (m === "char" && Math.abs(vnoise(x * 0.11, y * 0.09, z * 0.11) + 0.2 * vnoise(x * 0.4, y * 0.4, z * 0.4)) < 0.02) ? "ember" : m;
  const knight = Paint(Disp(U(1.3, body, ...pauld, cuirass, ...fauld, ...knees, ...boots, fistR, fistL), (x, y, z) => 0.16 * fbm(x * 0.7, y * 0.7, z * 0.7)), cracked);
  const fingersL = fingers([41, 38, 15], 180, "char", { n: 3, len: 3.4, spread: 14, r: 0.9, curl: 1.6, z: 1.4 });
  const scene = U(0, flagstones(64, 122, 50, 16, { n: 6, seed: 801, big: 3.6 }), cape, knight, ...seams, Paint(sallet, cracked), brim, crest, skull, ...eyeF, pole, finial, bar, barEnd, banner, ...flames, ...fingersL);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [26, 58, 26], r: 56, k: 0.55 }, { p: [89, 62, 20], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  // 褪せた金の紋 (塔と二本の槍) を軍旗に
  const G1 = "#4a3a1a", G2 = "#6a5426";
  const only = (x, y, c) => { const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && p.m === "cloth") C.set(x, y, c); };
  for (let y = 26; y <= 44; y++) for (let x = 15; x <= 25; x++) { const edge = x <= 16 || x >= 24 || y >= 43; if (edge) only(x, y, y < 32 ? G2 : G1); }
  for (const x of [15, 16, 19, 20, 23, 24]) { only(x, 24, G2); only(x, 25, G2); }
  for (let y = 36; y <= 42; y++) { only(19, y, G1); only(20, y, G1); }
  for (let i = 0; i < 18; i++) { only(10 + i * 0.25, 50 - i * 1.5, G1); only(30 - i * 0.25, 50 - i * 1.5, G1); }
  // 火の粉と灰
  ash(C, 803, 26, [2, 0, 70, 76], true);
  ash(C, 805, 8, [60, 2, 50, 60], true);
  ash(C, 807, 12);
  grit(C, 809, 64, 121, 46, 26);
  return C.toArt();
}

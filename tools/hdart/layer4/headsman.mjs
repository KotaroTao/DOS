import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit, tri } from "../fort.mjs";
export const meta = { id: "el_headsman", key: "hd_headsman", w: 112, h: 128,
  note: "処刑人の大鬼 (強敵): 砦の処刑場で首を刎ね続けた大鬼。目穴だけ開いた黒革の頭巾と肩掛け、むき出しの分厚い胸と太鼓腹には古傷、血の染みた革の前掛け。三日月の刃の首斬り斧を右肩に担ぎ、左手は血の染みた首斬り台の上に置く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#030202", "#090706", "#110d0b", "#1a1410", "#231b16", "#2e231c", "#3a2c23", "#48372b", "#5a4535"], 9), spec: 0.8, pow: 22, specCol: "#8a6c56", dither: 0.6, amb: 0.1, dif: 0.9,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    hood: { ramp: ramp(["#010101", "#050506", "#0b0b0d", "#131316", "#1c1c21", "#28282e", "#36363e"], 7), spec: 1.4, pow: 30, specCol: "#5a5a66", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216", "#42301e"], 6), dither: 0.55, shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6) },
    blood: { ramp: ["#0a0101", "#1e0303", "#360707", "#4e0c0a"], dither: 0.5 },
    iron: { ramp: ramp(["#020203", "#07080a", "#0e1013", "#16191e", "#1f232a", "#2a2f37", "#383e48", "#4a515c"], 8), spec: 1.6, pow: 45, specCol: "#a8b0bc", dither: 0.4,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    eye: { ramp: ["#3a2a00", "#8a6a0a", "#e0c040"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#030202"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 巨躯: 右手 (画面右) で斧の柄を握り肩に担ぐ。左手 (画面左) は首斬り台の上
  const J = { head: [56, 25, 6], neck: [56, 32, 3], chest: [56, 46, 3], waist: [56, 64, 4], hip: [56, 76, 0],
    shL: [34, 40, 3], elL: [24, 62, 7], haL: [22, 89, 10], shR: [78, 40, 2], elR: [92, 52, 7], haR: [84, 36, 12],
    hpL: [46, 80, 0], knL: [40, 98, 5], ftL: [37, 116, 4], hpR: [66, 80, -1], knR: [72, 98, 4], ftR: [76, 116, 2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 7, headY: 7.6, headZ: 7, neck: 6, chestX: 21, chestY: 13, chestZ: 12, waistX: 17, waistY: 13, waistZ: 13, hipX: 15, hipY: 6, hipZ: 10,
    arm: 8, arm2: 6.6, wrist: 4.8, thigh: 8, knee: 6, ankle: 5 }, k: 3.2 });
  // 盛り上がった肩と胸、太鼓腹
  const pecs = [ellipsoid([46, 44, 11], [10, 6.5, 5], "skin", 10), ellipsoid([66, 44, 10], [10, 6.5, 5], "skin", -10)];
  const belly = ellipsoid([56, 64, 12], [15, 13, 9], "skin");
  const delts = [ellipsoid([31, 41, 4], [9, 9, 9], "skin", 30), ellipsoid([81, 41, 3], [9, 9, 9], "skin", -30)];
  const forearm = [ellipsoid([23, 74, 8], [6.4, 10, 6.4], "skin", 5), ellipsoid([89, 44, 10], [6, 9, 6], "skin", 35)];
  const fistL = Disp(ellipsoid([22, 93, 12], [6.6, 4.6, 6.6], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(x * 1.3)));
  const fingersL = fingers([22, 93, 14], 90, "skin", { n: 4, len: 4.4, spread: 18, r: 1.3, curl: 0.4, z: 2 });
  const fistR = Disp(ellipsoid([84, 34, 13], [6, 6, 5.6], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(y * 1.3)));
  const navel = ellipsoid([56, 66, 21], [1.4, 1.8, 1.6], "hole");
  const ogre0 = Disp(U(3, body, ...pecs, belly, ...delts, ...forearm, fistL, fistR), (x, y, z) => 0.16 * fbm(x * 0.5, y * 0.5, z * 0.5) + (Math.abs(x - 56) < 1.2 && y > 38 && y < 52 ? 0.5 : 0));
  const ogre = Sub(ogre0, navel, 0.6);
  // 黒革の頭巾: 先の尖った袋状、肩を覆う肩掛け。目穴だけ開く
  const hood = U(2, ellipsoid([56, 24, 6], [8.4, 9, 8.4], "hood"), cone([56, 18, 4], [58, 6, 0], 6.4, 1.4, "hood"),
    Disp(ellipsoid([56, 36, 3], [17, 6, 12], "hood"), (x, y, z) => 0.5 * Math.sin(x * 0.8) * Math.max(0, (y - 36) / 5)));
  const capelet = Disp(slab([[38, 33], [74, 33], [80, 42], [70, 46], [62, 44], [56, 48], [50, 44], [42, 46], [32, 42]], 6, 1.2, "hood", 0.8), (x, y, z) => 0.5 * Math.sin(x * 0.9));
  const eyeHoles = U(0, ellipsoid([52.4, 24, 14], [2.2, 1.5, 3], "hole"), ellipsoid([59.6, 24, 14], [2.2, 1.5, 3], "hole"));
  const eyes = [sphere([52.4, 24.2, 12.4], 0.9, "eye"), sphere([59.6, 24.2, 12.4], 0.9, "eye")];
  // 革の前掛けとベルト
  const apron = Disp(slab([[44, 68], [68, 68], [70, 96], [66, 102], [56, 100], [46, 102], [42, 96]], 18, 1.2, "leather", 0.8), (x, y, z) => 0.6 * Math.sin(x * 0.6) * Math.max(0, (y - 74) / 26));
  const belt = torus([56, 70, 6], 15, 1.8, "leather", 0, 12);
  const buckle = box([56, 71.5, 21.5], [3, 2.6, 1], "iron", 0.6);
  const wraps = [cyl([22, 78, 9], [22, 85, 10], 5.6, "leather", 1.2), cyl([87, 40, 11], [85, 36, 12], 5.2, "leather", 1.2)];
  const legWraps = [cyl([39, 104, 6], [37, 114, 5], 5.4, "leather", 1.4), cyl([73, 104, 5], [76, 114, 4], 5.4, "leather", 1.4)];
  const boots = [ellipsoid([36, 117, 7], [7, 3.6, 8.6], "leather"), ellipsoid([77, 117, 5], [7, 3.6, 8.6], "leather")];
  // 首斬り斧: 柄は右の拳から肩越しに斜め上へ。三日月の刃は右上に
  const hb = [92, 54, 13], ht = [66, 4, 2];
  const haft = cyl(hb, ht, 1.8, "wood", 0.4);
  const ferrule = [torus([90, 50, 13], 1.9, 0.7, "iron", 63, 90), torus([69, 10, 3], 1.9, 0.7, "iron", 63, 90)];
  const bladeP = [[66, 2], [76, 1], [84, -2], [94, 0], [102, 8], [107, 20], [104, 32], [97, 40], [93, 30], [86, 22], [76, 17], [69, 15]];
  const blade = Disp(slab(bladeP, 0, 1.3, "iron", 0.4, 1.2), (x, y, z) => 0.4 * Math.max(0, vnoise(x * 0.5, y * 0.5) - 0.3));
  const spike = cone([65, 6, 2], [58, 2, 2], 2.2, 0.3, "iron");
  // 首斬り台: 血の染みた樫の切り株、刃の切れ込み
  const block = Sub(Disp(cyl([22, 98, 12], [22, 120, 12], 10, "wood", 1.6), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4)), box([22, 99, 12], [11, 1.4, 1.2], "hole", 0.2, -8), 0.3);
  const bloody = (x, y, z, m) => {
    if (m === "wood" && y < 104 && fbm(x * 0.35, z * 0.35, 7) > -0.1) return "blood";
    if (m === "wood" && y >= 104 && y < 118 && Math.abs(Math.sin(x * 1.3 + 2 * fbm(x * 0.2, 3))) > 0.94) return "blood";
    if (m === "leather" && y > 72 && y < 102 && fbm(x * 0.3 + 5, y * 0.3, 1) > 0.18) return "blood";
    if (m === "iron" && y > 18 && fbm(x * 0.25, y * 0.25, 9) > 0.15) return "blood";
    return m;
  };
  const scene = U(0, flagstones(56, 122, 54, 16, { n: 6, seed: 901, big: 3.8 }), Paint(U(0, haft, ...ferrule, blade, spike, block, apron, belt, ...wraps, ...legWraps, ...boots), bloody),
    Sub(U(0, ogre, hood, capelet), eyeHoles, 0.3), buckle, ...eyes, ...fingersL);
  const r = render(scene, mats, { w: W, h: H, rim: RIM });
  const C = new Canvas(r);
  // 古傷: 胸と腹を斜めに走る縫い跡
  for (const [x0, y0, x1, y1] of [[42, 40, 52, 56], [62, 56, 70, 64], [30, 46, 34, 54]]) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && p.m === "skin") C.set(x, y, i % 3 ? "#150e0b" : "#4a3226"); }
  }
  // 刃の縁の研ぎ跡 (明るい一筋)
  for (let t = 0; t < 1; t += 0.02) { const a = -1.2 + t * 2.6; const x = 87 + Math.cos(a) * 19, y = 18 + Math.sin(a) * 19; const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && p.m === "iron") C.set(x, y, "#7a8290"); }
  // 台と床の血だまり
  for (const [x, y] of [[30, 119], [31, 119], [32, 120], [14, 120], [15, 120], [28, 121]]) C.set(x, y, "#360707");
  grit(C, 903, 56, 121, 50, 26);
  ash(C, 907, 14);
  return C.toArt();
}

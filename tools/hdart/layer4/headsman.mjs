import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit, tri } from "../fort.mjs";
export const meta = { id: "el_headsman", key: "hd_headsman", w: 112, h: 128,
  note: "処刑人の大鬼 (強敵): 砦の処刑場で首を刎ね続けた大鬼。目穴だけ開いた黒革の頭巾と肩掛け、むき出しの分厚い胸と太鼓腹には古傷、血の染みた革の前掛け。三日月の刃の首斬り斧を右肩に担ぎ、左手は血の染みた首斬り台の上に置く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#030202", "#0a0706", "#130e0b", "#1d1511", "#281d17", "#34261e", "#423026", "#523c30", "#664c3c", "#7c5e4a"], 10), spec: 1.2, pow: 26, specCol: "#a8866a", dither: 0.4, amb: 0.1, dif: 0.95,
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
    shL: [34, 40, 3], elL: [25, 62, 7], haL: [24, 90, 13], shR: [78, 40, 2], elR: [92, 52, 7], haR: [84, 36, 12],
    hpL: [46, 80, 0], knL: [40, 98, 5], ftL: [37, 116, 4], hpR: [66, 80, -1], knR: [72, 98, 4], ftR: [76, 116, 2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 7, headY: 7.6, headZ: 7, neck: 6, chestX: 21, chestY: 13, chestZ: 12, waistX: 17, waistY: 13, waistZ: 13, hipX: 15, hipY: 6, hipZ: 10,
    arm: 8, arm2: 6.6, wrist: 4.8, thigh: 8, knee: 6, ankle: 5 }, k: 3.2 });
  // 筋肉の塊: 僧帽筋・三角筋・大胸筋・腹の段・二の腕と前腕の膨らみを重ねる
  const traps = [ellipsoid([45, 33, 1], [10, 5.5, 7], "skin", 22), ellipsoid([67, 33, 0], [10, 5.5, 7], "skin", -22)];
  const delts = [ellipsoid([31, 42, 5], [9, 9.5, 9], "skin", 30), ellipsoid([81, 41, 4], [9.5, 9, 9], "skin", -40)];
  const pecs = [ellipsoid([46, 45, 12], [10.5, 7, 5.6], "skin", 12), ellipsoid([66, 45, 11], [10.5, 7, 5.6], "skin", -12)];
  const rolls = [ellipsoid([56, 57, 14], [14, 5.4, 7], "skin"), ellipsoid([56, 64, 15], [15.5, 5.6, 7.5], "skin"), ellipsoid([56, 71, 14], [14.5, 5, 7], "skin")];
  const serratus = [ellipsoid([38, 56, 9], [4, 6, 5], "skin", 15), ellipsoid([74, 56, 8], [4, 6, 5], "skin", -15)];
  // 左腕: 垂らして首斬り台の縁を掴む
  const armL = [ellipsoid([28, 51, 8], [6.8, 10, 6.8], "skin", 25), ellipsoid([25, 52, 3], [5.6, 9, 5.6], "skin", 25),
    ellipsoid([23.5, 71, 9], [7.2, 9, 7], "skin", 4), ellipsoid([23.5, 82, 11], [5.2, 6, 5.2], "skin")];
  // 右腕: 肘を張って斧の柄を肩口で握る
  const armR = [ellipsoid([86, 46, 7], [9.6, 6.8, 6.8], "skin", 38), ellipsoid([86, 50, 3], [8.6, 5.4, 5.4], "skin", 38),
    ellipsoid([90, 44, 10], [6.6, 9, 6.4], "skin", -22)];
  const fistL = Disp(ellipsoid([24, 94, 15], [6.4, 4.6, 6], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(x * 1.3)));
  const fingersL = [...fingers([24, 96, 18], 90, "skin", { n: 4, len: 7, spread: 20, r: 1.6, curl: 0.15, z: 3.4 }),
    tube([[19, 95, 16, 1.8], [16, 97, 19, 1.5], [16, 99, 21, 1.2]], "skin")];
  const fistR = Disp(ellipsoid([84, 34, 13], [6.4, 6.2, 5.8], "skin"), (x, y, z) => 0.4 * Math.max(0, Math.sin(y * 1.3)));
  const navel = ellipsoid([56, 66, 22.4], [1.4, 1.6, 1.6], "hole");
  // 筋の溝: 胸の谷間・腹の正中線・大胸筋の下縁・腕の筋の境目
  const grooves = (x, y, z) => {
    let d = 0.14 * fbm(x * 0.5, y * 0.5, z * 0.5);
    if (Math.abs(x - 56) < 1.1 && y > 37 && y < 74) d += 0.55;
    const under = 51.5 + 0.12 * Math.abs(x - 56) ** 1.25 * 0.4;
    if (Math.abs(y - under) < 0.8 && Math.abs(x - 56) < 18) d += 0.5;
    if (Math.abs(x - 28 + (y - 50) * 0.35) < 0.7 && y > 44 && y < 60) d += 0.35;
    return d;
  };
  const ogre = Sub(Disp(U(2.4, body, ...traps, ...delts, ...pecs, ...rolls, ...serratus, ...armL, ...armR, fistL, fistR), grooves), navel, 0.6);
  // 黒革の頭巾: 大きな先の尖った袋状。肩掛けの裾は胸に垂れる。目穴だけ開く
  const hood = U(2, ellipsoid([56, 21, 7], [10.4, 11, 10], "hood"), cone([56, 14, 5], [59, 0, 0], 7.6, 1.4, "hood"),
    Disp(ellipsoid([56, 33, 5], [15, 5, 11], "hood"), (x, y, z) => 0.3 * Math.sin(x * 0.7) * Math.max(0, (y - 33) / 5)));
  // 肩掛けの裾: 胸の上へ尖って垂れる革の前垂れ
  const capelet = Disp(slab([[45, 31], [67, 31], [70, 37], [64, 41], [59, 49], [56, 53], [53, 49], [48, 41], [42, 37]], 14.5, 1.1, "hood", 0.7, 1.4),
    (x, y, z) => 0.55 * Math.sin((x - 56) * 0.75 + 0.5) * Math.max(0, (y - 34) / 16));
  const eyeHoles = U(0, ellipsoid([51.8, 22, 16], [2.5, 1.6, 3.4], "hole"), ellipsoid([60.2, 22, 16], [2.5, 1.6, 3.4], "hole"));
  const eyes = [sphere([51.8, 22.2, 14.4], 1, "eye"), sphere([60.2, 22.2, 14.4], 1, "eye")];
  // 革の前掛けとベルト
  const apron = Disp(slab([[44, 68], [68, 68], [70, 96], [66, 102], [56, 100], [46, 102], [42, 96]], 18, 1.2, "leather", 0.8), (x, y, z) => 0.6 * Math.sin(x * 0.6) * Math.max(0, (y - 74) / 26));
  const belt = torus([56, 70, 6], 15, 1.8, "leather", 0, 12);
  const buckle = box([56, 71.5, 21.5], [3, 2.6, 1], "iron", 0.6);
  const wraps = [cyl([23.5, 84, 11.5], [24, 89, 13], 5.4, "leather", 1.2), cyl([87, 40, 11], [85, 36, 12], 5.2, "leather", 1.2)];
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
  const block = Sub(Disp(cyl([22, 99, 11], [22, 120, 11], 10, "wood", 1.6), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4)), box([20, 100, 11], [11, 1.4, 1.2], "hole", 0.2, -8), 0.3);
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

import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_vampire", key: "hd_vampire", w: 96, h: 96,
  note: "ヴァンパイア: 打ち捨てられた砦に棲む夜の貴族。蒼白の顔に赤い眼と牙、後ろへ撫でつけた黒髪。立ち襟の黒い外套を蝙蝠の翼のように広げて深紅の裏地を見せ、長い爪の片手を差し伸べる。胴衣の胸には血のような紅玉のブローチ" };
export function build() {
  const mats = {
    lining: { ramp: ramp(["#060102", "#140306", "#24050a", "#36080f", "#4a0c15", "#60121c", "#781a24"], 7), spec: 0.6, pow: 18, specCol: "#a02a34", dither: 0.55, amb: 0.2,
      // 蝙蝠の翼の骨のように、肩から放射する襞
      shade: p => { const L = p.x < 48 ? [40, 28] : [56, 28]; const a = Math.atan2(p.y - L[1], p.x - L[0]); return 0.24 * Math.sin(a * 11) - 0.004 * Math.hypot(p.x - L[0], p.y - L[1]); } },
    cloak: { ramp: ramp(["#010101", "#050407", "#0b090e", "#131017", "#1d1922"], 5), spec: 0.5, pow: 20, specCol: "#2e2934", dither: 0.5 },
    vest: { ramp: ramp(["#030102", "#0b0507", "#160a0d", "#221015", "#30171d", "#3e1f26"], 6), spec: 0.6, pow: 25, dither: 0.5,
      shade: p => 0.06 * Math.sin(p.y * 1.6) },
    skin: { ramp: ramp(["#08090c", "#1a1c22", "#2e3139", "#454852", "#5e626c", "#7a7e88", "#989ca4", "#b8bcc2"], 7), spec: 0.6, pow: 30, specCol: "#dadde2", dither: 0.45, amb: 0.22 },
    hair: { ramp: ramp(["#010101", "#060607", "#0e0e11", "#18181d", "#26262d"], 5), spec: 0.8, pow: 40, specCol: "#3a3a46", dither: 0.4, gain: 0.8,
      shade: p => 0.1 * Math.sin(p.x * 2.2 + p.y * 0.4) },
    lace: { ramp: ramp(["#0c0c0e", "#26262a", "#46464c", "#6a6a70", "#8e8e94"], 5), dither: 0.5 },
    gold: { ramp: ramp(["#050302", "#1a1206", "#36260c", "#5a4416", "#82662a", "#a88a44"], 6), spec: 1.5, pow: 40, specCol: "#f0dca0", dither: 0.4 },
    ruby: { ramp: ["#2a0004", "#6a0410", "#b0101e", "#f04050", "#ffb0b4"], emit: p => 0.35 + 0.55 * Math.max(0, p.nz * 0.7 - p.nx * 0.3 - p.ny * 0.3) },
    eye: { ramp: ["#4a0004", "#a00a10", "#f03a2a", "#ffc0a0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    claw: { ramp: ramp(["#020202", "#0a090b", "#151316", "#221f24"], 4), spec: 1.2, pow: 35, specCol: "#5a5460", dither: 0.4 },
    maw: { ramp: ["#000000", "#140204", "#26050a"], amb: 0.2, dif: 0.2, noRim: true },
    flag: FLAG, stone: { ...STONE, ramp: ramp(["#030303", "#141416", "#2b2d31", "#4c4f56"], 5) },
  };
  // 痩身の貴族: 左手は外套の端を掲げ (外套の陰)、右手を前へ差し伸べる
  const J = { head: [48, 19, 6], neck: [48, 25, 4], chest: [48, 37, 3], waist: [48, 50, 2], hip: [48, 58, 1],
    shL: [40, 31, 3], elL: [32, 26, 0], haL: [22, 18, -2], shR: [56, 31, 3], elR: [64, 40, 9], haR: [73, 41, 16],
    hpL: [44, 59, 1], knL: [42, 73, 3], ftL: [41, 87, 3], hpR: [52, 59, 1], knR: [55, 73, 2], ftR: [56, 87, 2] };
  const body = humanoid(J, { skin: "vest", head: "skin", leg: "cloak", hip: "cloak", arm: "cloak" }, { w: { headX: 4.9, headY: 5.9, headZ: 5, neck: 2.2, chestX: 8.5, chestY: 8, chestZ: 5.5, waistX: 6, waistY: 6, waistZ: 4.5, hipX: 6.5, hipY: 4,
    arm: 2.6, arm2: 2.2, wrist: 1.6, thigh: 3.2, knee: 2.6, ankle: 2.2 }, k: 1.4 });
  const boots = [ellipsoid([40.5, 87.5, 5], [3, 2.4, 5.5], "cloak"), ellipsoid([56.5, 87.5, 4], [3, 2.4, 5.5], "cloak")];
  // 撫でつけた黒髪 (額に尖った生え際) と尖った耳
  const hairline = (x) => 15.0 + 2.4 * Math.exp(-((x - 48) ** 2) / 3);
  const hair = Paint(ellipsoid([48, 17.4, 5.8], [5.4, 6.0, 5.4], "hair"), (x, y, z, m) => (y > hairline(x) && z > 8.2) ? "skin" : m);
  const hairBack = ellipsoid([48, 19, 1.5], [5, 6.4, 4.2], "hair");
  const ears = [cone([43.6, 19.5, 5], [40.6, 15.6, 3.5], 1.2, 0.2, "skin"), cone([52.4, 19.5, 5], [55.4, 15.6, 3.5], 1.2, 0.2, "skin")];
  const eyes = [sphere([46.2, 19, 10.3], 0.75, "eye"), sphere([49.8, 19, 10.3], 0.75, "eye")];
  const brow = ellipsoid([48, 17.6, 9.4], [3.6, 1, 1.6], "skin");
  const nose = cone([48, 18.8, 10.4], [48, 21.6, 11.2], 0.5, 0.7, "skin");
  // 立ち襟: 頭の後ろに尖って立つ、外は黒・内は深紅
  const collarL = slab([[44, 28], [35, 10], [40, 9.5], [46, 23]], -1, 0.8, "lining", 0.4);
  const collarR = slab([[52, 28], [61, 10], [56, 9.5], [50, 23]], -1, 0.8, "lining", 0.4);
  const collarBack = [slab([[44.5, 29], [33.6, 9], [40, 8], [47, 24]], -2.2, 0.8, "cloak", 0.4), slab([[51.5, 29], [62.4, 9], [56, 8], [49, 24]], -2.2, 0.8, "cloak", 0.4)];
  // 外套: 蝙蝠の翼のように広げる。縁は鋸歯状にえぐれる
  const wingL = [[42, 30], [30, 22], [20, 15], [10, 12], [5, 25], [11, 31], [6, 45], [15, 49], [10, 64], [20, 66], [18, 82], [28, 79], [33, 90], [42, 80]];
  const wingR = [[54, 30], [64, 24], [76, 19], [88, 16], [91, 29], [85, 34], [90, 48], [81, 51], [86, 66], [76, 67], [78, 82], [68, 79], [63, 90], [54, 80]];
  const grow = (poly, cx, cy, k) => poly.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * k, y + dy / l * k]; });
  const wave = (x, y, z) => 0.5 * Math.sin(Math.atan2(y - 30, x - 48) * 11);
  const capeIn = [Disp(slab(wingL, -4, 0.9, "lining", 0.4), wave), Disp(slab(wingR, -4, 0.9, "lining", 0.4), wave)];
  const capeOut = [slab(grow(wingL, 40, 40, 1.4), -6, 0.9, "cloak", 0.4), slab(grow(wingR, 56, 40, 1.4), -6, 0.9, "cloak", 0.4)];
  // 掲げた左手の拳が外套の上端を握る
  const fistL = ellipsoid([11.5, 13, -2.5], [1.8, 2, 1.6], "skin");
  // 差し伸べる右手: 長い指に黒い鉤爪
  const handR = ellipsoid([74.5, 41, 16.5], [2.4, 2, 1.8], "skin", 10);
  const fing = fingers([75.5, 41, 16.5], -8, "skin", { n: 4, len: 7, spread: 22, r: 0.6, curl: 0.35, z: 1.5 });
  const thumb = tube([[74, 42, 17, 0.7], [76, 44.5, 18, 0.55], [78.5, 45, 18.5, 0.4]], "skin", { seg: 2 });
  const claws = [];
  for (let i = 0; i < 4; i++) { const a = (-8 + (i - 1.5) * 22 * 2 / 3) * Math.PI / 180, a2 = a + 0.35; const p1 = [75.5 + Math.cos(a) * 3.85, 41 + Math.sin(a) * 3.85], p2 = [p1[0] + Math.cos(a2) * 3.5, p1[1] + Math.sin(a2) * 3.5];
    claws.push(cone([p2[0], p2[1], 18], [p2[0] + Math.cos(a2 + 0.3) * 2.6, p2[1] + Math.sin(a2 + 0.3) * 2.6, 18.5], 0.45, 0.05, "claw")); }
  const cuff = cyl([69, 41, 13], [71, 41, 14.5], 2.1, "lace", 0.5);
  // 胴衣の飾り: 胸元のレースの襟飾りと、紅玉のブローチ、金の釦
  const jabot = [Disp(slab([[45.5, 25], [50.5, 25], [51.5, 34], [48, 36], [44.5, 34]], 8.6, 0.8, "lace", 0.5), (x, y, z) => 0.35 * Math.sin(y * 2.4)) ];
  const lapels = [slab([[42, 28], [46, 27], [47, 46], [44, 42]], 7.8, 0.6, "cloak", 0.3), slab([[54, 28], [50, 27], [49, 46], [52, 42]], 7.8, 0.6, "cloak", 0.3)];
  const brooch = [torus([48, 30, 10.4], 1.8, 0.55, "gold", 0, 90), sphere([48, 30, 10.2], 1.5, "ruby")];
  const buttons = [39, 43, 47].map(y => sphere([48, y, 8.2], 0.7, "gold"));
  const sash = torus([48, 51, 2], 6.2, 1, "lining", 0, 4);
  const mouth = ellipsoid([48, 23.3, 10], [1.4, 0.55, 1.2], "maw");
  const scene = U(0, flagstones(48, 91, 42, 13, { n: 5, seed: 151 }), ...capeOut, ...capeIn, ...collarBack, collarL, collarR,
    Sub(U(0.8, body, ...boots, fistL), mouth, 0.3), hairBack, hair, ...ears, brow, nose, ...eyes, handR, ...fing, thumb, ...claws, cuff, ...jabot, ...lapels, ...brooch, ...buttons, sash);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 30, 20], r: 14, k: 0.45 }, { p: [40, 14, 26], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  // 牙と眼の芯
  C.set(47, 24, "#b8bcc2"); C.set(49, 24, "#b8bcc2");
  C.set(46, 19, "#ffc0a0"); C.set(50, 19, "#ffc0a0");
  // 口元の一筋の血
  C.only(49, 25, "#6a0410"); C.only(49, 26, "#2a0004");
  // 宙を舞う小さな蝙蝠 (2D)
  const bat = (x, y, s = 1) => { const c = "#0b090e"; C.set(x, y, c); C.set(x - 1, y - 1, c); C.set(x + 1, y - 1, c); C.set(x - 2, y - 1, c); C.set(x + 2, y - 1, c); if (s > 1) { C.set(x - 3, y, c); C.set(x + 3, y, c); } C.set(x, y - 1, "#1d1922"); };
  bat(84, 6, 2); bat(10, 4, 1); bat(30, 4, 2);
  grit(C, 157, 48, 91, 38);
  ash(C, 159, 10);
  return C.toArt();
}

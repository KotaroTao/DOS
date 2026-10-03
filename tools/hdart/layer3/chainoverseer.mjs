import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "el_chainoverseer", key: "hd_chainoverseer", w: 112, h: 128,
  note: "鎖鞭の坑監 (強敵): 裾の千切れた長外套に鍔広の帽子の、痩せた坑監の骸。革を張りつけた髑髏の顔に口布、帽子の陰に熾火の眼。右手の鉄鎖の鞭が宙をうねり、左手に吊り灯、腰には罪人の枷と鍵束" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    coat: { ramp: ramp(["#030202", "#090605", "#110b09", "#1a110d", "#241811", "#302016", "#3e2a1c", "#4e3624"], 8), spec: 0.5, pow: 20, specCol: "#6e5038", dither: 0.6,
      shade: p => 0.14 * Math.sin(p.x * 0.7 + p.y * 0.08) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    skin: { ramp: ramp(["#040303", "#110d0a", "#201913", "#30261c", "#423426", "#574632", "#6e5a42"], 7), spec: 0.6, pow: 25, dither: 0.5,
      shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    cloth: { ramp: ramp(["#030303", "#0a0a09", "#141310", "#1f1d18", "#2b2822"], 5), dither: 0.6 },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66", "#707884"], 8), spec: 1.3, pow: 40, specCol: "#b0b8c4", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624", "#a88636"], 7), spec: 1.4, pow: 35, specCol: "#ffe0a0", dither: 0.4 },
    flame: { ramp: ["#3a1002", "#8a3006", "#e07010", "#ffc050", "#fff0b0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    eye: { ramp: ["#3a0a00", "#8a2004", "#e05010", "#ffc060"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#030202"], amb: 0, dif: 0.1, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const J = { head: [56, 28, 6], neck: [56, 35, 3], chest: [56, 46, 0], waist: [56, 60, -1], hip: [56, 68, -2],
    shL: [45, 40, 2], elL: [38, 54, 8], haL: [32, 64, 12], shR: [67, 40, 0], elR: [78, 34, 6], haR: [86, 22, 8],
    hpL: [51, 70, -1], knL: [48, 92, 2], ftL: [46, 116, 2], hpR: [61, 70, -2], knR: [66, 92, 1], ftR: [68, 116, 0] };
  const body = humanoid(J, { skin: "coat", head: "skin" }, { w: { headX: 5, headY: 6.2, headZ: 5.2, neck: 2.2, chestX: 10, chestY: 9, chestZ: 6.5, waistX: 7, waistY: 7, hipX: 8,
    arm: 2.8, arm2: 2.4, wrist: 1.6, thigh: 3.6, knee: 3, ankle: 2.4 }, k: 1.6 });
  // 長外套の裾: 腰から脛まで、千切れて割れる
  const skirt = Disp(cone([56, 56, -1], [56, 106, -2], 9, 16, "coat"), (x, y, z) => 0.8 * Math.sin(Math.atan2(z + 2, x - 56) * 5 + y * 0.12) * Math.max(0, (y - 64) / 40));
  // 前の合わせ目から裾が割れ、脚の間に闇がのぞく
  const slit = slab([[54.5, 80], [57.5, 80], [61, 106], [51, 106]], 18, 10, "hole", 0.5);
  const coat = Sub(Disp(skirt, (x, y, z) => 0.5 * Math.max(0, Math.sin((x - 56) * 0.9)) * Math.max(0, (y - 70) / 30)), slit, 1.5);
  const lapels = [slab([[50, 38], [55, 40], [55, 58], [52, 56]], 7, 0.8, "coat", 0.4), slab([[62, 38], [57, 40], [57, 58], [60, 56]], 7, 0.8, "coat", 0.4)];
  const boots = [ellipsoid([45, 116, 5], [4.6, 3.4, 7], "coat"), ellipsoid([69, 116, 3], [4.6, 3.4, 7], "coat")];
  // 鍔広の帽子と口布
  const hat = U(0.8, cyl([56, 21, 6], [56, 22.2, 6], 13, "coat", 0.6), Disp(cyl([56, 13, 5], [56, 21, 6], 6.5, "coat", 2), (x, y, z) => (Math.abs(x - 56) < 1 && y < 15 ? 0.6 : 0)));
  const band = cyl([56, 19, 6], [56, 20.6, 6], 6.7, "iron", 0.3);
  const mask = Disp(slab([[50, 29], [62, 29], [61, 36], [56, 39], [51, 36]], 11, 1, "cloth", 0.5), (x, y, z) => 0.25 * Math.sin(y * 1.6));
  const eyes = [sphere([53.4, 26, 10.6], 0.9, "eye"), sphere([58.6, 26, 10.6], 0.9, "eye")];
  // 右手の鎖鞭: 振り上げた手から大きく S 字にうねって床へ
  const links = [];
  const path = [[86, 22, 8], [92, 12, 10], [100, 8, 12], [106, 16, 12], [102, 30, 14], [92, 40, 16], [86, 54, 16], [92, 68, 14], [100, 80, 12], [98, 96, 10], [90, 108, 8], [82, 116, 6]];
  let li = 0;
  for (let k = 0; k < path.length - 1; k++) { const a = path[k], b = path[k + 1]; const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.6)); for (let i = 0; i < n; i++) { const t = i / n; const p = a.map((v, c) => v + (b[c] - v) * t); links.push(torus(p, 1.7, 0.65, "iron", Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, (li++) % 2 ? 0 : 90)); } }
  const grip = cyl([84, 25, 9], [88, 19, 8], 1.6, "coat", 0.3);
  const handR = fingers([86, 22, 8], -60, "skin", { n: 4, len: 3.6, spread: 14, r: 0.8, curl: 1.4, z: 1 });
  // 左手の吊り灯
  const lampRing = torus([32, 70, 13], 1.4, 0.5, "iron", 0, 90);
  const lampTop = cone([32, 73, 13], [32, 76, 13], 1, 4, "brass");
  const lampCage = [];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; lampCage.push(cyl([32 + Math.cos(a) * 3.4, 76, 13 + Math.sin(a) * 3.4], [32 + Math.cos(a) * 3.4, 85, 13 + Math.sin(a) * 3.4], 0.5, "brass")); }
  const lampBase = cyl([32, 85, 13], [32, 87.5, 13], 4.2, "brass", 0.5);
  const flame = ellipsoid([32, 81, 13], [1.8, 3, 1.8], "flame");
  const handL = fingers([32, 64, 12], 90, "skin", { n: 4, len: 3.6, spread: 12, r: 0.8, curl: 1, z: 1 });
  // 腰の枷と鍵束
  const belt = torus([56, 62, -1], 8.6, 1.3, "coat", 0, 6);
  const shackles = [torus([47, 70, 8], 3, 1, "iron", 20, 70), torus([49, 76, 9], 3, 1, "iron", -20, 70)];
  const keys = [torus([65, 68, 8], 2.4, 0.6, "brass", 0, 80), cyl([64, 70, 9], [63, 77, 9], 0.6, "brass"), cyl([66, 70, 9], [68, 76, 9], 0.6, "brass")];
  const scene = U(0, rubble(56, 120, 50, 18, { n: 10, seed: 221, big: 4 }), U(1, body, ...boots), coat, ...lapels, hat, band, mask, ...eyes, ...links, grip, ...handR, lampRing, lampTop, ...lampCage, lampBase, flame, ...handL, belt, ...shackles, ...keys);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [32, 80, 22], r: 34, k: 0.6 }] });
  const C = new Canvas(r);
  // 口布の上に覗く皮の張りついた頬骨と、眼の熾火
  C.set(53, 25, "#ffc060"); C.set(58, 25, "#ffc060");
  // 鞭の先が床を打つ火花
  const Sp = ["#8a3006", "#e07010", "#ffc050", "#fff0b0"];
  const R = rand(223);
  for (let i = 0; i < 14; i++) { const a = -Math.PI * R(), d = 2 + R() * 7; C.set(82 + Math.cos(a) * d, 116 + Math.sin(a) * d * 0.6, Sp[Math.floor(R() * 4)]); }
  pebbles(C, 227, 56, 118, 46, 30);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, EMBER, ASH, sandFloor, ashfall, embers, smolder, puffs, ashCoat, dents } from "../arena.mjs";
export const meta = { id: "el_ashshogun", key: "hd_ashshogun", w: 112, h: 128,
  note: "灰燼の将 (強敵): 町を守る兵を率い、町が焼けた夜に兵ごと灰になった将の霊。灰を固めたような大鎧と大袖、焦げてちぎれた陣羽織、大きな鍬形の兜と面頬の奥に熾火の眼。両手で高く構えた灰の大太刀は刃先だけが赤く焼け、鎧の継ぎ目の急所を正確に何度も断つ (痛撃・多用)。斬られた左肩は灰煙となって崩れ、舞い散った灰がまた体へ吸い寄せられて将の形に積もり直す (再生)。足元には灰の小山" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    plate: { ramp: ["#060505", "#100f0e", "#1c1a19", "#2a2725", "#3a3633", "#4c4743", "#605a55", "#77706a"], spec: 0.4, pow: 20, dither: 0.5,
      shade: p => (Math.sin(p.y * 1.5) > 0.75 ? -0.14 : 0) + 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    cord: { ramp: ["#0c0303", "#200707", "#3a0d0c", "#541512"], dither: 0.4 },
    coat: { ramp: ["#050202", "#110605", "#200b09", "#30120e", "#421a14"], dither: 0.6, amb: 0.22 },
    brass: { ramp: ["#0e0904", "#2a1c0c", "#4a3616", "#725826", "#a08040", "#ccb070"], spec: 1.2, pow: 28, specCol: "#f0e0b0", dither: 0.4 },
    blade: { ramp: ["#08080a", "#18181c", "#2c2c32", "#44444c", "#606068", "#8a8a92"], spec: 1.3, pow: 34, specCol: "#e0e0e8", dither: 0.4 },
    hole: { ramp: ["#000000", "#0c0302"], amb: 0, dif: 0.05, noRim: true },
    glow: { ramp: EMBER.slice(1), noRim: true, emit: () => 0.85 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 脇構えから斬り上げる構え: 両手を右の腰に、大太刀は左上へ
  const J = { head: [58, 34, 2], neck: [58, 42, 1], chest: [58, 55, 0], waist: [58, 70, 0], hip: [58, 78, 0],
    shL: [45, 49, 4], elL: [46, 62, 10], haL: [60, 68, 14], shR: [71, 49, -2], elR: [80, 60, 6], haR: [68, 70, 14],
    hpL: [51, 82, 2], knL: [42, 98, 8], ftL: [36, 121, 6], hpR: [65, 82, -2], knR: [74, 98, 2], ftR: [80, 121, -2] };
  const body = Disp(humanoid(J, { skin: "plate" }, { k: 2, w: { headX: 6, headY: 6.6, chestX: 14, chestY: 12, chestZ: 9, waistX: 11, waistY: 9, hipX: 12, arm: 4, arm2: 3.4, wrist: 2.6, thigh: 5, knee: 4, ankle: 3.4 } }), dents(0.5, 0.3));
  // 大袖 (四角い肩の板) と草摺 (腰の垂れ板)
  const sode = [Disp(box([40, 58, 6], [7, 10, 2], "plate", 1, 14), dents(0.4, 0.4)), Disp(box([76, 58, 0], [7, 10, 2], "plate", 1, -14), dents(0.4, 0.4))];
  const kusazuri = [];
  for (let i = 0; i < 4; i++) kusazuri.push(box([46 + i * 8, 86, 8 - Math.abs(i - 1.5) * 1.4], [3.8, 7, 1.2], "plate", 0.6, (i - 1.5) * 8));
  const cords = [tube([[44, 50, 9, 0.7], [44, 66, 9, 0.7]], "cord"), tube([[72, 50, 7, 0.7], [72, 66, 7, 0.7]], "cord"), torus([58, 72, 0], 11, 1.2, "cord", 0, 10)];
  // 焦げてちぎれた陣羽織 (背から裾へ)
  const coat = Disp(slab([[44, 46], [72, 46], [80, 80], [86, 104], [76, 100], [70, 110], [62, 102], [52, 108], [44, 98], [34, 104], [38, 80]], -9, 1.2, "coat", 0.8),
    (x, y, z) => 0.6 * Math.sin(x * 0.4 + y * 0.2) + 0.4 * fbm(x * 0.3, y * 0.3));
  // 鍬形の兜と面頬
  const kabuto = Disp(U(1, ellipsoid([58, 31, 2], [7.6, 6.4, 7.4], "plate"), Disp(ellipsoid([58, 36, -1], [12, 3, 9], "plate", 0, -12), (x, y, z) => -0.1 * Math.abs(x - 58))), dents(0.4, 0.5));
  const kuwagata = [tube([[56, 27, 8, 1.2], [50, 18, 8, 1], [44, 6, 8, 0.8], [46, 2, 8, 0.4]], "brass", { seg: 3 }), tube([[60, 27, 8, 1.2], [66, 18, 8, 1], [72, 6, 8, 0.8], [70, 2, 8, 0.4]], "brass", { seg: 3 })];
  const mempo = ellipsoid([58, 38, 6.6], [4.8, 3.4, 3], "plate");
  const eyes = U(0, box([55.4, 33.4, 8.6], [1.6, 0.7, 1.2], "hole"), box([60.6, 33.4, 8.6], [1.6, 0.7, 1.2], "hole"));
  const eyeGlow = [sphere([55.4, 33.4, 8], 0.8, "glow"), sphere([60.6, 33.4, 8], 0.8, "glow")];
  // 灰の大太刀 (両手で左上へ)
  const tachi = U(0.3, cone([60, 66, 16], [12, 14, 16], 1.9, 0.6, "blade"), torus([61, 67, 16], 2.2, 0.7, "brass", 47, 90), cyl([62, 68, 16], [72, 76, 16], 1.1, "cord"));
  const hands = [...fingers([62, 68, 15], -40, "plate", { n: 4, len: 3, spread: 14, r: 0.9, curl: 1.4 }), ...fingers([69, 72, 15], -40, "plate", { n: 4, len: 3, spread: 14, r: 0.9, curl: 1.4 })];
  // 足元の灰の小山
  const mound = Disp(ellipsoid([58, 126, 2], [30, 6, 16], "ashbed"), (x, y, z) => 0.8 * fbm(x * 0.2, z * 0.2));
  const scene = U(0, sandFloor(56, 127, 52, 15, { seed: 13101, ash: 0.4, flags: 1, swords: 1, helms: 1 }), mound, coat, Sub(U(1.2, body, kabuto, mempo, ...sode), eyes, 0.3), ...eyeGlow, ...kusazuri, ...cords, ...kuwagata, tachi, ...hands);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [20, 6, 26], r: 22, k: 0.35 }] });
  const C = new Canvas(r);
  ashCoat(C, ["plate"], { th: -0.45, seed: 5, k: 1.2 });
  smolder(C, ["plate"], { f: 0.25, th: 0.9, seed: 9 });
  // 刃先だけ赤く焼けた刃
  for (let t = 0; t <= 1; t += 0.004) { const x = 60 - t * 48, y = 66 - t * 52; if (t < 0.55) continue; const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && p.m === "blade") C.set(x, y, EMBER[Math.min(4, 1 + Math.floor((t - 0.55) * 9))]); }
  for (const [x, y, c] of [[11, 13, EMBER[4]], [10, 13, EMBER[2]], [12, 13, EMBER[2]], [11, 14, EMBER[2]], [11, 12, EMBER[2]], [9, 13, EMBER[1]], [13, 13, EMBER[1]], [11, 10, EMBER[1]], [11, 16, EMBER[1]]]) C.set(x, y, c);
  // 崩れる左肩: 大袖のあたりを灰煙にほどく
  for (let y = 44; y < 74; y++) for (let x = 28; x < 50; x++) { const p = C.pix[y * W + x]; if (p && (p.m === "plate" || p.m === "cord" || p.m === "coat") && x + 0.6 * (y - 44) * 0 + 6 * fbm(x * 0.25, y * 0.25, 3) < 38) C.px[y * W + x] = null; }
  puffs(C, [[30, 56, 9], [22, 50, 7], [16, 60, 6], [26, 68, 6], [12, 46, 5]], [ASH[1], ASH[2], ASH[3], ASH[4]], { dens: 0.9, seed: 13 });
  // 体へ吸い寄せられる灰の流れ (渦を描いて戻る)
  const R = rand(13103);
  for (let i = 0; i < 9; i++) { const a0 = R() * Math.PI * 2, d0 = 30 + R() * 20; for (let t = 0; t < 1; t += 0.02) { const a = a0 + t * 2, d = d0 * (1 - t * 0.7), x = 58 + Math.cos(a) * d, y = 66 + Math.sin(a) * d * 0.9; if (!C.get(Math.round(x), Math.round(y)) && ((t * 50) | 0) % 3 !== 0) C.set(x, y, ASH[t > 0.6 ? 3 : 2]); } }
  embers(C, 13105, 20, [0, 20, W, 100]);
  ashfall(C, 13107, 90);
  return C.toArt();
}

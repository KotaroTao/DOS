import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, EMBER, ASH, sandFloor, ashfall, embers, smolder, puffs, ashCoat, dents } from "../arena.mjs";
export const meta = { id: "bs_championofash", key: "hd_championofash", w: 96, h: 96,
  note: "灰の覇者: 町が焼けた夜も最後まで砂の上に立っていた闘技場の覇者。全身が灰をかぶった重い鎧で、肩には覇者の証の大きな月桂の飾り。継ぎ目と胸のひびの奥ではまだ熾火が赤く光る。兜の口から灰まじりの熱い息を吐いて隊をまとめて焼く (ブレス・多用) — 灰と火の粉の奔流が左へ噴き出す。焼けて固まった鎧が刃を半ば阻む (物理抵抗50)" };
export function build() {
  const mats = {
    plate: { ramp: ["#050403", "#0e0c0b", "#1a1716", "#272321", "#36312e", "#47413d", "#5a534e"], spec: 0.5, pow: 22, dither: 0.5,
      shade: p => 0.07 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    hole: { ramp: ["#000000", "#0c0302"], amb: 0, dif: 0.05, noRim: true },
    glow: { ramp: EMBER.slice(1), noRim: true, emit: p => 0.4 + 0.5 * Math.max(0, p.nz) },
    laurel: { ramp: ["#0e0904", "#2a1c0c", "#4a3616", "#725826", "#a08040"], spec: 1, pow: 24, dither: 0.4 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [52, 28, 2], neck: [52, 35, 1], chest: [53, 46, 0], waist: [54, 58, 0], hip: [54, 65, 0],
    shL: [42, 40, 4], elL: [36, 52, 8], haL: [30, 62, 12], shR: [64, 40, -2], elR: [72, 52, 2], haR: [76, 62, 6],
    hpL: [48, 68, 2], knL: [42, 79, 6], ftL: [38, 91, 6], hpR: [60, 68, -2], knR: [66, 79, 0], ftR: [70, 91, -2] };
  const body = Disp(humanoid(J, { skin: "plate" }, { k: 1.8, w: { headX: 6, headY: 6.6, chestX: 12, chestY: 10, chestZ: 8, waistX: 9, hipX: 10, arm: 4, arm2: 3.6, wrist: 3, thigh: 4.6, knee: 3.8, ankle: 3.2 } }), dents(0.5, 0.3));
  const pauldrons = [ellipsoid([40, 38, 3], [8, 5.4, 7], "plate", -25), ellipsoid([66, 38, -2], [8, 5.4, 7], "plate", 25)];
  // 覇者の兜 (大きな頬当てと、息を吐く口の穴)
  const helm = Disp(U(1, ellipsoid([52, 27, 2], [7, 7.6, 7], "plate"), box([52, 22, 2], [7.4, 1.2, 6.6], "plate", 0.6)), dents(0.6, 0.45));
  const mouth = ellipsoid([49, 32, 8.4], [2.6, 1.6, 2], "hole");
  const eyes = U(0, box([49, 26, 8.6], [2, 0.8, 1.2], "hole"), box([55, 26, 8.6], [1.6, 0.8, 1.2], "hole"));
  const eyeGlow = [sphere([49, 26, 8], 0.8, "glow"), sphere([55, 26, 8], 0.8, "glow")];
  // 月桂の飾り (兜の後ろから左右へ)
  const laurel = [];
  for (let k = 0; k < 7; k++) { const a = Math.PI + 0.4 + k * 0.38; laurel.push(ellipsoid([52 + Math.cos(a) * 8, 24 + Math.sin(a) * 4, -2], [2.2, 1, 1.6], "laurel", a * 57)); }
  // 胸のひび (熾火)
  const crack = tube([[48, 40, 8.6, 0.8], [52, 46, 8.8, 0.9], [50, 52, 8.4, 0.8], [55, 58, 7.6, 0.7]], "glow");
  const greatsword = U(0.4, cone([30, 62, 12], [24, 92, 12], 2.2, 1.2, "plate"), box([30, 62, 12], [4, 0.8, 1.2], "laurel", 0.3, -10), cyl([30, 62, 12], [31, 56, 12], 1, "iron"));
  const scene = U(0, sandFloor(54, 95, 44, 13, { seed: 12701, blood: 0.02, ash: 0.35, flags: 1, swords: 1 }), Sub(U(1.2, body, helm, ...pauldrons), U(0, mouth, eyes), 0.3), ...eyeGlow, ...laurel, crack, greatsword);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [40, 34, 20], r: 20, k: 0.35 }] });
  const C = new Canvas(r);
  ashCoat(C, ["plate"], { th: -0.4, seed: 7, k: 1.3 });
  smolder(C, ["plate"], { f: 0.35, th: 0.75, seed: 3 });
  // 兜の口から噴き出す灰と火の粉の奔流 (左へ扇に広がる)
  const fan = [];
  for (let i = 0; i < 9; i++) { const t = i / 8; fan.push([46 - t * 40, 33 + t * 14 + Math.sin(i) * 3, 3 + t * 9]); }
  puffs(C, fan, [ASH[1], ASH[2], ASH[3], ASH[4], "#8a6a5a"], { dens: 1, seed: 11 });
  embers(C, 12703, 70, [0, 26, 46, 40]);
  embers(C, 12705, 12, [0, 0, 96, 96]);
  ashfall(C, 12707, 50);
  return C.toArt();
}

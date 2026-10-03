import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_darksamurai", key: "hd_darksamurai", w: 96, h: 96,
  note: "黒甲の武者: 黒漆の大鎧の落ち武者。三日月の金の前立ての兜、面頬の奥に赤い眼。朱の威糸で綴った大袖と草摺の段板を張り、腰を深く落として左腰の刀の柄に手をかけた居合の構え" };
export function build() {
  const mats = {
    lac: { ramp: ramp(["#020203", "#060609", "#0c0c11", "#14141a", "#1d1d25", "#282832", "#363642", "#4a4a58", "#62626e"], 9), spec: 2.4, pow: 55, specCol: "#b4b4c4", dither: 0.4, amb: 0.2,
      shade: p => 0.05 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    odo: { ramp: ramp(["#120302", "#2a0804", "#4a1006", "#6e1c0a", "#962a10", "#ba4018"], 6), dither: 0.5, amb: 0.2 },
    gold: { ramp: ramp(["#060402", "#1c1406", "#36280c", "#584216", "#7c6020", "#a48434", "#ccae58"], 7), spec: 1.6, pow: 40, specCol: "#fff0b8", dither: 0.4 },
    cloth: { ramp: ramp(["#030304", "#08080b", "#101014", "#18181e", "#222228"], 5), dither: 0.6, amb: 0.2,
      shade: p => 0.1 * Math.sin(p.x * 0.9 + p.y * 0.2) },
    menpo: { ramp: ramp(["#030102", "#0c0405", "#180809", "#260e0e", "#361614", "#4a201c"], 6), spec: 1.6, pow: 40, specCol: "#8a5048", dither: 0.4 },
    steel: { ramp: ramp(["#05070a", "#10141a", "#1e2530", "#303a48", "#485668", "#66788e"], 6), spec: 2, pow: 45, specCol: "#e0ecf8", dither: 0.4 },
    void: { ramp: ["#000000", "#000000", "#020102"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 段板を威糸で綴った板 (裏は朱の威、表に黒漆の札板を n 段)
  const laced = (x0, y0, w, h, n, z, rot = 0, flare = 0) => {
    const parts = [box([x0, y0 + h / 2, z - 0.8], [w / 2 - 0.3, h / 2, 0.8], "odo", 0.4, rot)];
    const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    for (let i = 0; i < n; i++) {
      const yy = (i + 0.5) * h / n - h / 2, ww = w / 2 + flare * i / Math.max(1, n - 1);
      parts.push(box([x0 - s * yy, y0 + h / 2 + c * yy, z + 0.4], [ww, h / n / 2 - 0.55, 1.1], "lac", 0.4, rot));
    }
    return parts;
  };
  // 胴: 黒漆の箱型の胴、胸に段板
  const torso = box([48, 42, 0], [10, 9.5, 7], "lac", 3.5);
  const dou = laced(48, 36, 19, 16, 5, 7.2);
  const obi = cyl([48, 53, 0], [48, 55.4, 0], 9.6, "odo", 0.6);
  // 草摺: 腰から前後左右に下がる四枚
  const kusa = [...laced(40, 55, 9, 12, 4, 6.8, 10, 0.8), ...laced(56, 55, 9, 12, 4, 6.8, -10, 0.8), ...laced(33, 54, 8, 11, 4, 1, 26, 0.6), ...laced(63, 54, 8, 11, 4, 1, -26, 0.6)];
  // 大袖: 肩から垂れる大きな四角い板
  const sodeL = laced(30, 30, 11, 19, 5, 3, 16, 1);
  const sodeR = laced(66, 30, 11, 19, 5, 3, -16, 1);
  // 兜: 鉢・錣 (しころ)・吹返し・三日月の前立て
  const hc = [48, 22, 3];
  const bowl = Sub(ellipsoid([48, 19.5, 3], [6.6, 5.4, 6.6], "lac"), box([48, 26, 3], [10, 4, 10], "lac"));
  const ribs = [-3.4, 0, 3.4].map(dx => Sub(ellipsoid([48 + dx * 0.9, 19.4, 3], [0.7, 5.5, 6.8], "lac"), box([48, 26, 3], [10, 4, 10], "lac")));
  const visor = slab([[41, 21], [55, 21], [53.5, 23], [42.5, 23]], 9.2, 0.7, "lac", 0.3, 0.2);
  const shikoro = [0, 1, 2].map(i => Sub(cone([48, 21.6 + i * 2.5, 2], [48, 24 + i * 2.5, 1.5], 7.6 + i * 2.1, 9 + i * 2.1, i === 1 ? "odo" : "lac"),
    box([48, 26, 13.5], [16, 10, 10], "lac")));
  const fuki = [slab([[39.5, 22], [42.5, 22], [41.5, 28], [36.5, 27]], 6.5, 0.8, "lac", 0.4), slab([[56.5, 22], [53.5, 22], [54.5, 28], [59.5, 27]], 6.5, 0.8, "lac", 0.4)];
  const face = ellipsoid([48, 25, 4.5], [4.2, 3.6, 3.6], "void");
  // 三日月: 外の弧と内の弧の間
  const moon = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.06 + 0.88 * i / 18); moon.push([48 - Math.cos(a) * 16, 3 + Math.sin(a) * 15.5]); }
  for (let i = 18; i >= 0; i--) { const a = Math.PI * (0.1 + 0.8 * i / 18); moon.push([48 - Math.cos(a) * 14.4, 3.6 + Math.sin(a) * 11.4]); }
  const maedate = slab(moon, 10.6, 0.8, "gold", 0.3, 0.4);
  const crestBase = sphere([48, 18.4, 10.8], 1.5, "gold");
  // 面頬: 鼻から顎を覆う赤黒の面、口は牙をむく
  const menpo = Sub(ellipsoid([48, 27.4, 6.4], [4.6, 3.2, 3], "menpo"), box([48, 28.4, 9.5], [2.4, 0.6, 2], "void", 0.2), 0.2);
  const throat = [0, 1].map(i => cyl([48, 30 + i * 1.6, 3], [48, 31.2 + i * 1.6, 3.3], 5.2 + i * 0.6, i ? "odo" : "lac", 0.4));
  // 腕: 右手 (画面左) は体の前を横切って柄へ、左手 (画面右) は鯉口を握る
  const armR = [tube([[36, 36, 1, 3.2], [33, 47, 6, 2.9], [47, 55, 11, 2.3]], "cloth", { seg: 3 }), cyl([34, 48, 7], [45, 54.4, 11], 2.7, "lac", 1), ellipsoid([49, 55, 12.4], [2.8, 2.6, 2.6], "lac")];
  const armL = [tube([[60, 36, 1, 3.2], [67, 47, 4, 2.9], [62, 58.6, 8, 2.3]], "cloth", { seg: 3 }), cyl([66.6, 48, 4.6], [63, 57, 8], 2.7, "lac", 1), ellipsoid([61.6, 59.4, 9.6], [2.8, 2.6, 2.6], "lac")];
  // 刀: 左腰の鞘、柄は前へ。鞘は後ろ (右下) へ長く伸びる
  const tsuka = cyl([57.6, 58.6, 9.6], [45, 53.6, 13], 1.3, "cloth", 0.4);
  const kashira = sphere([44.6, 53.4, 13.1], 1.4, "gold");
  const tsuba = cyl([58.4, 58.9, 9.2], [59.2, 59.2, 8.8], 3, "gold", 0.3);
  const saya = tube([[60, 59.6, 8.4, 1.5], [70, 63, 4, 1.45], [80, 66.4, -0.5, 1.4], [89, 68.2, -4, 1.25]], "lac");
  const sageo = tube([[61, 60.6, 9, 0.5], [63, 63.5, 8.5, 0.5], [60, 65, 8, 0.45], [57, 63.5, 7.5, 0.4]], "odo");
  // 脚: 深く腰を落とした広い構え。佩楯 (はいだて) と臑当
  const legs = [tube([[43, 64, 0, 5.2], [31, 73, 3, 4.4], [29, 86, 2, 3]], "cloth", { seg: 3 }), tube([[53, 64, 0, 5.2], [66, 73, 2, 4.4], [69, 86, 1, 3]], "cloth", { seg: 3 }),
    ...laced(36.4, 63, 7, 8, 3, 5.6, 40, 0.4), ...laced(60, 63, 7, 8, 3, 5, -40, 0.4),
    cyl([31.2, 77, 4.6], [29.4, 85.6, 4], 3.5, "lac", 1.2), cyl([66, 77, 3.6], [68.6, 85.6, 3], 3.5, "lac", 1.2),
    sphere([32, 74.6, 4.6], 2.8, "lac"), sphere([65.4, 74.6, 3.6], 2.8, "lac"),
    ellipsoid([28, 88.6, 4], [5, 2.2, 4.6], "cloth"), ellipsoid([70, 88.6, 3], [5, 2.2, 4.6], "cloth")];
  const studs = [[27, 30.6, 5.2], [32.6, 32, 5.2], [63.4, 32, 5.2], [69, 30.6, 5.2], [39.6, 22.6, 7.6], [56.4, 22.6, 7.6], [44, 36.6, 8.8], [52, 36.6, 8.8]].map(p => sphere(p, 0.9, "gold"));
  const scene = U(0, ...studs, flagstones(49, 92, 44, 13, { n: 4, seed: 101 }),
    torso, ...dou, obi, ...kusa, ...sodeL, ...sodeR, bowl, ...ribs, visor, ...shikoro, ...fuki, face, maedate, crestBase, menpo, ...throat,
    ...armR, ...armL, tsuka, kashira, tsuba, saya, sageo, ...legs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [hc[0], hc[1] + 4, hc[2] + 12], r: 8, k: 0.25 }] });
  const C = new Canvas(r);
  // 面頬の奥の赤い眼
  const E = ["#4a0804", "#a01808", "#ff4a1a", "#ffb080"];
  for (const [ex, d] of [[45.5, -1], [50.5, 1]]) { C.set(ex - d, 24, E[1]); C.set(ex, 24, E[3]); C.set(ex + d, 24, E[2]); C.set(ex, 25, E[0]); }
  // 柄巻の菱目
  for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; C.only(57 - 12 * t, 58.3 - 4.7 * t, "#5a4a30"); }
  grit(C, 103, 49, 91, 40);
  ash(C, 105, 12, [2, 2, 92, 92], true);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, STEEL, BRASS, RIM, SOULS, sandFloor, ashfall, embers, soulLamp, slashArc, ashCoat, dents } from "../arena.mjs";
export const meta = { id: "bs_championwraith", key: "hd_championwraith", w: 96, h: 96,
  note: "不滅の闘士: 灰に埋もれた闘技場でいまも試合を続ける闘士の霊。へこんだ兜とひびの入った丸盾、片手剣。鎧の胸の小さな覗き窓の奥で青白い魂の灯がひとつ揺れる。片手剣で続けざまに二度斬りつけ (二連撃)、二筋の刃の軌跡が交わる。手負いで猛り (激昂)、致命の一撃を一度は耐える (不屈) — 膝の砂に一度ついた跡が残る" };
export function build() {
  const mats = {
    steel: { ...STEEL, shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) - (fbm(p.x * 0.35 + 3, p.y * 0.35, p.z * 0.35) > 0.32 ? 0.14 : 0) },
    shield: { ramp: ["#040302", "#100a07", "#20160e", "#322216", "#4a3220", "#583c26"], dither: 0.5, spec: 0.4, pow: 18,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4) },
    brass: BRASS, crest: { ramp: ["#0e0304", "#2a080a", "#4a1012", "#6e1c1a"], dither: 0.6 },
    cloth: { ramp: ["#040303", "#110e0c", "#211b17", "#332a22"], dither: 0.6 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    lamp: { ramp: [SOULS[1], SOULS[2], SOULS[3], SOULS[4]], noRim: true, emit: () => 0.9 },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [50, 28, 2], neck: [50, 35, 1], chest: [50, 45, 0], waist: [50, 56, 0], hip: [50, 63, 0],
    shL: [40, 40, 4], elL: [30, 48, 10], haL: [26, 56, 14], shR: [60, 40, -2], elR: [70, 32, 2], haR: [76, 22, 4],
    hpL: [44, 66, 2], knL: [38, 78, 8], ftL: [34, 91, 6], hpR: [56, 66, -2], knR: [62, 78, 2], ftR: [66, 91, -2] };
  const body = Disp(humanoid(J, { skin: "steel", leg: "cloth" }, { w: { headX: 5.2, headY: 6, chestX: 10, chestY: 8.5, chestZ: 7, waistX: 7.4, hipX: 8.6, arm: 3.2, arm2: 2.8, wrist: 2.2, thigh: 3.8, knee: 3.2, ankle: 2.6 } }), dents(0.5, 0.4));
  // へこんだ兜: 丸い鉢・張り出したつば・頬当て、頂に擦り切れた赤い鶏冠
  const helm = Disp(U(0.8, ellipsoid([50, 27, 2], [6.4, 6.6, 6.4], "steel"), torus([50, 27, 2], 6.4, 1, "steel", 0, 8), box([45, 32, 6], [1.6, 3, 2], "steel", 0.5), box([55, 32, 6], [1.6, 3, 2], "steel", 0.5)), dents(0.7, 0.5));
  const crest = Disp(U(0.6, ellipsoid([50, 18, 0], [1.6, 4, 8], "crest"), ellipsoid([50, 16, -6], [1.4, 3, 4], "crest")), (x, y, z) => 0.5 * fbm(x * 0.8, y * 0.8, z * 0.5));
  const visor = U(0, box([50, 28, 8.2], [4, 0.9, 1.4], "hole"), box([50, 31, 8.2], [0.8, 2, 1.4], "hole"));
  const eyes = [sphere([47.6, 28, 7.6], 0.8, "eye"), sphere([52.4, 28, 7.6], 0.8, "eye")];
  // 胸の覗き窓 (格子つき) と奥の魂の灯
  const window = box([50, 45, 7.2], [2.4, 2.6, 1.6], "hole", 0.4);
  const lamp = sphere([50, 45.6, 5.6], 1.6, "lamp");
  const grille = [box([50, 45, 7.4], [0.35, 2.6, 0.5], "brass"), box([50, 45, 7.4], [2.4, 0.35, 0.5], "brass")];
  const pauldron = ellipsoid([61, 38, -1], [5.6, 4, 5.4], "steel", 25);
  const belt = torus([50, 57, 0], 7.6, 1.1, "brass", 0, 10);
  const skirt = [box([45, 63, 5], [3, 4.4, 1.2], "shield", 0.5, 8), box([50, 64, 6], [3, 4.6, 1.2], "shield", 0.5), box([55, 63, 5], [3, 4.4, 1.2], "shield", 0.5, -8)];
  const greaves = [cone([38, 79, 9], [34, 90, 7], 3.2, 2.6, "steel"), cone([62, 79, 3], [66, 90, -1], 3.2, 2.6, "steel")];
  // ひびの入った丸盾 (左手、前に構える)
  const shield = Sub(U(0.5, Disp(cyl([24, 54, 14], [24, 54, 18], 12, "shield", 1.2), (x, y, z) => -0.12 * Math.hypot(x - 24, y - 54)),
    torus([24, 54, 17.6], 11.2, 1.1, "brass"), sphere([24, 54, 19.4], 2.6, "brass")), box([20, 47, 20], [0.6, 7, 4], "hole", 0, 24), 0.3);
  // 片手剣 (右手、振りかぶる)
  const blade = U(0.3, cone([77, 21, 4], [88, 4, 2], 1.6, 0.4, "steel"), box([76, 23, 4], [3.2, 0.7, 1], "brass", 0.3, 33), cyl([76, 23, 4], [73, 27, 4], 0.9, "cloth"));
  const scene = U(0, sandFloor(50, 95, 44, 13, { seed: 11101, blood: 0.1, ash: 0.1, flags: 1, swords: 1 }), crest, Sub(U(1.2, body, helm, pauldron), U(0, visor, window), 0.3), lamp, ...grille, ...eyes, belt, ...skirt, ...greaves, shield, blade);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [50, 46, 10], r: 9, k: 0.6 }, { p: [86, 8, 20], r: 22, k: 0.3 }] });
  const C = new Canvas(r);
  // 盾のひび
  for (const [x, y] of [[20, 47], [21, 49], [20, 51], [21, 53], [22, 55], [21, 57], [22, 58]]) C.only(x, y, "#000000");
  soulLamp(C, 50, 46, 0.8, SOULS, false);
  ashCoat(C, ["steel", "shield"], { th: -0.55, seed: 3 });
  // 続けざまの二連の斬撃 (交わる二筋)
  slashArc(C, 58, 40, 30, -1.9, -0.2, { w: 2.4 });
  slashArc(C, 64, 52, 26, -0.6, 1.1, { w: 2, cols: ["#2c3044", "#5c6280", "#a8aec8", "#e8ecf8"] });
  ashfall(C, 11103, 60);
  embers(C, 11105, 8, [0, 30, 96, 50]);
  return C.toArt();
}

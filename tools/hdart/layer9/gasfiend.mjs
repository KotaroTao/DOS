import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, scum, motes, puffs, sores } from "../swamp.mjs";
export const meta = { id: "bs_gasfiend", key: "hd_gasfiend", w: 96, h: 96,
  note: "毒気の鬼: 沼の毒気が凝って生まれた、背の丸い緑くすみの鬼。膨れた腹と、ねじれた二本の角。両頬を膨らませて大口を開け、黄緑の毒の息を前へ吹きつける (ブレス・多用)。肩と背中のあちこちに開いた穴からも毒気が噴き上がる。毒気でできた体は、呪文の熱にもろい (魔法弱点)" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#020301", "#070a05", "#0e1409", "#16200e", "#1f2c13", "#2a3a19", "#374a21", "#465c2a"], 8), dither: 0.55, amb: 0.24, spec: 0.4, pow: 18,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    horn: { ramp: ramp(["#0a0805", "#1e1a10", "#38301c", "#56492c", "#78683e"], 5), spec: 0.8, pow: 24, dither: 0.4 },
    loin: { ramp: ramp(["#030202", "#0b0806", "#15100b", "#211912"], 4), dither: 0.6 },
    maw: { ramp: ["#020301", "#0e1a06", "#24400c", "#3e6a14"], dither: 0.4 },
    vent: { ramp: ["#000000", "#0e1806", "#24400c"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [32, 34, 8], neck: [38, 40, 4], chest: [50, 46, 0], waist: [54, 60, 0], hip: [56, 70, 0],
    shL: [42, 40, 8], elL: [32, 54, 14], haL: [24, 62, 16], shR: [62, 40, -4], elR: [72, 54, 2], haR: [74, 66, 8],
    hpL: [50, 72, 6], knL: [42, 80, 10], ftL: [36, 90, 10], hpR: [62, 72, -4], knR: [70, 80, 0], ftR: [74, 90, 0] };
  const body = humanoid(J, { skin: "skin" }, { k: 2.4, w: { headX: 8, headY: 7, headZ: 7, neck: 5, chestX: 15, chestY: 11, chestZ: 11, waistX: 15, waistY: 10, waistZ: 12, hipX: 13, arm: 4.6, arm2: 3.8, wrist: 3, thigh: 5, knee: 4, ankle: 3 } });
  const belly = ellipsoid([50, 62, 8], [12, 11, 8], "skin");
  const cheeks = [ellipsoid([28, 38, 12], [4.4, 4, 4], "skin"), ellipsoid([36, 38, 13], [4.2, 3.8, 4], "skin")];
  const brow = ellipsoid([31, 29, 13], [7, 2.4, 3], "skin", -10);
  const horns = [tube([[28, 28, 8, 2.6], [24, 21, 8, 2], [26, 15, 8, 1.2], [23, 10, 8, 0.4]], "horn"), tube([[36, 27, 6, 2.6], [42, 20, 4, 2], [42, 13, 3, 1.2], [46, 9, 2, 0.4]], "horn")];
  const mouth = ellipsoid([26, 41, 14], [5, 3.4, 3], "maw", -10);
  const eyes = [sphere([27, 31, 14], 1.1, "eye"), sphere([34, 31, 14.4], 1.1, "eye")];
  const loin = Disp(ellipsoid([56, 72, 2], [13, 5, 11], "loin"), (x, y, z) => 0.6 * Math.max(0, y - 72) * Math.abs(Math.sin(x * 0.8)));
  const handL = [ellipsoid([23, 63, 17], [3, 3, 2.6], "skin"), ...fingers([22, 64, 17], 120, "skin", { n: 4, len: 5, spread: 30, r: 1.1, curl: 0.4 })];
  const handR = [ellipsoid([74, 67, 9], [3, 3, 2.6], "skin"), ...fingers([74, 68, 9], 70, "skin", { n: 4, len: 5, spread: 30, r: 1.1, curl: 0.4 })];
  // 背中・肩の噴気の穴
  const vents = [ellipsoid([58, 36, 4], [2, 2, 2], "vent"), ellipsoid([66, 44, 2], [1.8, 1.8, 2], "vent"), ellipsoid([46, 38, 9], [1.6, 1.6, 1.8], "vent")];
  const oni = Sub(Disp(U(1.6, body, belly, ...cheeks, brow, ...handL, ...handR), (x, y, z) => 0.4 * Math.max(0, fbm(x * 0.6, y * 0.6, z * 0.6))), U(0, mouth, ...vents), 0.4);
  const scene = U(0, bogFloor(54, 94, 42, 14, { n: 2, seed: 9801, wet: 0.05, logs: 1 }), oni, loin, ...horns, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [16, 46, 24], r: 22, k: 0.3 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 22, 30, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#3a3a20", "#8a8a5a", "#d8d8a8"], seed: 9803 });
  sores(C, 13, ["skin"], { th: 0.6, f: 0.5 });
  // 毒の息 (口から左下へ吹きつける)
  const cols = ["#16200a", "#24380e", "#3a5414", "#587a1c", "#86a82a", "#bcd658"];
  puffs(C, [[20, 44, 6], [14, 49, 9], [8, 55, 11], [3, 62, 11], [10, 63, 8], [2, 48, 7]], cols, { dens: 0.95, seed: 4 });
  // 噴気の穴から立ちのぼる毒気
  puffs(C, [[60, 30, 5], [62, 22, 4], [70, 38, 4], [74, 32, 3], [46, 32, 3]], MIASMA.slice(1), { dens: 1, seed: 6 });
  scum(C, 9805);
  motes(C, 9807, 18, [2, 2, 92, 60], true);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_frostknight", key: "hd_frostknight", w: 96, h: 96,
  note: "凍れる騎士: 霜と氷にびっしり覆われた、王家の近衛の古い全身鎧。中身はとうに無く、兜の覗き穴の奥に青白い光だけが灯る。両手で握った長い氷の剣を引いて突きの構えをとり、鎧ごと急所を貫く (痛撃)。肩と腕には厚い氷が張り、縁から氷柱が垂れる。背には凍って固まったぼろぼろの外套" };
export function build() {
  const mats = {
    steel: { ramp: ramp(["#030405", "#0a0c10", "#14181e", "#20262e", "#2e3640", "#404a56", "#58646e", "#76848e"], 8), spec: 1.2, pow: 30, specCol: "#c4d4e0", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    cloak: { ramp: ramp(["#030407", "#080c14", "#0e1520", "#16202e", "#202c3c"], 5), dither: 0.6 },
    trim: { ramp: ramp(["#0e0a04", "#2a200c", "#4e3e1a", "#7a6430", "#a48c50"], 5), spec: 1, pow: 26, dither: 0.4 },
    blade: { ramp: ramp(["#06101c", "#123050", "#24507a", "#3e78a4", "#6aa4c8", "#b4dcf0", "#e8f6ff"], 7), spec: 1.8, pow: 50, specCol: "#ffffff", dither: 0.35 },
    hole: { ramp: ["#000000", "#010203"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  const J = { head: [50, 20, 2], neck: [50, 27, 1], chest: [50, 38, 0], waist: [50, 52, 0], hip: [50, 60, 0],
    shL: [40, 32, 4], elL: [34, 44, 10], haL: [30, 50, 14], shR: [60, 32, -2], elR: [62, 46, 4], haR: [44, 52, 12],
    hpL: [44, 62, 2], knL: [38, 74, 6], ftL: [34, 89, 6], hpR: [56, 62, -2], knR: [62, 74, 0], ftR: [66, 89, -2] };
  const body = humanoid(J, { skin: "steel" }, { w: { headX: 5.4, headY: 6.4, chestX: 11, chestY: 9, chestZ: 7, waistX: 8, hipX: 9.5, arm: 3.4, arm2: 3, wrist: 2.4, thigh: 4, knee: 3.4, ankle: 2.8 } });
  const pauldrons = [ellipsoid([39, 30, 4], [6, 4.4, 6], "steel", -20), ellipsoid([61, 30, -2], [6, 4.4, 6], "steel", 20)];
  const helm = U(1, ellipsoid([50, 19, 2], [6, 7.4, 6.4], "steel"), cone([50, 13, 1], [50, 5, 0], 2.2, 0.4, "steel"));
  const visor = box([50, 20, 8], [4, 0.8, 1.6], "hole");
  const eyes = [sphere([48, 20, 7], 0.9, "eye"), sphere([52, 20, 7], 0.9, "eye")];
  const belt = torus([50, 54, 0], 8.4, 1.2, "trim", 0, 10);
  const tassets = [box([45, 62, 5], [4, 5, 1.4], "steel", 0.6, 8), box([55, 62, 4], [4, 5, 1.4], "steel", 0.6, -8)];
  const cloak = Disp(slab([[42, 30], [60, 30], [70, 70], [62, 86], [40, 82], [34, 64]], -9, 1, "cloak", 0.6), (x, y, z) => 0.8 * Math.sin(x * 0.7 + fbm(x * 0.2, y * 0.2)) * Math.max(0, (y - 40) / 40));
  // 両手で引いた長い氷の剣 (切っ先は画面左へ)
  const grip = cyl([28, 52, 15], [46, 52, 12], 1.2, "trim");
  const guard = box([26, 52, 15], [1.2, 5, 1.4], "trim", 0.4);
  const blade = Disp(cone([25, 52, 15], [-2, 46, 18], 2.8, 0.3, "blade"), (x, y, z) => -0.2 * Math.abs(Math.sin(x * 0.6)));
  // 肩と腕の厚い氷
  const ice = Disp(U(1.5, ellipsoid([38, 29, 4], [7, 4, 7], "ice", -20), ellipsoid([63, 31, -2], [6, 5, 6], "ice", 20), ellipsoid([36, 74, 6], [4, 6, 4], "ice")), iceCracks(0.7, 0.4));
  const scene = U(0, iceFloor(50, 94, 42, 13, { n: 3, seed: 9301, snow: 0.08 }), cloak, Sub(U(1.2, body, helm, ...pauldrons), visor, 0.3), ...eyes, belt, ...tassets, grip, guard, blade, ice);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [10, 48, 22], r: 22, k: 0.3 }] });
  const C = new Canvas(r);
  hoarfrost(C, ["steel", "cloak"], { th: 0.35, seed: 23, k: 1.3 });
  icicles(C, 9303, ["ice", "steel", "cloak"], 0.14, 4);
  glints(C, 9305, ["blade", "ice"], 5);
  // 切っ先の冷たい光
  C.set(1, 46, "#e8f6ff"); C.set(0, 46, "#6aa4c8"); C.set(1, 45, "#6aa4c8"); C.set(2, 46, "#b4dcf0");
  snowfall(C, 9307, 30);
  return C.toArt();
}

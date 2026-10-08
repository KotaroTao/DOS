import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, LAVA_RAMP, RIM, lavaFloor, underglow, embers, crackAt } from "../lava.mjs";
export const meta = { id: "bs_lavamaw", key: "hd_lavamaw", w: 96, h: 96,
  note: "溶岩の顎: 溶岩溜まりから突き出した、岩のような巨大な顎だけの魔。ひび割れた黒い玄武岩の顎に黒曜石の牙がぎざぎざに並び、喉の奥は煮えたぎって白く光る。牙の先から溶岩がしたたり、上顎の気孔のひとつ眼がぎらつく" };
export function build() {
  const mats = {
    lip: { ramp: ramp(["#020101", "#080505", "#110b09", "#1b120e", "#271a14", "#35231a", "#462e22"], 7), spec: 0.5, pow: 20, dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    throat: { ramp: LAVA_RAMP, noRim: true, emit: p => 0.55 + 0.45 * Math.max(0, p.nz) + 0.15 * fbm(p.x * 0.3, p.y * 0.3, 1) },
    fang: { ramp: ramp(["#06050a", "#14111c", "#262234", "#3e3850", "#5c5672", "#888098", "#c0b8d0"], 7), spec: 1.4, pow: 40, specCol: "#ece8f8", dither: 0.35 },
    eye: { ramp: ["#7a1a06", "#f07a1c", "#ffdc7a", "#fff4c4"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const rock = (x, y, z) => 1.2 * fbm(x * 0.1, y * 0.1, z * 0.1) + 0.8 * Math.pow(1 - Math.abs(vnoise(x * 0.22, y * 0.22, z * 0.22)), 6);
  // 上顎: 斜め上へ大きく開いた岩のくちばし。下顎: 溶岩溜まりから突き出る
  const upper = Disp(U(4, ellipsoid([50, 28, -2], [28, 11, 17], "lip", -14), ellipsoid([56, 18, -8], [18, 10, 13], "lip", -10), ellipsoid([28, 36, 4], [10, 7, 11], "lip", -25)), rock);
  const lower = Disp(U(4, ellipsoid([46, 72, 2], [32, 9, 17], "lip", 6), ellipsoid([22, 66, 6], [9, 7, 10], "lip", 30)), rock);
  const back = Disp(ellipsoid([56, 50, -14], [22, 24, 10], "lip"), rock);
  const mawCut = ellipsoid([44, 52, 12], [24, 14, 16], "lip", -6);
  const jaws = Paint(Sub(U(3, upper, lower, back), mawCut, 2), (x, y, z, m) => (m === "lip" && crackAt(x + y * 0.4, z + y * 0.7, 0.25, 0.9)) ? "lava" : m);
  const gullet = Disp(ellipsoid([52, 52, -4], [14, 11, 5], "throat"), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3, 2));
  // 牙: 上顎の縁から下へ、下顎の縁から上へ。黒曜石のぎざぎざ
  const R = rand(7511);
  const fangs = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = 24 + t * 44, yb = 40 + t * 6 - Math.sin(t * 3.1) * 2, L = 7 + R() * 6 - Math.abs(t - 0.4) * 5, z = 10 - Math.abs(t - 0.4) * 12;
    fangs.push(cone([x, yb - 1, z], [x - 1 + R() * 2, yb + L, z + 1], 2.2, 0.25, "fang"));
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7, x = 24 + t * 42, yb = 66 - t * 2, L = 5 + R() * 5 - Math.abs(t - 0.4) * 4, z = 12 - Math.abs(t - 0.4) * 12;
    fangs.push(cone([x, yb + 1, z], [x - 1 + R() * 2, yb - L, z + 1], 2.0, 0.25, "fang"));
  }
  const eye = sphere([58, 17, 9.5], 2.4, "eye");
  const lid = Sub(ellipsoid([58, 16, 7], [5.2, 3.6, 4], "lip"), ellipsoid([58, 17.5, 10], [3.2, 2.2, 3], "lip"));
  const drips = [];
  for (let i = 0; i < 5; i++) { const x = 28 + i * 9 + R() * 3, y = 48 + R() * 4; drips.push(cone([x, y, 13], [x, y + 4 + R() * 5, 14], 1, 0.4, "lava")); }
  const scene = U(0, lavaFloor(48, 90, 46, 14, { n: 3, seed: 7503, pool: [46, 4, 32], cracks: 0.8 }), jaws, gullet, ...fangs, eye, lid, ...drips);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [50, 52, 8], r: 32, k: 0.55 }] });
  const C = new Canvas(r);
  C.set(57, 16, "#fff4c4"); C.set(58, 16, "#fff4c4");
  underglow(C, { skip: ["throat", "eye", "fang"] });
  embers(C, 7509, 34, [4, 2, 88, 40]);
  return C.toArt();
}

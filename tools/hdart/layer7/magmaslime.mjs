import { sphere, ellipsoid, cone, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, LAVA_RAMP, RIM, lavaFloor, underglow, embers, puffs } from "../lava.mjs";
export const meta = { id: "bs_magmaslime", key: "hd_magmaslime", w: 96, h: 96,
  note: "溶岩の粘塊: 床に広がって盛り上がる溶岩の塊。表面は黒く冷えた皮膜の板に割れ、すき間から煮えた橙が光る。半ば呑まれた兜と盾が赤く溶けて崩れかけ (鎧を溶かす)、縁からは溶岩が垂れて床を焼く。上には熱気と火の粉" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030101", "#0c0605", "#170b08", "#22110b", "#2f170e", "#3e1f12", "#4e2a17"], 7), spec: 0.9, pow: 26, specCol: "#9a4a2a", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    lava: LAVA,
    steel: { ramp: ramp(["#040404", "#0e0e10", "#1c1c20", "#2c2c32", "#404048", "#5a5a64", "#7c7c88"], 7), spec: 1.1, pow: 30, specCol: "#c8c8d4", dither: 0.45 },
    hot: { ramp: ["#3a0a04", "#7a1a06", "#b8380c", "#e86a18", "#ffa040"], emit: p => 0.3 + 0.55 * Math.max(0, p.nz) + 0.2 * fbm(p.x * 0.4, p.y * 0.4, 2) },
    basalt: BASALT, crust: CRUST,
  };
  // 塊: 床に広がる低い山 + 盛り上がる頭のこぶ
  const mound = U(5, ellipsoid([48, 74, 0], [36, 16, 22], "skin"), ellipsoid([44, 56, 2], [22, 20, 18], "skin"), ellipsoid([62, 62, -2], [14, 12, 12], "skin"),
    ellipsoid([28, 66, 6], [12, 10, 10], "skin"));
  const lump = Disp(mound, (x, y, z) => 1.1 * fbm(x * 0.09, y * 0.09, z * 0.09) + 0.3 * vnoise(x * 0.4, y * 0.4, z * 0.4));
  // 冷えた皮膜の板の継ぎ目に溶岩 (ボロノイ風: 2 つの稜線ノイズ)
  const seam = (x, y, z) => { const w = 3 * fbm(x * 0.07, y * 0.07, z * 0.07); return Math.pow(1 - Math.abs(vnoise(x * 0.11 + w, y * 0.14 - w, z * 0.12)), 5) > 0.72; };
  const slime = Paint(lump, (x, y, z, m) => (m === "skin" && (seam(x, y, z) || (y > 85 && fbm(x * 0.3, z * 0.3) > 0.1))) ? "lava" : m);
  // 呑まれかけた兜 (左上へ傾いて半ば沈む) と盾の縁。溶けた所は赤熱
  const helm = Sub(U(0.8, ellipsoid([34, 48, 14], [8, 7.5, 7.5], "steel", -20), cone([31, 44, 16], [27, 37, 16], 2, 0.4, "steel")),
    U(0, box([34, 51, 22], [7, 1.2, 3], "steel", 0.3, -20), box([35.5, 48, 22], [1, 4, 3], "steel", 0.3, -20)));
  const helmP = Paint(helm, (x, y, z, m) => (y > 50 + 2 * fbm(x * 0.5, z * 0.5) ? "hot" : m));
  const shield = Paint(Disp(ellipsoid([66, 58, 12], [9, 11, 1.6], "steel", 25, -30), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5)),
    (x, y, z, m) => (y > 60 + 3 * fbm(x * 0.4, y * 0.4, 3) ? "hot" : m));
  const boss = sphere([66, 57, 14.5], 1.6, "steel");
  // 垂れる溶岩の雫
  const drips = [];
  const R = rand(7101);
  for (let i = 0; i < 6; i++) { const x = 18 + R() * 60, y = 78 + R() * 4; drips.push(cone([x, y, 14 + R() * 6], [x + (R() - 0.5) * 2, y + 5 + R() * 4, 16 + R() * 6], 1.6, 0.6, "lava")); }
  const floor = lavaFloor(48, 90, 46, 14, { n: 3, seed: 7103, pool: [20, 8, 9] });
  const scene = U(0, floor, U(1.4, slime, helmP, shield), boss, ...drips);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 兜の覗き穴の奥は闇
  C.set(34, 50, "#000000"); C.set(33, 50, "#000000"); C.set(36, 49, "#000000");
  underglow(C, { skip: ["hot"] });
  // 塊の上の二つの眼のような光る穴
  for (const [x, y] of [[45, 41], [53, 42]]) { C.set(x, y, "#ffdc7a"); C.set(x + 1, y, "#f07a1c"); C.set(x, y + 1, "#d24e10"); C.set(x + 1, y + 1, "#7a1a06"); C.set(x - 1, y, "#4e0e04"); }
  embers(C, 7107, 30, [6, 4, 84, 50]);
  return C.toArt();
}

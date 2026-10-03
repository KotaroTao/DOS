import { tube, sphere, ellipsoid, cone, slab, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, cracks } from "../mine.mjs";
export const meta = { id: "bs_deepgolem", key: "hd_deepgolem", w: 96, h: 96,
  note: "大地のゴーレム: 岩盤そのものが立ち上がった巨像。体は幾重もの地層の縞で、肩は丸い巨岩、頭は小さな岩塊に眼の割れ目がひとつ。古い呪文の文字が胸に薄く残り、足元の床が割れる" };
export function build() {
  // 地層: 高さで色の違う縞 (砂岩・頁岩・粘土)
  const strata = (y) => { const b = Math.floor((y + 2 * Math.sin(y * 0.2)) / 4.5) % 4; return ["rockA", "rockB", "rockA", "rockC"][(b + 4) % 4]; };
  const R0 = (stops) => ({ ramp: ramp(stops, 7), spec: 0.3, pow: 20, dither: 0.55, shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) });
  const mats = {
    rockA: R0(["#030302", "#0c0a07", "#17130e", "#231d15", "#30281d", "#3f3426", "#524430"]),
    rockB: R0(["#030303", "#0a0a0a", "#141413", "#1f1e1c", "#2b2a27", "#393733", "#4a4741"]),
    rockC: R0(["#040201", "#0f0705", "#1c0e09", "#2a160e", "#3a2014", "#4c2b1b", "#603824"]),
    rune: { ramp: ["#1e1a08", "#4a3e10", "#8a7420", "#d0b440"], emit: p => 0.5 + 0.3 * Math.max(0, p.nz) },
    eye: { ramp: ["#2a1e00", "#7a5204", "#d0a020", "#fff0a0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    gravel: GRAVEL, rock: ROCK,
  };
  const torso = Disp(box([48, 46, 0], [18, 17, 12], "rockA", 6), (x, y, z) => 0.6 * fbm(x * 0.2, y * 0.2, z * 0.2));
  const hip = Disp(box([48, 66, -2], [14, 7, 10], "rockA", 4), (x, y, z) => 0.6 * fbm(x * 0.2, y * 0.2, z * 0.2));
  const shoulders = [Disp(sphere([26, 34, 0], 11, "rockA"), (x, y, z) => 0.9 * fbm(x * 0.2, y * 0.2, z * 0.2)), Disp(sphere([70, 34, -2], 11, "rockA"), (x, y, z) => 0.9 * fbm(x * 0.2, y * 0.2, z * 0.2))];
  const arms = [tube([[24, 42, 4, 7.5], [18, 58, 8, 7], [18, 72, 10, 7.5]], "rockA"), tube([[72, 42, 2, 7.5], [78, 58, 6, 7], [78, 72, 8, 7.5]], "rockA")];
  const fists = [Disp(sphere([18, 78, 11], 8.5, "rockA"), (x, y, z) => 0.8 * fbm(x * 0.3, y * 0.3, z * 0.3)), Disp(sphere([78, 78, 9], 8.5, "rockA"), (x, y, z) => 0.8 * fbm(x * 0.3, y * 0.3, z * 0.3))];
  const legs = [Disp(box([38, 80, 0], [7, 10, 8], "rockA", 3), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3)), Disp(box([58, 80, -2], [7, 10, 8], "rockA", 3), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3))];
  const head = Disp(box([48, 24, 6], [7, 6, 6], "rockA", 3, -4), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const golem = Paint(Disp(U(2.2, torso, hip, ...shoulders, ...arms, ...fists, ...legs, head), (x, y, z) => cracks(0.9, 0.22)(x, y, z) + (Math.abs(((y + 2 * Math.sin(x * 0.2)) % 4.5 + 4.5) % 4.5) < 0.5 ? 0.35 : 0)),
    (x, y, z, m) => m === "rockA" ? strata(y + 2 * Math.sin(x * 0.2)) : m);
  // 眼: 頭を横に走る割れ目に、ひとつの灯
  const eye = ellipsoid([48, 24, 12.4], [4, 0.9, 1], "eye");
  const scene = U(0, rubble(48, 92, 46, 15, { n: 9, seed: 151, big: 3.8 }), golem, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 胸に薄く残る呪文の文字
  const G = ["#4a3e10", "#8a7420"];
  // 円環と放射の刻印 (半ば削れて途切れる)
  for (let a = 0; a < 6.28; a += 0.22) if (Math.sin(a * 3) > -0.4) C.only(48 + Math.cos(a) * 6, 44 + Math.sin(a) * 5, G[(a * 5 | 0) % 2]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; C.only(48 + Math.cos(a) * 2, 44 + Math.sin(a) * 1.6, G[1]); C.only(48 + Math.cos(a) * 3.4, 44 + Math.sin(a) * 2.8, G[0]); }
  // 足元の割れた床
  for (const [x0, y0, x1, y1] of [[30, 90, 22, 93], [64, 90, 74, 93], [48, 91, 50, 95]]) C.line(x0, y0, x1, y1, "#000000");
  pebbles(C, 67, 48, 91, 42);
  return C.toArt();
}

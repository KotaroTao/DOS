import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_tunneler", key: "hd_tunneler", w: 96, h: 96,
  note: "坑道掘りの獣: 土を割って躍り出る盲いた巨獣。毛に埋もれた潰れた眼、肉色の星形の鼻、岩を砕く鋤のような前肢の巨大なかぎ爪。崩れる土塊が足元に散る" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#020202", "#080706", "#110f0d", "#1a1714", "#25201b", "#312a23", "#3f362c", "#4f4436"], 8), dither: 0.65, spec: 0.3, pow: 15,
      shade: p => 0.14 * fbm(p.x * 1.1, p.y * 1.1, p.z * 1.1) },
    flesh: { ramp: ramp(["#050203", "#170809", "#2c1012", "#441a1a", "#5e2624", "#7a3630", "#96483c"], 7), spec: 1.4, pow: 35, specCol: "#f0b0a0", dither: 0.45 },
    claw: { ramp: ramp(["#040302", "#141009", "#282014", "#40321e", "#5c4a2c", "#7e683e", "#a08a58"], 7), spec: 1.6, pow: 50, specCol: "#f4e8c0", dither: 0.4 },
    maw: { ramp: ["#000000", "#0c0304", "#1a0607"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 胴は土の中から斜めに伸び上がり、頭と前肢が手前に迫る
  const body = ellipsoid([60, 64, -10], [30, 16, 16], "fur", -12);
  const head = ellipsoid([38, 50, 8], [12, 10, 11], "fur", -20);
  const snout = cone([34, 53, 14], [24, 58, 22], 6.2, 3.0, "fur");
  // 星形の鼻: 鼻先から肉の触手が輪になって伸びる
  const N = [23, 58.5, 23];
  const star = [sphere(N, 2.2, "flesh")];
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; star.push(cone([N[0] + Math.cos(a) * 1.6, N[1] + Math.sin(a) * 1.6, N[2]], [N[0] + Math.cos(a) * 5.6, N[1] + Math.sin(a) * 5.6, N[2] + 1.5], 1.2, 0.5, "flesh")); }
  const mouth = ellipsoid([29, 62, 18], [5, 1.6, 4], "maw", -20);
  // 前肢: 太い腕の先に鋤のような掌、四本の大爪が床をえぐる
  const arm = (s, hx, hy, hz) => {
    const sh = [s < 0 ? 40 : 60, 62, 4];
    const parts = [tube([[...sh, 7], [hx - s * 2, hy - 8, hz - 2, 6], [hx, hy, hz, 5.5]], "fur")];
    parts.push(Disp(ellipsoid([hx, hy + 2, hz + 2], [8, 5, 6], "fur", s * 20), (x, y, z) => 0.3 * fbm(x * 0.6, y * 0.6, z * 0.6)));
    for (let i = 0; i < 4; i++) {
      const bx = hx - 6 + i * 4 + s, by = hy + 5, bz = hz + 4 - Math.abs(i - 1.5);
      parts.push(tube([[bx, by, bz, 1.8], [bx - 1 + s * 0.5, by + 6, bz + 3, 1.3], [bx - 2 + s, by + 12, bz + 3, 0.35]], "claw", { seg: 3 }));
    }
    return parts;
  };
  const beast = Disp(U(3, body, head, snout), (x, y, z) => 0.35 * fbm(x * 0.7, y * 0.7, z * 0.7));
  // 土を割った穴の縁: 盛り上がった土塊
  const clods = [];
  const R = rand(41);
  for (let i = 0; i < 9; i++) clods.push(Disp(sphere([46 + (R() * 2 - 1) * 40, 80 + R() * 6, -10 + R() * 18], 3 + R() * 3.5, "rock"), (x, y, z) => 0.6 * fbm(x * 0.5, y * 0.5, z * 0.5)));
  const scene = U(0, rubble(48, 91, 46, 15, { n: 8, seed: 43, big: 4 }), ...clods, Sub(beast, mouth, 0.6), ...star, ...arm(-1, 14, 70, 14), ...arm(1, 58, 72, 14));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 毛に埋もれた潰れた眼 (細い切れ目)
  C.line(30, 47, 33, 48, "#000000"); C.line(40, 46, 43, 46, "#000000"); C.set(31, 48, "#3a3028"); C.set(41, 47, "#3a3028");
  for (const x of [26, 28, 31, 33]) C.only(x, 62, "#b8ac90");
  // 爪の先から舞う土埃
  const D = ["#29241f", "#3e372e", "#544c42"];
  for (let i = 0; i < 26; i++) { const x = 6 + R() * 84, y = 70 + R() * 14; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, D[Math.floor(R() * 3)]); }
  pebbles(C, 17, 48, 90, 40);
  return C.toArt();
}

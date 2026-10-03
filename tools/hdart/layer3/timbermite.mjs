import { tube, sphere, ellipsoid, cone, slab, cyl, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_timbermite", key: "hd_timbermite", w: 96, h: 96,
  note: "坑木喰いの白アリ: 犬ほどもある白蟻。蒼白く透ける膨れた腹、琥珀色の硬い頭と大顎、顎先から滴る蟻酸。喰い荒らした坑木の上に群れの二匹目がのぞく" };
export function build() {
  const mats = {
    pale: { ramp: ramp(["#060504", "#16130f", "#28241c", "#3c362a", "#524a3a", "#6a614c", "#847a60", "#a09474"], 8), spec: 1.4, pow: 40, specCol: "#e8dcc0", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    band: { ramp: ramp(["#040303", "#100d0a", "#1e1912", "#2c251b", "#3a3124"], 5), dither: 0.5 },
    chit: { ramp: ramp(["#040201", "#120904", "#241207", "#381d0b", "#4e2a10", "#683a16", "#844c1e"], 7), spec: 1.6, pow: 50, specCol: "#f0c080", dither: 0.45 },
    mand: { ramp: ramp(["#020101", "#0a0504", "#170a06", "#26100a", "#3a1a0e", "#522614"], 6), spec: 1.6, pow: 50, specCol: "#d09060", dither: 0.4 },
    wood: { ramp: ramp(["#030201", "#0d0805", "#1a110a", "#281a0f", "#372415", "#48301c", "#5a3c24"], 7), dither: 0.55,
      shade: p => 0.14 * Math.sin(p.y * 1.4 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    hole: { ramp: ["#000000", "#000000", "#040302"], amb: 0, dif: 0.1, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 喰い荒らされた坑木: 斜めに倒れた梁、虫食いの穴
  const beam = Sub(Disp(box([48, 80, -10], [44, 5.5, 6], "wood", 1.5, -8), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4, z * 0.4)),
    U(0, ...[[20, 82], [34, 79], [70, 74], [82, 72], [58, 77]].map(([x, y]) => sphere([x, y, -4], 2.2, "hole"))), 0.5);
  // 一匹目: 正面やや左向き。頭は手前、腹は奥で膨れる
  const mite = (ox, oy, oz, k, dir) => {
    const P = (x, y, z) => [ox + x * k * dir, oy + y * k, oz + z * k];
    const ring = (cx) => (x, y, z, m) => (m === "pale" && Math.abs(Math.sin(((x - cx) * dir) * 0.55)) < 0.22) ? "band" : m;
    const abd = Paint(ellipsoid(P(14, -2, -6), [17 * k, 12 * k, 12 * k], "pale", -10 * dir), ring(P(14, 0, 0)[0]));
    const thorax = ellipsoid(P(-2, 0, 0), [7 * k, 6 * k, 6 * k], "pale");
    const head = ellipsoid(P(-12, 2, 6), [8 * k, 7 * k, 7.5 * k], "chit");
    const mand = [];
    // 大顎: 上下に開いた鎌形の一対 (横から見て咬み合う)
    for (const s of [-1, 1]) mand.push(tube([[...P(-17, 3 + s * 2.4, 8), 1.9 * k], [...P(-22, 3 + s * 4.4, 9), 1.4 * k], [...P(-25.5, 3 + s * 3.4, 9), 0.8 * k], [...P(-27, 3 + s * 2.2, 9), 0.3 * k]], "mand", { seg: 3 }));
    const ant = [tube([[...P(-15, -3, 8), 0.7 * k], [...P(-20, -10, 10), 0.6 * k], [...P(-27, -12, 9), 0.4 * k]], "chit"), tube([[...P(-12, -3, 4), 0.7 * k], [...P(-12, -11, 2), 0.6 * k], [...P(-6, -16, 0), 0.4 * k]], "chit")];
    const legs = [];
    for (const [a, b, c] of [[[-4, 3], [-12, 8], [-16, 16]], [[-1, 4], [-2, 10], [-4, 17]], [[3, 3], [10, 8], [14, 16]]]) for (const zs of [1, -1])
      legs.push(tube([[...P(a[0], a[1], 4 * zs), 1.2 * k], [...P(b[0], b[1] - 3, 9 * zs), 1.0 * k], [...P(c[0], c[1], 10 * zs), 0.5 * k]], "pale"));
    return U(1 * k, abd, thorax, head, ...mand, ...ant, ...legs);
  };
  const m1 = mite(52, 58, 6, 1.25, 1);
  const m2 = mite(76, 36, -18, 0.62, -1);
  const scene = U(0, rubble(48, 91, 44, 14, { n: 6, seed: 31, big: 3 }), beam, m1, m2);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 単眼のない頭に小さな黒点、顎先から滴る蟻酸 (黄緑)
  const A = ["#3a4a10", "#7a9418", "#c4dc48"];
  for (const [x, y0, l] of [[16, 66, 7], [19, 67, 4]]) { for (let i = 0; i < l; i++) C.set(x, y0 + i, A[i < l - 2 ? 0 : 1]); C.set(x, y0 + l, A[2]); }
  for (const [x, y] of [[18, 86], [24, 87], [30, 86]]) { C.set(x, y, A[1]); C.set(x + 1, y, A[0]); }
  pebbles(C, 13, 48, 90, 40);
  return C.toArt();
}

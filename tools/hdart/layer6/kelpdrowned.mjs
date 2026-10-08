import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes, drips } from "../temple.mjs";
export const meta = { id: "bs_kelpdrowned", key: "hd_kelpdrowned", w: 96, h: 96,
  note: "藻に巻かれし者: 水に呑まれた参拝者の亡骸。頭から足まで黒緑の藻に巻かれ、藻の隙間から白く濁った眼がのぞく。前屈みに両腕を伸ばしてすがりつこうとし、背後にはもう一体の亡骸の影 (群れ)。全身から水がしたたる" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040505", "#0e1212", "#1a2020", "#283030", "#384242", "#4a5654", "#606c68"], 7), spec: 0.7, pow: 26, specCol: "#90a8a4", dither: 0.55, amb: 0.2,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    kelp: { ramp: ramp(["#020302", "#060c07", "#0c160c", "#132212", "#1b2e18", "#253c1f", "#324c28"], 7), spec: 0.9, pow: 30, specCol: "#5a7a50", dither: 0.6, amb: 0.2,
      shade: p => 0.16 * Math.sin(p.x * 1.6 + 2 * fbm(p.x * 0.2, p.y * 0.1, p.z * 0.2)) },
    shade: { ramp: ramp(["#020404", "#060c0d", "#0b1517", "#122022", "#1a2c2c"], 5), dither: 0.8, amb: 0.25, dif: 0.45 },
    eye: { ramp: ["#4a5a58", "#a8c0bc", "#e8f8f4"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#030505", "#070a0a"], amb: 0.1, dif: 0.2, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const R = rand(601);
  // 前屈みの亡骸: 頭を突き出し、両腕を前へ
  const J = { head: [50, 27, 6], neck: [48, 33, 3], chest: [46, 40, 1], waist: [44, 51, 0], hip: [44, 58, 0],
    shL: [37, 36, 2], elL: [33, 45, 9], haL: [30, 52, 15], shR: [56, 36, 2], elR: [62, 44, 9], haR: [66, 50, 15],
    hpL: [39, 60, -1], knL: [37, 72, 3], ftL: [35, 86, 1], hpR: [50, 60, 1], knR: [53, 72, 4], ftR: [55, 86, 3] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5, headY: 6, chestX: 8.5, chestY: 7.6, waistX: 6.5, thigh: 3.4, arm: 2.5 } });
  const hands = [...fingers(J.haL, 120, "skin", { n: 4, len: 5, spread: 18, r: 0.75, curl: -0.4 }), ...fingers(J.haR, 60, "skin", { n: 4, len: 5, spread: 18, r: 0.75, curl: 0.4 })];
  const face = U(0, ellipsoid([48, 25.6, 10.4], [1.6, 1.1, 1], "maw"), ellipsoid([53.4, 25.6, 10.2], [1.6, 1.1, 1], "maw"), ellipsoid([51, 31, 10], [2.2, 1.6, 1.4], "maw"));
  const eyes = [sphere([48.2, 25.7, 9.6], 0.9, "eye"), sphere([53.2, 25.7, 9.4], 0.9, "eye")];
  // 藻: 体に巻きつく帯 (塗り分け) と、頭や腕から垂れ下がる房
  const wrap = (x, y, z, m) => {
    if (m !== "skin") return m;
    if (y < 22 || (y < 27 && Math.abs(x - 50.6) > 3.6)) return "kelp"; // 頭を覆う藻
    if (y > 29 && y < 33 && x > 48 && x < 54) return m;
    const s = Math.sin(y * 0.9 + x * 0.35 + 2.4 * fbm(x * 0.15, y * 0.15, z * 0.15));
    return s > -0.15 ? "kelp" : m;
  };
  const wrapped = Paint(Disp(Sub(U(1.2, body, ...hands), face, 0.4), (x, y, z) => 0.4 * Math.max(0, Math.sin(y * 0.9 + x * 0.35 + 2.4 * fbm(x * 0.15, y * 0.15, z * 0.15)))), wrap);
  const hang = [];
  for (const [x0, y0, z0, L] of [[44, 20, 4, 18], [47, 18, 6, 14], [53, 18, 7, 12], [56, 21, 4, 20], [42, 24, 2, 22], [58, 26, 3, 16],
    [32, 44, 10, 14], [35, 41, 7, 16], [63, 42, 9, 16], [60, 40, 6, 18], [40, 50, 5, 24], [50, 52, 5, 22], [45, 55, 6, 26]]) {
    const sw = (R() - 0.5) * 4, pts = [];
    for (let k = 0; k <= 4; k++) { const u = k / 4; pts.push([x0 + Math.sin(u * 3 + x0) * 1.4 + sw * u, y0 + L * u, z0 + 1 + u, 1.5 - u * 1.05]); }
    hang.push(Disp(tube(pts, "kelp", { seg: 3 }), (x, y, z) => 0.5 * vnoise(x * 1.2, y * 0.9, z)));
  }
  // 背後のもう一体 (群れ): 暗く沈んだ同じ姿の影
  const J2 = { head: [24, 34, -14], neck: [25, 39, -15], chest: [26, 46, -16], waist: [27, 56, -16], hip: [27, 62, -16],
    shL: [19, 42, -15], elL: [16, 51, -10], haL: [16, 58, -6], shR: [33, 42, -15], elR: [36, 51, -12], haR: [39, 57, -8],
    hpL: [23, 64, -16], knL: [21, 75, -14], ftL: [20, 86, -14], hpR: [31, 64, -16], knR: [33, 75, -14], ftR: [33, 86, -14] };
  const back = Disp(humanoid(J2, { skin: "shade" }, { scale: 0.92 }), (x, y, z) => 0.5 * vnoise(x * 0.9, y * 0.9, z));
  const backKelp = [];
  for (const [x0, L] of [[21, 26], [24, 30], [27, 24], [30, 20]]) backKelp.push(tube([[x0, 32, -12, 1.3], [x0 + 1, 32 + L * 0.5, -11, 1.1], [x0 - 0.5, 32 + L, -11, 0.4]], "shade", { seg: 2 }));
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 3, seed: 603, wet: 0.25 }), wrapped, ...eyes, ...hang, back, ...backKelp);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.12 });
  const C = new Canvas(r);
  C.set(48, 25, "#e8f8f4"); C.set(53, 25, "#e8f8f4");
  // 背後の影の眼 (濁った小さな光)
  C.set(22, 33, "#6a807c"); C.set(26, 33, "#6a807c");
  drips(C, 605, ["kelp", "skin"], 0.12);
  ripples(C, 607);
  bubbles(C, 609, 13, [4, 4, 88, 70]);
  motes(C, 611, 18, [4, 4, 88, 80]);
  return C.toArt();
}

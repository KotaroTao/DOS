import { sphere, ellipsoid, cone, tube, U, Sub, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, towerFloor, sparks, rain, windStreaks, afterimage } from "../storm.mjs";
export const meta = { id: "bs_galehound", key: "hd_galehound", w: 96, h: 96,
  note: "疾風の猟犬: 塔の回廊を群れで駆ける、灰色の痩せた猟犬。あばらの浮いた細い体を地すれすれに伸ばし、耳を伏せ、牙をむいて走る。目にも止まらぬ速さで一度に二度動き (神速)、長い残像を引く。後ろからも同じ影が二頭、三頭と追ってくる (群れ)" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030304", "#09090c", "#121217", "#1d1d24", "#2a2a34", "#3a3a46", "#4e4e5c", "#666676"], 8), dither: 0.55, amb: 0.22,
      shade: p => 0.12 * Math.max(0, Math.sin(p.x * 1.6)) * (p.y < 58 ? 1 : 0) },
    far: { ramp: ramp(["#030305", "#08080d", "#0f0f17", "#181822", "#22222e"], 5), dither: 0.6, amb: 0.26 },
    maw: { ramp: ["#000000", "#16080a", "#3a1218"], dither: 0.3 },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  // 駆ける猟犬 (頭は左)。s = 大きさ、m = 材質、ph = 脚の位相
  const hound = (cx, cy, z, s, m, ph = 0) => {
    const P = (x, y, dz = 0) => [cx + x * s, cy + y * s, z + dz * s];
    const parts = [
      ellipsoid(P(-8, 0), [9 * s, 6 * s, 6 * s], m, 8), ellipsoid(P(6, 1), [8 * s, 4.4 * s, 5 * s], m, -4), ellipsoid(P(16, -1), [6 * s, 5 * s, 5 * s], m, -10),
      tube([[...P(-16, -2), 3.6 * s], [...P(-22, -4), 3 * s], [...P(-26, -4), 2.6 * s]], m),
      ellipsoid(P(-28, -4, 1), [5 * s, 3.6 * s, 3.6 * s], m, 10), ellipsoid(P(-34, -2, 1), [4.4 * s, 2 * s, 2.6 * s], m, 15),
      cone(P(-26, -7), P(-20, -10, -1), 1.4 * s, 0.3, m),
      // 前脚は前へ、後脚は後ろへ伸びきる
      tube([[...P(-12, 4, 2), 2.6 * s], [...P(-22 + ph, 10, 3), 1.6 * s], [...P(-30 + ph, 12, 3), 1.2 * s]], m),
      tube([[...P(-8, 4, -2), 2.4 * s], [...P(-16 - ph, 10, -2), 1.4 * s], [...P(-20 - ph, 14, -2), 1.1 * s]], m),
      tube([[...P(16, 2, 2), 3.2 * s], [...P(22 + ph, 8, 3), 1.8 * s], [...P(32 + ph, 10, 3), 1.2 * s]], m),
      tube([[...P(14, 2, -2), 3 * s], [...P(18 - ph, 10, -2), 1.6 * s], [...P(26 - ph, 14, -2), 1.1 * s]], m),
      tube([[...P(21, -3), 1.4 * s], [...P(28, -6), 1 * s], [...P(36, -5), 0.6 * s]], m),
    ];
    return { body: U(1.4 * s, ...parts), maw: ellipsoid(P(-34, -1, 2.4), [5 * s, 1.4 * s, 2 * s], "maw", 15), eye: sphere(P(-29, -5.4, 4.2), 0.9 * s, "eye") };
  };
  const F = hound(58, 64, 6, 1.25, "hide", 0);
  const front = F.body, maw = F.maw, eye = F.eye;
  const back1 = hound(72, 38, -14, 0.55, "far", 2).body;
  const back2 = hound(36, 28, -18, 0.42, "far", -2).body;
  const scene = U(0, towerFloor(48, 95, 46, 12, { n: 2, seed: 11601, wet: 0.3 }), Sub(front, maw, 0.3), eye, back1, back2);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 10, 22, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#3a3a46", "#a8a8b8", "#e8e8f4"], seed: 11603 });
  // 長い残像 (右へ伸びる)
  afterimage(C, [[8, 0, 0.5, "#16161e"], [16, 0, 0.32, "#111118"], [24, 0, 0.18, "#0c0c12"]], [0, 40, 96, 40]);
  afterimage(C, [[6, 0, 0.35, "#0e0e15"]], [40, 20, 56, 30]);
  windStreaks(C, 11605, 26, [0, 36, 96, 52], { len: [10, 24], cols: ["#1c1c2e", "#2c2c44", "#42425e"] });
  rain(C, 11607, 40, [0, 0, 96, 96], { slope: 1.4 });
  sparks(C, 11609, 6);
  return C.toArt();
}

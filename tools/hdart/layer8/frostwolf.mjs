import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { SHELF, SNOW, ICE, RIM, FROST, iceFloor, hoarfrost, icicles, snowfall, puffs } from "../ice.mjs";
export const meta = { id: "bs_frostwolf", key: "hd_frostwolf", w: 96, h: 96,
  note: "白霜の狼: 霜で毛先の白く凍った、青灰色の痩せた狼。頭を低く下げて牙をむき、白い息を吐きながら前へ踏み出す。後ろにはもう一頭が回り込み (群れ)、胸と脚の毛から細い氷柱が垂れる" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#020306", "#080d14", "#121b26", "#1e2a38", "#2e3d4e", "#425467", "#5c6f84", "#7c90a6", "#a0b4c8"], 9), dither: 0.6, spec: 0.2, amb: 0.2,
      shade: p => 0.1 * Math.sin(p.x * 1.6 + p.y * 0.9 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    fur2: { ramp: ramp(["#020305", "#060a10", "#0d141e", "#16202c", "#222e3c", "#303e4e"], 6), dither: 0.6 },
    maw: { ramp: ["#060203", "#1c080a", "#3a1216", "#5a2026"], dither: 0.4 },
    eye: { ramp: ["#1e4c7a", "#94c8ec", "#e4f6ff"], emit: () => 0.9 },
    claw: { ramp: ["#0a0c10", "#3a4450", "#8a98a8"], spec: 1, pow: 30, dither: 0.3 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // 手前の狼: 左向き、頭を低く下げてうなる
  const wolf = (ox, oy, oz, s, mat) => {
    const P = (x, y, z) => [ox + x * s, oy + y * s, oz + z * s];
    const chest = ellipsoid(P(0, 0, 0), [11 * s, 12 * s, 9.5 * s], mat, 15);
    const ruff = ellipsoid(P(-8, -1, 3), [8 * s, 10 * s, 8 * s], mat, -30);
    const barrel = ellipsoid(P(14, -2, -1), [14 * s, 9 * s, 8.5 * s], mat, -4);
    const haunch = ellipsoid(P(26, -1, -1), [9 * s, 10 * s, 8.5 * s], mat, 20);
    const neck = tube([[...P(-2, -4, 2), 7 * s], [...P(-10, 0, 4), 5.6 * s], [...P(-16, 4, 5), 4.8 * s]], mat);
    const skull = ellipsoid(P(-19, 4, 6), [6.4 * s, 5.4 * s, 5.4 * s], mat, 15);
    const snout = cone(P(-22, 6, 7), P(-32, 10, 8), 3.8 * s, 1.8 * s, mat);
    const jaw = cone(P(-22, 10, 7), P(-30, 14, 8), 2.8 * s, 1.4 * s, mat);
    const ears = [cone(P(-17, 0, 2), P(-12, -8, 0), 2.4 * s, 0.3, mat), cone(P(-20, 0, 9), P(-17, -8, 10), 2.2 * s, 0.3, mat)];
    const legs = [
      tube([[...P(-4, 6, 7), 4.6 * s], [...P(-8, 15, 8), 3.2 * s], [...P(-10, 24, 9), 2.4 * s], [...P(-14, 26, 9), 2.2 * s]], mat, { seg: 3 }),
      tube([[...P(2, 6, -6), 4 * s], [...P(3, 15, -6), 2.8 * s], [...P(1, 24, -6), 2.2 * s], [...P(-2, 26, -6), 1.9 * s]], mat, { seg: 3 }),
      tube([[...P(26, 2, 6), 6 * s], [...P(32, 12, 7), 3.6 * s], [...P(29, 21, 7), 2.4 * s], [...P(32, 26, 7), 2.2 * s]], mat, { seg: 3 }),
      tube([[...P(26, 2, -6), 5.2 * s], [...P(30, 12, -6), 3.2 * s], [...P(28, 21, -6), 2.2 * s], [...P(31, 26, -6), 1.9 * s]], mat, { seg: 3 }),
    ];
    const tail = tube([[...P(33, -6, -1), 3.8 * s], [...P(40, -4, -2), 3.8 * s], [...P(45, 2, -3), 2.8 * s], [...P(47, 9, -3), 1.2 * s]], mat);
    const body = Disp(U(2.4 * s, chest, ruff, barrel, haunch, neck, skull, snout, jaw, ...ears, ...legs, tail),
      (x, y, z) => 0.5 * Math.abs(Math.sin(x * 1.3 + y * 0.6 + 2 * fbm(x * 0.2, y * 0.2, z * 0.2))) * 0.6 + 0.2 * fbm(x * 0.6, y * 0.6, z * 0.6));
    return { body, mouth: ellipsoid(P(-29, 11.6, 10), [5 * s, 1.8 * s, 3 * s], "maw", 22), eyes: [sphere(P(-21, 2.6, 10.6), 0.9 * s, "eye"), sphere(P(-18, 2.4, 10.6), 0.8 * s, "eye")] };
  };
  const A = wolf(42, 60, 4, 1, "fur");
  const B = wolf(76, 34, -22, 0.72, "fur2");
  // 後ろの狼が立つ、張り出した氷の棚
  const ledge = Disp(box([84, 58, -22], [22, 4, 8], "ice", 1.2, -6), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const scene = U(0, iceFloor(50, 90, 44, 14, { n: 3, seed: 8101, snow: 0.0 }), Sub(A.body, A.mouth, 0.4), ...A.eyes, Sub(B.body, B.mouth, 0.3), ...B.eyes, ledge);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 14, 20, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#4a5460", "#a8b4c0", "#eef4f8"], seed: 8103 });
  
  hoarfrost(C, ["fur", "fur2"], { th: 0.3, seed: 3 });
  icicles(C, 8105, ["fur"], 0.12, 3);
  icicles(C, 8109, ["ice"], 0.35, 6);
  // 白い息
  puffs(C, [[8, 72, 5], [4, 68, 4], [3, 75, 3]], ["#1a2836", "#2e4256", "#4c6680", "#7a98b4"], { dens: 1, seed: 4 });
  snowfall(C, 8107, 40);
  return C.toArt();
}

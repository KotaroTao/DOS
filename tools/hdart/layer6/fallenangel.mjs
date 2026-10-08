import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { RIM, bubbles, motes, drips, dissolve } from "../temple.mjs";
export const meta = { id: "bs_fallenangel", key: "hd_fallenangel", w: 96, h: 96,
  note: "堕天使: 神殿と共に沈み、水を吸って重くなった白い翼の御使い。濡れた長い髪で顔を伏せ、割れた光輪を頭上に傾ける。両手で逆さに構えた細身の剣を、祈るような手つきで振り下ろして急所を断つ。翼の先からは水がしたたり、片方の翼は折れて垂れる" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#08080a", "#1a1a1e", "#2e2e32", "#46464a", "#606064", "#7e7e80", "#9e9c9a", "#c0bcb6"], 8), spec: 0.5, pow: 22, dither: 0.4, amb: 0.24 },
    wing: { ramp: ramp(["#08090c", "#16181e", "#262a32", "#383e48", "#4e5662", "#68707c", "#868e98", "#a8aeb4"], 8), dither: 0.5, amb: 0.26,
      shade: p => 0.12 * Math.sin((p.x * 0.7 + p.y * 1.2) * 1.3) },
    hair: { ramp: ramp(["#060504", "#14100c", "#241e16", "#362e22", "#4a3e2e"], 5), spec: 1, pow: 30, specCol: "#8a7a5a", dither: 0.5 },
    cloth: { ramp: ramp(["#08090a", "#181a1c", "#2a2e30", "#3e4446", "#565e60", "#727a7a"], 6), dither: 0.6, amb: 0.24, shade: p => 0.14 * Math.sin((p.x - 48) * 0.9 + p.y * 0.05) },
    steel: { ramp: ramp(["#06080a", "#161c22", "#2a343c", "#425058", "#5e6e78", "#8494a0", "#b0c0c8"], 7), spec: 1.8, pow: 50, specCol: "#f0ffff", dither: 0.3 },
    gold: { ramp: ramp(["#0a0602", "#2a1a08", "#4e3410", "#7a541c", "#a8782a", "#d8a840"], 6), spec: 1.4, pow: 32, specCol: "#fff0b0", dither: 0.4 },
    hole: { ramp: ["#000000", "#000000", "#020202"], amb: 0, dif: 0.05, noRim: true },
  };
  // 体: 宙に浮き、前のめりに剣を振り下ろす
  const J = { head: [46, 24, 3], neck: [47, 30, 2], chest: [48, 37, 1], waist: [49, 47, 0], hip: [49, 53, 0],
    shL: [41, 33, 3], elL: [36, 40, 9], haL: [40, 45, 14], shR: [56, 33, 0], elR: [54, 42, 8], haR: [44, 46, 14] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 4.4, headY: 5.4, headZ: 4.6, chestX: 7.4, chestY: 6.4, waistX: 5.4, hipX: 6.2, arm: 2.1, arm2: 1.8, wrist: 1.3 } });
  const hands = [ellipsoid([42, 46, 14.6], [2, 2.2, 1.8], "skin"), ellipsoid([44.6, 46.6, 15], [2, 2.2, 1.8], "skin")];
  // 衣: 腰布から脚を覆って下へ流れる
  const robe = Disp(U(1.6, ellipsoid([48, 40, 1], [7.6, 4.6, 5], "cloth"), cone([49, 50, 0], [52, 82, -2], 6.6, 10.4, "cloth")), (x, y, z) => 0.8 * Math.sin(Math.atan2(z, x - 50) * 6 + y * 0.1) * Math.max(0, (y - 52) / 26));
  const hem = Disp(cyl([52, 96, -2], [52, 78, -2], 16, "cloth"), (x, y, z) => -5 * Math.max(0, Math.sin(x * 0.9) * 0.6 + vnoise(x * 0.4, 6) * 0.6));
  // 濡れた長い髪 (顔を半ば覆って垂れる)
  const hair = [Disp(ellipsoid([46.6, 21.6, 1.6], [5, 5, 5], "hair"), (x, y, z) => 0.3 * Math.sin(y * 2))];
  for (const [x0, s] of [[41.6, -1], [42.6, -1], [50.6, 1], [51.6, 1]]) hair.push(tube([[x0, 20, 2, 1.4], [x0 + s * 1.2, 29, 3, 1.3], [x0 + s * 1.6 - 1, 40 + (x0 % 2) * 3, 2, 0.5]], "hair", { seg: 3 }));
  const lids = U(0, ellipsoid([44.6, 24.4, 7.4], [1.3, 0.4, 0.8], "hole", 12), ellipsoid([48.2, 24.4, 7.4], [1.3, 0.4, 0.8], "hole", -12));
  // 細身の剣: 逆手に握り、切っ先は前下へ
  const sword = U(0.3, slab([[42.6, 48], [44.6, 48.6], [30, 82], [28.4, 84], [28.6, 81]], 15, 0.55, "steel", 0.2, 0.4), cyl([38.6, 47, 15], [48.6, 49.6, 15], 0.8, "gold", 0.3), cyl([44, 46, 15], [45.4, 41, 15], 0.75, "gold"), sphere([45.6, 40, 15], 1.2, "gold"));
  // 割れた光輪
  const halo = Sub(torus([46, 12, 0], 7, 0.9, "gold", -14, 64), box([52, 11, 0], [1.4, 3, 3], "gold", 0, -20), 0.2);
  // 翼: 右は大きく広げ、左は折れて垂れる。羽根の板を重ねる
  const wingSet = (base, dirs) => dirs.map(([ang, len, z, w]) => {
    const a = ang * Math.PI / 180, ex = base[0] + Math.cos(a) * len, ey = base[1] + Math.sin(a) * len;
    const px = -Math.sin(a) * w, py = Math.cos(a) * w;
    return slab([[base[0], base[1]], [base[0] + px, base[1] + py], [ex + px * 0.3, ey + py * 0.3], [ex, ey]], z, 0.7, "wing", 0.4, 0.4);
  });
  const wingR = U(0.6, tube([[56, 32, -4, 2.6], [70, 18, -6, 2], [86, 8, -7, 1.2]], "wing", { seg: 3 }),
    ...wingSet([70, 18], [[-20, 20, -6.5, 4], [10, 22, -6.8, 4.4], [40, 22, -7.1, 4.4], [66, 20, -7.4, 4.2], [88, 16, -7.7, 4]]),
    ...wingSet([60, 28], [[30, 20, -5.6, 4], [58, 22, -5.8, 4.4], [80, 18, -6, 4]]));
  const wingL = U(0.6, tube([[40, 33, -4, 2.6], [30, 36, -6, 2], [24, 50, -7, 1.6], [22, 66, -7, 1]], "wing", { seg: 3 }),
    ...wingSet([30, 36], [[110, 20, -6.4, -4], [130, 18, -6.6, -4], [150, 14, -6.8, -3.6]]), ...wingSet([24, 50], [[95, 18, -7.2, -4], [120, 14, -7.4, -3.6]]));
  const rot = (x, y, z, m) => m === "wing" && fbm(x * 0.3, y * 0.3, 2) > 0.28 ? "hair" : m;
  const scene = U(0, Paint(U(0, wingR, wingL), rot), Sub(Sub(U(1, body, robe), hem, 0.8), lids, 0.2), ...hands, ...hair, sword, halo);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [40, 50, 24], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  // 振り下ろしの軌跡 (剣先の白い弧)
  const T = ["#1a2830", "#2e4a58", "#6a98a8", "#d0f0f8"];
  for (let a = -2.2; a < -0.9; a += 0.008) {
    const t = (a + 2.2) / 1.3;
    for (let k = 0; k < 2; k++) { const X = Math.round(44 + Math.cos(a + Math.PI) * (40 + k)), Y = Math.round(46 - Math.sin(a + Math.PI) * (40 + k) * 0.9); if (X >= 0 && Y >= 0 && !C.get(X, Y)) C.set(X, Y, T[Math.max(0, Math.min(3, Math.floor(t * 3.4) - k))]); }
  }
  dissolve(C, 64, 84, { seed: 13, x0: 36, x1: 70, darken: mats.cloth.ramp });
  drips(C, 983, ["wing"], 0.06);
  bubbles(C, 985, 8);
  motes(C, 987, 8);
  return C.toArt();
}

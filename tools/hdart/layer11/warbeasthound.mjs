import { sphere, ellipsoid, cone, tube, torus, U, Sub, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, ashfall, sandDust, spikes } from "../arena.mjs";
export const meta = { id: "bs_warbeasthound", key: "hd_warbeasthound", w: 96, h: 96,
  note: "闘犬: 試合の合間の余興に殺し合わされてきた闘犬の群れ (群れ)。がっしりした胸と短い脚、棘のついた鉄の首輪、噛みちぎられた耳と尾。前の一頭は頭を低く下げて牙をむき、喉笛へ跳びかかる寸前 — 急所に喰らいつく (痛撃)。手負いになるほど狂ったように吠えたてる (激昂)。後ろからも二頭が回りこむ" };
export function build() {
  const mats = {
    hide: { ramp: ["#040303", "#0e0b09", "#1c1612", "#2a211b", "#3a2e25", "#4c3d31", "#62503f"], dither: 0.55, amb: 0.22,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) + (Math.sin(p.x * 1.3 + p.y * 0.4 + 2 * fbm(p.x * 0.3, p.y * 0.3)) > 0.6 ? -0.14 : 0) },
    far: { ramp: ["#040302", "#0c0806", "#160f0b", "#211812", "#2c2119"], dither: 0.6, amb: 0.26 },
    scar: { ramp: ["#140606", "#2e0e0c", "#4e1a16"], dither: 0.4 },
    maw: { ramp: ["#000000", "#1a0606", "#3e1010"], dither: 0.3 },
    eye: { ramp: ["#5a0a06", "#c42a1a", "#ff8a6a"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 低く構えた闘犬 (頭は左)。s = 大きさ
  const dog = (cx, cy, z, s, m, withCollar = true) => {
    const P = (x, y, dz = 0) => [cx + x * s, cy + y * s, z + dz * s];
    const parts = [
      ellipsoid(P(-8, -1), [12 * s, 9.4 * s, 9 * s], m, 14), ellipsoid(P(8, 0), [8 * s, 5.6 * s, 6.4 * s], m, -6),
      ellipsoid(P(-21, 3, 1), [7.6 * s, 6.8 * s, 6.6 * s], m, 15), ellipsoid(P(-28, 6, 1), [5.4 * s, 4 * s, 4.6 * s], m, 20),
      cone(P(-22, -2, 3), P(-24, -8, 3), 2 * s, 0.4, m), cone(P(-18, -2, -2), P(-17, -7, -3), 1.8 * s, 0.4, m),
      tube([[...P(-12, 4, 4), 4 * s], [...P(-15, 12, 5), 2.8 * s], [...P(-17, 19, 5), 2.2 * s]], m),
      tube([[...P(-8, 4, -4), 3 * s], [...P(-6, 12, -4), 2.2 * s], [...P(-8, 18, -4), 1.8 * s]], m),
      tube([[...P(12, 2, 4), 3.4 * s], [...P(16, 10, 5), 2.4 * s], [...P(14, 18, 5), 2 * s]], m),
      tube([[...P(10, 2, -4), 3 * s], [...P(14, 10, -4), 2.2 * s], [...P(12, 18, -4), 1.8 * s]], m),
      tube([[...P(17, -2), 1.6 * s], [...P(20, -5), 1.1 * s]], m),
    ];
    const out = { body: U(1.6 * s, ...parts) };
    if (withCollar) {
      out.collar = torus(P(-14, 2, 1), 6.2 * s, 1.3 * s, "iron", 60, 75);
      const sp = []; for (let k = 0; k < 6; k++) { const a = -0.4 + k * 0.6; const c = P(-14 + Math.cos(a) * 1.4, 2 + Math.sin(a) * 6.2, 1 + Math.cos(a) * 6); sp.push([c, [c[0] - 2.6 * s, c[1] + Math.sin(a) * 2.6 * s, c[2] + Math.cos(a) * 2.6 * s], 0.9 * s, 0.15]); }
      out.spikes = spikes(sp, "iron");
      out.maw = ellipsoid(P(-30, 8, 3), [5 * s, 2 * s, 2.6 * s], "maw", 22);
      out.eye = sphere(P(-25, 1.6, 5.6), 0.9 * s, "eye");
      out.scar = tube([[...P(-2, -5, 6), 0.7 * s], [...P(4, -3, 7), 0.7 * s], [...P(8, 2, 7), 0.6 * s]], "scar");
    }
    return out;
  };
  const F = dog(56, 66, 6, 1.25, "hide");
  const B1 = dog(74, 44, -16, 0.6, "far", false), B2 = dog(30, 42, -20, 0.5, "far", false);
  const scene = U(0, sandFloor(52, 95, 46, 13, { seed: 12601, blood: 0.2, ash: 0.06, flags: 1 }), Sub(F.body, F.maw, 0.3), F.collar, ...F.spikes, F.eye, F.scar, B1.body, B2.body);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 14, 26, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#3a352a", "#a8a088", "#e8e0c8"], seed: 12603 });
  // 後ろの二頭の赤い眼
  for (const [x, y] of [[63, 46], [21, 43]]) { C.only(x, y, "#c42a1a"); }
  // 吠えたてる声 (前の一頭の口から)
  for (const [r0, c] of [[5, "#5c412e"], [9, "#463122"], [13, "#332318"]]) for (let a = 2.7; a < 3.6; a += 0.05) { const x = 18 + Math.cos(a) * r0, y = 78 + Math.sin(a) * r0; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 20) > -0.3) C.set(x, y, c); }
  sandDust(C, 12605, 40, [10, 82, 80, 12]);
  ashfall(C, 12607, 40);
  return C.toArt();
}

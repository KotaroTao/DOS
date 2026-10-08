import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_doombringer", key: "hd_doombringer", w: 96, h: 96,
  note: "釜底の古竜: 大釜の底の熱に何百年も浸かってきた、翼を失った巨大な古竜。正面を向いて身を低く沈め、胸の裂け目と喉の奥に業火を溜めて赤く膨らませる (溜め)。重い眉と折れた角、顎にはぼろぼろのひげのような棘。片方の角は先が折れている" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#030101", "#0b0405", "#160807", "#220c0a", "#30120d", "#401912", "#532218", "#6a2e20"], 8), spec: 0.6, pow: 22, specCol: "#b06a50", dither: 0.55,
      shade: p => 0.1 * Math.abs(Math.sin(p.x * 1.1) * Math.sin(p.y * 1.1)) + 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    horn: { ramp: ramp(["#060402", "#16100a", "#2c2216", "#463826", "#665440", "#8e7a5e"], 6), spec: 0.8, pow: 24, dither: 0.4 },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    heat: { ramp: ["#4e0e04", "#a8300a", "#f07a1c", "#ffc04a", "#fff0b0"], noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    bone: { ramp: ramp(["#0c0a08", "#2a241c", "#4a4032", "#6e604c"], 4), spec: 0.4, dither: 0.5 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 正面向き: 大きな頭を低く構え、肩から前脚、後ろに盛り上がる胴
  const body = ellipsoid([48, 56, -10], [30, 18, 16], "scale");
  const chest = ellipsoid([48, 62, 4], [18, 14, 12], "scale");
  const neck = ellipsoid([48, 52, 10], [11, 10, 10], "scale");
  const skull = ellipsoid([48, 46, 16], [12, 9, 10], "scale");
  const snout = ellipsoid([48, 52, 24], [8, 6, 8], "scale");
  const jaw = ellipsoid([48, 60, 22], [8.5, 3.6, 8], "scale");
  const legs = [tube([[26, 60, 6, 8], [20, 74, 10, 6.4], [20, 86, 12, 5.4]], "scale"), tube([[70, 60, 6, 8], [76, 74, 10, 6.4], [76, 86, 12, 5.4]], "scale")];
  const brow = [ellipsoid([41, 41.5, 22], [6, 2.6, 4], "scale", 16), ellipsoid([55, 41.5, 22], [6, 2.6, 4], "scale", -16)];
  const dr = Disp(U(3, body, chest, neck, skull, snout, jaw, ...legs, ...brow), (x, y, z) => 0.5 * Math.pow(1 - Math.abs(vnoise(x * 0.2, y * 0.2, z * 0.2)), 6) + 0.2 * fbm(x * 0.6, y * 0.6, z * 0.6));
  // 胸の裂け目に溜めた業火
  const rift = (x, y, z) => Math.abs(x - 48 + 2 * Math.sin(y * 0.5)) < 3.4 - Math.abs(y - 66) * 0.25 && y > 58 && y < 78 && z > 6;
  const dragon = Paint(dr, (x, y, z, m) => (m === "scale" && rift(x, y, z)) ? "heat" : m);
  const mawGlow = ellipsoid([48, 57.5, 28], [5.4, 1.6, 2], "heat");
  const nostrils = [sphere([45, 50, 31.4], 0.9, "heat"), sphere([51, 50, 31.4], 0.9, "heat")];
  // 後ろへ反る角 (右は先が折れている)
  const horns = [tube([[38, 40, 12, 3.6], [26, 34, 6, 2.8], [16, 30, 0, 2], [10, 22, -2, 1.2]], "horn", { seg: 3 }), tube([[58, 40, 12, 3.6], [68, 34, 6, 2.8], [76, 31, 0, 2.2], [79, 28, -1, 1.8]], "horn", { seg: 3 }),
    cone([42, 38, 16], [40, 30, 14], 1.6, 0.3, "horn"), cone([54, 38, 16], [56, 30, 14], 1.6, 0.3, "horn")];
  const barbs = [];
  for (let i = 0; i < 7; i++) { const x = 41 + i * 2.3; barbs.push(cone([x, 62, 24], [x + (i - 3) * 0.6, 70 + Math.abs(i - 3) * -0.8, 24], 1, 0.2, "horn")); }
  const eyes = [sphere([42, 44.5, 24], 1.3, "eye"), sphere([54, 44.5, 24], 1.3, "eye")];
  const scene = U(0, lavaFloor(48, 92, 46, 13, { n: 3, seed: 9001, pool: [48, 10, 14] }), dragon, mawGlow, ...nostrils, ...horns, ...barbs, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 66, 26], r: 22, k: 0.45 }] });
  const C = new Canvas(r);
  C.set(42, 44, "#fff4a0"); C.set(54, 44, "#fff4a0");
  // 溜めの予兆: 胸と口の前に集まる熱の粒
  const R = rand(9003);
  for (let i = 0; i < 40; i++) { const a = R() * 6.283, d = 10 + R() * 16, x = 48 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.7; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#7a1a06", "#c43e0c", "#f07a1c", "#ffc04a"][Math.floor(R() * 4)]); }
  underglow(C, { skip: ["eye", "heat"] });
  embers(C, 9005, 20, [4, 2, 88, 30]);
  return C.toArt();
}

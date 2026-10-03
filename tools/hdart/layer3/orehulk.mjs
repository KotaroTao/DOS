import { tube, sphere, ellipsoid, cone, slab, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri, cracks } from "../mine.mjs";
export const meta = { id: "bs_orehulk", key: "hd_orehulk", w: 96, h: 96,
  note: "鉱くずの巨塊: 精錬で捨てられた鉱滓が積もって動き出した猫背の巨塊。かすの殻の継ぎ目から熔けた鉱脈が赤く脈打ち、肩に埋もれた小さな頭に熾火の眼、地を擦る巨大な拳" };
export function build() {
  const mats = {
    slag: { ramp: ramp(["#030202", "#0a0807", "#13100d", "#1d1814", "#28211b", "#342b23", "#43372c", "#554636"], 8), spec: 0.8, pow: 30, specCol: "#8c7a66", dither: 0.55,
      shade: p => 0.14 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    ore: { ramp: ramp(["#040404", "#0e1012", "#1a1e22", "#283036", "#38444c", "#4c5c66"], 6), spec: 1.8, pow: 60, specCol: "#c8d8e0", dither: 0.4 },
    melt: { ramp: ["#2a0602", "#5a1404", "#9a3008", "#d8600e", "#f8a030", "#ffe090"], emit: p => 0.35 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: ["#3a1000", "#8a3004", "#e07010", "#fff0a0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    gravel: GRAVEL, rock: ROCK,
  };
  // 塊の体: 背が盛り上がり、頭は肩に埋もれ、腕は長く拳が床に届く
  const R = rand(121);
  const lumps = [ellipsoid([48, 46, -4], [24, 20, 16], "slag"), ellipsoid([48, 30, 4], [14, 10, 12], "slag"), ellipsoid([48, 64, 0], [16, 10, 12], "slag")];
  for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, rr = 0.6 + R() * 0.4; lumps.push(Disp(box([48 + Math.cos(a) * 22 * rr, 44 + Math.sin(a) * 18 * rr, 2 + R() * 6], [4 + R() * 4, 3.5 + R() * 3, 4], R() < 0.3 ? "ore" : "slag", 1.6, R() * 90), (x, y, z) => 0.4 * fbm(x * 0.5, y * 0.5, z * 0.5))); }
  const armL = tube([[28, 38, 4, 8], [16, 56, 8, 7], [16, 72, 12, 7]], "slag");
  const armR = tube([[68, 38, 2, 8], [80, 56, 6, 7], [80, 72, 10, 7]], "slag");
  const fistL = Disp(box([16, 80, 13], [8, 7, 8], "slag", 3), (x, y, z) => 0.7 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const fistR = Disp(box([80, 80, 11], [8, 7, 8], "slag", 3), (x, y, z) => 0.7 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const legs = [tube([[38, 70, 0, 7], [36, 86, 4, 6]], "slag"), tube([[58, 70, -2, 7], [60, 86, 2, 6]], "slag")];
  const head = Disp(ellipsoid([48, 25, 14], [7.5, 6.5, 6.5], "slag"), (x, y, z) => 0.5 * fbm(x * 0.6, y * 0.6, z * 0.6));
  // 熔けた鉱脈: 割れ目に沿って赤く脈打つ
  const hulk = Paint(Disp(U(3, ...lumps, armL, armR, fistL, fistR, ...legs, head), (x, y, z) => cracks(1.1, 0.24)(x, y, z) + 0.25 * fbm(x * 0.7, y * 0.7, z * 0.7)),
    (x, y, z, m) => (m === "slag" && Math.abs(vnoise(x * 0.13, y * 0.11, z * 0.13) + 0.25 * vnoise(x * 0.5, y * 0.5, z * 0.5)) < 0.05) ? "melt" : m);
  const eyes = [sphere([45, 25, 20], 1.3, "eye"), sphere([51, 25, 20], 1.3, "eye")];
  const scene = U(0, rubble(48, 92, 46, 15, { n: 9, seed: 123, big: 3.6 }), hulk, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 52, 30], r: 30, k: 0.25 }] });
  const C = new Canvas(r);
  // 拳の下で赤熱して砕ける床と、熱の火の粉
  const M = ["#5a1404", "#9a3008", "#d8600e", "#f8a030"];
  for (const cx of [16, 80]) for (let i = -6; i <= 6; i++) if (C.get(cx + i, 89) && Math.abs(i) < 5 + (i & 1)) C.set(cx + i, 89, M[Math.max(0, 2 - Math.floor(Math.abs(i) / 2))]);
  for (let i = 0; i < 18; i++) { const x = 10 + R() * 76, y = 6 + R() * 50; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, M[1 + Math.floor(R() * 3)]); }
  pebbles(C, 53, 48, 91, 42);
  return C.toArt();
}

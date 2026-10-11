import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lampHeap, soot, murkMotes, shards, afterimage } from "../cavern.mjs";
export const meta = { id: "bs_gloomstalker", key: "hd_gloomstalker", w: 96, h: 96,
  note: "闇這いの蟲: 灯籠の山のすき間を這い回る、黒い甲殻の大きな百足。S字にうねって身を起こし、体節ごとに濁った灯のかけらが琥珀に鈍く光る。左右に細い脚がびっしり並び、頭には大きな顎肢。高く反り返った尾の先に毒の針、刺された者はしびれる (麻痺)。目にも止まらぬ速さで二度這い寄る (神速) — うねりに沿った残像" };
export function build() {
  const mats = {
    shell: { ramp: ["#020203", "#060609", "#0c0b10", "#141219", "#1e1b24", "#2a2632", "#383342"], spec: 1.3, pow: 40, specCol: "#8a84a0", dither: 0.4 },
    leg: { ramp: ["#020203", "#08070a", "#121016", "#1e1a22"], spec: 0.6, pow: 20, dither: 0.4 },
    core: { ramp: MURK.slice(1), noRim: true, emit: p => 0.35 + 0.45 * Math.max(0, p.nz) },
    sting: { ramp: ["#1a0e04", "#4a2a0c", "#8a5a1a", "#d0a04a"], spec: 1, pow: 30, dither: 0.3 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // うねる背の線 (頭は左上、尾は右上へ反る)
  const path = t => { const x = 14 + t * 74, y = 56 + Math.sin(t * Math.PI * 2.1 + 0.6) * 14 + (t > 0.85 ? -(t - 0.85) * 160 : 0) + (t < 0.12 ? -(0.12 - t) * 140 : 0); return [x, y, Math.sin(t * 7) * 3]; };
  const segs = [], legs = [], cores = [];
  const N = 15;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = path(t), q = path(Math.min(1, t + 0.02)), r = 6.4 - t * 3.2;
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    segs.push(ellipsoid(p, [r * 0.9, r, r], "shell", a * 180 / Math.PI));
    if (i > 0 && i < N - 1) {
      const nx = -Math.sin(a), ny = Math.cos(a);
      for (const sd of [1, -1]) legs.push(tube([[p[0], p[1] + r * 0.6, p[2] + sd * 3, 0.9], [p[0] - 2 + nx * 2, p[1] + r + 4, p[2] + sd * 6, 0.7], [p[0] - 4, p[1] + r + 9 + (i % 2) * 2, p[2] + sd * 6, 0.4]], "leg", { seg: 2 }));
      if (i % 2 === 0) cores.push(sphere([p[0] - 0.6, p[1] - r * 0.4, p[2] + r * 0.72], 1.3, "core"));
    }
  }
  const h = path(0);
  const jaws = [tube([[h[0] - 2, h[1] + 2, 6, 1.2], [h[0] - 8, h[1] + 4, 8, 1], [h[0] - 9, h[1] + 9, 8, 0.4]], "sting"), tube([[h[0] + 1, h[1] + 3, 4, 1.2], [h[0] - 4, h[1] + 8, 6, 1], [h[0] - 8, h[1] + 11, 6, 0.4]], "sting")];
  const antennae = [tube([[h[0], h[1] - 4, 2, 0.6], [h[0] - 6, h[1] - 16, 0, 0.4], [h[0] - 2, h[1] - 26, 0, 0.3]], "leg"), tube([[h[0] + 2, h[1] - 4, 0, 0.6], [h[0] + 6, h[1] - 16, -2, 0.4], [h[0] + 12, h[1] - 22, -2, 0.3]], "leg")];
  const tl = path(1);
  const sting = cone([tl[0], tl[1], tl[2]], [tl[0] - 6, tl[1] - 10, tl[2]], 1.8, 0.2, "sting");
  const scene = U(0, cavernFloor(48, 95, 47, 13, { seed: 13801, rocks: 2, lamps: 2, heaps: [[80, 12, 5]] }), U(1, ...segs), ...legs, ...cores, ...jaws, ...antennae, sting);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  afterimage(C, [[4, 3, 0.4, "#1e1b24"], [9, 6, 0.22, "#100e14"]], [0, 20, 90, 60]);
  // 針の先のしずく
  C.set(Math.round(tl[0] - 6), Math.round(tl[1] - 11), "#d0a04a");
  murkMotes(C, 13803, 14, [6, 6, 84, 30]);
  shards(C, 13805, ["bed"], 16);
  soot(C, 13807, 30);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, hoarfrost, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_iceserpent", key: "hd_iceserpent", w: 96, h: 96,
  note: "氷の大蛇: 氷の床にとぐろを巻き、鎌首をもたげる大蛇。背は霜の付いた青黒い鱗、腹は白い蛇腹。冷気の牙を見せて口を開き、獲物に巻きついて凍えさせ動けなくする (麻痺)。鱗の縁には氷が張り、鼻先から白い息がこぼれる" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020306", "#060b12", "#0d1622", "#152232", "#1f3146", "#2c425c", "#3c5876", "#527290"], 8), spec: 1.1, pow: 28, specCol: "#b8d4e8", dither: 0.5 },
    belly: { ramp: ramp(["#0a0e14", "#1c2632", "#2e3c4c", "#445668", "#5e7286", "#7c90a4"], 6), spec: 0.5, pow: 20, dither: 0.45 },
    maw: { ramp: ["#060204", "#1e0a12", "#3e1624", "#5e2434"], dither: 0.4 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // とぐろ (床の上の2重の輪) と立ち上がる首
  const spine = [];
  for (let i = 0; i <= 22; i++) { const t = i / 22, a = t * Math.PI * 3.4 + 0.6, r = 26 - t * 10; spine.push([50 + Math.cos(a) * r, 82 - t * 8 + Math.sin(a) * 2, -2 + Math.sin(a) * r * 0.55, 5.6 - t * 0.4]); }
  const last = spine[spine.length - 1];
  const neck = [[last[0] + 4, last[1] - 6, last[2] + 2, 5.2], [42, 50, 6, 5], [34, 38, 8, 4.6], [30, 28, 10, 4.4]];
  const all = [...spine, ...neck];
  const body = tube(all, "scale", { seg: 3, k: 1.5 });
  const ap = arcParam(all.map(p => p.slice(0, 3)));
  const scales = Disp(body, (x, y, z) => 0.35 * Math.abs(Math.sin(ap(x, y, z) * 1.6 + Math.atan2(y - 60, z) * 4)));
  const bellyT = tube(neck.map(([x, y, z, r]) => [x - r * 0.35, y + r * 0.2, z + r * 0.55, r * 0.55]), "belly", { seg: 3 });
  const skull = ellipsoid([26, 24, 12], [8, 5.4, 6.4], "scale", -14);
  const snout = cone([22, 25, 13], [12, 26, 14], 4.4, 2.6, "scale");
  const jaw = cone([22, 30, 13], [12, 34, 14], 3.2, 1.8, "scale");
  const maw = ellipsoid([15, 29.4, 16], [6.4, 2.2, 3.4], "maw", 12);
  const eyes = [sphere([24, 21, 17], 1.2, "eye")];
  const brow = ellipsoid([25, 20, 15], [3.4, 1.2, 2], "scale", -14);
  const head = Sub(U(1.4, skull, snout, jaw, brow), maw, 0.4);
  const scene = U(0, iceFloor(50, 92, 44, 14, { n: 3, seed: 8501, snow: 0.05 }), U(1.4, scales, head), bellyT, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 10, 20, { step: 3, top: [2, 3], bot: [1, 2], cols: ["#4a5a6a", "#a8c0d0", "#eef6fa"], seed: 8503 });
  C.set(23, 20, SOUL[4]);
  hoarfrost(C, ["scale"], { th: 0.45, seed: 9 });
  glints(C, 8505, ["scale"], 6);
  // 鼻先からこぼれる白い息
  const B = ["#1a2a3a", "#2e4458", "#4a6680", "#7a98b4"];
  for (const [x, y, c] of [[9, 24, 2], [7, 22, 1], [5, 23, 0], [8, 20, 1], [4, 19, 0], [6, 26, 1]]) if (!C.get(x, y)) C.set(x, y, B[c]);
  snowfall(C, 8507, 38);
  return C.toArt();
}

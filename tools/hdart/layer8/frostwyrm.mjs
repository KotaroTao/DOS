import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, hoarfrost, icicles, glints, snowfall, breathFan } from "../ice.mjs";
export const meta = { id: "bs_frostwyrm", key: "hd_frostwyrm", w: 96, h: 96,
  note: "氷牙の蛇竜: 翼の名残の薄いひれを背に並べた、青白い鱗の長い蛇竜。氷の床からうねって鎌首をもたげ、大きく開いた顎から凍てつく息を前へ吹きつける (ブレス・多用)。頭には後ろへ反った二本の氷の角、背には氷の棘が並び、吐く息の中で霜の粒がきらめく" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020306", "#060c14", "#0e1824", "#182636", "#24384c", "#344e66", "#486882", "#62849e", "#86a6bc"], 9), spec: 1.3, pow: 32, specCol: "#dceef8", dither: 0.45 },
    belly: { ramp: ramp(["#0a0e14", "#1e2834", "#34424e", "#4e5e6c", "#6c7e8c", "#90a2ae"], 6), spec: 0.5, pow: 20, dither: 0.45 },
    fin: { ramp: ramp(["#06101c", "#123050", "#24507a", "#3e78a4", "#6aa4c8"], 5), spec: 1.4, pow: 40, dither: 0.4 },
    maw: { ramp: ["#04070c", "#0c1a2c", "#1e4c7a", "#4686bc", "#94c8ec"], noRim: true, emit: p => 0.25 + 0.6 * Math.max(0, p.nz) },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // 背骨: 右下の床から S 字にうねって左上で鎌首
  const spine = [[92, 88, -8, 4], [82, 84, -4, 6.5], [70, 80, 0, 8], [58, 76, 2, 8.5], [52, 66, 2, 8.4], [58, 54, 0, 8], [64, 42, 0, 7.4], [58, 30, 2, 6.8], [46, 26, 6, 6.4]];
  const body = tube(spine, "scale", { seg: 5, k: 2 });
  const ap = arcParam(spine.map(p => p.slice(0, 3)));
  const scales = Disp(body, (x, y, z) => 0.4 * Math.abs(Math.sin(ap(x, y, z) * 1.1 + Math.atan2(z, x - 60) * 3)) * 0.6);
  const bellyS = tube(spine.slice(2, 8).map(([x, y, z, r]) => [x - r * 0.35, y, z + r * 0.62, r * 0.42]), "belly", { seg: 4 });
  const skull = ellipsoid([38, 24, 8], [9, 6.4, 7], "scale", -10);
  const snout = cone([32, 25, 10], [18, 23, 12], 5.4, 3, "scale");
  const jaw = cone([32, 31, 10], [19, 36, 12], 4, 2, "scale");
  const maw = ellipsoid([24, 30, 14], [8, 3.4, 4], "maw", 12);
  const horns = [tube([[42, 19, 4, 2.2], [52, 12, 0, 1.6], [60, 10, -2, 0.5]], "fin"), tube([[40, 19, 12, 2], [48, 10, 12, 1.4], [54, 6, 11, 0.5]], "fin")];
  const eye = sphere([35, 20.5, 14.6], 1.3, "eye");
  // 背の氷の棘とひれ
  const fins = [];
  for (let i = 1; i < spine.length - 1; i++) { const [x, y, z, r] = spine[i]; fins.push(cone([x + r * 0.5, y - r * 0.7, z - 3], [x + r * 1.1, y - r * 1.6, z - 4], 2.2, 0.3, "fin")); }
  const head = Sub(U(1.6, skull, snout, jaw), maw, 0.5);
  const scene = U(0, iceFloor(64, 94, 40, 13, { n: 3, seed: 9801, snow: 0.08 }), U(1.4, scales, head), bellyS, ...horns, ...fins, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [16, 30, 20], r: 20, k: 0.35 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 17, 30, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#4a5a6a", "#b0c8d8", "#f0f8fc"], seed: 9803 });
  C.set(34, 20, SOUL[4]);
  // 凍てつく息 (口から左下へ)
  breathFan(C, 18, 33, 122, 46, 46, { seed: 4 });
  hoarfrost(C, ["scale"], { th: 0.4, seed: 31 });
  icicles(C, 9805, ["scale"], 0.08, 3);
  glints(C, 9807, ["scale", "fin"], 6);
  snowfall(C, 9809, 26);
  return C.toArt();
}

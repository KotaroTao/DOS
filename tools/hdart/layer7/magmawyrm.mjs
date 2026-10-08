import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs, ribbon } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "el_magmawyrm", key: "hd_magmawyrm", w: 112, h: 128,
  note: "溶鉄の蛇竜 (名のある強敵): 溶岩溜まりから S 字に鎌首をもたげる長大な蛇竜。鱗は溶けた鉄が冷えかけた鈍い銀で、継ぎ目から橙の溶鉄がにじむ。首の後ろに鉄のひれが並び、大きく開いた口の奥で熱がふくらみ、今にも隊をまとめて焼く熱の息を吐こうとしている" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    iron: { ramp: ramp(["#030303", "#0b0a0a", "#171514", "#25221f", "#36312c", "#4a433c", "#605750", "#7c726a", "#a0968c"], 9), spec: 1.3, pow: 34, specCol: "#f0e0d0", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    belly: { ramp: ramp(["#100602", "#2a1006", "#4a1e0a", "#6e2e0e", "#964216"], 5), spec: 0.6, pow: 20, dither: 0.45 },
    fin: { ramp: ramp(["#060504", "#16130f", "#2a251e", "#423a30"], 4), spec: 1, pow: 26, dither: 0.4 },
    maw: { ramp: ["#4e0e04", "#a8300a", "#f07a1c", "#ffc04a", "#fff0b0"], noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 背骨の点列: 溶岩溜まりから右下で潜り、S 字に昇って左上で鎌首
  const spine = [[100, 120, -10, 5], [94, 104, -6, 9], [80, 94, -2, 11], [64, 92, 2, 11.5], [52, 84, 4, 11], [48, 70, 4, 10], [56, 56, 2, 9], [62, 44, 0, 8], [56, 32, 2, 7.4], [44, 26, 6, 7]];
  const body = tube(spine, "iron", { seg: 5, k: 2 });
  const ap = arcParam(spine.map(p => p.slice(0, 3)));
  // 鱗: 弧長に沿った帯と、継ぎ目ににじむ溶鉄
  const scales = Disp(body, (x, y, z) => 0.5 * Math.abs(Math.sin(ap(x, y, z) * 0.9 + Math.atan2(z, x - 56) * 3)) * 0.6);
  const wyrm = Paint(scales, (x, y, z, m) => {
    const s = ap(x, y, z);
    if (Math.abs(Math.sin(s * 0.45)) < 0.08 && fbm(x * 0.3, y * 0.3, z * 0.3) > -0.1) return "lava";
    return m;
  });
  // 頭: 左上を向いて大きく口を開く
  const skull = ellipsoid([36, 22, 8], [10, 7, 8], "iron", -20);
  const snout = cone([30, 22, 10], [14, 16, 12], 6, 3.4, "iron");
  const jaw = cone([32, 30, 10], [16, 32, 12], 4.4, 2.2, "iron");
  const maw = ellipsoid([22, 25, 14], [9, 4.4, 4.6], "maw", -8);
  const horns = [tube([[40, 16, 4, 2.2], [48, 8, 0, 1.6], [54, 6, -2, 0.6]], "fin"), tube([[38, 16, 12, 2], [44, 6, 12, 1.4], [48, 3, 11, 0.5]], "fin")];
  const eye = sphere([33, 17.5, 15], 1.3, "eye");
  // 首の後ろの鉄のひれ
  const fins = [];
  for (let i = 4; i < spine.length - 1; i++) {
    const p = spine[i], q = spine[i + 1];
    fins.push(cone([p[0] + 4, p[1], p[2] - 4], [p[0] + 12, p[1] - 4, p[2] - 6], 2.4, 0.3, "fin"));
    fins.push(cone([(p[0] + q[0]) / 2 + 4, (p[1] + q[1]) / 2, p[2] - 4], [(p[0] + q[0]) / 2 + 10, (p[1] + q[1]) / 2 - 3, p[2] - 6], 1.8, 0.3, "fin"));
  }
  const bellyS = tube(spine.slice(2, 8).map(([x, y, z, r]) => [x - r * 0.3, y, z + r * 0.62, r * 0.42]), "belly", { seg: 4 });
  const head = Sub(U(2, skull, snout, jaw), maw, 0.6);
  const scene = U(0, lavaFloor(64, 122, 52, 16, { n: 3, seed: 9201, pool: [90, 2, 18], cracks: 0.84 }), U(1.5, wyrm, head), bellyS, ...horns, ...fins, eye);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [22, 26, 24], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 14, 30, { step: 2, top: [2, 4], bot: [2, 3], cols: ["#3a3632", "#a8a098", "#f0e8dc"], seed: 9203 });
  C.set(32, 17, "#fff4a0");
  // 口の前でふくらむ熱 (ブレスの予兆)
  const HT = ["#4e0e04", "#a8300a", "#f07a1c", "#ffc04a", "#fff0b0"];
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 10; y < 44; y++) for (let x = 0; x < 20; x++) {
    if (C.get(x, y)) continue;
    const d = Math.hypot(x - 10, (y - 24) * 1.1), v = 1 - d / 12 + 0.25 * fbm(x * 0.4, y * 0.4, 6);
    if (v > (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, HT[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
  }
  underglow(C, { skip: ["eye", "maw"] });
  embers(C, 9205, 50, [4, 2, W - 8, 90]);
  return C.toArt();
}

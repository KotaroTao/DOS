import { sphere, ellipsoid, cone, tube, slab, cyl, U, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { RIM, BOLT, CLOUD, sparks, rain, clouds } from "../storm.mjs";
export const meta = { id: "bs_ravenswarm", key: "hd_ravenswarm", w: 96, h: 96,
  note: "黒雲の鴉群: 嵐の空を黒雲のように覆って渦を巻く、無数の鴉の群れ。手前の一羽は両の翼を高く振り上げて舞い降り、くちばしにくわえた金貨を光らせる。一斉に舞い降りて懐の光り物をくわえ去る (金貨奪い・多用)。一羽を払っても、雲の奥から次々と黒い影が湧く (群れ)" };
export function build() {
  const mats = {
    f0: { ramp: ramp(["#020205", "#07070d", "#0e0d18", "#171526", "#221f36", "#2e2a48", "#3c375c", "#4c4672"], 8), dither: 0.55, amb: 0.22,
      shade: p => 0.12 * (Math.abs(Math.sin(p.x * 0.8 - p.y * 0.5)) - 0.5) },
    wing: { ramp: ramp(["#020205", "#06060b", "#0c0b15", "#141221", "#1d1a2f", "#28243f", "#353052"], 7), dither: 0.55, amb: 0.22,
      shade: p => 0.18 * (Math.abs(Math.sin(Math.atan2(p.y - 50, p.x - 50) * 11)) - 0.5) },
    f1: { ramp: ramp(["#030308", "#08070f", "#0f0d1a", "#171426", "#201c34"], 5), dither: 0.6, amb: 0.22 },
    beak: { ramp: ramp(["#060606", "#18181c", "#303036", "#4c4c56", "#6a6a76"], 5), spec: 1, pow: 30 },
    claw: { ramp: ramp(["#060606", "#18181c", "#303036", "#4c4c56"], 4), spec: 0.6, pow: 20 },
    gold: { ramp: ramp(["#1a1004", "#4a3008", "#8a6012", "#c8962a", "#f0cc60", "#fff2b0"], 6), spec: 1.6, pow: 40, specCol: "#ffffff", dither: 0.3 },
    eye: { ramp: ["#6a5a2a", "#e8d070", "#fffbe0"], emit: () => 0.95 },
  };
  // 手前の一羽 (左向き、翼を V に振り上げて舞い降りる)
  const body = ellipsoid([52, 58, 4], [12, 7, 7], "f0", -15);
  const head = ellipsoid([36, 52, 8], [5.6, 5, 5], "f0", -10);
  const beak = U(0.4, cone([31, 52, 9], [21, 56, 9], 2.2, 0.3, "beak"), cone([31, 54.6, 8.6], [23, 57, 8.6], 1.4, 0.2, "beak"));
  const coin = cyl([20, 58, 7.4], [20, 58, 10.6], 3.6, "gold", 0.6);
  const ruff = ellipsoid([42, 55, 7], [5, 5, 5], "f0", 20);
  const tail = slab([[62, 60], [80, 64], [88, 70], [84, 74], [76, 72], [70, 74], [62, 66]], 2, 0.8, "f0", 0.4);
  // 振り上げた翼: 先は羽が指のように割れる
  const wingF = slab([[46, 54], [42, 40], [36, 26], [26, 12], [30, 10], [28, 4], [36, 8], [38, 2], [44, 10], [48, 6], [50, 16], [56, 14], [56, 30], [58, 52]], 10, 1, "wing", 0.6, 0.8);
  const wingB = slab([[54, 52], [60, 38], [68, 24], [80, 10], [82, 14], [90, 8], [88, 18], [96, 18], [88, 28], [92, 34], [80, 36], [76, 46], [64, 56]], -4, 1, "wing", 0.6, 0.8);
  const legs = [tube([[50, 64, 6, 1.4], [46, 72, 8, 1], [44, 76, 9, 0.6]], "claw"), tube([[56, 64, 2, 1.4], [54, 72, 4, 1], [53, 76, 5, 0.6]], "claw")];
  const eye = sphere([35, 50.4, 12.6], 0.9, "eye");
  // 奥の鴉 (小さく、翼の形だけ)
  const small = (cx, cy, s, dir) => U(0.6, ellipsoid([cx, cy, -14], [5 * s, 2.4 * s, 2 * s], "f1", dir * 10), ellipsoid([cx - dir * 5 * s, cy - 1 * s, -13], [2 * s, 1.8 * s, 1.8 * s], "f1"),
    slab([[cx, cy], [cx - 4 * s, cy - 10 * s], [cx + 2 * s, cy - 12 * s], [cx + 4 * s, cy - 2 * s]], -15, 0.4, "f1", 0.2),
    slab([[cx + dir * 5 * s, cy], [cx + dir * 11 * s, cy + 1 * s], [cx + dir * 10 * s, cy + 3 * s]], -14, 0.4, "f1", 0.2));
  const scene = U(0, wingB, body, head, ruff, tail, beak, coin, wingF, ...legs, eye, small(78, 70, 1.1, -1), small(14, 30, 0.9, 1), small(84, 46, 0.7, -1), small(22, 82, 0.8, 1), small(64, 86, 0.6, -1));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [20, 58, 22], r: 12, k: 0.5 }] });
  const C = new Canvas(r);
  // 渦を巻く群れ (遠くの小さな鴉の影)
  const R = rand(11101);
  for (let i = 0; i < 50; i++) {
    const a = R() * Math.PI * 2, d = 20 + R() * 30, x = Math.round(48 + Math.cos(a) * d * 1.1), y = Math.round(48 + Math.sin(a) * d * 0.8);
    if (C.get(x, y) || C.get(x - 1, y - 1) || C.get(x + 1, y - 1)) continue;
    const c = R() < 0.5 ? "#0e0d18" : "#1b1930";
    C.set(x, y, c); C.set(x - 1, y - 1, c); C.set(x + 1, y - 1, c); if (R() < 0.5) { C.set(x - 2, y - 1, c); C.set(x + 2, y - 2, c); }
  }
  // 金貨のきらめき
  C.set(19, 55, "#fff2b0"); C.set(18, 55, "#f0cc60"); C.set(19, 54, "#f0cc60"); C.set(17, 52, "#c8962a");
  clouds(C, [[48, 48, 50, 44]], { dens: 0.3, seed: 13, cols: CLOUD.slice(0, 4) });
  rain(C, 11103, 30);
  sparks(C, 11105, 6);
  return C.toArt();
}

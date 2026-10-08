import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_divinegolem", key: "hd_divinegolem", w: 96, h: 96,
  note: "神のくぐつ: 審判のために造られた、白い石と金の背の高いくぐつ。顔のない卵形の頭にただ一つの眼が開き、そこから金色の裁きの光をまっすぐ放つ。光を浴びた足元の石畳は灰色の石と化してひび割れる。片手に天秤を下げ、背には光の輪" };
export function build() {
  const mats = {
    white: { ramp: ramp(["#060606", "#141412", "#262420", "#3a3832", "#524e46", "#6c675c", "#888274", "#a8a090", "#c8c0ac"], 9), spec: 0.9, pow: 26, specCol: "#f0ead8", dither: 0.45, amb: 0.2 },
    gold: { ramp: ramp(["#080502", "#1e1206", "#3a240a", "#5c3a12", "#80561c", "#a8782a", "#d0a040", "#f0d070"], 8), spec: 1.6, pow: 36, specCol: "#fff4c0", dither: 0.4 },
    eye: { ramp: ["#6a4a08", "#d8a020", "#fff080", "#ffffe0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    stoned: { ramp: ramp(["#0a0a0a", "#1c1c1c", "#2e2e2c", "#42423e", "#585852"], 5), dither: 0.6, amb: 0.4, dif: 0.55, noRim: true, shade: p => 0.12 * fbm(p.x * 0.5, p.z * 0.5) },
    hole: { ramp: ["#000000", "#000000", "#020202"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  // 卵形の頭と細い首、肩の張った胴 (前垂れの金の帯)、長い衣のような下半身
  const head = ellipsoid([52, 17, 2], [6, 8, 6], "white");
  const eyeSock = ellipsoid([51, 17, 7.6], [2.6, 2, 2], "hole");
  const eye = sphere([51, 17, 6.4], 1.7, "eye");
  const neck = cyl([52, 24, 1], [52, 29, 1], 2.4, "gold", 0.6);
  const torso = U(2, ellipsoid([52, 36, 0], [12, 7, 7], "white"), ellipsoid([52, 48, 0], [8, 8, 6], "white"));
  const skirt = Disp(cone([52, 50, 0], [52, 86, 0], 8, 15, "white"), (x, y, z) => 0.8 * Math.sin(Math.atan2(z, x - 52) * 8) * Math.max(0, (y - 54) / 30));
  const goldBand = (x, y, z, m) => m === "white" && ((y > 41 && y < 43.6) || (Math.abs(x - 52) < 2.2 && z > 4 && y > 44)) ? "gold" : m;
  const pauldrons = [ellipsoid([40, 32, 1], [5.4, 4, 5], "gold", -20), ellipsoid([64, 32, 1], [5.4, 4, 5], "gold", 20)];
  // 腕: 右 (見る側の左) は前へ指を差し、左は天秤を下げる
  const armP = tube([[40, 34, 2, 2.6], [32, 38, 7, 2.2], [24, 37, 11, 1.8]], "white", { seg: 3 });
  const handP = U(0.5, ellipsoid([22, 37, 11.6], [2, 1.8, 1.6], "white"), cyl([20.6, 36.6, 11.8], [16, 36, 12], 0.7, "white", 0.3));
  const armS = tube([[64, 34, 2, 2.6], [68, 44, 4, 2.2], [68, 54, 6, 1.8]], "white", { seg: 3 });
  const handS = ellipsoid([68, 55, 6.6], [2, 2.2, 1.8], "white");
  // 天秤: 竿と二つの皿
  const scale = U(0.4, cyl([68, 57, 6.6], [68, 61, 6.6], 0.5, "gold"), cyl([60, 61, 6.6], [76, 61, 6.6], 0.6, "gold"),
    cyl([60, 61, 6.6], [60, 69, 6.6], 0.25, "gold"), cyl([76, 61, 6.6], [76, 67, 6.6], 0.25, "gold"),
    Sub(ellipsoid([60, 70, 6.6], [3.4, 1.4, 3], "gold"), ellipsoid([60, 69, 6.6], [3, 1, 2.6], "gold"), 0.2), Sub(ellipsoid([76, 68, 6.6], [3.4, 1.4, 3], "gold"), ellipsoid([76, 67, 6.6], [3, 1, 2.6], "gold"), 0.2));
  // 背の光の輪
  const halo = U(0.3, torus([52, 18, -8], 13, 1, "gold", 0, 90), ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return cone([52 + Math.cos(a) * 14, 18 + Math.sin(a) * 14, -8], [52 + Math.cos(a) * 18, 18 + Math.sin(a) * 18, -8], 0.8, 0.2, "gold"); }));
  // 裁きの光を浴びて石と化した床 (前方の石畳を灰色に)
  const floor = Paint(templeFloor(52, 91, 44, 14, { n: 3, seed: 963, cols: 1 }), (x, y, z, m) => (m === "flag" || m === "pool") && x < 36 && z > -6 ? "stoned" : m);
  const statue = Paint(Sub(U(1.2, head, neck, torso, skirt, armP, armS), eyeSock, 0.3), goldBand);
  const scene = U(0, floor, halo, statue, eye, ...pauldrons, handP, handS, scale);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.12, lights: [{ p: [40, 30, 22], r: 26, k: 0.35 }] });
  const C = new Canvas(r);
  // 裁きの眼光: 眼から前下方 (左下) へ広がる光の帯
  const L = ["#4a3a10", "#8a6a20", "#d8a830", "#fff080", "#ffffe0"];
  for (let t = 0; t < 1; t += 0.004) {
    const x = 49 - t * 46, y = 17 + t * 66, w = 1 + t * 7;
    for (let k = -w; k <= w; k++) {
      const X = Math.round(x + k * 0.8), Y = Math.round(y + k * 0.5);
      if (X < 0 || C.get(X, Y)) continue;
      const e = 1 - Math.abs(k) / w;
      const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      if (e * (1 - t * 0.5) > (BY[Y & 3][X & 3] + 0.5) / 16) C.set(X, Y, L[Math.min(4, Math.floor(e * 3 + 1 - t))]);
    }
  }
  // 石と化した床のひび
  const R = rand(965);
  for (let i = 0; i < 6; i++) { let x = 4 + R() * 28, y = 88 + R() * 4; for (let k = 0; k < 6; k++) { const p = C.pix[Math.round(y) * 96 + Math.round(x)]; if (p && p.m === "stoned") C.set(x, y, "#060606"); x += 1; y += (R() - 0.5) * 1.6; } }
  C.set(50, 16, "#ffffe0");
  ripples(C, 967);
  bubbles(C, 969, 6);
  motes(C, 971, 8);
  return C.toArt();
}

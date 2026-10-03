import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, MIST, mist, spores } from "../forest.mjs";
export const meta = { id: "el_mistmother", key: "hd_mistmother", w: 112, h: 128,
  note: "霧の繭母 (強敵): 霧のように白く淡い巨大な蜘蛛の女王。冠のような棘の並ぶ頭に無数の眼が青白く光り、長い脚で霧の糸の巣にまたがる。背と巣のあちこちに繭が房になって垂れ、その一つが裂けて大蛾が羽化しかけている。牙からは痺れの光る糸を吐く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    chit: { ramp: ramp(["#040506", "#0d1012", "#181d1f", "#262d2f", "#363f40", "#4a5455", "#626c6b", "#7e8886", "#9ea7a2", "#c0c7c0"], 10), spec: 0.9, pow: 30, specCol: "#e8f0ec", dither: 0.5, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    fur: { ramp: ramp(["#040506", "#0d1112", "#181d1e", "#252b2b", "#343b3a", "#454d4b", "#5a625e", "#727a74", "#8e9590"], 9), dither: 0.7, amb: 0.22,
      shade: p => 0.16 * fbm(p.x * 1.1, p.y * 1.1, p.z * 1.1) + 0.12 * Math.sin(Math.atan2(p.x - 56, p.z + 14) * 7 + p.y * 0.25) },
    silk: { ramp: ramp(["#0e0e0c", "#1c1b18", "#2e2c27", "#45423a", "#5e5a50", "#7a766a", "#989384", "#b8b2a0", "#d4cebc"], 9), dither: 0.6, amb: 0.34, dif: 0.85,
      shade: p => 0.12 * Math.sin(p.y * 1.7 + p.x * 0.6 + 2 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3)) },
    moth: { ramp: ramp(["#060504", "#16120d", "#2a2318", "#403524", "#584a32", "#726044", "#8e7a58", "#aa9670"], 8), dither: 0.6, amb: 0.36,
      shade: p => 0.1 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    eye: { ramp: ["#1a3a48", "#3a7890", "#80c8dc", "#e0fcff"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    meye: { ramp: ["#3a1a08", "#8a4a10", "#e0a040"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020304"], amb: 0, dif: 0.1, noRim: true },
  };
  const R = rand(5201);
  // 胴: 背後に高く持ち上げた大きな腹、前に頭胸部。腹は毛羽立ち、背に繭の房
  const abd = Disp(ellipsoid([56, 36, -14], [24, 20, 18], "fur", 0, -20), (x, y, z) => 0.35 * fbm(x * 0.9, y * 0.9, z * 0.9));
  const ceph = ellipsoid([56, 62, 2], [14, 11, 13], "chit");
  const pedicel = ellipsoid([56, 50, -6], [7, 6, 7], "chit");
  const head = ellipsoid([56, 70, 12], [9, 7, 7], "chit");
  // 冠: 頭の縁に並ぶ棘
  const spikes = [];
  for (let i = -3; i <= 3; i++) spikes.push(cone([56 + i * 3.4, 62 - Math.abs(i) * 0.3, 10], [56 + i * 4.6, 50 - (3 - Math.abs(i)) * 1.6, 8], 1.4, 0.2, "chit"));
  // 無数の眼
  const eyes = [];
  for (const [x, y, r] of [[52.5, 70, 2.1], [59.5, 70, 2.1], [49, 67, 1.4], [63, 67, 1.4], [54, 66, 1.2], [58, 66, 1.2], [47, 70.5, 1], [65, 70.5, 1], [51, 63.5, 0.9], [61, 63.5, 0.9], [56, 64.5, 1], [45.5, 66.5, 0.8], [66.5, 66.5, 0.8]]) eyes.push(sphere([x, y, 18.4 - Math.abs(x - 56) * 0.25], r, "eye"));
  const chel = [ellipsoid([52, 77, 14], [3, 4, 3], "chit"), ellipsoid([60, 77, 14], [3, 4, 3], "chit")];
  const fang = [cone([52, 80, 15], [50, 86, 17], 1.6, 0.25, "chit"), cone([60, 80, 15], [62, 86, 17], 1.6, 0.25, "chit")];
  const palps = [tube([[48, 74, 12, 1.8], [42, 78, 16, 1.4], [42, 86, 18, 1]], "chit"), tube([[64, 74, 12, 1.8], [70, 78, 16, 1.4], [70, 86, 18, 1]], "chit")];
  // 長い脚: 胴から高く持ち上げた膝、先は巣の糸を踏む
  const legs = [];
  // 頭を下にして巣にかかる: 前の二対は下へ、後ろの二対は上へ、星形に広げる
  const LEG = [
    [[64, 68, 8, 3], [78, 74, 16, 2.4], [86, 94, 14, 1.8], [82, 124, 8, 0.5]],
    [[66, 63, 4, 3], [86, 60, 10, 2.4], [100, 76, 8, 1.8], [109, 106, 2, 0.5]],
    [[66, 57, 0, 3], [88, 44, 6, 2.4], [101, 34, 4, 1.8], [110, 16, -2, 0.5]],
    [[64, 52, -4, 2.8], [82, 28, 2, 2.2], [90, 15, 0, 1.6], [92, 2, -4, 0.5]]];
  for (const L of LEG) for (const s of [-1, 1]) {
    const P = L.map(([x, y, z, r]) => [56 + s * (x - 56), y, z, r]);
    legs.push(tube(P, "chit", { seg: 4 }), sphere(P[1].slice(0, 3), P[1][3] * 1.25, "chit"), sphere(P[2].slice(0, 3), P[2][3] * 1.25, "chit"));
  }
  // 繭: 背の房と、巣から垂れる房
  const cocoons = [];
  const coc = (x, y, z, s, rot = 0) => cocoons.push(Disp(ellipsoid([x, y, z], [2.5 * s, 5.4 * s, 2.5 * s], "silk", rot), (X, Y, Z) => 0.3 * fbm(X, Y, Z) + 0.25 * Math.abs(Math.sin((Y + X * 0.4) * 1.6))));
  for (const [x, y, z, s, r] of [[50, 16, -6, 1.2, -20], [58, 13, -8, 1.35, 12], [65, 18, -4, 1.1, 38], [46, 24, 0, 1.05, -72], [56, 22, 2, 1.15, 82], [66, 26, 2, 0.95, -60], [40, 30, -2, 0.85, -40]]) coc(x, y, z, s, r);
  const strands = [cyl([100, 26, -12], [100, 48, -12], 0.4, "silk")];
  for (const [x, y, z, s, r] of [[98, 52, -12, 1, -10], [102.5, 54, -11, 0.9, 12], [100, 60, -10, 0.85, 0]]) coc(x, y, z, s, r);
  // 巣から垂れる繭の房 (左)
  strands.push(cyl([20, 40, -12], [20, 70, -12], 0.4, "silk"), cyl([12, 50, -14], [12, 82, -14], 0.4, "silk"));
  for (const [x, y, z, s, r] of [[18, 74, -12, 1, -12], [22.5, 76, -11, 0.9, 14], [20, 82, -10, 0.85, 0], [12, 86, -14, 1, -6], [9, 92, -14, 0.8, 10]]) coc(x, y, z, s, r);
  // 裂けた繭から羽化しかける大蛾 (右下)
  const big = [96, 108, -2];
  const shell = Sub(Disp(ellipsoid(big, [7, 11, 7], "silk", 8), (X, Y, Z) => 0.3 * fbm(X, Y, Z) + 0.25 * Math.abs(Math.sin((Y + X * 0.4) * 1.6))),
    U(0, ellipsoid([big[0] + 1, big[1] - 10, big[2] + 2], [5, 7, 6], "hole", 8), ellipsoid([big[0] + 1, big[1] - 4, big[2] + 4], [4.4, 6, 4.4], "hole")), 0.4);
  const bigStrand = cyl([94, 84, -12], [94.5, 98, -6], 0.4, "silk");
  // 大蛾: 裂け目から上へ這い出し、濡れた翅を半ば開く
  const mBody = Disp(U(1.2, ellipsoid([96, 98, 4], [3.6, 7, 3.6], "moth", 6), sphere([95, 89.5, 6], 3.2, "moth")), (X, Y, Z) => 0.5 * fbm(X * 1.4, Y * 1.4, Z * 1.4));
  const mEyes = [sphere([93, 89.5, 8.4], 1.2, "meye"), sphere([97.2, 89, 8.4], 1.2, "meye")];
  const wingL = Disp(slab([[94, 95], [86, 78], [79, 74], [74, 80], [74, 92], [80, 102], [92, 101]], 2, 0.6, "moth", 0.5), (X, Y, Z) => 0.7 * Math.sin(X * 0.9 + Y * 0.7));
  const wingR = Disp(slab([[98, 95], [104, 80], [109, 76], [111, 82], [111, 96], [106, 104], [99, 101]], 1, 0.6, "moth", 0.5), (X, Y, Z) => 0.7 * Math.sin(X * 0.9 - Y * 0.7));
  const antL = tube([[94, 87, 7, 0.5], [90, 82, 8, 0.4], [87, 81, 8, 0.3]], "moth"), antR = tube([[96.5, 87, 7, 0.5], [99, 82, 8, 0.4], [102, 80.5, 8, 0.3]], "moth");
  const scene = U(0, U(1.2, abd, pedicel, ceph, head, ...chel), ...spikes, ...eyes, ...fang, ...palps, ...legs, ...cocoons, ...strands, shell, bigStrand, mBody, ...mEyes, wingL, wingR, antL, antR);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 68, 30], r: 20, k: 0.35 }] });
  const C = new Canvas(r);
  // 翅の眼状紋
  for (const [x, y] of [[80, 88], [106, 89]]) { C.only(x, y, "#e0a040"); C.only(x + 1, y, "#8a4a10"); C.only(x, y + 1, "#8a4a10"); C.only(x - 1, y, "#3a1a08"); C.only(x, y - 1, "#3a1a08"); }
  // 霧の糸の巣 (背後): 放射の縦糸と螺旋の横糸を、空いた所だけ淡いディザで
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const WEB = ["#2a3434", "#3e4c4a", "#5e6e6a", "#8a9a94"];
  const cx = 56, cy = 48;
  const webPix = (x, y, a) => {
    const X = Math.round(x), Y = Math.round(y);
    if (X < 0 || Y < 0 || X >= W || Y >= H || C.get(X, Y)) return;
    if (a > (BY[Y & 3][X & 3] + 0.5) / 16) C.set(X, Y, WEB[Math.min(3, Math.floor(a * 3.2))]);
  };
  for (let k = 0; k < 12; k++) {
    const ang = k / 12 * Math.PI * 2 + 0.26;
    for (let t = 8; t < 95; t += 0.4) {
      const X = Math.round(cx + Math.cos(ang) * t), Y = Math.round(cy + Math.sin(ang) * t * 1.05);
      if (X < 0 || Y < 0 || X >= W || Y >= H || C.get(X, Y)) continue;
      const n = fbm(t * 0.07, k * 3.1, 1);
      if (n < -0.22) continue;
      C.set(X, Y, WEB[Math.max(0, Math.min(3, Math.floor((1 - t / 100) * 2.2 + n * 2.5)))]);
    }
  }
  for (let ring = 0; ring < 9; ring++) {
    const rr0 = 16 + ring * 8.5;
    for (let a = 0; a < Math.PI * 2; a += 0.6 / rr0) {
      const seg = Math.floor((a - 0.26) / (Math.PI * 2 / 12) + 12) % 12, f = ((a - 0.26) / (Math.PI * 2 / 12) + 12) % 1;
      const rr = rr0 * (1 - 0.1 * Math.sin(f * Math.PI)); // 糸の間でたわむ
      const X = Math.round(cx + Math.cos(a) * rr), Y = Math.round(cy + Math.sin(a) * rr * 1.05);
      if (X < 0 || Y < 0 || X >= W || Y >= H || C.get(X, Y)) continue;
      const n = fbm(a * 2 + seg, ring * 1.7, 2);
      if (n < -0.05) continue;
      C.set(X, Y, WEB[Math.max(0, Math.min(2, Math.floor((1 - rr0 / 100) * 1.6 + n * 2)))]);
    }
  }
  // 痺れの糸: 牙から手前下へ吐き出す光る糸と火花
  const PZ = ["#4a4a14", "#8a8a20", "#d8d860", "#fffff0"];
  for (const [ex, ey, bend] of [[20, 126, -8], [46, 127, 3], [66, 127, -3]]) {
    for (let t = 0; t <= 1; t += 0.008) {
      const x = 56 + (ex - 56) * t + Math.sin(t * Math.PI) * bend, y = 86 + (ey - 86) * t + Math.sin(t * Math.PI * 3) * 1.2;
      const X = Math.round(x), Y = Math.round(y); const p = C.pix[Y * W + X];
      if (p && p.z > 10) continue;
      C.set(X, Y, PZ[(Math.round(t * 40) % 6 === 0) ? 2 : 1]);
    }
    for (let k = 0; k < 4; k++) { const t = 0.3 + R() * 0.65; const x = 56 + (ex - 56) * t + Math.sin(t * Math.PI) * bend, y = 86 + (ey - 86) * t; C.set(x + 1, y - 1, PZ[3]); C.set(x - 1, y + 1, PZ[2]); C.set(x + 1, y + 1, PZ[0]); C.set(x - 1, y - 1, PZ[0]); }
  }
  mist(C, 5207, 3, [0, 60, W, 66], 0.4);
  spores(C, 5209, 24, [2, 2, W - 4, 120]);
  return C.toArt();
}

import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, mist, spores } from "../forest.mjs";
export const meta = { id: "bs_giantmoth", key: "hd_giantmoth", w: 96, h: 96,
  note: "鱗粉の大蛾: 霧の夜に舞う人の背丈ほどの大蛾。左右に広げた翼に不気味な目玉模様、毛深い胴と羽毛のような大きな触角。翼の縁から淡く光る眠りの鱗粉が滝のように降り注ぐ" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 葉の距離関数を z 方向へ曲げる (翼の反り)。勾配が小さい曲げだけ
function bendZ(n, fn, grow = 8) {
  if (n.leaf) { const f = n.f, b = n.bound; return { leaf: true, f: (x, y, z) => f(x, y, z - fn(x, y)) * 0.85, mat: n.mat, bound: [b[0], b[1], b[2], b[3] + grow] }; }
  const o = { ...n, kids: n.kids.map(k => bendZ(k, fn, grow)) };
  if (n.fn) { const f0 = n.fn; o.fn = (x, y, z, m) => f0(x, y, z - fn(x, y), m); }
  return o;
}
export function build() {
  const CX = 48, CY = 36;
  const mats = {
    wing: { ramp: ramp(["#060504", "#110e0b", "#1d1812", "#2a231a", "#3a3124", "#4b4030", "#5f523e", "#76684f"], 8), dither: 0.75, amb: 0.22, dif: 0.85,
      shade: p => 0.14 * fbm(p.x * 0.18, p.y * 0.25, 2) + 0.08 * Math.sin(Math.hypot(p.x - CX, p.y - CY) * 0.9) },
    band: { ramp: ramp(["#040303", "#0b0807", "#140f0c", "#1e1712", "#2a2018"], 5), dither: 0.7, amb: 0.2, dif: 0.7 },
    pale: { ramp: ramp(["#14130e", "#2c2a1e", "#47432e", "#625c40", "#7e7652", "#9a9066"], 6), dither: 0.6, amb: 0.3, dif: 0.8 },
    ring: { ramp: ramp(["#020202", "#070605", "#0e0c09", "#16120e"], 4), dither: 0.5, amb: 0.15, dif: 0.5 },
    iris: { ramp: ["#3a2a08", "#6a4e12", "#a07a24", "#d0a848", "#f0d488"], emit: p => 0.45 + 0.25 * fbm(p.x * 0.5, p.y * 0.5, 3) },
    pupil: { ramp: ["#000000", "#050302"], amb: 0, dif: 0.1, noRim: true },
    fur: { ramp: ramp(["#050403", "#0f0c09", "#1b1610", "#2a2218", "#3c3122", "#52442f", "#6c5a3e", "#8a7552"], 8), dither: 0.85, amb: 0.22,
      shade: p => 0.16 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    seg: { ramp: ramp(["#040302", "#0d0a07", "#18130d", "#251d14", "#33281b"], 5), dither: 0.6 },
    eye: { ramp: ["#1a0806", "#3e140a", "#6a2410", "#9a3c1a", "#c8642c"], spec: 2, pow: 60, specCol: "#ffd8b0", dither: 0.2, amb: 0.3,
      shade: p => 0.14 * ((((Math.floor(p.x * 1.3) + Math.floor(p.y * 1.3)) % 2) + 2) % 2 - 0.5) },
    ant: { ramp: ramp(["#060504", "#16110c", "#2a2116", "#433524", "#5e4c34"], 5), dither: 0.5 },
  };
  // 翼: 前翅 (上へ大きく張る) と後翅 (下へ丸く垂れる)。目玉模様は前後翅に一つずつ
  const fwL = [[44, 30], [30, 16], [16, 8], [5, 7], [2, 14], [4, 26], [10, 38], [22, 44], [38, 42]];
  const hwL = [[42, 40], [28, 44], [14, 50], [8, 60], [12, 72], [22, 78], [32, 74], [40, 62], [45, 48]];
  const mirror = poly => poly.map(([x, y]) => [2 * CX - x, y]);
  const EYES = [[17, 24, 7.2], [26, 61, 5.4], [79, 24, 7.2], [70, 61, 5.4]];
  const pattern = (x, y, z, m) => {
    if (m !== "wing") return m;
    for (const [ex, ey, er] of EYES) {
      const d = Math.hypot(x - ex, (y - ey) * 1.1) / er;
      if (d < 0.32) return "pupil";
      if (d < 0.58) return "iris";
      if (d < 0.78) return "ring";
      if (d < 0.98) return "pale";
    }
    const dx = Math.abs(x - CX), r = Math.hypot(dx, y - CY);
    // 翅脈: 胴から放射する暗い筋
    const ang = Math.atan2(y - CY, dx);
    if (r > 10 && Math.abs(Math.sin(ang * 7.5)) < 0.06 * (1 + 8 / r)) return "band";
    // 縁取りの波帯と、内側の暗い帯
    if (Math.abs(r - 36 - 2 * Math.sin(ang * 14)) < 1.4) return "pale";
    if (r > 39 && Math.sin(ang * 22) > 0.55) return "band";
    if (Math.abs(r - 13 - 1.5 * Math.sin(ang * 9)) < 1.6) return "band";
    return m;
  };
  const wings = Paint(U(0, slab(fwL, -3, 0.7, "wing", 0.5), slab(mirror(fwL), -3, 0.7, "wing", 0.5),
    slab(hwL, -5, 0.7, "wing", 0.5), slab(mirror(hwL), -5, 0.7, "wing", 0.5)), pattern);
  // 翼の反り: 外側ほど奥へ (左の翼は光を受け、右は陰る) + ゆるい波打ち
  const bentWings = bendZ(wings, (x, y) => -0.32 * Math.abs(x - CX) + 1.2 * Math.sin(y * 0.22 + x * 0.05));
  // 胴: 毛深い胸、節のある腹、小さな頭と大きな複眼
  const thorax = ellipsoid([CX, 34, 4], [7, 8, 6], "fur");
  const collar = ellipsoid([CX, 27, 5], [7.5, 3.6, 5.5], "fur");
  const abd = [];
  for (let i = 0; i < 6; i++) abd.push(ellipsoid([CX, 44 + i * 5.2, 3 - i * 0.6], [5.6 - i * 0.6, 3.4, 4.6 - i * 0.4], i % 2 ? "seg" : "fur"));
  const head = ellipsoid([CX, 22, 7], [4.6, 4, 4.4], "fur");
  const eyes = [sphere([CX - 3.8, 21.5, 8.5], 2.6, "eye"), sphere([CX + 3.8, 21.5, 8.5], 2.6, "eye")];
  const body = Disp(U(1.6, thorax, collar, ...abd, head), (x, y, z) => 0.5 * fbm(x * 0.9, y * 0.9, z * 0.9));
  // 脚: 胸から前へ縮めた細い脚
  const legs = [];
  for (const s of [-1, 1]) for (const [dy, ly] of [[-2, 8], [2, 10], [6, 11]]) legs.push(tube([[CX + s * 4, 34 + dy, 8, 1], [CX + s * 9, 38 + dy, 11, 0.8], [CX + s * 7, 38 + dy + ly * 0.6, 13, 0.5]], "ant"));
  // 触角の軸 (羽毛状の小枝は後で 2D で描く)
  const antPts = s => [[CX + s * 2, 18.5, 8, 0.8], [CX + s * 8, 10, 6, 0.7], [CX + s * 16, 5, 4, 0.6], [CX + s * 24, 4, 2, 0.4]];
  const ants = [tube(antPts(-1), "ant"), tube(antPts(1), "ant")];
  const scene = U(0, bentWings, body, ...eyes, ...legs, ...ants);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.3, lights: [{ p: [17, 24, 14], r: 14, k: 0.2 }, { p: [79, 24, 14], r: 14, k: 0.2 }] });
  const C = new Canvas(r);
  // 羽毛の触角: 軸の両側へ斜めの細い小枝
  const AC = ["#3a2f20", "#5e4c34", "#7e6848"];
  for (const s of [-1, 1]) {
    const P = antPts(s);
    for (let t = 0.12; t < 0.97; t += 0.07) {
      const i = Math.min(P.length - 2, Math.floor(t * (P.length - 1))), f = t * (P.length - 1) - i;
      const x = P[i][0] + (P[i + 1][0] - P[i][0]) * f, y = P[i][1] + (P[i + 1][1] - P[i][1]) * f;
      let tx = P[i + 1][0] - P[i][0], ty = P[i + 1][1] - P[i][1]; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      const L = 1.5 + 3.5 * Math.sin(Math.PI * Math.min(1, t * 1.1));
      // 軸に直角な小枝を両側へ、少し先へ傾けて
      for (const side of [-1, 1]) for (let k = 1.2; k <= L; k += 0.6) {
        const bx = x + (-ty * side) * k + tx * k * 0.35, by = y + (tx * side) * k + ty * k * 0.35;
        if (!C.get(Math.round(bx), Math.round(by))) C.set(bx, by, AC[k > L - 0.8 ? 0 : side < 0 ? 2 : 1]);
      }
    }
  }
  // 翼の縁の毛羽立ち (後縁を少し欠く)
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m === "fur" || p.m === "seg" || p.m === "eye" || p.m === "ant") continue;
    const edge = !C.get(x, y + 1) || !C.get(x - 1, y) || !C.get(x + 1, y);
    if (edge && fbm(x * 0.5, y * 0.5, 9) > 0.1) C.set(x, y, null);
  }
  // 目玉模様に濡れた光点
  for (const [ex, ey, er] of EYES) { C.set(ex - er * 0.12, ey - er * 0.14, "#f0d488"); }
  // 眠りの鱗粉: 翼の下縁から燐光の粉が滝のように降る
  const G = ["#2a3416", "#4a5c22", "#7a9438", "#b4cc64", "#e4f2a8"];
  const R = rand(5151);
  const bottoms = [];
  for (let x = 4; x < 92; x++) { let yb = -1; for (let y = 95; y >= 0; y--) if (C.get(x, y) && C.pix[y * 96 + x]) { yb = y; break; } if (yb > 30 && Math.abs(x - CX) > 6) bottoms.push([x, yb]); }
  // まず淡い燐光の帳 (塊のもや)、その中に明るい粉の粒を流す
  const H = ["#212c1c", "#2c3b23", "#394c2a", "#4a6232"];
  const haze = new Map();
  for (const [x, y0] of bottoms) {
    const strength = 0.4 + 0.6 * Math.max(0, Math.sin(x * 0.42 + 0.8 * Math.sin(x * 0.13)));
    for (let y = y0 + 1; y < 96; y++) {
      const t = (y - y0) / (96 - y0);
      const xc = x + Math.sin(y * 0.09 + x * 0.2) * 2.5 * t;
      const a = (strength * (1 - t * 0.75) + 0.4 * fbm(xc * 0.22, y * 0.1, 11)) * (1 - 0.5 * Math.max(0, (y - 78) / 18));
      if (a <= 0.4) continue;
      const w = Math.round(t * 1.6);
      for (let dx = -w; dx <= w; dx++) {
        const xx = Math.round(xc + dx); if (xx < 0 || xx > 95 || (C.get(xx, y) && !haze.has(xx + y * 96))) continue;
        const k = xx + y * 96, prev = haze.get(k) || 0, v = a - Math.abs(dx) * 0.12;
        if (v < 0.55 && fbm(xx * 0.6, y * 0.6, 13) > 0.05) continue; // 縁はほつれる
        if (v > prev) { haze.set(k, v); C.set(xx, y, H[v > 0.9 ? 3 : v > 0.72 ? 2 : v > 0.56 ? 1 : 0]); }
      }
    }
  }
  for (const [k, a] of haze) {
    const x = k % 96, y = (k / 96) | 0, t = (y - 40) / 56;
    if (R() < 0.28 - 0.12 * t) { C.set(x, y, G[a > 0.75 ? 4 : 3]); if (haze.has(k - 96) && R() < 0.5) C.set(x, y - 1, G[2]); }
  }
  // 帳の下や脇へこぼれる粉: 縦に短く尾を引く粒
  for (let i = 0; i < 50; i++) {
    const [x0, y0] = bottoms[Math.floor(R() * bottoms.length)];
    const x = Math.round(x0 + (R() - 0.5) * 8), y = Math.round(y0 + 6 + R() * (95 - y0 - 6));
    if (C.get(x, y) || C.get(x, y - 1) || y > 94) continue;
    const b = R() < 0.4 ? 4 : 3; C.set(x, y, G[b]); if (R() < 0.7) C.set(x, y - 1, G[b - 2]);
  }
  // 翼の下縁そのものが燐光でほの白む
  for (const [x, yb] of bottoms) { const p = C.pix[yb * 96 + x]; if (p && (x + yb) % 2 === 0) C.set(x, yb, G[3]); }
  spores(C, 5153, 24, [2, 2, 92, 92], true);
  return C.toArt();
}

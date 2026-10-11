// 第12層「地底大空洞」の共通部品: 闘技場の真ん中の穴の底に広がる、果ての見えない地底大空洞。
// 黒褐色のごつごつした岩床と、何百年も落ち続けて山になった黒く濁った灯籠 (割れたガラス・ゆがんだ鉄枠・取っ手)、
// 天井から垂れるつらら石と床から伸びる石筍、鉱脈の水晶の冷たいきらめき、灯籠から漏れた濁った魂の鈍い琥珀の光と、
// 茸・胞子の青白い燐光、舞う煤と漂う濁った光の粒、冷たい琥珀灰の縁光
import { ellipsoid, sphere, box, cone, cyl, torus, U, Sub, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri, cracks } from "./mine.mjs";
export { afterimage, dissolve } from "./temple.mjs";
export { puffs, scaleAt, spikes } from "./lava.mjs";
export { chain } from "./storm.mjs";
export { breathFan } from "./ice.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 大空洞の岩床: 黒褐色。照り返しは少ない
export const BED = { ramp: ramp(["#030202", "#0a0706", "#130e0b", "#1d1611", "#282018", "#352a20"], 6), dither: 0.85, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => 0.14 * fbm(p.x * 0.3, p.z * 0.3) + 0.1 * Math.max(0, vnoise(p.x * 0.8, p.z * 0.8) - 0.3) };
// 岩 (岩くれ・つらら石・石筍・岩の体): 茶灰
export const ROCK = { ramp: ramp(["#030302", "#0b0908", "#161210", "#221d19", "#2f2823", "#3e352e", "#50463d"], 7), spec: 0.3, pow: 20, dither: 0.6,
  shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 煤けた灯籠のガラス: ほぼ黒。角だけ鈍く光る
export const GLASS = { ramp: ["#020203", "#08080a", "#121216", "#1e1e24"], spec: 1.2, pow: 50, specCol: "#6a6a72", dither: 0.4, amb: 0.2 };
// 灯籠のゆがんだ鉄枠と取っ手: 煤で黒い錆
export const FRAME = { ramp: ["#030202", "#0c0907", "#18120d", "#251c14", "#352819"], spec: 0.7, pow: 30, specCol: "#6a5a48", dither: 0.45 };
// 灯籠から漏れる濁った魂の光 (暗→明): くすんだ琥珀〜濁った黄
export const MURK = ["#1e1a0a", "#3a3214", "#5e5222", "#8a7a3a", "#b4a250", "#d6c472", "#f0e2a6"];
// 濁った光の灯籠のガラス (自ら鈍く光る)
export const MURKGLASS = { ramp: MURK.slice(1, 6), noRim: true, emit: p => 0.3 + 0.45 * Math.max(0, p.nz) + 0.2 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) };
// 茸・胞子の青白い燐光 (暗→明)
export const SPORE = ["#0a2422", "#174a46", "#2c8076", "#5ab8aa", "#9ae4d6", "#e0fff6"];
// 水晶 (鉱脈の結晶・水晶の鱗): 冷たい白青。面ごとに明暗
export const CRYSTAL = { ramp: ramp(["#05080c", "#0c1622", "#162a3c", "#244258", "#365e78", "#4e7e98", "#6e9eb6", "#9cc4d6"], 8), spec: 1.6, pow: 46, specCol: "#e6f6ff", dither: 0.35,
  shade: p => 0.18 * (Math.floor((p.nx * 3 + p.ny * 2 + p.nz) * 2) % 2 ? 0.5 : -0.5) };
// 煤 (舞う黒灰)
export const SOOT = ["#0a0909", "#151313", "#211e1d", "#2e2a28", "#3e3936"];
// 闇の霊の体 (暗→明): 紫がかった黒灰
export const GLOOM = ["#050308", "#0b0710", "#130c1a", "#1d1426", "#281c34", "#352644", "#453456", "#58446a"];
// 地底大空洞の縁光 (濁った灯の照り返しが冷えた、冷たい琥珀灰)
export const RIM = "#7c7a74";
// 灯籠 (SDF): 底 [x, y, z] から上へ。s = 大きさ、rot = 横倒しの傾き (度)、lit = 濁った光で鈍く光る、broken = ガラスが割れて穴
//   材質: ガラス "glass" (lit なら "murk")、鉄枠 "frame"
export function lantern([x, y, z], s = 1, { rot = 0, lit = false, broken = false, handle = true, glass = null } = {}) {
  const a = rot * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a); // 底 → 上の向き
  const P = t => [x + ux * t * s, y + uy * t * s, z];
  const gm = glass || (lit ? "murk" : "glass");
  let body = U(0.2, ellipsoid(P(3), [2.2 * s, 2.6 * s, 2.2 * s], gm, rot));
  if (broken) body = Sub(body, sphere([P(3.4)[0] + 1.6 * s, P(3.4)[1] - 0.6 * s, z + 1.6 * s], 1.7 * s, "frame"), 0.2);
  const parts = [body,
    cyl(P(0), P(0.9), 2.3 * s, "frame", 0.3),
    cone(P(5.2), P(6.6), 2.1 * s, 0.6 * s, "frame"),
    cyl(P(1), P(5.2), 0.45 * s, "frame"), // 前の柱
  ];
  if (handle && s >= 0.8) parts.push(torus(P(7.4), 1.1 * s, 0.35 * s, "frame", rot, 90));
  return U(0.1, ...parts);
}
// 灯籠の山 (SDF): 中心 (cx, 床 y, z)、半径 r、n 個。下ほど多く、上ほど少なく積む。lit = 濁った光の残る灯籠の割合
export function lampHeap(cx, y, z, r, n = 10, { seed = 1, s = 0.9, lit = 0.25, mound = true } = {}) {
  const R = rand(seed), parts = [];
  if (mound) parts.push(Disp(ellipsoid([cx, y + 1, z], [r, r * 0.3, r * 0.7], "bed"), (X, Y, Z) => 0.6 * fbm(X * 0.4, Y * 0.4, Z * 0.4)));
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt(R()), a = R() * Math.PI * 2;
    const px = cx + Math.cos(a) * r * 0.85 * t, pz = z + Math.sin(a) * r * 0.5 * t;
    const h = r * 0.34 * (1 - t * t);
    parts.push(lantern([px, y - h + 1, pz], s * (0.75 + R() * 0.45), { rot: (R() - 0.5) * 140, lit: R() < lit, broken: R() < 0.4, handle: R() < 0.5 }));
  }
  return U(0.3, ...parts);
}
// 大空洞の床: 岩床 + 岩くれ (rocks 個) + 散らばる灯籠の残骸 (lamps 個) + 小さな灯籠の山 (heaps: [[x, r, n], ...]) +
//   石筍 (mites: [[x, z, h], ...])。材質 "bed" / "rock" / "glass" / "frame" / "murk"
export function cavernFloor(cx, cy, rx, rz = 14, { seed = 3, rocks = 3, lamps = 2, heaps = [], mites = [], big = 3 } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 3.8, rz], "bed"), (x, y, z) => 0.35 * fbm(x * 0.3, z * 0.3) + 0.45 * Math.max(0, vnoise(x * 0.7, z * 0.7) - 0.25));
  const parts = [bed];
  for (let i = 0; i < rocks; i++) {
    const a = R() * Math.PI * 2, d = 0.45 + R() * 0.5;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.85, s = big * (0.5 + R() * 0.7);
    parts.push(Disp(box([x, cy - 2.2 - s * 0.4, z], [s, s * 0.7, s * 0.9], "rock", s * 0.4, R() * 70 - 35), (X, Y, Z) => 0.5 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  for (let i = 0; i < lamps; i++) {
    const side = i % 2 ? 1 : -1, x = cx + side * rx * (0.45 + R() * 0.45), z = -2 + (R() - 0.2) * rz * 0.7;
    parts.push(lantern([x, cy - 2, z], 0.7 + R() * 0.3, { rot: 70 + R() * 40 * side, broken: R() < 0.6, lit: R() < 0.3, handle: false }));
  }
  for (const [x, r, n] of heaps) parts.push(lampHeap(x, cy - 2, -4, r, n, { seed: seed + Math.round(x), s: 0.8 }));
  for (const [x, z, h] of mites) parts.push(stalagmite(x, cy - 2, z, h, h * 0.22));
  return U(0.5, ...parts);
}
// 石筍 (SDF): 床 y から上へ h。材質 "rock"
export function stalagmite(x, y, z, h, r = 2.4, mat = "rock") {
  return Disp(U(1, cone([x, y + 1, z], [x + r * 0.15, y - h, z], r, 0.3, mat), ellipsoid([x, y, z], [r * 1.3, r * 0.5, r * 1.2], mat)), (X, Y, Z) => 0.25 * Math.sin(Y * 1.6) + 0.2 * fbm(X * 0.6, Y * 0.6, Z * 0.6));
}
// つらら石 (SDF): 天井 y から下へ len。材質 "rock"
export function stalactite(x, y, z, len, r = 2.2, mat = "rock", lean = 0) {
  return Disp(cone([x, y - 2, z], [x + lean, y + len, z], r, 0.25, mat), (X, Y, Z) => 0.25 * Math.sin(Y * 1.5) + 0.2 * fbm(X * 0.6, Y * 0.6, Z * 0.6));
}
// 天井の岩 (SDF): 画面上端に張りつく岩盤の帯と、垂れるつらら石 (drops: [[x, len, r], ...])
export function ceiling(cx, y, rx, { drops = [], seed = 2, z = -10, mat = "rock" } = {}) {
  const parts = [Disp(ellipsoid([cx, y, z], [rx, 7, 16], mat), (X, Y, Z) => 1.2 * fbm(X * 0.2, Y * 0.2, Z * 0.2 + seed))];
  for (const [x, len, r] of drops) parts.push(stalactite(x, y + 3, z + 6, len, r ?? 2.2, mat));
  return U(1.2, ...parts);
}
// 宙を舞う煤 (空いている所だけ)。大きいものは横に2画素
export function soot(C, seed, n, area = [0, 0, C.W, C.H], cols = SOOT) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 0 || y < 0 || x >= C.W || y >= C.H || C.get(x, y)) continue;
    const k = Math.min(cols.length - 1, 1 + Math.floor(R() * R() * cols.length * 1.3));
    C.set(x, y, cols[k]);
    if (k >= 3 && R() < 0.4 && !C.get(x + 1, y)) C.set(x + 1, y, cols[k - 2]);
  }
}
// ゆっくり漂う濁った光の粒 (空いている所だけ)。芯と暗い滲み
export function murkMotes(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = MURK) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 1 || y < 1 || x >= C.W - 1 || y >= C.H - 1 || C.get(x, y)) continue;
    const k = 2 + Math.floor(R() * R() * (cols.length - 2));
    C.set(x, y, cols[k]);
    if (k >= 4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!C.get(x + dx, y + dy) && R() < 0.6) C.set(x + dx, y + dy, cols[1]);
  }
}
// 胞子の燐光の粒 (空いている所だけ)
export function sporeMotes(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = SPORE) { murkMotes(C, seed, n, area, cols); }
// 天井から落ちるしずく (空いている所だけ・疎らに): 縦2画素の細い線
export function drips(C, seed, n, area = [2, 2, C.W - 4, C.H - 30], cols = ["#1a1c22", "#3a3e48"]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y) || C.get(x, y + 1)) continue;
    C.set(x, y, cols[0]); C.set(x, y + 1, cols[1]);
  }
}
// 濁った光のにじみ (2D・空いている所だけ): 灯籠のまわりに琥珀の暗い輪をディザで
export function murkHalo(C, x, y, r, cols = MURK.slice(0, 3), k = 0.7) {
  for (let Y = Math.floor(y - r); Y <= y + r; Y++) for (let X = Math.floor(x - r); X <= x + r; X++) {
    if (X < 0 || Y < 0 || X >= C.W || Y >= C.H || C.get(X, Y)) continue;
    const d = Math.hypot(X + 0.5 - x, Y + 0.5 - y) / r; if (d > 1) continue;
    const v = (1 - d) * k;
    if (v < by(X, Y)) continue;
    C.set(X, Y, cols[Math.min(cols.length - 1, Math.floor(v * cols.length))]);
  }
}
// 床に散ったガラスのかけら (2D): mats の画素の上に、小さな黒光りの欠片を置く
export function shards(C, seed, mats, n = 20, cols = ["#020203", "#2a2a32", "#6a6a72"]) {
  const R = rand(seed), M = new Set([].concat(mats)), cand = [];
  for (let y = 1; y < C.H - 1; y++) for (let x = 1; x < C.W - 1; x++) { const p = C.pix[y * C.W + x]; if (p && M.has(p.m) && p.ny < -0.3) cand.push([x, y]); }
  for (let i = 0; i < n && cand.length; i++) {
    const [x, y] = cand[Math.floor(R() * cand.length)];
    C.set(x, y, cols[1]); if (R() < 0.6) C.set(x + 1, y, cols[2]); C.set(x, y + 1, cols[0]);
  }
}
// 水晶のきらめき (2D): mats の光の当たる面に星形のきらめき
export function glints(C, seed, mats, n = 6, cols = ["#9cc4d6", "#e6f6ff"]) {
  const R = rand(seed), M = new Set([].concat(mats)), cand = [];
  for (let y = 1; y < C.H - 1; y++) for (let x = 1; x < C.W - 1; x++) { const p = C.pix[y * C.W + x]; if (p && M.has(p.m) && p.sh > 0.5 && p.nz > 0.3) cand.push([x, y]); }
  for (let i = 0; i < n && cand.length; i++) {
    const [x, y] = cand[Math.floor(R() * cand.length)];
    C.set(x, y, cols[1]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R() < 0.7) C.set(x + dx, y + dy, cols[0]);
  }
}
// 体に浮かぶ濁った魂の黒い粒・鈍い光 (2D): mats の画素の上に、ノイズで選んだ所だけ点を置く (水晶の奥の黒い粒など)
export function specks(C, mats, { f = 0.35, th = 0.62, seed = 1, cols = ["#000000", "#08080a"] } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    const v = Math.pow(1 - Math.abs(vnoise(p.x * f, p.y * f, p.z * f + seed)), 6);
    if (v < th) continue;
    const t = (v - th) / (1 - th);
    C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(t * cols.length))]);
  }
}
// 上を向いた面に積もる煤 (2D)
export function sootCoat(C, mats, { th = -0.5, seed = 1, cols = SOOT.slice(1), k = 1 } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    const s = (th - p.ny) * k + 0.3 * fbm(p.x * 0.4, p.y * 0.4, seed) - 0.1;
    if (s < by(x, y) * 0.6) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(s * cols.length * 1.4)))]);
  }
}
// 凹凸 (Disp に渡す)
export const rough = (k = 0.5, f = 0.4) => (x, y, z) => k * fbm(x * f, y * f, z * f);
export const lumpy = (k = 0.6, f = 0.3) => (x, y, z) => k * Math.max(0, vnoise(x * f, y * f, z * f) - 0.2);
export { Paint };

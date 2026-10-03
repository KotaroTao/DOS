import { tube, sphere, ellipsoid, cone, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, MIST } from "../forest.mjs";
export const meta = { id: "bs_wisplure", key: "hd_wisplure", w: 96, h: 96,
  note: "惑わしの群火: 霧の中に浮かぶ青白い鬼火の群れ。中央の大きな火の中には暗い眼窩と口の虚ろな顔、大小の火は尾を引いて渦を巻くように巡り、まわりの霧を青く照らす" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const CX = 48, CY = 46;
  const FR = ["#08142a", "#0e2244", "#16345e", "#1f4a7c", "#2c6498", "#3e82b4", "#5ea2cc", "#86c2e0", "#b4e0f0", "#e4f8ff"];
  const flick = p => 0.18 * fbm(p.x * 0.18, p.y * 0.14 + 2, 1);
  const mats = {
    fire: { ramp: FR, emit: p => 0.22 + 0.8 * Math.max(0, p.nz) ** 1.3 + flick(p) },
    tail: { ramp: FR.slice(1, 7), emit: p => 0.05 + 0.6 * Math.max(0, p.nz) ** 1.5 + flick(p) },
    hole: { ramp: ["#000000", "#02040a", "#050a16"], amb: 0, dif: 0.15, noRim: true },
  };
  // 火の形: 丸い芯 + 上へ揺れて細る舌。向き deg (0=上) の方向へ舌を伸ばす
  const lick = (x, y, z) => 1.6 * fbm(x * 0.16, y * 0.12 + 1.2, z * 0.16, 3);
  function wisp(x, y, z, r, deg, mat = "fire") {
    const a = deg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    return U(r * 0.5, sphere([x, y, z], r, mat), cone([x + dx * r * 0.3, y + dy * r * 0.3, z], [x + dx * r * 2.6, y + dy * r * 2.6, z - r * 0.3], r * 0.75, r * 0.05, mat), cone([x + dx * r * 0.2 - dy * r * 0.5, y + dy * r * 0.2 + dx * r * 0.5, z], [x + dx * r * 1.7 - dy * r * 0.9, y + dy * r * 1.7 + dx * r * 0.9, z - r * 0.3], r * 0.4, r * 0.05, mat));
  }
  // 渦の流れに沿った尾: 中心の周りを反時計回りに巡る弧
  function trail(ang0, rad, z, r, span = 1.4) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, a = ang0 - t * span, rr = rad + t * 4;
      pts.push([CX + Math.cos(a) * rr * 1.15, CY + Math.sin(a) * rr * 0.85, z - t * 3, r * (1 - t * 0.92)]);
    }
    return tube(pts, "tail", { seg: 3 });
  }
  // 群れ: [角度, 半径, 奥行き, 大きさ]
  const SW = [[-2.35, 32, -6, 5.6], [-0.85, 33, -4, 4.6], [0.35, 32, 4, 6.4], [1.45, 31, 6, 4], [2.55, 32, 2, 5.2], [-1.6, 34, -10, 3.4]];
  const fires = [], tails = [];
  for (const [a, rad, z, r] of SW) {
    const x = CX + Math.cos(a) * rad * 1.15, y = CY + Math.sin(a) * rad * 0.85;
    // 進む向き (反時計回り = 角度が増える向き) と逆へ舌がなびく
    const vx = -Math.sin(a) * 1.15, vy = Math.cos(a) * 0.85;
    const deg = Math.atan2(-vx, vy) * 180 / Math.PI * 0.5; // 上向きと後ろ向きの中間
    fires.push(wisp(x, y, z, r, deg));
    tails.push(trail(a - 0.12, rad, z - 2, r * 0.5, 0.75 + r * 0.05));
  }
  // 中央の大きな火と虚ろな顔
  const big = Disp(U(4, sphere([CX, CY + 2, 4], 14, "fire"), cone([CX - 1, CY - 6, 2], [CX + 3, CY - 30, -2], 10, 1.2, "fire"), cone([CX - 6, CY - 4, 2], [CX - 13, CY - 22, -2], 5, 0.8, "fire"),
    cone([CX + 7, CY - 4, 2], [CX + 15, CY - 20, -3], 5, 0.8, "fire")), lick);
  const face = Sub(big, U(0, ellipsoid([CX - 5, CY - 1, 18], [3.6, 2.4, 6], "hole", 24), ellipsoid([CX + 5, CY - 1, 18], [3.6, 2.4, 6], "hole", -24), ellipsoid([CX, CY + 8.5, 17], [3, 4.8, 6], "hole", 6)), 1.2);
  const coreTail = Disp(tube([[CX, CY + 10, 0, 9], [CX - 5, CY + 22, -2, 5.5], [CX - 2, CY + 31, -4, 3], [CX + 7, CY + 35, -5, 1.2]], "tail", { seg: 4 }), lick);
  const scene = U(0, face, coreTail, ...fires, ...tails.map(t => Disp(t, (x, y, z) => 0.8 * fbm(x * 0.2, y * 0.2, z * 0.2))));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 炎の縁はちらちらと欠ける
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m === "hole") continue;
    const edge = !C.get(x - 1, y) || !C.get(x + 1, y) || !C.get(x, y - 1);
    if (edge && fbm(x * 0.45, y * 0.45, 7) > 0.08) C.set(x, y, null);
  }
  // 眼窩の奥にかすかな灯
  C.set(CX - 5, CY - 1, "#16345e"); C.set(CX + 5, CY - 1, "#16345e");
  // 照らされた霧: 火の近くほど明るい、塊のままの層 (まばらな点にしない)
  const glowSrc = [[CX, CY, 20], ...SW.map(([a, rad, z, r]) => [CX + Math.cos(a) * rad * 1.15, CY + Math.sin(a) * rad * 0.85, r * 1.8])];
  const HZ = ["#141b1f", "#182327", "#1d2b30", "#23353a", "#2a3f44"];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    if (C.get(x, y)) continue;
    let g = 0;
    for (const [gx, gy, gr] of glowSrc) { const d = Math.hypot(x - gx, (y - gy) * 1.1); g += Math.max(0, 1 - d / (gr * 2.1)) ** 1.6; }
    const swirl = 0.5 + 0.5 * Math.sin(Math.atan2(y - CY, x - CX) * 2 + Math.hypot(x - CX, y - CY) * 0.16);
    const m = 0.55 * fbm(x * 0.06 + swirl, y * 0.09, 21) + 0.25 * swirl;
    const v = g * 0.7 + m * 0.45 - 0.36 - 0.5 * Math.max(0, Math.max(Math.abs(x - 47.5), Math.abs(y - 47.5)) - 40) / 6;
    const lv = v;
    if (lv > 0.12) C.set(x, y, HZ[Math.min(4, Math.floor((lv - 0.12) * 6.5))]);
  }
  // 火の粉: 渦に沿った小さな青い粒
  const R = rand(771);
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2, rad = 18 + R() * 24;
    const x = Math.round(CX + Math.cos(a) * rad * 1.15), y = Math.round(CY + Math.sin(a) * rad * 0.85);
    if (x < 2 || x > 93 || y < 2 || y > 93) continue;
    const p = C.pix[y * 96 + x]; if (p) continue;
    C.set(x, y, FR[6 + Math.floor(R() * 3)]);
  }
  return C.toArt();
}

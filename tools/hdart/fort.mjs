// 第4層「捨て砦」の共通部品: 足元の割れた石畳と崩れた石積み、折れた矢、宙を舞う灰と火の粉
import { ellipsoid, box, cyl, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
// 石畳: 切り石の目地 (暗い溝) が走る、冷えた灰色の床
export const FLAG = { ramp: ramp(["#030303", "#09090a", "#121214", "#1b1c1f", "#26272b", "#323439"], 6), dither: 0.8, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => {
    // 目地: 奥行き方向に詰まる石の並び。ずれた継ぎ目で切り石らしく
    const u = p.x * 0.16, v = (p.z + 40) * 0.3, row = Math.floor(v);
    const fu = (u + row * 0.5) % 1, fv = v % 1;
    const seam = (fu < 0.07 || fv < 0.12) ? -0.28 : 0;
    return seam + 0.12 * fbm(p.x * 0.4, p.z * 0.4);
  } };
// 崩れた石積み・城壁の欠片
export const STONE = { ramp: ramp(["#030303", "#0a0a0b", "#141416", "#1f2023", "#2b2d31", "#3a3c42", "#4c4f56"], 7), spec: 0.3, pow: 20, dither: 0.6,
  shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 折れた矢柄・朽ちた梁
export const WOOD = { ramp: ramp(["#030202", "#0c0806", "#181009", "#24180e", "#322214", "#42301c"], 6), dither: 0.55,
  shade: p => 0.12 * Math.sin(p.y * 1.4 + 2 * fbm(p.x * 0.3, p.y * 0.3)) };
// 砦の寒い縁光 (月明かりの青灰。第3層より青みを強く)
export const RIM = "#525e78";
// 足元に敷く石畳の平たい台 + 崩れた石積みの欠片 (n 個)。床は "flag"、欠片は "stone" 材質
export function flagstones(cx, cy, rx, rz = 14, { n = 5, seed = 3, big = 3.4 } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "flag"), (x, y, z) => 0.25 * fbm(x * 0.3, z * 0.3) + (vnoise(x * 0.5, z * 0.5) > 0.55 ? 0.6 : 0));
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.5 + R() * 0.45;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.55 + R() * 0.6);
    // 切り石らしく角張った箱。欠けは弱いノイズで
    blocks.push(Disp(box([x, cy - 2 - s * 0.4, z], [s * 1.2, s * 0.65, s * 0.8], "stone", s * 0.15, R() * 40 - 20), (X, Y, Z) => 0.3 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  }
  return U(0, bed, ...blocks);
}
// 床に突き立った折れ矢 (SDF)。矢柄 "wood"、矢羽は 2D で足す
export function arrowShafts(list) {
  return list.map(([x, y, z, dx, dy, len = 9]) => {
    const l = Math.hypot(dx, dy) || 1;
    return cyl([x, y, z], [x + dx / l * len, y + dy / l * len, z + 1], 0.55, "wood", 0.2);
  });
}
// 宙を漂う灰と火の粉 (空いている所だけ)。ember=true で暖色の火の粉
export function ash(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], ember = false) {
  const R = rand(seed);
  const cols = ember ? ["#5a1c04", "#a84010", "#e88a28", "#ffd27a"] : ["#1e1f22", "#2c2d31", "#40424a", "#5c5f68"];
  for (let i = 0; i < n; i++) {
    const x = area[0] + R() * area[2], y = area[1] + R() * area[3];
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.6))]);
  }
}
// 石畳の上の小石・砕けた漆喰 (2D)
export function grit(C, seed, cx, cy, rx, n = 22) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (R() * 2 - 1) * rx), y = Math.round(cy + (R() * 2 - 1) * 2.5);
    if (C.get(x, y)) { C.set(x, y, R() < 0.5 ? "#40424a" : "#555862"); C.set(x, y + 1, "#060607"); }
  }
}
// 布 (軍旗・外套) のはためき: Disp に渡す波
export const flutter = (k = 0.8, f = 0.45, axis = "x") => (x, y, z) => k * Math.sin((axis === "x" ? x : y) * f + 1.7 * fbm(x * 0.15, y * 0.15));
export { Paint };

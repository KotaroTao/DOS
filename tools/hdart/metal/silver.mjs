import { sphere, ellipsoid, torus, U, render, Canvas } from "../sdf.mjs";
import { chrome, JOINT, FLOOR, soulGlow, chibi } from "../metalkit.mjs";
export const meta = { id: "mt_silver", key: "hd_mt_silver", w: 96, h: 96,
  note: "銀業: 手のひらほどの銀の人業。鏡のような銀肌に丸い無貌の頭、魂の灯る青い双眸、胸の小窓に揺れる魂。片手を振り上げて駆け出す" };
export const SOUL = ["#0c2a44", "#1d5a8a", "#3a9ad0", "#8fe0ff", "#e4fbff"];
export function build() {
  const mats = {
    metal: chrome(["#06070a", "#13161c", "#262b33", "#3d434d", "#5b636e", "#7f8893", "#a7afb9", "#cfd5dc", "#f0f3f6"], "#ffffff"),
    joint: JOINT, floor: FLOOR, soul: soulGlow(SOUL),
  };
  const d = chibi({ cx: 47, cy: 30, s: 0.95 });
  const window = torus([d.chest[0], d.chest[1], d.chest[2] - 1.2], 3.2, 1.1, "joint", 0, 90);
  const soul = sphere([d.chest[0], d.chest[1], d.chest[2] - 1.6], 2.6, "soul");
  const floor = ellipsoid([47, d.feet + 2.5, 2], [30, 2.2, 13], "floor");
  const r = render(U(0, floor, ...d.nodes, window, soul), mats, { w: 96, h: 96, rim: "#7c8ca8", zTop: 60 });
  const C = new Canvas(r);
  eyes(C, d.eye, SOUL);
  return C.toArt();
}
// 魂の灯る双眸: 暗い眼窩 (楕円) に、縦長の青い光と白い照り。rx/ry = 眼窩の半径
export function eyes(C, pts, cols, rx = 2.5, ry = 3.5) {
  for (const [x0, y0] of pts) {
    for (let y = Math.floor(y0 - ry - 1); y <= y0 + ry + 1; y++) for (let x = Math.floor(x0 - rx - 1); x <= x0 + rx + 1; x++) {
      const u = (x + 0.5 - x0) / rx, v = (y + 0.5 - y0) / ry, q = u * u + v * v;
      if (q > 1) continue;
      // 下ほど明るい魂の色 (中心は明るく、縁は暗い眼窩)
      const c = q > 0.62 ? "#04060a" : v < -0.35 ? cols[1] : v < 0.1 ? cols[2] : cols[3];
      C.only(x, y, c);
    }
    C.only(Math.round(x0 - rx * 0.35), Math.round(y0 - ry * 0.35), cols[4]);
  }
}

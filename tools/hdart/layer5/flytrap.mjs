import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, spores, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_flytrap", key: "hd_flytrap", w: 96, h: 96,
  note: "大食虫花: 根で床を掴んだ太い茎から三つの捕虫葉の顎が三方へ首を伸ばす。トラバサミのように棘の並ぶ顎の縁、内側は赤黒く濡れ、毒液が糸を引いて滴る" };
export function build() {
  const mats = {
    pod: { ramp: ramp(["#040502", "#0c1006", "#16200a", "#22300e", "#304214", "#40561a", "#546c22", "#6c842e"], 8), spec: 0.9, pow: 30, specCol: "#a8bc6c", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    blush: { ramp: ramp(["#060203", "#180709", "#2c0d0f", "#421414", "#5a1e1a", "#742a20"], 6), spec: 0.8, pow: 30, specCol: "#b06048", dither: 0.5 },
    inner: { ramp: ramp(["#030001", "#120304", "#220608", "#360a0c", "#4e1012", "#6a1a18"], 6), spec: 1.2, pow: 40, specCol: "#c8584a", dither: 0.45, amb: 0.3, noRim: true },
    stem: { ramp: ramp(["#030402", "#0a0e06", "#131b0a", "#1d290e", "#283813", "#354819", "#455c21"], 7), spec: 0.4, pow: 20, dither: 0.55,
      shade: p => 0.1 * Math.sin(p.x * 1.4 + 2 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2)) },
    root: ROOT, mould: MOULD,
  };
  // 顎: 首の先の捕虫葉。P=中心, deg=口の向き, s=大きさ, open=開き角
  // 顎: H=蝶番 (首の先), deg=口の向き, s=大きさ, open=開き角(度)
  const heads = [
    { H: [48, 36, 6], deg: -90, s: 1.5, open: 74 },
    { H: [33, 50, 8], deg: 198, s: 1.3, open: 70 },
    { H: [62, 44, 7], deg: -22, s: 1.3, open: 70 },
  ];
  const pods = [], necks = [];
  const base = [48, 62, 0];
  for (const h of heads) {
    const [hx, hy, hz] = h.H, l = 10 * h.s, w = 6.2 * h.s, d = 4.2 * h.s;
    const a0 = h.deg * Math.PI / 180;
    h.lobes = [];
    for (const sd of [-1, 1]) {
      // 二枚の捕虫葉: 蝶番から開き角の半分ずつ振れる。内側は凹んだ赤黒い面
      const a = a0 + sd * h.open / 2 * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      let nx = -uy, ny = ux; // 隙間 (もう一枚) の側への法線
      const tox = Math.cos(a0) - ux, toy = Math.sin(a0) - uy; if (nx * tox + ny * toy < 0) { nx = -nx; ny = -ny; }
      const c = [hx + ux * l * 0.95, hy + uy * l * 0.95, hz];
      const outer = Paint(Disp(ellipsoid(c, [l, w, d], "pod", a * 180 / Math.PI), (x, y, z) => 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4)),
        (x, y, z, m) => { const t = ((x - c[0]) * ux + (y - c[1]) * uy) / l; return m === "pod" && t > 0.25 + 0.35 * fbm(x * 0.3, y * 0.3, 7) ? "blush" : m; });
      const scoop = ellipsoid([c[0] + nx * w * 0.55, c[1] + ny * w * 0.55, hz + d * 0.55], [l * 0.92, w * 0.85, d * 0.95], "inner", a * 180 / Math.PI);
      pods.push(Sub(outer, scoop, 0.6));
      h.lobes.push({ c, ux, uy, nx, ny, l, w });
    }
    // 蝶番のふくらみ
    pods.push(ellipsoid([hx, hy, hz - 1], [w * 0.55, w * 0.55, d * 0.8], "pod"));
    // 首: 茎の分かれ目から蝶番へ (S 字に)
    const bx = hx - Math.cos(a0) * 5, by = hy - Math.sin(a0) * 5;
    const mx = (base[0] + bx) / 2 - Math.sin(a0) * 5, my = (base[1] + by) / 2 + 2;
    necks.push(tube([[base[0], base[1], base[2], 5.2], [mx, my, (base[2] + hz) / 2 + 2, 4.2], [bx, by, hz - 1, 3.8], [hx, hy, hz, 3.6]], "stem", { seg: 4 }));
  }
  // 太い茎と、床を掴む根
  const stalk = Disp(tube([[48, 92, 0, 6.5], [46, 82, 1, 5.6], [49, 70, 0, 5], [48, 60, 0, 5]], "stem", { seg: 3 }), (x, y, z) => 0.3 * Math.abs(Math.sin(Math.atan2(z, x - 48) * 7)));
  const knot = ellipsoid([48, 60, 0], [7, 6, 6], "stem");
  const roots = [];
  for (const [ex, ez, mx, my] of [[22, 6, 32, 88], [74, 6, 64, 88], [34, 16, 40, 90], [62, 14, 56, 90], [16, -4, 28, 90], [80, -4, 68, 90]]) {
    roots.push(tube([[48, 89, 0, 3.6], [mx, my, ez * 0.5, 2.4], [ex, 92, ez, 1.4], [ex + (ex < 48 ? -2 : 2), 94, ez + 1, 0.5]], "root", { seg: 3 }));
  }
  // 茎の根元の大きな葉
  const lv = [Disp(slab([[46, 88], [30, 80], [20, 82], [28, 88], [40, 91]], 4, 0.8, "stem", 0.5), (x, y, z) => -0.15 * Math.abs(x - 34)),
    Disp(slab([[50, 88], [66, 79], [77, 81], [68, 88], [56, 91]], 5, 0.8, "stem", 0.5), (x, y, z) => -0.15 * Math.abs(x - 64))];
  const floor = forestFloor(48, 94, 42, 12, { n: 0, roots: 0, seed: 53 });
  const scene = U(0, floor, U(1.6, stalk, knot, ...necks), ...lv, ...roots, ...pods);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: heads.map(h => ({ p: [h.H[0], h.H[1], h.H[2] + 12], r: 16, k: 0.15 })) });
  const C = new Canvas(r);
  // 顎の縁の棘: 楔の両辺に沿って、隙間を横切るように内向きに並ぶ
  const T = ["#5a5038", "#a89a70", "#e8dcb4"];
  const isHead = (x, y) => { const p = C.pix[y * 96 + x]; return p && (p.m === "pod" || p.m === "blush" || p.m === "inner"); };
  for (const h of heads) {
    const a0 = h.deg * Math.PI / 180, span = (h.open / 2 + 48) * Math.PI / 180, L = 10 * h.s;
    for (let f = -span; f <= span + 1e-6; f += 7.5 * Math.PI / 180) {
      if (Math.abs(f) < 0.12) continue; // 口の真ん中 (隙間) は飛ばす
      const dx = Math.cos(a0 + f), dy = Math.sin(a0 + f);
      let last = null;
      for (let r = 2; r < L * 2.3; r += 0.4) { const x = Math.round(h.H[0] + dx * r), y = Math.round(h.H[1] + dy * r); if (x >= 0 && y >= 0 && x < 96 && y < 96 && isHead(x, y)) last = [h.H[0] + dx * r, h.H[1] + dy * r]; }
      if (!last) continue;
      const tl = (Math.abs(f) < span * 0.75 ? 4.6 : 3.2) * h.s * 0.85;
      const px = -dy, py = dx;
      const ex = last[0] + dx * tl, ey = last[1] + dy * tl;
      tri(C, [last[0] - px * 0.75, last[1] - py * 0.75], [last[0] + px * 0.75, last[1] + py * 0.75], [ex, ey], T[1]);
      C.set(ex, ey, T[2]); C.set(last[0], last[1], T[0]);
    }
  }
  // 毒液: 顎から糸を引いて滴る
  const G = ["#1e3008", "#3e6410", "#78b020", "#c4f050"];
  const drip = (x, y, l) => { for (let i = 0; i < l; i++) C.set(x, y + i, G[i < l - 2 ? 1 : 2]); C.set(x, y + l, G[3]); C.set(x, y + l + 1, G[2]); };
  drip(44, 26, 5); drip(53, 27, 7); drip(13, 52, 6); drip(20, 54, 9); drip(82, 48, 5); drip(77, 49, 8);
  for (const [x, y] of [[20, 66], [77, 60], [53, 38]]) { C.set(x, y, G[2]); C.set(x, y + 1, G[1]); }
  leaves(C, 54, 48, 92, 40, 16);
  mist(C, 55, 2, [0, 70, 96, 18], 0.25);
  spores(C, 56, 10, [2, 4, 92, 70]);
  return C.toArt();
}

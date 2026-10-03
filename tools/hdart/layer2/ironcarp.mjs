import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { WATER, puddle, ripples, RIM } from "../lib.mjs";
export const meta = { id: "bs_ironcarp", key: "hd_ironcarp", w: 96, h: 96,
  note: "鋼鱗の大鯉: 汚水を割って身をくねらせる老いた大鯉。鋼板のような鱗に錆と苔、長い髭、濁った金の眼、厚い唇の口" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#030304", "#0b0d0f", "#161a1c", "#24292a", "#363b38", "#4e5248", "#6e6e5c", "#9c9a80"], 8), spec: 1.6, pow: 55, specCol: "#dde8e4", dither: 0.45 },
    belly: { ramp: ramp(["#060605", "#1a1a16", "#302e26", "#4c483a", "#6e6852", "#948c70"], 6), spec: 1.2, pow: 40, specCol: "#e8e4cc", dither: 0.5 },
    fin: { ramp: ramp(["#040303", "#130d0b", "#261813", "#3c251b", "#563626", "#764c34"], 6), spec: 0.5, pow: 25, dither: 0.55, shade: p => 0.12 * Math.sin(p.x * 1.6 - p.y * 0.4) },
    lip: { ramp: ramp(["#060404", "#1e1410", "#3a2820", "#5a4232", "#7c5e48"], 5), spec: 0.9, pow: 30, specCol: "#d8c4b0", dither: 0.5 },
    eye: { ramp: ramp(["#0a0600", "#3e2a04", "#7a5810", "#b48a20", "#d8b450"], 5), spec: 2, pow: 80, specCol: "#ffffff", amb: 0.4, dither: 0.3 },
    maw: { ramp: ["#000000", "#0c0404", "#1e0a0a"], amb: 0.3, dif: 0.3 },
    water: WATER,
  };
  // 体軸: 頭を左に、背を弓なりに反らせて汚水へ尾から沈む
  const spine = [[22, 46, 10, 12], [32, 42, 8, 15.5], [44, 40, 6, 17], [57, 43, 4, 15.5], [67, 51, 2, 12], [74, 61, 0, 8.5], [78, 71, -2, 5.5], [80, 78, -3, 3.5]];
  // 鱗: 半段ずらした格子に大きな鱗。上縁が光り、下の縁に影の弧
  const scaleShade = p => {
    const S = 5.6, v = p.y / S + 0.15 * Math.sin(p.x * 0.05), row = Math.floor(v), u = p.x / S + (row % 2) * 0.5;
    const fu = u - Math.floor(u) - 0.5, fv = v - row; // 0..1 (下へ)
    const r = Math.hypot(fu * 1.1, (fv - 0.15) * 1.0);
    if (r > 0.6) return -0.4;
    if (r > 0.5) return 0.12;
    return 0.04 - r * 0.3;
  };
  const body = Paint(Disp(tube(spine, "scale", { seg: 6, k: 2 }), (x, y, z) => 0.15 * fbm(x * 0.5, y * 0.5, z * 0.5)),
    (x, y, z, m) => (y > 47 && x < 62 && x > 24 && z > 0) ? "belly" : m);
  const head = ellipsoid([19, 47, 11], [12, 11.5, 10], "scale", -12);
  const lipU = ellipsoid([7.5, 49, 12], [4.5, 3, 5], "lip", -25), lipD = ellipsoid([8.5, 54, 12], [4.2, 2.6, 5], "lip", 15);
  const mouth = Sub(U(1.8, head, lipU, lipD), ellipsoid([5.5, 51.5, 14], [3.3, 2.2, 6], "maw"), 0.8);
  const eye = sphere([17, 42, 19.5], 2.7, "eye");
  const dorsal = slab([[34, 28], [38, 19], [44, 16], [52, 17], [60, 21], [66, 28], [70, 38], [62, 38], [52, 28], [42, 26]], 3, 1.4, "fin", 0.6);
  const tail = slab([[78, 76], [72, 84], [70, 92], [78, 88], [82, 82], [90, 90], [94, 88], [88, 78], [82, 74]], -4, 1.6, "fin", 0.6);
  const pect = slab([[26, 54], [22, 64], [22, 70], [30, 64], [33, 56]], 18, 1.3, "fin", 0.6);
  const pelv = slab([[50, 56], [48, 66], [54, 68], [58, 58]], 12, 1.2, "fin", 0.6);
  const anal = slab([[64, 60], [60, 68], [66, 70], [70, 62]], 6, 1.1, "fin", 0.6);
  const scene = U(0, puddle(76, 90, 20, 12), dorsal, tail, pelv, anal, body, mouth, pect, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.05 });
  const C = new Canvas(r);
  C.set(17, 42, "#000000"); C.set(18, 42, "#000000"); C.set(17, 43, "#000000"); C.set(16, 41, "#fffbe8");
  // 鰓蓋の弧
  for (let t = -1.1; t <= 1.1; t += 0.06) C.only(25 + Math.cos(t) * 4, 47 + Math.sin(t) * 9, "#0b0d0f");
  // 髭: 口の端から垂れて揺れる二対
  const W = "#5e4a38", WL = "#8c745a";
  let x = 6, y = 53; for (let i = 0; i < 14; i++) { x -= 0.35; y += 1; C.set(x + Math.sin(i * 0.6) * 1.2, y, i < 4 ? WL : W); }
  x = 10; y = 55; for (let i = 0; i < 10; i++) { x += 0.15; y += 1; C.set(x + Math.sin(i * 0.7 + 1) * 1.0, y, W); }
  // 鱗: 半段ずらした格子に、一枚ずつ下縁の暗い弧と上縁の照り
  const SR = mats.scale.ramp;
  const isScale = (x, y) => { const p = C.pix[y * 96 + x]; return p && p.m === "scale" && SR.includes(C.get(x, y)); };
  for (let gy = 26; gy < 84; gy += 4) for (let gx = 20 + ((gy / 4) % 2) * 2.75; gx < 84; gx += 5.5) {
    for (let a = 0.25; a <= Math.PI - 0.25; a += 0.18) { const x = Math.round(gx + Math.cos(a) * 3.1), y = Math.round(gy + Math.sin(a) * 2.6); if (isScale(x, y)) C.shift(x, y, SR, -2); }
    for (const [dx, dy] of [[-1, -1], [0, -1]]) { const x = Math.round(gx + dx), y = Math.round(gy + dy); if (isScale(x, y)) C.shift(x, y, SR, 1); }
  }
  // 跳ねた飛沫
  const R = rand(9); const S = ["#2c4446", "#4e6c6e", "#86a4a4", "#c4d8d4"];
  for (let i = 0; i < 30; i++) { const a = R() * Math.PI, d = 6 + R() * 18; const sx = 78 + Math.cos(a) * d * 1.0, sy = 88 - Math.sin(a) * d * 0.7; if (!C.get(Math.round(sx), Math.round(sy))) C.set(sx, sy, S[Math.floor(R() * 4)]); }
  ripples(C, 76, 90, 20);
  return C.toArt();
}

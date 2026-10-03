import { fangs, ribbon, tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
export const meta = { id: "bs_eelfiend", key: "hd_eelfiend", w: 96, h: 96,
  note: "噛みつき大鰻: 汚水から身をくねらせて躍りかかる大鰻。裂けた顎に鉤の牙、白濁した眼、背びれに沿って青白い放電が走る" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#020303", "#060808", "#0c1010", "#141a18", "#1e2622", "#2a362e", "#3c4c3e", "#5a6c56"], 8), spec: 2.2, pow: 50, specCol: "#d8f0e0", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    belly: { ramp: ramp(["#050504", "#16140c", "#2a2614", "#423c20", "#5e5630", "#807648"], 6), spec: 1.5, pow: 45, specCol: "#f0ecd0", dither: 0.5 },
    fin: { ramp: ramp(["#020303", "#081010", "#101c1c", "#1a2c2a", "#284038"], 5), dither: 0.5, shade: p => 0.1 * Math.sin(p.x * 1.3) },
    maw: { ramp: ["#000000", "#000000", "#140408", "#2c0a10", "#481418"], amb: 0.15, dif: 0.5 },
    eye: { ramp: ramp(["#1a2020", "#5a6866", "#a8b8b0", "#e0ece4"], 4), spec: 2, pow: 60, specCol: "#ffffff", amb: 0.4 },
    water: WATER,
  };
  // 体: 水面から S 字に伸び上がり、頭は左上で口を開く
  const spine = [[86, 90, -8, 5], [84, 78, -4, 7], [72, 68, 0, 8], [58, 70, 2, 8.5], [46, 62, 4, 8.5], [44, 48, 6, 8.5], [50, 36, 8, 8], [44, 24, 10, 7.5], [32, 20, 12, 7.5]];
  const body = Paint(tube(spine, "skin", { seg: 6, k: 1.5 }), (x, y, z, m) => (z > 9 && ((x < 52 && y > 40) || (y > 66 && x > 50 && x < 78))) ? "belly" : m);
  // 頭: 長く尖った鰻の頭。上下の顎を大きく開く
  const skull = ellipsoid([26, 17, 12], [14, 6, 6.5], "skin", -16);
  const lower = ellipsoid([24, 26, 12], [13, 3.6, 5.5], "skin", 18);
  const head = Sub(U(2, body, skull, lower), ellipsoid([16, 23, 15], [11, 3.4, 7], "maw", 4), 0.8);
  const fin = slab(ribbon(spine, 1, 1, 5, 0.1, 0.78), 6, 1.1, "fin", 0.5);
  const pect = slab([[40, 30], [33, 35], [35, 40], [42, 36]], 16, 1, "fin", 0.5);
  const eye = sphere([28, 13, 17.5], 2.1, "eye");
  const scene = U(0, puddle(80, 90, 20, 12), fin, head, pect, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  C.set(28, 13, "#3a4644"); C.set(27, 12, "#ffffff");
  fangs(C, "maw", 7, 30, { step: 2, top: [2, 4], bot: [2, 3], seed: 5 });
  // 放電: 背びれに沿ってジグザグの青白い稲妻
  const E = ["#2a5c7a", "#6ab4e0", "#d8f4ff"];
  const R = rand(17);
  const bolt = (x, y, n, dx, dy) => { for (let i = 0; i < n; i++) { const ox = x, oy = y; x += dx + (R() - 0.5) * 3; y += dy + (R() - 0.5) * 3; C.line(ox, oy, x, y, i % 3 === 0 ? E[2] : E[1]); } };
  bolt(60, 28, 5, 2, -2); bolt(40, 46, 4, -3, 1); bolt(70, 58, 4, 2, -2.5); bolt(36, 10, 4, -2, -1.5); bolt(88, 66, 3, 1.5, -2);
  for (let i = 0; i < 24; i++) { const x = 20 + R() * 74, y = 6 + R() * 70; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, E[Math.floor(R() * 2)]); }
  ripples(C, 80, 90, 20);
  return C.toArt();
}

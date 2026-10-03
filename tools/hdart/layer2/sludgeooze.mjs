import { tube, sphere, ellipsoid, cone, slab, cyl, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_sludgeooze", key: "hd_sludgeooze", w: 96, h: 96,
  note: "汚泥の塊: 幾年もの汚物が澱んで意思を持った黒緑の泥山。呑んだ者の髑髏や錆びた剣の柄が半ば沈み、裂け目の口から糸を引き、泥に浮いた眼玉がこちらを追う" };
export function build() {
  const mats = {
    mud: { ramp: ramp(["#020202", "#050604", "#090c07", "#0f130b", "#151b0f", "#1c2414", "#262e1a", "#343c22", "#4a5230"], 9), spec: 2.4, pow: 55, specCol: "#c8dc8c", dither: 0.6, amb: 0.12,
      shade: p => 0.1 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2) },
    tox: { ramp: ramp(["#040602", "#0e1604", "#1a2a08", "#2a420c", "#3e5c12", "#587a1c", "#7e9e30"], 7), spec: 2, pow: 50, specCol: "#e0f8a0", dither: 0.5, amb: 0.12 },
    bone: { ramp: ramp(["#060504", "#1a160e", "#302818", "#4a4026", "#6a5e3c", "#8e8258", "#b8ae80"], 7), spec: 0.8, pow: 30, specCol: "#e8e0c0", dither: 0.4 },
    iron: { ramp: ramp(["#030202", "#0e0806", "#1c100a", "#2c1a0e", "#422614", "#5a361e"], 6), spec: 1, pow: 30, specCol: "#b89878", dither: 0.4 },
    maw: { ramp: ["#000000", "#000000", "#040602", "#0a0e06", "#121a0a"], amb: 0.1, dif: 0.4 },
    eye: { ramp: ramp(["#1a1a14", "#4a4a3c", "#8a8a74", "#c4c4ac", "#ecece0"], 5), spec: 2.5, pow: 70, specCol: "#ffffff", amb: 0.4 },
  };
  // 泥山: 大小の塊を滑らかに融かし、表面をうねらせる
  const blobs = [[48, 66, 0, 26], [30, 74, 4, 16], [68, 72, 2, 18], [44, 46, 4, 15], [56, 40, 2, 11], [22, 84, 6, 10], [78, 84, 4, 11], [36, 34, 0, 8]].map(([x, y, z, r]) => sphere([x, y, z], r, "mud"));
  const floor = ellipsoid([48, 88, 0], [46, 5, 26], "mud");
  const mass0 = Disp(U(7, ...blobs, floor), (x, y, z) => 1.8 * fbm(x * 0.09, y * 0.09, z * 0.09, 4) + 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const mass = Paint(mass0, (x, y, z, m) => (m === "mud" && fbm(x * 0.13 + 4, y * 0.13, z * 0.13) > 0.42) ? "tox" : m);
  // 裂け目の口
  const body = Sub(mass, ellipsoid([46, 58, 26], [13, 6, 10], "maw", -6), 2.5);
  // 沈みかけた髑髏・肋・剣の柄
  const skull = Sub(ellipsoid([24, 66, 16], [7, 7.5, 7], "bone", 15), U(0, ellipsoid([21, 66, 23], [2.2, 2.5, 2.5], "maw"), ellipsoid([27.5, 67, 22.5], [2.2, 2.5, 2.5], "maw"), ellipsoid([25, 71.5, 22.5], [1, 1.4, 2], "maw")), 0.4);
  const skull2 = ellipsoid([72, 78, 18], [4.5, 5, 4.5], "bone", -20);
  const ribs = []; for (let i = 0; i < 4; i++) ribs.push(tube([[60 + i * 3, 52, 16, 0.9], [62 + i * 3.4, 46, 12, 0.8], [65 + i * 3, 44, 6, 0.7]], "bone"));
  const hilt = [cyl([66, 34, 6], [70, 20, 8], 1.3, "iron"), box([66, 35, 6], [5, 1.1, 1.2], "iron", 0.4, -16), sphere([70.5, 18.5, 8], 2, "iron")];
  const eyes = [sphere([36, 45, 15], 4.4, "eye"), sphere([58, 45, 12], 3.4, "eye"), sphere([79, 70, 13], 3, "eye")];
  const scene = U(0, body, skull, skull2, ...ribs, ...hilt, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 瞳: 濁った赤い虹彩
  for (const [x, y, r] of [[37, 46, 1.6], [59, 46, 1.2], [80, 71, 1.0]]) { C.disc(x, y, r + 0.6, "#5a1408"); C.disc(x, y, r * 0.6, "#000000"); C.set(x - 2, y - 2, "#ffffff"); }
  // 口の糸と泡
  const G = ["#1b2412", "#323e1e", "#567418", "#a8c040"];
  for (const [x, l] of [[39, 6], [46, 9], [53, 5]]) { let y = 52; while (y < 70 && !(C.pix[y * 96 + x] && C.pix[y * 96 + x].m === "maw")) y++; for (let i = 0; i < l; i++) C.set(x, y + i, G[i % 2 ? 1 : 2]); }
  const R = rand(27);
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, x = 48 + Math.cos(a) * (30 + R() * 14), y = 60 + Math.sin(a) * (24 + R() * 10); if (!C.get(Math.round(x), Math.round(y)) && y < 88) { C.set(x, y, G[2 + (R() < 0.3 ? 1 : 0)]); } }
  for (let i = 0; i < 16; i++) { const x = Math.floor(16 + R() * 64), y = Math.floor(30 + R() * 56); const p = C.pix[y * 96 + x]; if (p && (p.m === "mud" || p.m === "tox")) { C.set(x, y, "#5e6a36"); C.set(x + 1, y, "#0c1109"); C.set(x, y - 1, "#a8c040"); } }
  return C.toArt();
}

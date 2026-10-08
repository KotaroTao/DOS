import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { POOL, MARBLE, RIM, PHOS, ripples, bubbles, motes, column } from "../temple.mjs";
export const meta = { id: "bs_templelord", key: "hd_templelord", w: 112, h: 128,
  note: "沈める神官王 (層ボス): 王冠と司教冠が溶け合った高い冠を戴き、腰まで水に浸かってそびえる溺れた神官王の巨きな霊。ふやけた顔に青緑の燐光の眼、海藻の長い髭。貝のこびりついた王の大外套を広げ、片手に魚の頭を象った王笏を掲げ、もう片手で水を招く。背後の折れた柱の間から渦潮が立ちのぼって頭上で大きな輪を描き、両脇には呼び出された聖歌隊の霊が浮かぶ" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#050707", "#121818", "#222c2c", "#344242", "#4a5a58", "#647672", "#80948c"], 5), spec: 0.6, pow: 24, specCol: "#b8d0c8", dither: 0.45, amb: 0.22 },
    robe: { ramp: ramp(["#030508", "#081018", "#0e1a26", "#162636", "#1e3446", "#294458", "#36566c"], 6), spec: 0.7, pow: 22, specCol: "#6a90a8", dither: 0.6, amb: 0.2,
      shade: p => 0.14 * Math.sin((p.x - 56) * 0.5 + p.y * 0.05) + 0.05 * fbm(p.x * 0.4, p.y * 0.4) },
    cape: { ramp: ramp(["#060203", "#14060a", "#240c12", "#36141a", "#4a1e24", "#5e2a2e"], 5), dither: 0.6, amb: 0.2, shade: p => 0.14 * Math.sin(p.x * 0.5 + p.y * 0.08) },
    gold: { ramp: ramp(["#080502", "#1e1206", "#3a240a", "#5c3a12", "#80561c", "#a8782a", "#d0a040", "#f0d070"], 6), spec: 1.6, pow: 36, specCol: "#fff4c0", dither: 0.4 },
    kelp: { ramp: ramp(["#020302", "#071008", "#0d1c0e", "#152a14", "#1f3a1c", "#2a4a24"], 5), spec: 0.8, pow: 26, specCol: "#4a6a40", dither: 0.55 },
    shell: { ramp: ramp(["#0a0908", "#24201a", "#423a2e", "#645a48"], 4), dither: 0.5, amb: 0.3 },
    eye: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    water: { ramp: ramp(["#06141c", "#0c2430", "#143648", "#1e4a60", "#2c6278", "#407e92", "#5e9cac", "#8ac0c8"], 8), spec: 1.2, pow: 30, specCol: "#d0f4f4", dither: 0.6, amb: 0.32, noRim: true,
      shade: p => 0.16 * Math.sin(Math.atan2(p.z, p.x - 56) * 4 + p.y * 0.4) },
    hole: { ramp: ["#000000", "#000000", "#020304"], amb: 0, dif: 0.05, noRim: true },
    pool: POOL, marble: MARBLE,
  };
  const cx = 56;
  // 水面: 腰から下を呑む暗い水
  const sea = Disp(ellipsoid([cx, 120, -2], [58, 6, 22], "pool"), (x, y, z) => 0.5 * Math.sin(Math.hypot(x - cx, z * 2) * 0.6));
  // 背後の折れた柱
  const cols = [column(10, 122, -22, 92, 6, { seed: 11 }), column(102, 122, -22, 74, 6, { seed: 13 })];
  // 冠: 金の王冠の上に高い司教冠が溶け合う
  const crown = U(0.6, Disp(cyl([cx, 26, 0], [cx, 21, 0], 8.4, "gold", 0.6), (x, y, z) => 0.3 * Math.abs(Math.sin(Math.atan2(z, x - cx) * 8))),
    ...[-3, -2, -1, 0, 1, 2, 3].map(i => cone([cx + i * 2.6, 21.4, 2 + (3 - Math.abs(i)) * 1.4], [cx + i * 3.1, 15.4 + Math.abs(i) * 1, 1.6 + (3 - Math.abs(i)) * 1.2], 1.2, 0.25, "gold")),
    cone([cx, 22, -1], [cx, 2, -2], 6.4, 2.2, "gold"), sphere([cx, 18, 7], 1.6, "eye"));
  const mitreFace = (x, y, z, m) => m === "gold" && y < 19 && y > 3 && z > 0 && Math.abs(x - cx) > 1.8 && Math.abs(x - cx) < 5.4 && y < 14 ? "cape" : m;
  // ふやけた大きな顔と海藻の髭
  const head = U(1.2, ellipsoid([cx, 33, 2], [8, 9, 7], "skin"), ellipsoid([cx, 41, 3.4], [5.4, 3.4, 5], "skin"));
  const holes = U(0, ellipsoid([cx - 3.2, 31.6, 8], [2.2, 1.6, 1.6], "hole"), ellipsoid([cx + 3.2, 31.6, 8], [2.2, 1.6, 1.6], "hole"), ellipsoid([cx, 40.6, 8], [3, 1.2, 1.4], "hole"));
  const eyes = [sphere([cx - 3.2, 31.8, 7.2], 1.15, "eye"), sphere([cx + 3.2, 31.8, 7.2], 1.15, "eye")];
  const R = rand(1041), beard = [];
  for (let i = 0; i < 11; i++) { const x = cx - 6.5 + i * 1.3, L = 16 + R() * 16 - Math.abs(i - 5) * 1.2; beard.push(Disp(tube([[x, 41, 7, 1.4], [x + (R() - 0.5) * 3, 41 + L * 0.5, 8.6, 1.2], [x + (R() - 0.5) * 4, 41 + L, 8, 0.4]], "kelp", { seg: 2 }), (X, Y, Z) => 0.3 * vnoise(X, Y, Z))); }
  // 胴: 法衣と、肩から大きく広がる王の大外套 (内は暗赤)
  const torso = Disp(U(2.4, ellipsoid([cx, 56, 0], [17, 10, 9], "robe"), cone([cx, 58, 0], [cx, 118, 0], 14, 22, "robe")), (x, y, z) => 0.8 * Math.sin(Math.atan2(z, x - cx) * 8 + y * 0.05) * Math.max(0, (y - 62) / 40));
  const capePoly = [[cx - 18, 48], [cx + 18, 48], [cx + 40, 64], [cx + 50, 92], [cx + 48, 118], [cx - 48, 118], [cx - 50, 92], [cx - 40, 64]];
  const cape = Disp(slab(capePoly, -8, 1.2, "cape", 0.8), (x, y, z) => 1.2 * Math.sin(x * 0.35 + 1.6 * fbm(x * 0.12, y * 0.12)));
  const mantle = Disp(U(1.4, ellipsoid([cx - 16, 50, -1], [9, 6, 7], "gold", -16), ellipsoid([cx + 16, 50, -1], [9, 6, 7], "gold", 16), torus([cx, 48, 1], 12, 2.4, "gold", 0, 20)), (x, y, z) => 0.3 * Math.abs(Math.sin(x * 1.4)));
  const band = (x, y, z, m) => m === "robe" && Math.abs(x - cx) < 3.4 && z > 6 && y > 60 ? ((Math.floor(y / 3) % 2) ? "gold" : "robe") : m;
  const shells = [];
  for (let i = 0; i < 16; i++) { const x = cx - 44 + R() * 88, y = 70 + R() * 44; if (Math.abs(x - cx) < 18) continue; shells.push(ellipsoid([x, y, -6], [1.8, 1.3, 1.4], "shell", R() * 90)); }
  // 右腕 (見る側の左): 魚頭の王笏を掲げる / 左腕: 水を招く掌
  const armL = Disp(cone([cx - 17, 52, 2], [cx - 30, 36, 8], 5, 6.4, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handL = ellipsoid([cx - 31, 33, 9], [3, 3.2, 2.6], "skin");
  const sx = cx - 31;
  const sceptre = U(0.4, cyl([sx, 66, 9], [sx, 12, 9], 1.2, "gold"), Disp(ellipsoid([sx, 8, 9], [3.4, 5, 3], "gold"), (x, y, z) => 0.3 * Math.sin(y * 2)), cone([sx - 1, 12, 9], [sx - 5, 15, 9], 1.6, 0.3, "gold"), cone([sx + 1, 12, 9], [sx + 5, 15, 9], 1.6, 0.3, "gold"), sphere([sx, 7, 11.4], 1, "eye"));
  const armR = Disp(cone([cx + 17, 52, 2], [cx + 30, 62, 10], 5, 6.4, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handR = U(0.5, ellipsoid([cx + 32, 64, 11.6], [3, 2.8, 2.4], "skin"), ...fingers([cx + 33, 64.6, 11.6], 40, "skin", { n: 4, len: 6, spread: 24, r: 0.8, curl: 0.3 }));
  // 渦潮: 背後から立ちのぼり、頭上で大きな輪
  const spiral = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40, a = t * Math.PI * 6; spiral.push([cx + Math.cos(a) * (24 + t * 14), 112 - t * 100, -12 + Math.sin(a) * (10 + t * 6), 1.4 + t * 1.6]); }
  const vortex = Disp(tube(spiral, "water", { seg: 2 }), (x, y, z) => 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const halo = Disp(torus([cx, 12, -8], 34, 2, "water", 0, -14), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const king = U(0, Paint(crown, mitreFace), Sub(head, holes, 0.3), ...eyes, ...beard, Paint(U(1.2, torso, armL, armR), band), mantle, cape, ...shells, handL, handR, sceptre);
  const scene = U(0, sea, ...cols, vortex, halo, king);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, bounce: 0.18, lights: [{ p: [cx, 30, 30], r: 30, k: 0.3 }, { p: [cx + 36, 62, 22], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 招く掌の上の水の玉
  const Wc = mats.water.ramp;
  C.disc(cx + 38, 58, 3.4, Wc[3]); C.disc(cx + 37.6, 57.4, 2.2, Wc[5]); C.set(cx + 37, 56, Wc[7]);
  // 腰まわりの水面の輪と白い波
  for (let a = 0; a < Math.PI * 2; a += 0.008) { const X = Math.round(cx + Math.cos(a) * 26), Y = Math.round(116 + Math.sin(a) * 4.4); if (Math.sin(a) > -0.2 || !C.get(X, Y)) C.set(X, Y, Wc[Math.sin(a * 9) > 0.3 ? 7 : 5]); }
  // 両脇に浮かぶ聖歌隊の霊 (呼び出された眷属): 頭巾の小さな影
  const G = ["#0e1820", "#1a2a36", "#2a4050", "#4a6878"];
  for (const [x0, y0] of [[14, 52], [98, 46]]) {
    for (let y = -9; y <= 16; y++) for (let x = -6; x <= 6; x++) {
      const inHood = (x * x) / 30 + ((y + 3) * (y + 3)) / 36 < 1, inBody = y > 0 && Math.abs(x) < 4 + y * 0.18;
      if (!(inHood || inBody)) continue;
      const X = x0 + x, Y = y0 + y; if (C.get(X, Y)) continue;
      const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      if (y > 8 && (y - 8) / 8 > (BY[Y & 3][X & 3] + 0.5) / 16) continue;
      C.set(X, Y, G[x < -2 ? 2 : x > 3 ? 0 : 1]);
    }
    C.set(x0 - 2, y0 - 3, PHOS[3]); C.set(x0 + 2, y0 - 3, PHOS[3]); C.set(x0, y0 + 1, "#000000"); C.set(x0, y0 + 2, "#000000");
  }
  C.set(cx - 4, 31, PHOS[4]); C.set(cx + 2, 31, PHOS[4]);
  ripples(C, 1043, ["#1b3438", "#2c5054", "#8ac0c8"]);
  bubbles(C, 1045, 14);
  motes(C, 1047, 14, undefined, true);
  return C.toArt();
}

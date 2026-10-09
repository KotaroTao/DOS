import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, REED, RIM, ROT, MIASMA, bogFloor, reeds, reedTips, scum, motes, toxBubbles, slime, puffs, ooze, miasma } from "../swamp.mjs";
export const meta = { id: "bs_swamplord", key: "hd_swamplord", w: 112, h: 128,
  note: "よどみの主 (層ボス): 沼のいちばん深いところで、底まで落ちて腐った魂のよどみが寄り集まり、山のように盛り上がったもの。黒緑の泥の巨体のあちこちに、溶けきらない顔と腕が浮かび、胸の奥では腐った魂の光が濁ってうずまく。朽ち木と葦の冠をいただく頭が大口を開けて毒の息を吐き (ブレス)、泥の両腕の先からは腐敗の泥がぼとりと落ちて這い出す (招来)。崩れた所は沼の泥がすぐに塞ぐ (再生)。背後の霧の奥には、沈みかけた古い島の石積みの影" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    body: { ramp: ramp(["#010201", "#050704", "#0a0e07", "#11170b", "#18200f", "#202b14", "#2a3719", "#36451f", "#455626"], 9), spec: 1.3, pow: 34, specCol: "#8aa050", dither: 0.55, amb: 0.2,
      shade: p => 0.12 * fbm(p.x * 0.18, p.y * 0.18, p.z * 0.18) },
    face: { ramp: ramp(["#080906", "#161a10", "#262c1c", "#384028", "#4c5636", "#626e46"], 6), dither: 0.45, amb: 0.32 },
    crown: ROTWOOD, reed: REED,
    stone: { ramp: ramp(["#030403", "#070908", "#0c0f0d", "#121614", "#191e1b"], 5), dither: 0.8, amb: 0.4, noRim: true },
    maw: { ramp: ["#000000", "#040802", "#0e1a06", "#24400c"], amb: 0.05, dif: 0.2, noRim: true },
    hole: { ramp: ["#000000", "#020301"], amb: 0, dif: 0.05, noRim: true },
    core: { ramp: ROT, noRim: true, emit: p => 0.35 + 0.6 * Math.max(0, p.nz) },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    blob: { ramp: ramp(["#020301", "#070a04", "#0f1609", "#18230e", "#223114"], 5), spec: 1.4, pow: 36, specCol: "#6a8a3a", dither: 0.5 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 背景: 沈みかけた古い島の石積み (霧の奥)
  const isle = U(0.5, box([92, 64, -40], [14, 18, 6], "stone", 1), box([84, 52, -42], [6, 8, 5], "stone", 1), box([100, 46, -42], [4, 12, 4], "stone", 0.6), box([18, 70, -40], [10, 10, 6], "stone", 1));
  // 巨体: 沼から盛り上がる山
  const mass = Disp(U(6, ellipsoid([56, 104, -4], [46, 20, 22], "body"), ellipsoid([56, 78, -2], [32, 24, 18], "body"), ellipsoid([54, 52, 0], [22, 18, 15], "body", -6), ellipsoid([52, 34, 4], [15, 12, 12], "body", -8)),
    (x, y, z) => ooze(2.2, 0.12)(x, y, z) + 1.2 * Math.max(0, vnoise(x * 0.25, y * 0.25, z * 0.25) - 0.35));
  // 泥の両腕 (前へ垂らし、先から泥がこぼれる)
  const armL = Disp(tube([[30, 62, 8, 9], [18, 78, 14, 7], [12, 96, 18, 6], [14, 108, 20, 5]], "body", { seg: 4 }), ooze(1.2, 0.2));
  const armR = Disp(tube([[80, 62, 4, 9], [94, 76, 10, 7], [100, 94, 14, 6], [98, 106, 16, 5]], "body", { seg: 4 }), ooze(1.2, 0.2));
  const handL = fingers([14, 108, 20], 100, "body", { n: 4, len: 8, spread: 40, r: 1.6, curl: 0.4, z: 1 });
  const handR = fingers([98, 106, 16], 80, "body", { n: 4, len: 8, spread: 40, r: 1.6, curl: -0.4, z: 1 });
  // 溶けきらない顔 [x, y, z, s, 傾き]
  const faces = [[36, 88, 18, 1.5, -20], [76, 92, 18, 1.3, 15], [62, 72, 16, 1.1, 5], [80, 74, 14, 1, 25], [54, 102, 20, 1.3, 0], [26, 104, 18, 1, -10]];
  const fs = [], fh = [];
  for (const [x, y, z, s, a] of faces) {
    fs.push(ellipsoid([x, y, z], [4 * s, 5 * s, 3 * s], "face", a));
    fh.push(ellipsoid([x - 1.5 * s, y - 1, z + 2.4 * s], [1 * s, 1.2 * s, 1 * s], "hole"), ellipsoid([x + 1.5 * s, y - 1, z + 2.4 * s], [1 * s, 1.2 * s, 1 * s], "hole"), ellipsoid([x, y + 2.2 * s, z + 2.2 * s], [1.1 * s, 1.6 * s, 1 * s], "hole"));
  }
  // 浮かび出る腕
  const limbs = [tube([[26, 96, 18, 2], [20, 88, 22, 1.6], [22, 80, 24, 1.2]], "face"), tube([[88, 98, 16, 2], [94, 90, 20, 1.6], [92, 84, 22, 1.2]], "face")];
  // 頭と大口
  const maw = ellipsoid([50, 40, 15], [9, 6, 6], "maw", -6);
  const brow = Disp(ellipsoid([52, 30, 12], [12, 4, 6], "body", -6), ooze(0.8, 0.3));
  const eyes = [sphere([45, 31, 16.4], 1.6, "eye"), sphere([56, 30, 16.6], 1.6, "eye"), sphere([62, 33, 15], 1, "eye")];
  // 朽ち木と葦の冠
  const R = rand(11001);
  const crown = [];
  for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.36, x = 52 + Math.cos(a) * 13, y = 24 + Math.sin(a) * 4; crown.push(cone([x, y, 4 + Math.sin(a + 1.57) * 8], [x + Math.cos(a) * 6, y - 12 - R() * 8, 2], 2.2, 0.4, "crown")); }
  const reedList = [[40, 22, 6, 20, -3], [46, 20, 8, 26, 1], [60, 20, 6, 24, 4], [66, 22, 4, 18, 6]];
  // 胸の奥の腐った魂のうず
  const cores = [sphere([56, 60, 15], 4.6, "core"), sphere([46, 76, 16], 2.4, "core"), sphere([68, 82, 16], 2.2, "core")];
  // 這い出した腐敗の泥 (眷属)
  const blobs = [Disp(ellipsoid([10, 118, 14], [8, 6, 7], "blob"), ooze(0.9, 0.3)), Disp(ellipsoid([102, 118, 12], [7, 5, 6], "blob"), ooze(0.9, 0.3))];
  const lord = Sub(U(2.4, mass, armL, armR, ...handL, ...handR, ...fs, brow, ...limbs), U(0, maw, ...fh, ...cores.map(c => c)), 0.5);
  const scene = U(0, bogFloor(56, 124, 54, 18, { n: 2, seed: 11003, wet: 0.5, logs: 2 }), isle, lord, ...cores, ...eyes, ...crown, ...reeds(reedList), ...blobs);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 60, 30], r: 30, k: 0.4 }, { p: [50, 42, 28], r: 18, k: 0.25 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 42, 58, { step: 3, top: [2, 3], bot: [2, 3], cols: ["#3a3a20", "#7a7a4a", "#c8c890"], seed: 11005 });
  reedTips(C, reedList);
  for (const [x, y, z, s] of faces) { C.only(x - 1.5 * s, y - 1, ROT[3]); C.only(x + 1.5 * s, y - 1, ROT[2]); }
  C.set(45, 30, ROT[5]); C.set(56, 29, ROT[5]);
  // 光の核を泥で半ば覆う
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = C.pix[y * W + x]; if (p && p.m === "core" && fbm(x * 0.4, y * 0.4, 1) > 0.05 && (x + y) % 2) C.set(x, y, "#202b14"); }
  // 毒の息 (口から前下へ)
  const bc = ["#16200a", "#24380e", "#3a5414", "#587a1c", "#86a82a", "#bcd658"];
  puffs(C, [[42, 46, 6], [34, 48, 8], [24, 52, 10], [14, 56, 11], [5, 60, 10], [10, 46, 6]], bc, { dens: 0.9, seed: 8, own: ["body", "face", "stone"] });
  // 島の石積みの輪郭を霧で沈める
  miasma(C, 11007, 4, [0, 34, W, 50], 0.4);
  toxBubbles(C, 11009, 30, [4, 100, W - 8, 20]);
  slime(C, 11011, ["body"], 0.1, ["#0a0e07", "#18200f", "#455626"]);
  scum(C, 11013);
  motes(C, 11015, 40, [2, 2, W - 4, 90], true);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, CLOUD, SOULS, towerFloor, chain, bolt2d, crackle, sparks, rain, clouds, windStreaks } from "../storm.mjs";
export const meta = { id: "bs_stormlord", key: "hd_stormlord", w: 112, h: 128,
  note: "嵐の尖塔の主 (層ボス): 塔の頂で渦を巻く、数えきれない魂の光が寄り集まってできた嵐。紫灰の雷雲の巨体のあちこちに、渦に引き延ばされた青白い顔と手が浮かぶ。雷の冠をいただく頭が大口を開けて雷の息を吐き (ブレス)、渦からちぎれた魂が疾風の霊になって隊へ降りかかる (招来)。巨体の下からは床へ何本もの鎖が張りつめている。背後には火のともらない巨大な灯台が、割れた大レンズを闇に向けて立つ" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    body: { ramp: ramp(["#020205", "#06060d", "#0c0b18", "#131224", "#1c1a32", "#262442", "#323054", "#403e68", "#524f80"], 8), dither: 0.75, amb: 0.26,
      shade: p => 0.14 * Math.sin(Math.atan2(p.z, p.x - 56) * 3 + p.y * 0.22 + 2 * fbm(p.x * 0.12, p.y * 0.1)) },
    face: { ramp: ramp(["#08121a", "#22445a", "#538ca6", "#7cb4c8", "#aad6e2"], 5), dither: 0.45, amb: 0.34 },
    hole: { ramp: ["#000000", "#010103"], amb: 0, dif: 0.05, noRim: true },
    maw: { ramp: ["#000000", "#06061a", "#141a4a"], amb: 0.05, dif: 0.2, noRim: true },
    core: { ramp: [SOULS[1], BOLT[1], BOLT[2], SOULS[3], BOLT[3], BOLT[4]], noRim: true, emit: p => 0.3 + 0.65 * Math.max(0, p.nz) },
    eye: { ramp: [BOLT[3], BOLT[4], "#ffffff"], emit: () => 0.95 },
    beacon: { ramp: ramp(["#020204", "#07070e", "#10101b", "#1a1a28"], 4), dither: 0.8, amb: 0.4, noRim: true },
    lens: { ramp: ramp(["#03040a", "#0c1224", "#1e2a4a"], 3), spec: 1.6, pow: 60, specCol: "#6a78b0", dither: 0.6, noRim: true },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  // 背後の火のない灯台 (霧の奥、暗く沈む)
  const beacon = U(0.6, cone([84, 128, -46], [88, 36, -46], 16, 11, "beacon"), box([88, 34, -46], [14, 3, 12], "beacon", 1), cyl([88, 32, -46], [88, 14, -46], 10, "beacon", 1), cone([88, 14, -46], [88, 2, -46], 11, 1, "beacon"));
  const lens = Sub(sphere([88, 23, -36], 7, "lens"), box([92, 18, -30], [3, 8, 4], "lens", 0, 30), 0.4);
  // 渦の巨体: 下は細く床に縛られ、上へ広がる
  const swirl = (x, y, z) => 2.4 * fbm(x * 0.1, y * 0.07, z * 0.1) + 1.6 * Math.sin(Math.atan2(z + 2, x - 56) * 3 + y * 0.3);
  const mass = Disp(U(7, cone([56, 118, 0], [56, 60, 0], 8, 26, "body"), ellipsoid([56, 52, 0], [30, 20, 18], "body"), ellipsoid([56, 34, 4], [16, 14, 13], "body")), swirl);
  // 風の腕 (左右へ広げる)
  const armL = Disp(tube([[34, 50, 6, 9], [18, 46, 10, 6], [8, 36, 14, 4], [6, 26, 14, 2.4]], "body", { seg: 4 }), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2));
  const armR = Disp(tube([[78, 50, 6, 9], [94, 46, 10, 6], [104, 36, 14, 4], [106, 26, 14, 2.4]], "body", { seg: 4 }), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2));
  const handL = fingers([6, 25, 14], -100, "body", { n: 4, len: 8, spread: 40, r: 1, curl: 0.4 });
  const handR = fingers([106, 25, 14], -80, "body", { n: 4, len: 8, spread: 40, r: 1, curl: -0.4 });
  // 渦に浮かぶ魂の顔 [x, y, z, s, 傾き]
  const faces = [[34, 62, 20, 1.2, -25], [76, 64, 20, 1.1, 25], [46, 80, 16, 1, -10], [68, 84, 14, 0.9, 15], [56, 98, 10, 0.8, 0], [24, 52, 18, 0.9, -40], [88, 52, 18, 0.9, 40]];
  const fs = [], fh = [];
  for (const [x, y, z, s, a] of faces) {
    fs.push(ellipsoid([x, y, z], [3.6 * s, 4.6 * s, 2.6 * s], "face", a));
    fh.push(ellipsoid([x - 1.3 * s, y - 1, z + 2 * s], [0.9 * s, 1.1 * s, 1 * s], "hole"), ellipsoid([x + 1.3 * s, y - 1, z + 2 * s], [0.9 * s, 1.1 * s, 1 * s], "hole"), ellipsoid([x, y + 2 * s, z + 2 * s], [1 * s, 1.6 * s, 1 * s], "hole"));
  }
  // 頭: 大口と眼
  const maw = ellipsoid([56, 40, 16], [8, 5, 5], "maw");
  const brow = Disp(ellipsoid([56, 28, 13], [11, 4, 5], "body"), (x, y, z) => 0.8 * fbm(x * 0.3, y * 0.3));
  const eyes = [sphere([50, 30, 16.6], 1.6, "eye"), sphere([62, 30, 16.6], 1.6, "eye")];
  const core = sphere([56, 58, 16], 5, "core");
  // 床へ張りつめた鎖 (渦を縛る)
  const links = [...chain([46, 104, 6], [20, 124, 12], 1.6, "iron", 0.6), ...chain([66, 104, 6], [94, 124, 12], 1.6, "iron", 0.6), ...chain([56, 110, 8], [58, 126, 14], 1.6, "iron", 0.6)];
  const lord = Sub(U(3, mass, armL, armR, ...handL, ...handR, ...fs, brow), U(0, maw, ...fh, sphere([56, 58, 18], 4, "hole")), 0.5);
  const scene = U(0, towerFloor(56, 126, 54, 16, { n: 3, seed: 12001, wet: 0.3, big: 4 }), beacon, lens, lord, core, ...eyes, ...links);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 58, 34], r: 34, k: 0.45 }, { p: [56, 10, 28], r: 30, k: 0.35 }] });
  const C = new Canvas(r);
  for (const [x, y, z, s] of faces) { C.only(x - 1.3 * s, y - 1, SOULS[3]); C.only(x + 1.3 * s, y - 1, SOULS[2]); }
  C.set(50, 29, "#ffffff"); C.set(62, 29, "#ffffff");
  // 雷の冠 (頭の上に立つ稲妻の尖り)
  for (const [x1, y1, s] of [[44, 4, 1], [52, 0, 2], [60, 0, 3], [68, 4, 4], [38, 12, 5], [74, 12, 6]]) bolt2d(C, 56 + (x1 - 56) * 0.25, 22, x1, y1, { seed: s, jag: 1.4, branch: 0 });
  // 雷の息 (口から下へ広がる稲妻の束)
  for (const [x1, y1, s] of [[30, 84, 11], [40, 92, 12], [70, 92, 13], [82, 84, 14], [56, 96, 15]]) bolt2d(C, 56, 44, x1, y1, { seed: s, jag: 2.6, branch: 1, own: ["body", "face"] });
  // 渦からちぎれて飛ぶ魂 (疾風の霊になりかけたもの)
  const R = rand(12003);
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2, d = 40 + R() * 14, x = 56 + Math.cos(a) * d, y = 56 + Math.sin(a) * d * 0.8;
    if (C.get(Math.round(x), Math.round(y))) continue;
    C.set(x, y, SOULS[4]); for (let k = 1; k < 4; k++) if (!C.get(Math.round(x + Math.sin(a) * k), Math.round(y - Math.cos(a) * k))) C.set(x + Math.sin(a) * k, y - Math.cos(a) * k, SOULS[3 - k]);
  }
  crackle(C, 12005, ["body"], 0.015);
  clouds(C, [[16, 92, 18, 8], [96, 96, 18, 8], [56, 8, 40, 6]], { dens: 0.7, seed: 21 });
  windStreaks(C, 12007, 20, [0, 60, W, 50]);
  rain(C, 12009, 70, [0, 0, W, H]);
  sparks(C, 12011, 24);
  return C.toArt();
}

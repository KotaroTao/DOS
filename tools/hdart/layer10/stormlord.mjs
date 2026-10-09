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
    beacon: { ramp: ramp(["#030306", "#0b0b14", "#161622", "#222232"], 4), dither: 0.8, amb: 0.4, noRim: true },
    lens: { ramp: ramp(["#03040a", "#0c1224", "#1e2a4a"], 3), spec: 1.6, pow: 60, specCol: "#6a78b0", dither: 0.6, noRim: true },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  // 背後の火のない灯台 (霧の奥、暗く沈む): 細い塔身・回廊・灯室の割れた大レンズ・丸屋根
  const beacon = U(0.5, cone([90, 128, -44], [90, 40, -44], 9, 6, "beacon"), torus([90, 39, -44], 8, 1.2, "beacon", 0, 10), cyl([90, 38, -44], [90, 22, -44], 6.4, "beacon", 0.6),
    cone([90, 22, -44], [90, 8, -44], 8, 0.6, "beacon"), cyl([90, 8, -44], [90, 3, -44], 0.6, "beacon"));
  const lens = Sub(sphere([90, 30, -38], 5.4, "lens"), box([93, 26, -33], [2, 6, 3], "lens", 0, 30), 0.3);
  // 渦の巨体: 上は嵐の円盤のように広がり、下は細くなって床に縛られる
  const swirl = (x, y, z) => 2 * fbm(x * 0.1, y * 0.07, z * 0.1) + 1.4 * Math.sin(Math.atan2(z + 2, x - 56) * 3 + y * 0.3);
  const mass = Disp(U(7, cone([56, 114, 0], [56, 44, 0], 5, 24, "body"), ellipsoid([56, 36, -2], [36, 11, 18], "body"), ellipsoid([56, 50, 2], [20, 16, 14], "body")), swirl);
  // 風の腕 (渦から左右へほどけて伸びる)
  const armL = Disp(tube([[36, 50, 6, 7], [20, 52, 10, 5], [8, 44, 14, 3.4], [4, 34, 14, 2]], "body", { seg: 4 }), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2));
  const armR = Disp(tube([[76, 50, 6, 7], [92, 52, 10, 5], [104, 44, 14, 3.4], [108, 34, 14, 2]], "body", { seg: 4 }), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2));
  const handL = fingers([4, 33, 14], -100, "body", { n: 4, len: 7, spread: 40, r: 0.9, curl: 0.4 });
  const handR = fingers([108, 33, 14], -80, "body", { n: 4, len: 7, spread: 40, r: 0.9, curl: -0.4 });
  // 渦に浮かぶ魂の顔 [x, y, z, s, 傾き]
  const faces = [[30, 64, 16, 1, -25], [80, 66, 16, 1, 25], [44, 82, 12, 0.9, -10], [68, 86, 10, 0.8, 15], [22, 40, 14, 0.8, -40], [92, 42, 14, 0.8, 40]];
  const fs = [], fh = [];
  for (const [x, y, z, s, a] of faces) {
    fs.push(ellipsoid([x, y, z], [3.6 * s, 4.6 * s, 2.6 * s], "face", a));
    fh.push(ellipsoid([x - 1.3 * s, y - 1, z + 2 * s], [0.9 * s, 1.1 * s, 1 * s], "hole"), ellipsoid([x + 1.3 * s, y - 1, z + 2 * s], [0.9 * s, 1.1 * s, 1 * s], "hole"), ellipsoid([x, y + 2.2 * s, z + 2 * s], [0.9 * s, 1.2 * s, 1 * s], "hole"));
  }
  // 頭: 渦の芯から突き出る、深い眼窩と縦に裂けて叫ぶ口の顔
  const head = Disp(ellipsoid([56, 46, 18], [9.4, 12, 8], "body"), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const sockets = U(0, ellipsoid([52, 42, 25.4], [2.6, 2.2, 3], "hole", -15), ellipsoid([60, 42, 25.4], [2.6, 2.2, 3], "hole", 15));
  const maw = ellipsoid([56, 52.5, 25], [3.8, 5.6, 4], "maw");
  const eyes = [sphere([52, 42.4, 23.6], 1.2, "eye"), sphere([60, 42.4, 23.6], 1.2, "eye")];
  const core = sphere([56, 72, 12], 3.6, "core");
  // 床へ張りつめた鎖 (渦を縛る)
  const links = [...chain([50, 104, 4], [18, 124, 12], 1.6, "iron", 0.6), ...chain([62, 104, 4], [96, 124, 12], 1.6, "iron", 0.6), ...chain([56, 110, 6], [58, 126, 14], 1.6, "iron", 0.6)];
  const lord = Sub(U(3, mass, armL, armR, ...handL, ...handR, ...fs, head), U(0, maw, sockets, ...fh, sphere([56, 72, 14], 3, "hole")), 0.4);
  const scene = U(0, towerFloor(56, 126, 54, 16, { n: 3, seed: 12001, wet: 0.3, big: 4 }), beacon, lens, lord, core, ...eyes, ...links);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 72, 30], r: 30, k: 0.4 }, { p: [56, 30, 40], r: 30, k: 0.35 }] });
  const C = new Canvas(r);
  for (const [x, y, z, s] of faces) { C.only(x - 1.3 * s, y - 1, SOULS[3]); C.only(x + 1.3 * s, y - 1, SOULS[2]); }
  C.set(52, 42, "#ffffff"); C.set(60, 42, "#ffffff");
  // 渦の帯 (体の上を巡る明るい螺旋の筋)
  for (let t = 0; t < 1; t += 0.0015) {
    const y = 110 - t * 76, rr = 4 + t * 30, a = t * 30;
    const x = 56 + Math.cos(a) * rr; if (Math.sin(a) < 0.1) continue;
    const p = C.pix[Math.round(y) * W + Math.round(x)]; if (!p || p.m !== "body") continue;
    C.set(x, y, t > 0.5 ? "#524f80" : "#403e68");
  }
  // 雷の冠 (頭の上から放射する稲妻)
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32, l = 14 + (i % 2) * 6; bolt2d(C, 56 + Math.cos(a) * 8, 36 + Math.sin(a) * 2, 56 + Math.cos(a) * (9 + l), 34 + Math.sin(a) * (4 + l), { seed: 30 + i, jag: 1.2, branch: 1 }); }
  // 雷の息 (叫ぶ口から左下の隊へ)
  bolt2d(C, 56, 56, 6, 112, { seed: 11, jag: 3, branch: 2, own: ["body", "face"], thick: 2 });
  bolt2d(C, 54, 58, 26, 120, { seed: 12, jag: 2.6, branch: 1, own: ["body", "face"] });
  // 渦からちぎれて飛ぶ魂 (疾風の霊になりかけたもの)
  const R = rand(12003);
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2, d = 40 + R() * 14, x = 56 + Math.cos(a) * d, y = 56 + Math.sin(a) * d * 0.8;
    if (C.get(Math.round(x), Math.round(y))) continue;
    C.set(x, y, SOULS[4]); for (let k = 1; k < 4; k++) if (!C.get(Math.round(x + Math.sin(a) * k), Math.round(y - Math.cos(a) * k))) C.set(x + Math.sin(a) * k, y - Math.cos(a) * k, SOULS[3 - k]);
  }
  crackle(C, 12005, ["body"], 0.015);
  clouds(C, [[16, 96, 16, 7], [100, 100, 14, 7], [40, 6, 30, 5]], { dens: 0.65, seed: 21 });
  windStreaks(C, 12007, 20, [0, 60, W, 50]);
  rain(C, 12009, 70, [0, 0, W, H]);
  sparks(C, 12011, 24);
  return C.toArt();
}

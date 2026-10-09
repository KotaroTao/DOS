import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { MUD, POOL, REED, ROTWOOD, RIM, ROT, bogFloor, reeds, reedTips, scum, slime, motes, afterimage } from "../swamp.mjs";
export const meta = { id: "bs_marshlurker", key: "hd_marshlurker", w: 96, h: 96,
  note: "沼に潜む顎: 泥水から上顎と下顎だけを大きく突き出した、鰐に似た大顎の魔。泥に覆われたこぶだらけの頭、水面すれすれに光る黄色い眼。鎧ごと急所を噛み砕く何列もの牙 (痛撃・多用)。水面の波紋と跳ね上がる泥が、飛びかかる速さを物語る (俊敏)" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#020301", "#070a05", "#0e1309", "#161d0e", "#202913", "#2c3719", "#3a4621", "#4c5a2c"], 8), spec: 0.8, pow: 24, specCol: "#6e7e46", dither: 0.5, amb: 0.22,
      shade: p => 0.12 * (Math.abs(Math.sin(p.x * 1.1) * Math.sin(p.z * 1.1 + p.y * 0.6)) - 0.4) },
    belly: { ramp: ramp(["#0c0a05", "#221d10", "#3a321c", "#544a2c", "#6e6240"], 5), dither: 0.45 },
    maw: { ramp: ["#060203", "#1e080a", "#3c1216", "#5c2024"], dither: 0.4 },
    eye: { ramp: ["#5a4a08", "#c8a820", "#fff070"], emit: () => 0.95 },
    mud: MUD, pool: POOL, reed: REED, rotwood: ROTWOOD,
  };
  // 頭: 右奥から左手前へ突き出す
  const skull = Disp(U(3, ellipsoid([66, 62, -4], [20, 11, 14], "hide", -6), ellipsoid([50, 58, 0], [12, 7, 10], "hide", -14)), (x, y, z) => 0.7 * Math.max(0, fbm(x * 0.5, y * 0.5, z * 0.5)));
  const upper = Disp(U(2, cone([50, 56, 2], [12, 42, 12], 8, 3.4, "hide"), ellipsoid([14, 42, 12], [4.6, 3.4, 4.4], "hide")), (x, y, z) => 0.5 * Math.max(0, fbm(x * 0.7, y * 0.7, z * 0.7)));
  const lower = U(2, cone([50, 70, 4], [14, 76, 14], 7, 3, "belly"), ellipsoid([16, 76, 14], [4, 2.6, 4], "belly"));
  const maw = U(1.5, cone([48, 64, 6], [14, 58, 16], 6, 1.6, "maw"));
  const brows = [ellipsoid([56, 50, 4], [4.6, 3.6, 4], "hide"), ellipsoid([58, 50, -10], [4.4, 3.4, 4], "hide")];
  const eyes = [sphere([55, 49, 7.6], 1.6, "eye"), sphere([57, 48.6, -6.4], 1.4, "eye")];
  // 背のこぶ (水面から覗く)
  const R = rand(9501);
  const bumps = [];
  for (let i = 0; i < 6; i++) bumps.push(cone([76 + i * 4, 64 - i * 0.4, -6 + R() * 6], [77 + i * 4, 58 - R() * 3, -6], 2.6, 0.6, "hide"));
  const reedList = [[86, 84, -14, 34, -3], [90, 84, -12, 28, 2], [4, 84, -14, 30, 3]];
  const scene = U(0, bogFloor(48, 92, 48, 16, { n: 1, seed: 9503, wet: 0.7, logs: 1 }), Sub(U(1.5, skull, upper, lower, ...brows), maw, 0.6), ...eyes, ...bumps, ...reeds(reedList));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.1 });
  const C = new Canvas(r);
  fangs(C, "maw", 14, 46, { step: 3, top: [3, 4], bot: [3, 4], cols: ["#5a5034", "#b0a478", "#ece2c0"], seed: 9505, lean: 0 });
  C.set(55, 48, "#fff070"); C.set(57, 48, "#fff070");
  reedTips(C, reedList);
  // 水面の波紋 (頭のまわり)
  for (let a = 0; a < Math.PI; a += 0.05) for (const rr of [30, 38]) { const x = 50 + Math.cos(a) * rr, y = 82 + Math.sin(a) * 4; if (C.get(Math.round(x), Math.round(y)) && Math.sin(a * 13) > 0.2) C.set(x, y, "#3a4c24"); }
  // 跳ね上がる泥のしぶき
  for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.1 + R() * 0.8), d = 6 + R() * 18, x = 16 + Math.cos(a) * d * 1.2, y = 80 + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#12160c", "#1a1f11", "#2c3719"][Math.floor(R() * 3)]); }
  afterimage(C, [[6, 0, 0.35, "#0e1309"]], [0, 30, 60, 50]);
  slime(C, 9507, ["maw", "belly"], 0.1, ["#1e080a", "#3c1216", "#7a9a2a"]);
  scum(C, 9509);
  motes(C, 9511, 12, [2, 2, 92, 40], true);
  return C.toArt();
}

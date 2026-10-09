import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, REED, RIM, ROT, bogFloor, reeds, reedTips, scum, motes, toxBubbles, slime } from "../swamp.mjs";
export const meta = { id: "el_bogfrogking", key: "hd_bogfrogking", w: 112, h: 128,
  note: "沼呑みの蛙王 (強敵): 小屋ほどもある大蛙の王。いぼだらけの黒緑の背に黄色の斑、白く膨れた喉袋。頭には沼に沈んだ兵の錆びた兜を潰して重ねた冠。大口から長い舌を前へ伸ばし、舌先の粘液に触れた者は痺れて動けなくなる (麻痺・多用)。半ば泥に浸かった体は、傷を負っても泥に潜ってすぐに塞ぐ (再生)。足元には呑み残しの骨" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#010201", "#050804", "#0a1007", "#11190c", "#192311", "#222f16", "#2c3c1c", "#3a4c24", "#4a5e2e"], 9), spec: 1.4, pow: 32, specCol: "#9ab060", dither: 0.5, amb: 0.22,
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    belly: { ramp: ramp(["#0e0d08", "#24221a", "#3c3a2c", "#56543f", "#727054", "#90906e"], 6), spec: 0.6, pow: 20, dither: 0.45, amb: 0.3 },
    tongue: { ramp: ramp(["#100406", "#2c0a10", "#4c141c", "#702028", "#963038", "#bc4a4c"], 6), spec: 1.4, pow: 30, specCol: "#ffb0a0", dither: 0.4 },
    rust: { ramp: ramp(["#050302", "#120806", "#24120a", "#381e10", "#4e2c18", "#663c22"], 6), spec: 0.8, pow: 22, dither: 0.5 },
    bone: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054"], 5), dither: 0.45, amb: 0.3 },
    maw: { ramp: ["#000000", "#100306", "#24080c"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: ["#4a3a04", "#a88a10", "#e8c830", "#fff4a0"], spec: 1.6, pow: 40, specCol: "#ffffff", dither: 0.3, amb: 0.5 },
    pupil: { ramp: ["#000000", "#020200"], amb: 0, dif: 0.05, noRim: true },
    mud: MUD, pool: POOL, rotwood: ROTWOOD, reed: REED,
  };
  // 体: 低く構えた大蛙。正面やや左向き
  const body = U(6, ellipsoid([62, 86, -4], [40, 26, 26], "skin"), ellipsoid([50, 66, 4], [30, 20, 22], "skin", -8));
  const head = U(4, ellipsoid([46, 58, 10], [30, 13, 20], "skin", -4), ellipsoid([34, 52, 18], [10, 8, 9], "skin"), ellipsoid([62, 50, 14], [10, 8, 9], "skin"));
  const throat = ellipsoid([44, 76, 22], [18, 10, 9], "belly", -6);
  const legsF = [U(2, tube([[30, 84, 20, 7], [20, 100, 26, 5], [16, 114, 28, 4]], "skin"), ellipsoid([14, 116, 30], [7, 2.6, 5], "skin")),
    U(2, tube([[70, 84, 18, 7], [80, 100, 24, 5], [84, 114, 26, 4]], "skin"), ellipsoid([86, 116, 28], [7, 2.6, 5], "skin"))];
  const legsB = [ellipsoid([94, 98, -6], [14, 12, 14], "skin", 20), ellipsoid([18, 98, -10], [12, 11, 12], "skin", -20)];
  // 大口と、前へ伸びる舌
  const mouth = Disp(ellipsoid([44, 64, 22], [26, 2.4, 10], "maw", -4), (x, y, z) => -0.6 * Math.abs(Math.sin(x * 0.1)));
  const tongue = U(1.5, tube([[40, 66, 26, 4], [30, 72, 32, 3.4], [16, 74, 36, 3], [6, 70, 38, 3.4]], "tongue", { seg: 4 }), ellipsoid([4, 69, 38], [5, 4.4, 4], "tongue"));
  const eyes = [sphere([34, 46, 22], 5, "eye"), sphere([62, 44, 18], 4.6, "eye")];
  const pupils = [ellipsoid([33, 46, 26.6], [3, 1.2, 1], "pupil"), ellipsoid([61, 44, 22.4], [2.8, 1.1, 1], "pupil")];
  // 潰した兜を重ねた冠
  const crown = U(0.6, torus([48, 42, 8], 9, 2.2, "rust", 0, 14), ellipsoid([44, 36, 6], [6, 4, 5], "rust", -20), ellipsoid([54, 35, 4], [5.4, 4, 5], "rust", 25), cone([49, 34, 6], [50, 22, 4], 2.2, 0.4, "rust"), cone([40, 36, 8], [34, 26, 8], 1.6, 0.3, "rust"), cone([58, 35, 4], [64, 26, 2], 1.6, 0.3, "rust"));
  // いぼ
  const R = rand(11201);
  const warts = [];
  for (let i = 0; i < 26; i++) { const x = 20 + R() * 84, y = 52 + R() * 50, z = 8 + R() * 18; warts.push(sphere([x, y, z], 1.2 + R() * 1.6, "skin")); }
  const bones = [ellipsoid([100, 118, 16], [4, 3.6, 3.4], "bone", 20), tube([[60, 120, 22, 1.4], [74, 118, 24, 1.2]], "bone"), tube([[28, 122, 24, 1.2], [38, 120, 26, 1]], "bone")];
  const reedList = [[100, 112, -12, 50, -4], [106, 112, -14, 40, 3], [6, 110, -14, 46, 4]];
  const frog = Sub(Disp(U(3, body, head, throat, ...legsF, ...legsB, ...warts), (x, y, z) => 0.5 * Math.max(0, fbm(x * 0.4, y * 0.4, z * 0.4))), mouth, 0.6);
  const scene = U(0, bogFloor(56, 124, 54, 18, { n: 1, seed: 11203, wet: 0.5, logs: 1 }), frog, tongue, ...eyes, ...pupils, crown, ...bones, ...reeds(reedList));
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [10, 66, 44], r: 24, k: 0.25 }] });
  const C = new Canvas(r);
  reedTips(C, reedList);
  // 背の黄色の斑
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = C.pix[y * W + x]; if (p && p.m === "skin" && p.ny < 0.2 && vnoise(p.x * 0.18, p.y * 0.18, p.z * 0.18 + 7) > 0.45) C.set(x, y, p.sh > 0.5 ? "#6a6a1e" : "#3e3e12"); }
  // 舌先の痺れの粘液 (糸を引いて垂れ、黄緑の火花)
  for (const [x, l] of [[2, 10], [6, 7], [9, 5]]) for (let k = 0; k < l; k++) if (!C.get(x, 74 + k)) C.set(x, 74 + k, k === l - 1 ? ROT[5] : ROT[2]);
  for (const [x, y] of [[0, 62], [10, 60], [14, 64], [1, 78]]) { C.set(x, y, ROT[4]); C.set(x + 1, y - 1, ROT[3]); }
  slime(C, 11205, ["skin", "belly"], 0.06, ["#0a1007", "#192311", "#3a4c24"]);
  toxBubbles(C, 11207, 20, [4, 104, W - 8, 16]);
  scum(C, 11209);
  motes(C, 11211, 30, [2, 2, W - 4, 60], true);
  return C.toArt();
}

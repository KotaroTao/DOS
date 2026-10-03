import { tube, sphere, ellipsoid, cone, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, RIM, flagstones, tri } from "../fort.mjs";
export const meta = { id: "bs_bloodwraith", key: "hd_bloodwraith", w: 96, h: 96,
  note: "血霊: 落城の夜に流された大量の血から生まれた亡霊。凝りかけた血でできた濡れて照る深紅の人影が背を丸めて鉤爪の両手を広げ、下半身は血の柱となって流れ落ちる。指先と体から滴る血が足元の石畳に血溜まりをつくる" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    blood: { ramp: ramp(["#050102", "#0f0204", "#1c0307", "#2a050b", "#3c0810", "#500c16", "#66121c", "#7e1a22", "#98262a"], 9), spec: 2.6, pow: 50, specCol: "#e89090", dither: 0.5, amb: 0.2, dif: 0.85,
      shade: p => 0.12 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) + 0.1 * Math.max(0, p.nz - 0.6) },
    clot: { ramp: ramp(["#030101", "#0c0405", "#180809", "#281010", "#3c1a16", "#583026", "#7a4c3e"], 7), spec: 1.6, pow: 35, specCol: "#c8948a", dither: 0.6, rimCol: "#4a2a2e",
      shade: p => 0.15 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    pool: { ramp: ramp(["#050102", "#120205", "#22040a", "#36060f", "#4e0b15", "#681420"], 6), spec: 3, pow: 40, specCol: "#d87070", dither: 0.4, amb: 0.35, noRim: true },
    eye: { ramp: ["#4a0606", "#a01a10", "#ff6a3a", "#ffd0a0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#030101"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE,
  };
  // 背を丸めた上体と低く突き出た頭
  const head = ellipsoid([48, 27, 7], [6.4, 7, 6], "blood", 0);
  const jaw = ellipsoid([48, 33.5, 8], [4, 3, 4], "blood");
  const torso = ellipsoid([48, 42, -1], [13, 11, 8], "blood");
  const chest = ellipsoid([48, 38, 2], [10, 6.5, 5.5], "blood");
  const humps = [ellipsoid([37, 30, -1], [7, 5.5, 6], "blood", 20), ellipsoid([59, 30, -1], [7, 5.5, 6], "blood", -20)];
  // 腰から下は血の柱となって流れ落ち、床の血溜まりへつながる
  const column = [];
  for (let i = 0; i < 5; i++) { const t = i / 4; column.push(sphere([48 + Math.sin(t * 4) * 1.2, 50 + t * 12, Math.cos(t * 3) * 1.2], 9.5 - t * 3, "blood")); }
  // 流れ落ちる血の筋 (隙間から奥の石畳が透ける)
  const streams = [];
  for (const [x0, x1, z0, r0] of [[42, 34, 1, 3.2], [46, 44, 4, 3.6], [51, 54, 3, 3.4], [55, 63, 0, 3], [48, 49, -3, 2.8]]) {
    streams.push(tube([[x0, 58, z0, r0], [(x0 * 2 + x1) / 3 + 1, 70, z0 + 1, r0 * 0.7], [(x0 + x1 * 2) / 3 - 1, 80, z0 + 1.5, r0 * 0.55], [x1, 88, z0 + 2, r0 * 0.9]], "blood", { seg: 4 }));
  }
  // 腕: 肩から大きく広げ、鉤爪を下へ曲げる
  const armL = tube([[36, 31, 1, 4.2], [24, 36, 4, 3.2], [19, 48, 8, 2.4]], "blood");
  const armR = tube([[60, 31, 1, 4.2], [72, 36, 4, 3.2], [77, 48, 8, 2.4]], "blood");
  const hands = [ellipsoid([18.5, 51, 8.6], [3.2, 3.4, 2.6], "blood"), ellipsoid([77.5, 51, 8.6], [3.2, 3.4, 2.6], "blood")];
  const claws = [];
  const clawTube = (x, y, z, dx, sgn) => tube([[x, y, z, 1.1], [x + dx * 0.8, y + 4, z + 1, 0.85], [x + dx * 0.9 - sgn * 0.6, y + 8.5, z + 1.6, 0.55], [x + dx * 0.9 + sgn * 1.8, y + 12, z + 1.8, 0.2]], "clot", { seg: 3 });
  for (const [dx, k] of [[-4.2, -1], [-1.5, -0.4], [1.2, 0.4], [3.8, 1]]) {
    claws.push(clawTube(18.5 + dx * 0.6, 53, 9 - Math.abs(dx) * 0.3, dx * 0.9, 1));
    claws.push(clawTube(77.5 + dx * 0.6, 53, 9 - Math.abs(dx) * 0.3, dx * 0.9, -1));
  }
  // 凝った血の塊 (表面の瘤)
  const clots = [];
  const R = rand(471);
  for (let i = 0; i < 7; i++) { const a = R() * 6.28, y = 34 + R() * 20; clots.push(sphere([48 + Math.cos(a) * 10 * (1 - (y - 32) / 40), y, Math.sin(a) * 6 + 2], 1.2 + R() * 1.4, "clot")); }
  const body = Disp(U(3, head, jaw, torso, chest, ...humps, ...column, ...streams, armL, armR, ...hands), (x, y, z) => 0.45 * fbm(x * 0.22, y * 0.18, z * 0.22) + 0.35 * Math.sin(y * 0.9 + x * 0.2) * Math.max(0, (y - 52) / 30));
  const face = Sub(body, U(0, ellipsoid([45.2, 26.6, 12.4], [1.8, 2.2, 2.4], "hole", 15), ellipsoid([50.8, 26.6, 12.4], [1.8, 2.2, 2.4], "hole", -15), ellipsoid([48, 33.6, 11.6], [2.2, 2.8, 2.4], "hole")), 0.5);
  const eyes = [sphere([45.4, 27, 10.6], 1.1, "eye"), sphere([50.6, 27, 10.6], 1.1, "eye")];
  // 床の血溜まり (石畳の上に平たく広がる)
  const scene = U(0, flagstones(48, 92, 42, 13, { n: 4, seed: 473, big: 3 }), face, ...eyes, ...claws, ...clots);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.15, lights: [{ p: [48, 24, 16], r: 12, k: 0.3 }] });
  const C = new Canvas(r);
  // 半透明: 血の柱の中ほどと腕の外側が透けかける
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "blood") continue;
    const edge = Math.max(0, (y - 62) / 18) * 0.5;
    const a = 1.1 - edge + 0.8 * fbm(x * 0.4, y * 0.05, 3);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16 * 0.5 + 0.2) C.set(x, y, null);
  }
  // 血溜まり: 石畳の上面を濡れた深紅で塗る (縁はぎざぎざ、照りの筋)
  const P = mats.pool.ramp;
  for (let y = 84; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "flag") continue;
    const e = ((x - 48) / 32) ** 2 + ((y - 89.4) / 3.2) ** 2 + 0.35 * fbm(x * 0.25, y * 0.5, 11);
    if (e > 1) continue;
    let k = 2 + Math.floor((1 - e) * 3 + (BAYER[y & 3][x & 3] / 16) * 0.8);
    if (y <= 88 && Math.abs(x - 40 - (y - 87) * 3) < 4 && e < 0.7) k = 5;
    C.set(x, y, P[Math.min(P.length - 1, k)]);
  }
  // 鉤爪の先: 硬く凝った先端を明るく
  for (let y = 58; y < 70; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "clot" || C.get(x, y + 1)) continue;
    C.set(x, y, "#a87264"); if (C.get(x, y - 1)) C.set(x, y - 1, "#7a4c3e");
  }
  C.set(45, 26, "#ffd0a0"); C.set(50, 26, "#ffd0a0");
  // 滴: 爪先と腕から床へ落ちる血の筋と粒
  const Dr = ["#3a060e", "#6c0f1a", "#a4242c", "#e07070"];
  const drip = (x, y0, y1, gap = 0) => {
    for (let y = y0; y <= y1; y++) {
      if (gap && y > y0 + 3 && ((y - y0) % gap) < gap - 2) continue;
      if (!C.get(x, y)) { C.set(x, y, y === y0 ? Dr[1] : Dr[2]); if (!C.get(x + 1, y) && (y - y0) % 3 === 0) C.set(x + 1, y, Dr[0]); }
    }
    C.set(x, y1 + 1, Dr[3]);
  };
  drip(17, 66, 72); drip(20, 67, 80, 5); drip(14, 68, 86, 6);
  drip(79, 66, 73); drip(76, 67, 81, 5); drip(82, 68, 86, 6);
  drip(30, 42, 52, 4); drip(66, 42, 54, 4); drip(44, 37, 41); drip(53, 38, 44);
  // 血溜まりへ落ちた滴の波紋
  for (const [x, y] of [[20, 89], [76, 89], [14, 90], [82, 90]]) { C.only(x - 2, y, "#a4242c"); C.only(x + 2, y, "#a4242c"); C.only(x - 1, y - 1 + 0, "#6c0f1a"); C.only(x + 1, y - 1 + 0, "#6c0f1a"); }
  return C.toArt();
}

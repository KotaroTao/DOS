import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, towerFloor, bolt2d, crackle, sparks, rain, spikes } from "../storm.mjs";
export const meta = { id: "bs_thunderbeast", key: "hd_thunderbeast", w: 96, h: 96,
  note: "雷牙の獣: 塔の踊り場に身を低くして構える、黒い豹に似た大きな獣。逆立ったたてがみは稲妻そのもので、ばちばちと青白く鳴る。牙のあいだにも雷が走り、飛びかかって鎧の継ぎ目の急所をひと噛みで食い破る (痛撃・多用)。傷を負うとたてがみの雷がふくれ上がり、見境なく暴れ回る (激昂)" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#020205", "#06060c", "#0d0c16", "#151422", "#1f1d30", "#2a2840", "#383552", "#4a4668"], 8), dither: 0.55, amb: 0.22, spec: 0.6, pow: 24, specCol: "#8890c8",
      shade: p => 0.08 * Math.sin(p.x * 1.2 + p.y * 2 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    mane: { ramp: BOLT, noRim: true, emit: p => 0.35 + 0.55 * Math.max(0, p.nz) },
    claw: { ramp: ramp(["#0a0a0e", "#24242e", "#46465a", "#7a7a94"], 4), spec: 1, pow: 30 },
    maw: { ramp: ["#000000", "#0a0a20", "#1c2458"], dither: 0.3 },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  // 身を低くした豹の体 (頭は左)
  const chest = ellipsoid([36, 62, 4], [13, 12, 11], "hide", 10);
  const barrel = ellipsoid([58, 60, -2], [18, 10, 10], "hide", -6);
  const haunch = ellipsoid([76, 58, -2], [10, 12, 10], "hide", 10);
  const head = ellipsoid([20, 62, 8], [9, 7.4, 8], "hide", 10);
  const snout = ellipsoid([10, 66, 10], [6, 4, 5], "hide", 15);
  const jaw = ellipsoid([12, 72, 9], [6, 2.4, 4.4], "hide", 20);
  const mouth = ellipsoid([9, 69, 13], [5, 2.2, 3], "maw", 18);
  const ears = [cone([22, 56, 4], [26, 46, 2], 2.4, 0.3, "hide"), cone([18, 56, 12], [18, 47, 13], 2.2, 0.3, "hide")];
  const legs = [
    tube([[30, 70, 10, 4.4], [24, 80, 12, 3.4], [18, 89, 13, 2.8]], "hide", { seg: 3 }), tube([[38, 70, -6, 4], [40, 80, -6, 3.2], [36, 89, -6, 2.6]], "hide", { seg: 3 }),
    tube([[74, 66, 6, 5.4], [82, 76, 7, 3.4], [80, 89, 7, 2.8]], "hide", { seg: 3 }), tube([[78, 66, -8, 4.6], [86, 76, -8, 3], [86, 89, -8, 2.6]], "hide", { seg: 3 }),
  ];
  const tail = tube([[84, 54, -4, 2.4], [92, 46, -6, 1.8], [90, 36, -6, 1.4], [94, 30, -6, 1]], "hide", { seg: 3 });
  const claws = [];
  for (const [x, z] of [[18, 13], [36, -6], [80, 7]]) for (const d of [-2, 0, 2]) claws.push(cone([x + d, 89, z], [x + d - 2, 91, z + 2], 0.7, 0.2, "claw"));
  // 稲妻のたてがみ (首から背へ、逆立つ)
  const R = rand(10901);
  const mane = [];
  for (let i = 0; i < 14; i++) { const x = 18 + i * 3, y = 54 - Math.sin(i / 13 * Math.PI) * 2 + (i > 6 ? (i - 6) * 0.6 : 0); mane.push([[x, y + 4, 0], [x + 4 + R() * 3, y - 6 - R() * (i < 8 ? 9 : 4), -2], 1.4, 0.2]); }
  const eyes = [sphere([15, 59, 14.6], 1.1, "eye")];
  const beast = Sub(U(2.4, chest, barrel, haunch, head, snout, jaw, ...ears, ...legs, tail), mouth, 0.4);
  const scene = U(0, towerFloor(50, 95, 46, 13, { n: 2, seed: 10903, wet: 0.2 }), beast, ...spikes(mane, "mane"), ...claws, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [40, 40, 20], r: 26, k: 0.45 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 5, 13, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#4a4e60", "#b4bcd4", "#f0f4ff"], seed: 10905 });
  // たてがみの先から跳ねる稲妻
  for (const [x0, y0, x1, y1, s] of [[30, 40, 26, 22, 1], [44, 44, 50, 26, 2], [56, 48, 66, 34, 3]]) bolt2d(C, x0, y0, x1, y1, { seed: s, jag: 2.2, branch: 1 });
  // 牙のあいだを走る雷
  bolt2d(C, 6, 70, 0, 80, { seed: 7, jag: 1.2, branch: 0 });
  crackle(C, 10907, ["hide"], 0.015);
  rain(C, 10909, 40);
  sparks(C, 10911, 18, [4, 20, 88, 40]);
  return C.toArt();
}

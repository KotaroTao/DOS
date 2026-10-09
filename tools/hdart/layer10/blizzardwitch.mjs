import { sphere, ellipsoid, cone, tube, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { RIM, BOLT, CLOUD, SOULS, bolt2d, crackle, sparks, rain, clouds, windStreaks, dissolve } from "../storm.mjs";
export const meta = { id: "el_blizzardwitch", key: "hd_blizzardwitch", w: 112, h: 128,
  note: "雷雲の魔女 (強敵): 腰から下が雷雲に溶けた、背の高い魔女の霊。雲のように広がる長い灰色の髪、つばの垂れた古い魔女帽、ぼろぼろの黒い衣。先が鉤に曲がった鉄の杖を掲げると、鉤に稲妻が落ちて青白い雷の玉がいくつも生まれ、まわりを回りはじめる (招来)。指さした先へ雷を走らせ、撃たれた者を痺れさせ続ける (麻痺・多用)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    robe: { ramp: ramp(["#030206", "#08060e", "#100c18", "#191324", "#231b32", "#302542", "#3e3054"], 7), dither: 0.6, amb: 0.24,
      shade: p => 0.12 * Math.sin(p.x * 1.1 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    skin: { ramp: ramp(["#0a0a0e", "#1a1a22", "#2c2c38", "#424250", "#5c5c6c", "#7a7a8c", "#9a9aac"], 7), dither: 0.45, amb: 0.3 },
    hair: { ramp: ramp(["#06060a", "#101018", "#1c1c28", "#2a2a3a", "#3a3a4e", "#4e4e64", "#66667e"], 7), dither: 0.6, amb: 0.3,
      shade: p => 0.12 * Math.sin(p.y * 1.4 + p.x * 0.3) },
    cloud: { ramp: ramp(["#04040a", "#0a0a16", "#121224", "#1c1c34", "#282846", "#36365a", "#48486e"], 7), dither: 0.8, amb: 0.36, noRim: true,
      shade: p => 0.14 * fbm(p.x * 0.15, p.y * 0.15, p.z * 0.15) },
    iron: { ramp: ramp(["#030304", "#09090c", "#131318", "#1f1f27", "#2e2e3a", "#42424f"], 6), spec: 1.4, pow: 40, specCol: "#c8d0f0", dither: 0.45 },
    hole: { ramp: ["#000000", "#010103"], amb: 0, dif: 0.05, noRim: true },
    orb: { ramp: [SOULS[1], BOLT[1], BOLT[2], BOLT[3], BOLT[4]], noRim: true, emit: p => 0.15 + 0.85 * Math.max(0, p.nz) ** 1.4 },
    eye: { ramp: [BOLT[3], BOLT[4], "#ffffff"], emit: () => 0.95 },
  };
  const J = { head: [52, 34, 2], neck: [52, 41, 1], chest: [52, 52, 0], waist: [52, 66, 0], hip: [52, 74, 0],
    shL: [44, 46, 4], elL: [34, 56, 8], haL: [22, 60, 12], shR: [60, 46, -2], elR: [70, 36, 0], haR: [78, 24, 2] };
  const body = humanoid(J, { skin: "robe", head: "skin" }, { w: { headX: 4.6, headY: 5.8, chestX: 8.4, chestY: 8, chestZ: 6, waistX: 6.4, waistY: 7, hipX: 8, arm: 2.4, arm2: 2, wrist: 1.4 } });
  const skirt = Disp(cone([52, 104, 0], [52, 64, 0], 18, 8, "robe"), (x, y, z) => 0.8 * Math.abs(Math.sin(x * 0.7 + y * 0.1)) + 0.6 * fbm(x * 0.3, y * 0.3));
  // つばの垂れた魔女帽
  const hat = U(0.8, Disp(ellipsoid([52, 30, 0], [15, 2, 13], "robe", -8), (x, y, z) => 0.6 * fbm(x * 0.4, z * 0.4) + Math.max(0, Math.abs(x - 52) - 10) * 0.25),
    tube([[52, 29, -1, 6], [54, 20, -2, 4.4], [60, 12, -4, 2.6], [70, 10, -6, 1.2], [74, 14, -6, 0.6]], "robe", { seg: 3 }));
  const face = ellipsoid([51, 36, 4.6], [3.8, 4.8, 3], "skin");
  const sockets = U(0, ellipsoid([49.4, 35, 7.2], [1.1, 1, 0.8], "hole"), ellipsoid([52.8, 35, 7.2], [1.1, 1, 0.8], "hole"), ellipsoid([51, 39.6, 7], [1.4, 0.8, 0.8], "hole"));
  // 雲のように広がる長い髪 (両脇へ流れる)
  const hair = Disp(U(2, tube([[46, 32, 0, 4], [38, 44, -2, 5], [30, 60, -4, 5], [22, 76, -6, 3], [16, 88, -6, 1.4]], "hair", { seg: 4 }),
    tube([[58, 32, 0, 4], [66, 44, -2, 5], [74, 58, -4, 5], [84, 70, -6, 3], [92, 78, -6, 1.4]], "hair", { seg: 4 })), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2, z * 0.2));
  // 指さす手と、掲げた鉤の杖
  const point = fingers([22, 60, 12], 170, "skin", { n: 3, len: 6, spread: 10, r: 0.7, curl: 0.1 });
  const staff = cyl([80, 112, 2], [76, 14, 2], 1.4, "iron", 0.4);
  const crook = tube([[76, 14, 2, 1.4], [76, 6, 2, 1.2], [82, 2, 2, 1], [88, 6, 2, 0.9], [86, 12, 2, 0.6]], "iron", { seg: 3 });
  const grip = U(0.6, ...fingers([78, 24, 4], 180, "skin", { n: 4, len: 4, spread: 12, r: 0.7, curl: 0.8 }));
  // 腰から下の雷雲
  const cloud = Disp(U(5, ellipsoid([52, 106, 0], [34, 12, 18], "cloud"), ellipsoid([30, 112, -4], [16, 9, 12], "cloud"), ellipsoid([76, 110, -4], [18, 10, 12], "cloud"), ellipsoid([52, 120, 0], [26, 6, 14], "cloud")),
    (x, y, z) => 2 * fbm(x * 0.14, y * 0.14, z * 0.14));
  // 回る雷の玉
  const orbs = [[16, 30, 5], [96, 40, 5.4], [26, 92, 4.4], [98, 96, 4], [40, 14, 3.6]];
  const eyes = [sphere([49.4, 35, 6.8], 0.7, "eye"), sphere([52.8, 35, 6.8], 0.7, "eye")];
  const scene = U(0, hair, Sub(U(1.4, body, skirt), sockets, 0.2), Sub(face, sockets, 0.2), hat, ...point, staff, crook, grip, cloud, ...orbs.map(([x, y, r]) => sphere([x, y, 6], r, "orb")), ...eyes);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [84, 6, 18], r: 26, k: 0.5 }, { p: [20, 60, 22], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 鉤に落ちる稲妻と、指先から走る雷
  bolt2d(C, 82, 0, 84, 6, { seed: 1, jag: 1, branch: 0, all: true });
  bolt2d(C, 104, 0, 87, 7, { seed: 2, jag: 2, branch: 1 });
  bolt2d(C, 16, 60, 0, 78, { seed: 3, jag: 2.4, branch: 2 });
  // 雷の玉どうしを結ぶ弧
  for (const [a, b, s] of [[0, 4, 5], [1, 3, 6]]) bolt2d(C, orbs[a][0], orbs[a][1], orbs[b][0], orbs[b][1], { seed: s, jag: 3, branch: 0, glow: false, cols: [BOLT[0], BOLT[0], BOLT[1], BOLT[2], BOLT[2]] });
  for (const [x, y, rr] of orbs) for (let a = 0; a < Math.PI * 2; a += 0.2) { const X = Math.round(x + Math.cos(a) * (rr + 2)), Y = Math.round(y + Math.sin(a) * (rr + 2)); if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, BOLT[0]); }
  crackle(C, 12103, ["cloud", "iron"], 0.02);
  clouds(C, [[56, 4, 40, 5]], { dens: 0.6, seed: 22 });
  windStreaks(C, 12105, 16, [0, 40, W, 60]);
  rain(C, 12107, 60, [0, 0, W, H]);
  sparks(C, 12109, 18);
  return C.toArt();
}

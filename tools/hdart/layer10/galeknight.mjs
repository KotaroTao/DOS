import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, SOULS, towerFloor, chain, bolt2d, crackle, sparks, rain, windStreaks, wetGlint } from "../storm.mjs";
export const meta = { id: "bs_galeknight", key: "hd_galeknight", w: 96, h: 96,
  note: "烈風の騎士: 塔の螺旋階段の途中で倒れた騎士の鎧に、吹き上げる風が入りこんで動かしているもの。へこんだ全身鎧の継ぎ目から風が鳴り、兜の覗き穴の奥に青白い魂の光。ちぎれた外套が横へなびく。両手で振りかぶった重い戦槌で、鎧ごと守りを叩き割る (守り崩し・多用)。風の渦が継ぎ目を覆い、刃を半ば逸らす (物理抵抗50)" };
export function build() {
  const mats = {
    steel: { ramp: ramp(["#030305", "#09090e", "#121219", "#1d1d27", "#2a2a37", "#3a3a4a", "#4e4e62", "#68687e"], 8), spec: 1.2, pow: 30, specCol: "#c4c8e8", dither: 0.45,
      shade: p => 0.07 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) - (fbm(p.x * 0.3 + 4, p.y * 0.3, p.z * 0.3) > 0.3 ? 0.12 : 0) },
    cloak: { ramp: ramp(["#050208", "#0e0610", "#180a1a", "#241026", "#321634"], 5), dither: 0.6 },
    trim: { ramp: ramp(["#0e0a04", "#2a200c", "#4e3e1a", "#7a6430", "#a48c50"], 5), spec: 1, pow: 26, dither: 0.4 },
    hole: { ramp: ["#000000", "#010103"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  const J = { head: [46, 30, 2], neck: [46, 37, 1], chest: [46, 47, 0], waist: [46, 59, 0], hip: [46, 66, 0],
    shL: [36, 42, 4], elL: [32, 30, 8], haL: [38, 20, 10], shR: [56, 42, -2], elR: [60, 30, 2], haR: [46, 19, 6],
    hpL: [40, 68, 2], knL: [34, 78, 6], ftL: [30, 90, 6], hpR: [52, 68, -2], knR: [58, 78, 0], ftR: [62, 90, -2] };
  const body = humanoid(J, { skin: "steel" }, { w: { headX: 5.4, headY: 6.4, chestX: 11, chestY: 9, chestZ: 7, waistX: 8, hipX: 9.5, arm: 3.4, arm2: 3, wrist: 2.4, thigh: 4, knee: 3.4, ankle: 2.8 } });
  const pauldrons = [ellipsoid([35, 40, 4], [6.4, 4.6, 6], "steel", -30), ellipsoid([57, 40, -2], [6.4, 4.6, 6], "steel", 30)];
  const helm = U(1, ellipsoid([46, 29, 2], [6.2, 7.4, 6.4], "steel"), box([46, 24, 2], [6.6, 1, 6], "steel", 0.4), cone([46, 23, 0], [52, 12, -4], 1.6, 0.3, "steel"));
  const visor = box([46, 30, 8], [4, 0.8, 1.6], "hole");
  const eyes = [sphere([44, 30, 7.4], 0.9, "eye"), sphere([48, 30, 7.4], 0.9, "eye")];
  const belt = torus([46, 60, 0], 8.4, 1.2, "trim", 0, 10);
  const tassets = [box([41, 68, 5], [4, 5, 1.4], "steel", 0.6, 8), box([51, 68, 4], [4, 5, 1.4], "steel", 0.6, -8)];
  // 横へなびくちぎれた外套
  const cloak = Disp(slab([[38, 40], [56, 40], [76, 48], [94, 50], [88, 58], [96, 64], [80, 68], [72, 82], [52, 80], [40, 72]], -9, 1, "cloak", 0.6),
    (x, y, z) => 1 * Math.sin(y * 0.6 + fbm(x * 0.2, y * 0.2) * 2) * Math.max(0, (x - 50) / 40));
  // 頭上へ振りかぶった戦槌 (柄は左上から右下、頭は左上)
  const haft = cyl([44, 20, 8], [18, 4, 12], 1.3, "iron");
  const hammer = U(0.4, box([16, 4, 12], [6, 4, 4], "iron", 0.8, -32), cone([10, 8, 12], [4, 12, 12], 2.6, 0.4, "iron"));
  const handGuard = torus([42, 19, 8], 2, 0.8, "trim", -32, 90);
  // 手すりの鎖の残骸 (左の床へ垂れる)
  const links = chain([2, 72, -10], [16, 92, -6], 1.5);
  const scene = U(0, towerFloor(48, 95, 42, 13, { n: 2, seed: 10201, wet: 0.15 }), cloak, Sub(U(1.2, body, helm, ...pauldrons), visor, 0.3), ...eyes, belt, ...tassets, haft, hammer, handGuard, ...links);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [14, 8, 26], r: 22, k: 0.35 }] });
  const C = new Canvas(r);
  // 継ぎ目を覆う風の渦 (鎧のまわりに弧)
  for (const [cx, cy, rr, a0, a1] of [[46, 50, 16, 2.6, 4.2], [46, 50, 18, -0.9, 0.7], [46, 72, 14, 2.4, 3.9], [46, 72, 15, -0.6, 0.6]]) for (let a = a0; a < a1; a += 0.04) {
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6;
    if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 17) > -0.6) C.set(x, y, Math.sin(a * 5) > 0.5 ? "#4a5278" : "#2c3250");
  }
  // 槌の頭に跳ねる稲光
  crackle(C, 10203, ["iron"], 0.03);
  wetGlint(C, 10205, ["steel"], 0.04);
  windStreaks(C, 10207, 18, [0, 30, 96, 50]);
  rain(C, 10209, 40);
  sparks(C, 10211, 8, [0, 0, 40, 30]);
  return C.toArt();
}

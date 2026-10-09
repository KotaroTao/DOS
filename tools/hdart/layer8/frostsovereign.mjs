import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, hoarfrost, glints, snowfall, afterimage, dissolve } from "../ice.mjs";
export const meta = { id: "el_frostsovereign", key: "hd_frostsovereign", w: 112, h: 128,
  note: "凍王の影 (名のある強敵): 凍王が三百年の間に切り離した己の影。黒に近い藍の影が鎧と外套の形をとり、頭には本体と同じ氷の棘の冠だけが白く浮かぶ。顔のない兜の奥に二つの青白い眼。長い氷の剣を低く構えて踏み込み、目にも止まらぬ速さで二度斬りつけ (神速)、斬られた者は芯から凍えて動けなくなる (麻痺)。足元は床の影につながったまま、体の後ろに影の残像がいくつも尾を引く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    shade: { ramp: ramp(["#010103", "#040510", "#08091a", "#0e1026", "#161834", "#202444", "#2c3256"], 7), dither: 0.6, spec: 0.8, pow: 26, specCol: "#4a5a8a", amb: 0.2,
      shade: p => 0.06 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    cloak: { ramp: ramp(["#010103", "#03040c", "#070816", "#0c0e22", "#13162e"], 5), dither: 0.65 },
    blade: { ramp: ramp(["#06101c", "#123050", "#24507a", "#3e78a4", "#6aa4c8", "#b4dcf0", "#e8f6ff"], 7), spec: 1.8, pow: 50, specCol: "#ffffff", dither: 0.35 },
    crown: { ramp: ramp(["#1e3046", "#3e5a78", "#7a9cb8", "#bcd8ec", "#f0faff"], 5), spec: 1.4, pow: 40, specCol: "#ffffff", dither: 0.4, amb: 0.4 },
    hole: { ramp: ["#000000", "#000000"], amb: 0, dif: 0, noRim: true },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  // 踏み込む姿勢: 体を低く、左足を前へ、剣は右下から左上へ斬り上げる構え
  const J = { head: [58, 30, 2], neck: [58, 37, 1], chest: [58, 50, 0], waist: [60, 64, 0], hip: [60, 72, 0],
    shL: [46, 44, 4], elL: [36, 56, 10], haL: [30, 66, 14], shR: [70, 44, -2], elR: [74, 58, 6], haR: [64, 68, 14],
    hpL: [54, 74, 4], knL: [40, 88, 10], ftL: [30, 110, 10], hpR: [66, 74, -2], knR: [78, 92, -2], ftR: [88, 112, -4] };
  const body = humanoid(J, { skin: "shade" }, { w: { headX: 6.4, headY: 7.4, headZ: 6.6, chestX: 14, chestY: 11, chestZ: 8, waistX: 10, hipX: 11.5, arm: 4.4, arm2: 3.8, wrist: 3, thigh: 5.4, knee: 4.6, ankle: 3.6 } });
  const pauld = [ellipsoid([45, 42, 4], [7.4, 5, 7], "shade", -20), ellipsoid([71, 42, -2], [7.4, 5, 7], "shade", 20)];
  const visor = box([58, 31, 8.2], [4.6, 0.9, 1.4], "hole");
  const eyes = [sphere([55.6, 31, 7.6], 1, "eye"), sphere([60.4, 31, 7.6], 1, "eye")];
  // 氷の棘の冠
  const crown = [torus([58, 24, 2], 6.4, 1, "crown", 0, 10)];
  for (let i = 0; i < 7; i++) { const a = -2.7 + i * 0.4, x = 58 + Math.cos(a) * 6.4, y = 23.6 + Math.sin(a) * 1.2; crown.push(cone([x, y, 2 + Math.sin(a + 1.57) * 6.4], [x + Math.cos(a) * 2, y - 6 - (i === 3 ? 6 : i % 2 ? 1 : 3), 2], 1.3, 0.2, "crown")); }
  // 後ろへひるがえる影の外套
  const cloak = Disp(slab([[50, 40], [68, 40], [100, 60], [110, 92], [92, 100], [76, 80], [56, 76]], -10, 1.2, "cloak", 0.6), (x, y, z) => 1.2 * Math.sin(x * 0.4 + fbm(x * 0.1, y * 0.1) * 2) * Math.max(0, (x - 60) / 50));
  // 両手で握った長い氷の剣 (左上へ斬り上げる)
  const grip = cyl([28, 70, 15], [38, 66, 15], 1.3, "shade");
  const guard = box([27, 71, 15], [1.2, 5.4, 1.4], "crown", 0.4, 22);
  const blade = Disp(cone([25, 71, 15], [4, 18, 18], 3, 0.3, "blade"), (x, y, z) => -0.2 * Math.abs(Math.sin(y * 0.5)));
  const hands = [ellipsoid([31, 68, 15], [3, 2.6, 2.6], "shade"), ellipsoid([37, 66, 15], [3, 2.6, 2.6], "shade")];
  const scene = U(0, iceFloor(58, 122, 52, 16, { n: 3, seed: 10201, snow: 0.05 }), cloak, Sub(U(1.4, body, ...pauld), visor, 0.3), ...eyes, ...crown, grip, guard, blade, ...hands);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, rimTh: 0.15, lights: [{ p: [12, 40, 24], r: 30, k: 0.3 }] });
  const C = new Canvas(r);
  C.set(55, 30, SOUL[4]); C.set(60, 30, SOUL[4]);
  // 剣の刃の冷たい筋と、斬撃の軌跡 (2度)
  for (const [x0, y0, x1, y1, c] of [[2, 98, 46, 8, "#3e78a4"], [8, 108, 54, 16, "#24507a"]]) for (let t = 0; t <= 1; t += 0.01) { const x = x0 + (x1 - x0) * t + Math.sin(t * 3.14) * -14, y = y0 + (y1 - y0) * t; if (!C.get(Math.round(x), Math.round(y)) && t > 0.1 && t < 0.92) C.set(x, y, c); }
  // 足元は床に落ちた影につながる
  for (let y = 112; y < 124; y++) for (let x = 20; x < 100; x++) { const p = C.pix[y * W + x]; if (p && (p.m === "shelf" || p.m === "snow") && Math.abs(x - 60) < 34 - (y - 112) * 0.6 + 6 * fbm(x * 0.2, y * 0.3)) C.set(x, y, (x + y) % 2 ? "#04050e" : "#08091a"); }
  afterimage(C, [[10, -1, 0.42, "#141a34"], [20, -2, 0.26, "#0e1226"], [30, -3, 0.14, "#0a0c1c"]], [0, 0, W, 110]);
  hoarfrost(C, ["shade"], { th: 0.5, seed: 41, cols: ["#1e2440", "#2e3a5c", "#4a5a80"] });
  glints(C, 10203, ["blade", "crown"], 6);
  snowfall(C, 10205, 40);
  return C.toArt();
}

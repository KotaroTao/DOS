import { sphere, ellipsoid, cone, tube, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_frozenexplorer", key: "hd_frozenexplorer", w: 96, h: 96,
  note: "凍てつく先人: 王家の地下牢に入れられた操霊師が、氷漬けのまま半ば動き出したもの。王家の紋の入った長い法衣は霜で固まり、体の右半分はまだ厚い氷に閉じ込められている。動く方の腕を前へ伸ばして宿した魂を奪おうとし、手首には牢の千切れた枷と鎖。顔は霜に覆われ、凍った眼の奥だけが青白く光る" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#030407", "#0a0d14", "#131a24", "#1e2836", "#2a384a", "#3a4c60"], 6), dither: 0.6, amb: 0.2,
      shade: p => 0.12 * Math.sin(p.x * 1.1 + 1.8 * fbm(p.x * 0.15, p.y * 0.08)) },
    trim: { ramp: ramp(["#100c06", "#2e2410", "#544420", "#806a38", "#a8925a"], 5), spec: 1, pow: 26, dither: 0.4 },
    skin: { ramp: ramp(["#080a0e", "#1a2028", "#303a46", "#4a5866", "#687a8a", "#8c9eac", "#b0c0cc"], 7), dither: 0.5, amb: 0.3 },
    iron: { ramp: ramp(["#030303", "#0e0f12", "#1e2026", "#32363e", "#4c525c"], 5), spec: 1, pow: 28, specCol: "#a8b0c0", dither: 0.4 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  const J = { head: [44, 26, 4], neck: [44, 33, 1], chest: [46, 42, 0], waist: [46, 56, 0], hip: [46, 64, 0],
    shL: [36, 38, 2], elL: [26, 44, 8], haL: [14, 46, 12], shR: [56, 38, 0], elR: [62, 50, 0], haR: [62, 60, 2] };
  const body = humanoid(J, { skin: "robe", head: "skin", arm: "robe" }, { w: { headX: 5, headY: 6, chestX: 12, chestY: 9, chestZ: 7, waistX: 10, hipX: 10.5, arm: 3.6, arm2: 2.8, wrist: 2.2 } });
  const skirt = Disp(cone([46, 58, 0], [46, 88, -1], 10.5, 17, "robe"), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.6 + fbm(x * 0.1, y * 0.1))) * Math.max(0, (y - 64) / 24));
  const hood = Sub(ellipsoid([44, 24, 0], [7.4, 8.4, 7], "robe"), ellipsoid([44, 26, 7], [5.4, 7, 5], "robe"), 1);
  const collar = torus([46, 34, 1], 6.4, 1.2, "trim", 0, 12);
  const stole = U(0, cone([41, 36, 8], [38, 84, 14], 1.4, 2.2, "trim"));
  const hand = [ellipsoid([12, 46, 13], [2.2, 2, 1.8], "skin"), ...fingers([11, 46, 13], 185, "skin", { n: 4, len: 6, spread: 40, r: 0.8, curl: 0.5, z: 0.5 })];
  // 枷と千切れた鎖
  const cuff = torus([18, 46, 11], 2.8, 1.1, "iron", 80, 10);
  const chain = []; for (let i = 0; i < 5; i++) chain.push(torus([19 + i * 0.6, 50 + i * 3, 11 - i * 0.3], 1.4, 0.5, "iron", i * 40, i % 2 ? 0 : 90));
  const eyes = [sphere([41.8, 25.4, 9.2], 1, "eye"), sphere([46.4, 25.4, 9.2], 1, "eye")];
  // 体の右半分を閉じ込める氷の塊
  const block = Disp(U(1.5, box([62, 58, 4], [13, 30, 12], "ice", 3, -6), box([56, 30, 2], [8, 10, 10], "ice", 2, 14), box([52, 74, 8], [7, 14, 8], "ice", 2, 8)), iceCracks(0.9, 0.28));
  const man = U(1.2, body, skirt, hood);
  const scene = U(0, iceFloor(48, 93, 42, 13, { n: 3, seed: 8901, snow: 0.08 }), man, collar, ...hand, cuff, ...chain, ...eyes, block);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 氷の中に透ける法衣と腕の影
  for (let y = 20; y < 90; y++) for (let x = 50; x < 84; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "ice" && Math.abs(x - 58 - (y - 40) * 0.1) < 9 && y > 32 && (x + y) % 2 === 0) C.set(x, y, y < 64 ? "#2a384a" : "#1e2836"); }
  // 胸の王家の紋 (金の小さな冠)
  for (const [x, y] of [[44, 44], [46, 43], [48, 44], [44, 45], [45, 45], [46, 45], [47, 45], [48, 45]]) C.only(x, y, "#a8925a");
  hoarfrost(C, ["robe", "skin", "trim"], { th: 0.3, seed: 17, k: 1.3 });
  icicles(C, 8903, ["robe", "ice"], 0.14, 4);
  glints(C, 8905, ["ice"], 5);
  snowfall(C, 8907, 30);
  return C.toArt();
}

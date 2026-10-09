import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, SOULS, towerFloor, chain, sparks, rain, wetGlint } from "../storm.mjs";
export const meta = { id: "bs_soulanchor", key: "hd_soulanchor", w: 96, h: 96,
  note: "魂縛りの像: 塔のあちこちの台座に立つ、頭巾をかぶった顔のない石の像。両腕の先は太い鉄の鎖になって上へ伸び、鎖の先には昇ろうとする魂の青白い光が絡め取られてもがく。胸は空ろにくりぬかれ、縛った魂の光がそこに溜まる。鎖を伸ばして生者の宿す魂まで引き抜こうとする (魂奪い・多用)。濡れた石の体は刃をほとんど通さない (物理抵抗75)" };
export function build() {
  const mats = {
    stone: { ramp: ramp(["#020204", "#07070b", "#0e0e14", "#16161e", "#202029", "#2b2b36", "#383845", "#484857"], 8), spec: 0.5, pow: 22, dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) - (Math.pow(1 - Math.abs(fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25 + 6)), 10) > 0.75 ? 0.2 : 0) },
    hole: { ramp: ["#000000", "#010103", "#030308"], amb: 0, dif: 0.05, noRim: true },
    soul: { ramp: SOULS, noRim: true, emit: p => 0.3 + 0.65 * Math.max(0, p.nz) },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  const plinth = U(0.6, box([48, 86, 0], [16, 4, 10], "stone", 1), box([48, 80, 0], [13, 3, 8], "stone", 1));
  const robe = Disp(U(3, cone([48, 78, 0], [48, 40, 0], 13, 8, "stone"), ellipsoid([48, 40, 0], [10, 7, 7], "stone")), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.9)) * (y > 50 ? 1 : 0));
  const hood = U(1.4, ellipsoid([48, 26, 0], [7.4, 9, 7], "stone"), cone([48, 22, -2], [48, 12, -4], 5, 1, "stone"));
  const hoodHole = ellipsoid([48, 28, 7], [4.6, 6, 4], "hole");
  const chest = ellipsoid([48, 50, 8], [5, 7, 4], "hole");
  // 両腕は上へ伸びる鎖になる
  const arms = [tube([[40, 40, 2, 3.6], [32, 32, 4, 3], [28, 24, 4, 2.4]], "stone"), tube([[56, 40, 2, 3.6], [64, 32, 4, 3], [68, 24, 4, 2.4]], "stone")];
  const cuffs = [cyl([27, 23, 4], [29, 26, 4], 3, "iron", 0.4), cyl([67, 26, 4], [69, 23, 4], 3, "iron", 0.4)];
  const chains = [...chain([26, 21, 4], [16, 5, 6], 2, "iron", 0.8), ...chain([70, 21, 4], [82, 5, 6], 2, "iron", 0.8)];
  // 鎖の先と胸の中で、縛られてもがく魂の光
  const souls = [sphere([14, 3, 8], 3.4, "soul"), sphere([84, 3, 8], 3, "soul"), sphere([48, 51, 6], 3.6, "soul"), sphere([46, 47, 5], 1.8, "soul")];
  const statue = Sub(U(1.4, robe, hood, ...arms), U(0, hoodHole, chest), 0.5);
  const scene = U(0, towerFloor(48, 95, 40, 12, { n: 2, seed: 11501, wet: 0.3 }), plinth, statue, ...cuffs, ...chains, ...souls);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 52, 18], r: 18, k: 0.45 }, { p: [14, 4, 16], r: 14, k: 0.4 }, { p: [84, 4, 16], r: 14, k: 0.4 }] });
  const C = new Canvas(r);
  // 魂の光から上へほどけようとする尾 (鎖に引き止められる)
  for (const [x, y] of [[14, 3], [84, 3]]) for (let k = 1; k < 4; k++) for (const d of [-2, 0, 2]) if (!C.get(x + d, y - k - 2)) C.set(x + d, y - k - 2, SOULS[3 - Math.min(2, k)]);
  // 顔のない頭巾の奥のかすかな光
  C.only(48, 28, SOULS[1]); C.only(47, 29, SOULS[0]); C.only(49, 29, SOULS[0]);
  // 像の表面を流れる雨の筋
  for (let x = 36; x < 62; x += 3) for (let y = 34; y < 78; y++) { const p = C.pix[y * 96 + x]; if (p && p.m === "stone" && fbm(x * 0.5, y * 0.08, 3) > 0.15) C.set(x, y, "#2b2b36"); }
  wetGlint(C, 11503, ["stone"], 0.05);
  rain(C, 11505, 50);
  sparks(C, 11507, 10, [2, 2, 92, 40], SOULS);
  return C.toArt();
}

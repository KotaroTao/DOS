import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, towerFloor, bolt2d, crackle, sparks, rain, wetGlint } from "../storm.mjs";
export const meta = { id: "bs_lightninggolem", key: "hd_lightninggolem", w: 96, h: 96,
  note: "雷光のゴーレム: 塔の古い雷よけの仕掛けが、落ち続ける雷を吸って動き出したもの。黒い鉄の胴に緑青の浮いた銅線が幾重にも巻かれ、頭のかわりに錆びた雷よけの針が突き立つ。撃ち込まれた呪文は針に吸われて銅線を伝い、足元へ流れて消える (魔法抵抗100)。胸の雷の窯が光るたび、身のまわりに稲光の膜を張って打撃を半分に受け流す (障壁3)" };
export function build() {
  const mats = {
    iron: { ramp: ramp(["#030304", "#09090c", "#131318", "#1f1f27", "#2e2e3a", "#42424f", "#585868"], 7), spec: 1.1, pow: 30, specCol: "#c8d0f0", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    copper: { ramp: ramp(["#060a08", "#0e1c16", "#16302a", "#22483e", "#346656", "#4e8a74", "#7ab098"], 7), spec: 0.9, pow: 26, dither: 0.4,
      shade: p => 0.12 * Math.sin(p.y * 2.6) },
    core: { ramp: BOLT, noRim: true, emit: p => 0.5 + 0.45 * Math.max(0, p.nz) },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  const torso = U(1.5, box([48, 50, 0], [14, 14, 10], "iron", 4), box([48, 66, 0], [10, 6, 8], "iron", 3));
  const coils = [];
  for (let i = 0; i < 6; i++) coils.push(torus([48, 40 + i * 4, 0], 15 - (i > 3 ? 2 : 0), 1.1, "copper", 0, 8));
  const shoulders = [sphere([31, 40, 0], 7, "iron"), sphere([65, 40, 0], 7, "iron")];
  const arms = [tube([[30, 44, 2, 5], [24, 58, 6, 4.4], [24, 70, 8, 5.4]], "iron"), tube([[66, 44, 2, 5], [72, 58, 6, 4.4], [72, 70, 8, 5.4]], "iron")];
  const armCoils = [torus([25, 56, 6], 5, 0.9, "copper", 20, 70), torus([25, 60, 6], 5, 0.9, "copper", 20, 70), torus([71, 56, 6], 5, 0.9, "copper", -20, 70), torus([71, 60, 6], 5, 0.9, "copper", -20, 70)];
  const legs = [box([40, 80, 0], [5, 8, 6], "iron", 2), box([56, 80, 0], [5, 8, 6], "iron", 2)];
  const feet = [box([39, 89, 3], [7, 3, 7], "iron", 1.5), box([57, 89, 3], [7, 3, 7], "iron", 1.5)];
  // 頭のかわりの雷よけの針
  const neck = cyl([48, 36, 0], [48, 28, 0], 4, "iron", 1);
  const rod = U(0.5, cone([48, 30, 0], [48, 2, 0], 2.4, 0.3, "iron"), torus([48, 22, 0], 4, 0.8, "copper", 0, 10), torus([48, 16, 0], 3, 0.7, "copper", 0, 10));
  const prongs = [cone([48, 14, 0], [40, 8, 0], 1, 0.2, "iron"), cone([48, 14, 0], [56, 8, 0], 1, 0.2, "iron")];
  const windows = U(0, box([48, 52, 10], [6, 6, 2], "core", 1));
  const body = Sub(U(1, torso, ...shoulders, ...arms, ...legs, ...feet, neck), box([48, 52, 11], [5, 5, 3], "core", 1), 0.4);
  const scene = U(0, towerFloor(48, 95, 42, 13, { n: 2, seed: 10601, wet: 0.3 }), body, ...coils, ...armCoils, rod, ...prongs, windows);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 52, 22], r: 22, k: 0.5 }] });
  const C = new Canvas(r);
  // 空から針へ落ちる雷と、吸われる呪文の光
  bolt2d(C, 30, 0, 48, 3, { seed: 1, jag: 2, branch: 0 });
  bolt2d(C, 70, 0, 49, 4, { seed: 2, jag: 2, branch: 0 });
  // 稲光の膜 (障壁): 体を包む楕円の破線
  for (let a = 0; a < Math.PI * 2; a += 0.025) {
    const x = 48 + Math.cos(a) * 38, y = 54 + Math.sin(a) * 36;
    if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 22) > 0.2) C.set(x, y, Math.sin(a * 7) > 0.5 ? BOLT[2] : BOLT[1]);
  }
  // 足元へ流れる電気
  bolt2d(C, 36, 92, 6, 94, { seed: 7, jag: 1, branch: 1, own: ["stair", "puddle"] });
  bolt2d(C, 60, 92, 92, 93, { seed: 9, jag: 1, branch: 1, own: ["stair", "puddle"] });
  crackle(C, 10603, ["copper"], 0.03);
  wetGlint(C, 10605, ["iron"], 0.05);
  rain(C, 10607, 40);
  sparks(C, 10609, 12);
  return C.toArt();
}

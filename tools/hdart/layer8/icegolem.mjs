import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_icegolem", key: "hd_icegolem", w: 96, h: 96,
  note: "氷塊のゴーレム: 回廊の氷が人の形に凝り固まった、ずんぐりと重い巨人。体は何枚もの厚い氷の板が鎧のように重なってでき、表の板が割れても下の板が打撃を受け流す (障壁3)。胸の奥には凍った魂の核が青く透け、頭は小さな氷塊に細い光の眼が一本。片腕を振りかぶり、もう片腕は床について体を支える" };
export function build() {
  const mats = {
    ice: ICE,
    plate: { ramp: ramp(["#03060c", "#081322", "#102238", "#1a3350", "#264868", "#366080", "#4c7a98", "#6c98b2", "#9cbcd0"], 9), spec: 1.5, pow: 36, specCol: "#e4f4fc", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    core: { ramp: SOUL, noRim: true, emit: p => 0.35 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    shelf: SHELF, snow: SNOW,
  };
  const R = rand(9601);
  // 重なった氷の板 (箱を少しずつ傾けて積む)
  const plates = [];
  const chunk = (c, h, rot) => plates.push(Disp(box(c, h, "plate", 1.4, rot), iceCracks(0.6, 0.35)));
  chunk([48, 50, 0], [16, 13, 11], 4); chunk([44, 40, 4], [12, 7, 9], -10); chunk([54, 62, 2], [13, 8, 9], 8);
  chunk([30, 38, 2], [8, 7, 8], -24); chunk([66, 38, 0], [8, 7, 8], 24);   // 肩
  chunk([48, 26, 4], [7, 6, 6], 6);                                         // 頭
  // 振りかぶった腕 (画面右) と、床につく腕 (画面左)
  chunk([74, 28, 2], [5, 9, 6], 30); chunk([80, 14, 4], [7, 7, 7], 14);
  chunk([24, 52, 6], [5, 10, 6], 12); chunk([20, 74, 8], [8, 9, 8], -6);
  // 脚
  chunk([38, 80, 2], [8, 9, 8], -4); chunk([60, 80, 0], [8, 9, 8], 6);
  const coreS = sphere([48, 48, 8], 4.6, "core");
  const eye = box([48, 25, 10.4], [4, 0.7, 0.8], "eye", 0.2);
  const body = Sub(U(1.4, ...plates), sphere([48, 48, 13], 4.6, "plate"), 0.8);
  const scene = U(0, iceFloor(48, 94, 44, 14, { n: 4, seed: 9603, snow: 0.06, shards: 2 }), body, coreS, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 48, 18], r: 18, k: 0.3 }] });
  const C = new Canvas(r);
  // 板の縁の白い継ぎ目
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) { const p = C.pix[y * 96 + x], q = C.pix[(y + 1) * 96 + x]; if (p && q && p.m === "plate" && q.m === "plate" && q.z - p.z > 2.5 && (x + y) % 3) C.set(x, y, "#6c98b2"); }
  hoarfrost(C, ["plate"], { th: 0.45, seed: 27 });
  icicles(C, 9605, ["plate"], 0.13, 4);
  glints(C, 9607, ["plate"], 8);
  snowfall(C, 9609, 30);
  return C.toArt();
}

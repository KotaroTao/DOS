import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, FROST, iceFloor, hoarfrost, icicles, snowfall, puffs } from "../ice.mjs";
export const meta = { id: "bs_snowstalker", key: "hd_snowstalker", w: 96, h: 96,
  note: "雪渡りの獣: 長い白毛に全身を覆われた、背の丸い大獣 (雪男)。太く長い両腕を頭の上で組み、鎧ごと叩き割ろうと振り下ろす (守り崩し)。毛先は凍って房になり氷柱を垂らす。毛の奥の顔は黒く、小さな眼と歯をむいた口。蹴立てた雪煙が足元に舞う" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030407", "#0a0f16", "#151e28", "#22303e", "#344658", "#4a6074", "#647c92", "#8298ae", "#a4b8ca"], 9), dither: 0.6, amb: 0.22,
      shade: p => 0.12 * fbm(p.x * 0.7, p.y * 0.25, p.z * 0.7) },
    face: { ramp: ramp(["#020203", "#08080a", "#121216", "#1e1e24", "#2c2c34"], 5), dither: 0.4, spec: 0.4, pow: 18 },
    maw: { ramp: ["#060203", "#1c080a", "#3a1216"], dither: 0.4 },
    eye: { ramp: ["#5a1a08", "#d26a20", "#ffc060"], emit: () => 0.9 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  const J = { head: [48, 34, 4], neck: [48, 40, 2], chest: [48, 50, 0], waist: [48, 64, -1], hip: [48, 72, -1],
    shL: [34, 44, 0], elL: [28, 28, 4], haL: [40, 14, 6], shR: [62, 44, 0], elR: [68, 28, 4], haR: [56, 14, 6],
    hpL: [40, 74, 0], knL: [34, 82, 4], ftL: [32, 90, 6], hpR: [56, 74, 0], knR: [62, 82, 4], ftR: [64, 90, 6] };
  const body = humanoid(J, { skin: "fur" }, { w: { headX: 8, headY: 7.5, headZ: 7, chestX: 17, chestY: 12, chestZ: 11, waistX: 14, waistY: 10, hipX: 14, arm: 6.4, arm2: 5.6, wrist: 4.6, thigh: 7, knee: 6, ankle: 5, neck: 6 } });
  // 握り合わせた両拳 (頭上)
  const fists = U(1.5, ellipsoid([44, 12, 7], [6, 5, 5], "fur"), ellipsoid([53, 12, 7], [6, 5, 5], "fur"));
  const furry = Disp(U(2, body, fists), (x, y, z) => 0.9 * Math.max(0, fbm(x * 0.55, y * 0.22, z * 0.55, 2)) + 0.35 * fbm(x * 0.9, y * 0.5, z * 0.9));
  // 毛の奥の黒い顔
  const face = ellipsoid([48, 36, 10.5], [5, 5.4, 2.4], "face");
  const maw = ellipsoid([48, 40, 13], [3, 1.4, 1.2], "maw");
  const eyes = [sphere([45.6, 34, 12.4], 0.8, "eye"), sphere([50.4, 34, 12.4], 0.8, "eye")];
  const scene = U(0, iceFloor(48, 94, 42, 14, { n: 3, seed: 8701, snow: 0.15 }), furry, Sub(face, maw, 0.2), ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 46, 50, { step: 2, top: [1, 1], bot: [1, 1], cols: ["#6a6a60", "#c8c8b8", "#f0f0e0"], seed: 8703 });
  hoarfrost(C, ["fur"], { th: 0.4, seed: 13 });
  icicles(C, 8705, ["fur"], 0.16, 4);
  // 振り下ろす勢いの風切りの線 (拳の両脇)
  for (const [x0, y0, x1, y1] of [[30, 6, 22, 18], [66, 6, 74, 18], [34, 2, 28, 10], [62, 2, 68, 10]]) for (let t = 0; t <= 1; t += 0.08) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (!C.get(Math.round(x), Math.round(y)) && t > 0.15) C.set(x, y, FROST[t > 0.6 ? 0 : 1]); }
  // 蹴立てた雪煙
  puffs(C, [[20, 88, 7], [76, 88, 7], [12, 84, 5], [84, 84, 5]], ["#141e2a", "#22324a", "#3a5068", "#5e7a94"], { dens: 0.8, seed: 14 });
  snowfall(C, 8707, 34);
  return C.toArt();
}

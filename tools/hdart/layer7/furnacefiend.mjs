import { sphere, ellipsoid, cone, box, tube, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_furnacefiend", key: "hd_furnacefiend", w: 96, h: 96,
  note: "溶鉱の鬼神: 腹がそのまま溶鉱炉になった、肩幅の広い鉄錆色の鬼神。腹の格子の奥で炉の火が白く燃え、背には二本の煙突。両腕の先は拳でなく鍛冶の大槌の頭で、片方を振りかぶって鎧ごと打ち砕こうとする。額には太い一本角" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#040201", "#0e0604", "#1a0c07", "#28130a", "#381b0e", "#4a2412", "#5e2f18", "#76401f"], 8), spec: 0.6, pow: 20, specCol: "#b0704a", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    iron: { ramp: ramp(["#030303", "#0b0a0a", "#171514", "#262220", "#38322e", "#4e4640", "#686058"], 7), spec: 1, pow: 26, specCol: "#a8a098", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    fire: { ramp: ["#7a1a06", "#d24e10", "#ffae3a", "#ffe8a0", "#fffce8"], noRim: true, emit: p => 0.5 + 0.5 * fbm(p.x * 0.4, p.y * 0.4, 3) + 0.2 },
    horn: { ramp: ["#100c08", "#3a3024", "#6e5e44", "#a8946c"], spec: 1, pow: 28, dither: 0.35 },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const J = { head: [46, 20, 4], neck: [46, 26, 3], chest: [46, 36, 2], waist: [47, 50, 3], hip: [47, 60, 0],
    shL: [32, 30, 3], elL: [22, 42, 8], haL: [18, 54, 12], shR: [60, 30, -2], elR: [72, 22, 2], haR: [74, 10, 4],
    hpL: [40, 62, 4], knL: [36, 74, 6], ftL: [34, 87, 6], hpR: [54, 62, -4], knR: [58, 74, -4], ftR: [60, 87, -4] };
  const body = humanoid(J, { skin: "hide" }, { w: { headX: 5, headY: 5, chestX: 15, chestY: 10, waistX: 13, waistY: 11, hipX: 10, arm: 5, arm2: 4.4, wrist: 3.6, thigh: 5.4, knee: 4.2, ankle: 3.6 } });
  const brute = Disp(U(2, body, ellipsoid([46, 48, 6], [12, 11, 9], "hide")), (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5));
  // 腹の炉: 鉄の縁と格子、奥に炎
  const furnace = Sub(brute, ellipsoid([46, 48, 15], [8, 7, 6], "fire"), 1);
  const rim = Sub(ellipsoid([46, 48, 11.5], [9.5, 8.5, 3], "iron"), ellipsoid([46, 48, 14], [7.6, 6.6, 4], "iron"));
  const grate = [-4, 0, 4].map(dx => cyl([46 + dx, 41.5, 12.4], [46 + dx, 54.5, 12.4], 0.8, "iron"));
  const fire = ellipsoid([46, 48, 7.5], [7, 6, 3], "fire");
  // 大槌の腕
  const hamL = cyl([12, 58, 12], [24, 56, 12], 5.4, "iron", 1);
  const hamR = cyl([68, 8, 4], [80, 8, 4], 5.4, "iron", 1);
  const stacks = [cyl([38, 26, -8], [36, 6, -9], 2.6, "iron", 0.6), cyl([54, 26, -8], [57, 8, -9], 2.6, "iron", 0.6)];
  const horn = cone([46, 15, 8], [44, 4, 9], 2.4, 0.3, "horn");
  const eyes = [sphere([44, 20, 8.6], 0.9, "eye"), sphere([48.4, 20, 8.6], 0.9, "eye")];
  const scene = U(0, lavaFloor(48, 92, 44, 13, { n: 3, seed: 8701 }), furnace, rim, ...grate, fire, hamL, hamR, ...stacks, horn, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [46, 52, 24], r: 26, k: 0.45 }] });
  const C = new Canvas(r);
  // 煙突の火と、振りかぶった槌の熱の筋
  flame2d(C, 36, 5, 2.4, 6, { seed: 1 }); flame2d(C, 57, 7, 2.4, 6, { seed: 2 });
  for (const [x, y] of [[66, 14], [64, 18], [62, 22]]) C.line(x - 4, y + 4, x, y, "#8e2c10");
  underglow(C, { skip: ["eye", "fire"] });
  embers(C, 8703, 26, [4, 2, 88, 60]);
  return C.toArt();
}

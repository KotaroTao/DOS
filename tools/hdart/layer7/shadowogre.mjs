import { sphere, ellipsoid, cone, box, tube, cyl, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, ASH, lavaFloor, underglow, embers, puffs } from "../lava.mjs";
export const meta = { id: "bs_shadowogre", key: "hd_shadowogre", w: 96, h: 96,
  note: "煤の大鬼: 全身が煤で真っ黒な、腹の突き出た大鬼。釜にくべる魂を集める役目で、大きな鉄のシャベルを肩に担ぎ、腰には捕えた魂の青白い火がいくつもぎっしり詰まった網袋を下げる。小さな白目だけが煤の顔に光り" };
export function build() {
  const mats = {
    soot: { ramp: ramp(["#010101", "#050505", "#0b0a0a", "#131111", "#1c1a19", "#272423", "#34302e"], 7), spec: 0.3, pow: 14, dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    iron: { ramp: ramp(["#030303", "#0c0b0b", "#1a1716", "#2a2624", "#3e3834", "#56504a", "#76706a"], 7), spec: 1, pow: 26, specCol: "#a8a098", dither: 0.45 },
    wood: { ramp: ramp(["#030201", "#0c0805", "#18100a", "#26190f", "#342215"], 5), dither: 0.5 },
    net: { ramp: ramp(["#060504", "#16120e", "#2a221a", "#3e3226"], 4), dither: 0.5 },
    soul: { ramp: ["#0e2a4a", "#2a5a8a", "#5a98c8", "#a8d8f0", "#e8f8ff"], noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: ["#8a8070", "#d8d0c0", "#ffffff"], emit: () => 0.9 },
    maw: { ramp: ["#000000", "#100404", "#3a0c06"], amb: 0.1, dif: 0.2, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const J = { head: [44, 24, 4], neck: [45, 30, 3], chest: [46, 40, 2], waist: [48, 54, 3], hip: [48, 64, 0],
    shL: [32, 34, 3], elL: [24, 48, 8], haL: [26, 60, 12], shR: [60, 34, -2], elR: [68, 24, 4], haR: [64, 16, 8],
    hpL: [41, 66, 4], knL: [38, 76, 6], ftL: [36, 87, 6], hpR: [55, 66, -4], knR: [58, 76, -5], ftR: [60, 87, -5] };
  const body = humanoid(J, { skin: "soot" }, { w: { headX: 6, headY: 6, chestX: 14, chestY: 11, waistX: 14, waistY: 11, hipX: 12, arm: 5, arm2: 4.2, wrist: 3.4, thigh: 6, knee: 4.6, ankle: 3.6 } });
  const belly = ellipsoid([46, 54, 7], [13, 11, 9], "soot");
  const brute = Disp(U(2, body, belly, ellipsoid([44, 30, 8], [5, 3, 4], "soot")), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const maw = ellipsoid([44, 30, 11.5], [3.2, 1.2, 2], "maw");
  const fistL = sphere([26, 61, 12], 4.2, "soot"), fistR = sphere([64, 15, 8], 4, "soot");
  // 肩に担いだ大きなシャベル (柄は右手から背へ、鉄の刃は背の上へ)
  const shaft = cyl([80, 40, -6], [56, 4, 12], 1.6, "wood");
  const blade = Disp(box([84, 46, -8], [8, 10, 1.2], "iron", 1, -30), (x, y, z) => -1.2 * Math.max(0, 1 - Math.abs(x - 84) / 8));
  // 腰の網袋: 魂の火がぎっしり
  const bag = Disp(ellipsoid([24, 74, 10], [9, 10, 8], "net"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 1.1) * Math.sin(y * 1.1)));
  const souls = [];
  const R = rand(8301);
  for (let i = 0; i < 7; i++) souls.push(sphere([20 + R() * 8, 68 + R() * 12, 15 + R() * 3], 2 + R() * 1.4, "soul"));
  const rope = tube([[30, 60, 10, 1], [26, 64, 12, 0.8]], "net");
  const eyes = [sphere([42, 23.5, 9.6], 0.9, "eye"), sphere([46.4, 23.5, 9.4], 0.9, "eye")];
  const scene = U(0, lavaFloor(48, 91, 44, 13, { n: 3, seed: 8303 }), Sub(brute, maw, 0.3), fistL, fistR, shaft, blade, bag, ...souls, rope, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [22, 74, 24], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 網の目
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "soul" && ((x + y) % 4 === 0 || (x - y) % 4 === 0)) C.set(x, y, "#2a221a"); }
  underglow(C, { skip: ["eye", "soul"] });
  embers(C, 8307, 18, [4, 20, 88, 50]);
  return C.toArt();
}

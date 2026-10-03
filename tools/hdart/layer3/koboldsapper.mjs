import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_koboldsapper", key: "hd_koboldsapper", w: 96, h: 96,
  note: "坑掘りのコボルド: 獣面の小鬼の工夫。蝋燭を立てたへこんだ坑夫兜、黄色く光る眼と犬歯、肩につるはし、背には鉱石の光る盗品袋。前かがみに忍び寄る" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030302", "#0e0b08", "#1d1710", "#2e2418", "#423422", "#5a4830", "#786244"], 7), spec: 0.4, pow: 20, dither: 0.6,
      shade: p => 0.12 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    snout: { ramp: ramp(["#040303", "#110c0a", "#211713", "#3a2820", "#5c3e30"], 5), spec: 0.8, pow: 30, specCol: "#8c6050", dither: 0.5 },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216", "#422d1d"], 6), dither: 0.55, shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6) },
    brass: { ramp: ramp(["#050402", "#151006", "#2a200a", "#4a3a12", "#7e6424", "#a08236"], 6), spec: 1.2, pow: 30, specCol: "#e6cc80", dither: 0.4 },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b"], 6), spec: 1, pow: 40, specCol: "#9aa2ae", dither: 0.45 },
    wood: { ramp: ramp(["#040302", "#110b07", "#1f150c", "#2e1f12", "#402b19"], 5), dither: 0.5 },
    sack: { ramp: ramp(["#040302", "#16120b", "#2c2416", "#463a24", "#665636", "#8a7650"], 6), dither: 0.65, shade: p => 0.1 * Math.sin(p.x * 0.7 + p.y * 1.1) },
    wax: { ramp: ramp(["#0a0906", "#4c4632", "#8e8460"], 3), spec: 0.6, pow: 20, dither: 0.3 },
    eye: { ramp: ["#3a2a00", "#7a5a06", "#c09018", "#f4d040"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#100405", "#1e0808"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 前かがみの小柄な体: 頭は低く前へ、尾を引きずる
  const J = { head: [38, 36, 10], neck: [42, 43, 6], chest: [47, 52, 2], waist: [50, 62, 0], hip: [51, 69, -1],
    shL: [41, 48, 6], elL: [35, 57, 11], haL: [33, 65, 14], shR: [55, 47, 1], elR: [63, 47, 5], haR: [59, 36, 7],
    hpL: [47, 71, 3], knL: [42, 78, 9], ftL: [44, 89, 7], hpR: [55, 71, -2], knR: [60, 77, 2], ftR: [60, 89, -1] };
  const body = humanoid(J, { skin: "hide", hip: "leather" }, { w: { headX: 6.4, headY: 5.8, headZ: 6, neck: 2.8, chestX: 8, chestY: 7, chestZ: 6, waistX: 6, waistY: 5.5, hipX: 6.5, hipY: 4,
    arm: 2.7, arm2: 2.3, wrist: 1.7, thigh: 3.4, knee: 2.6, ankle: 1.9 }, k: 1.5 });
  // 獣の面: 鼻面は左下へ長く突き出す (横顔寄り)
  const muzzle = cone([35, 38, 13], [23, 42, 15], 4.2, 2.0, "snout");
  const nose = sphere([22, 41.6, 15.5], 1.7, "maw");
  const jaw = cone([35, 42, 12], [25, 45.5, 13.5], 3.0, 1.3, "snout");
  const ears = [cone([34, 32, 6], [27, 24, 2], 3, 0.4, "hide"), cone([44, 31, 4], [50, 22, 0], 3, 0.4, "hide")];
  const tail = tube([[56, 68, -4, 2.2], [66, 74, -6, 1.8], [74, 84, -4, 1.2], [80, 87, 0, 0.5]], "hide");
  const eyes = [sphere([33.5, 35.4, 14.5], 1.4, "eye"), sphere([39.5, 35.2, 15], 1.3, "eye")];
  // へこんだ坑夫兜と、つばに立てた蝋燭
  const helm = Disp(Sub(ellipsoid([39, 30, 9], [8.2, 6, 7.6], "brass", -8), box([39, 37, 9], [11, 3, 11], "brass")), (x, y, z) => (Math.hypot(x - 43, y - 27) < 2.6 ? 0.8 : 0) + 0.12 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const brim = cyl([39.5, 32, 9], [39.6, 33, 9], 10.2, "brass", 0.4);
  const candle = cyl([35, 23, 15], [35, 17, 15], 1.3, "wax", 0.3);
  const holder = cyl([35, 25, 14.5], [35, 23, 15], 2.1, "iron", 0.3);
  // 肩に担いだつるはし (右手)
  const haft = cyl([52, 40, 6], [72, 22, 0], 1.1, "wood", 0.3);
  const pick = tube([[64, 16, 2, 0.8], [70, 20, 1, 1.6], [72, 22, 0, 1.9], [76, 26, -1, 1.4], [79, 32, -2, 0.3]], "iron", { seg: 3 });
  // 背負った盗品袋: 口から鉱石と金貨がのぞく
  const sack = Disp(ellipsoid([70, 60, -8], [10, 11, 9], "sack", 20), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const strap = tube([[43, 46, 8, 0.9], [54, 52, 8, 0.9], [66, 60, 2, 0.9]], "leather");
  const handL = fingers([33, 65, 14], 100, "hide", { n: 3, len: 4.5, spread: 18, r: 0.9, curl: 0.6, z: 1 });
  const scene = U(0, rubble(50, 91, 40, 13, { n: 7, seed: 21, big: 3 }), U(1.2, body, muzzle, jaw, ...ears, tail), nose, ...eyes, helm, brim, holder, candle, haft, pick, sack, strap, ...handL);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [35, 13, 18], r: 26, k: 0.45 }] });
  const C = new Canvas(r);
  // 蝋燭の炎
  const Fl = ["#7a2a04", "#d06010", "#f8a830", "#fff0b0"];
  for (const [x, y, c] of [[35, 16, 1], [35, 15, 2], [35, 14, 3], [34, 15, 1], [36, 15, 1], [35, 13, 2], [35, 12, 1]]) C.set(x, y, Fl[c]);
  // 牙と、袋の口の鉱石・金貨のきらめき
  tri(C, [27, 43.5], [28.4, 43.5], [27.6, 46.4], "#d8ccb0"); tri(C, [31, 43.4], [32.2, 43.4], [31.6, 45.8], "#a89c80");
  C.line(25, 43.6, 33, 43, "#000000");
  for (const [x, y, c] of [[68, 49, "#f0d070"], [70, 48, "#a08236"], [72, 49, "#e6cc80"], [66, 50, "#4ac0c8"], [71, 50, "#7e6424"], [73, 51, "#f8f0c0"], [69, 50, "#f0d070"]]) C.set(x, y, c);
  pebbles(C, 8, 50, 90, 36);
  return C.toArt();
}

import { sphere, ellipsoid, cone, box, tube, cyl, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
import { tri } from "../mine.mjs";
export const meta = { id: "bs_darkliege", key: "hd_darkliege", w: 96, h: 96,
  note: "祭場の黒騎士: 煤けた黒鉄の全身鎧に、炎をかたどった兜飾りの騎士。片手で大剣を頭上に突き上げて雄叫びをあげ、兜の覗き穴の奥と胸の火の紋章が赤く燃える。焼け焦げた外套が背でひるがえり、もう片手には火の教団の小さな旗" };
export function build() {
  const mats = {
    plate: { ramp: ramp(["#020202", "#070708", "#0f0f11", "#18181b", "#222226", "#2e2e33", "#3c3c42", "#4e4e56"], 8), spec: 1.1, pow: 28, specCol: "#8a8a98", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    cloak: { ramp: ramp(["#020101", "#080304", "#100506", "#1a0808", "#260c0b"], 5), dither: 0.6,
      shade: p => 0.12 * Math.sin(p.x * 0.6 + p.y * 0.2 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    blade: { ramp: ramp(["#0a0a0c", "#24242a", "#44444c", "#6c6c78", "#9c9caa", "#d0d0dc"], 6), spec: 1.4, pow: 40, specCol: "#f0f0ff", dither: 0.35 },
    gold: { ramp: ramp(["#140a02", "#3a2206", "#6a420c", "#9a6a18", "#c89a34"], 5), spec: 1, pow: 26, dither: 0.4 },
    glow: { ramp: ["#5a0e04", "#c43e0c", "#ffae3a", "#fff0b0"], noRim: true, emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    flag: { ramp: ramp(["#100304", "#2a0708", "#46100c", "#641a12"], 4), dither: 0.6, amb: 0.3 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const J = { head: [46, 24, 3], neck: [46, 30, 2], chest: [46, 39, 1], waist: [47, 50, 0], hip: [47, 58, 0],
    shL: [36, 34, 4], elL: [28, 44, 8], haL: [24, 52, 12], shR: [57, 33, -2], elR: [62, 22, 2], haR: [62, 12, 4],
    hpL: [42, 60, 4], knL: [38, 72, 6], ftL: [36, 86, 6], hpR: [52, 60, -4], knR: [56, 72, -4], ftR: [58, 86, -4] };
  const knight = humanoid(J, { skin: "plate" }, { w: { headX: 5.2, headY: 6, chestX: 10, chestY: 8.5, waistX: 7, hipX: 8, arm: 3.4, arm2: 3, wrist: 2.4, thigh: 4.2, knee: 3.4, ankle: 2.8 } });
  // 肩当て・腰垂れ・兜の面頬
  const pauldrons = [ellipsoid([35, 33, 4], [6.5, 4.6, 6], "plate", 20), ellipsoid([58, 32, -2], [6.5, 4.6, 6], "plate", -20)];
  const tassets = cone([47, 56, 0], [47, 66, 0], 8.5, 10.5, "plate");
  const visor = Sub(ellipsoid([46, 25, 7.5], [4.6, 4.4, 3], "plate"), box([46, 24, 11], [3.4, 0.6, 2], "plate"));
  const slit = box([46, 24, 9.5], [3.2, 0.5, 0.6], "glow");
  const body = Disp(U(1.4, knight, ...pauldrons, tassets), (x, y, z) => 0.12 * fbm(x * 0.8, y * 0.8, z * 0.8));
  // 胸の火の紋章
  const crest = Paint(ellipsoid([46, 40, 8.2], [2.2, 2.8, 0.8], "plate"), () => "glow");
  // 頭上へ突き上げた大剣
  const sword = U(0.6, box([62, -2, 4], [1.8, 12, 0.6], "blade"), box([62, 10.5, 4], [5, 1, 1.2], "gold", 0.4), cyl([62, 11, 4], [62, 15, 4], 1, "gold"));
  // 外套: 背でひるがえる
  const cloak = Disp(slab([[38, 30], [56, 30], [72, 52], [80, 72], [70, 66], [64, 78], [56, 70], [50, 80], [44, 64]], -6, 1, "cloak", 0.8, 1), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2));
  // 左手の小旗
  const pole = cyl([22, 70, 13], [20, 30, 13], 0.8, "gold");
  const flag = slab([[20, 31], [8, 33], [12, 38], [6, 43], [20, 42]], 13, 0.4, "flag", 0.3);
  const scene = U(0, lavaFloor(48, 91, 42, 13, { n: 3, seed: 8401 }), cloak, body, visor, slit, crest, sword, pole, flag);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 兜飾りの炎と、旗の火の印
  for (const [x, w, h, s] of [[46, 2.5, 9, 1], [43, 1.8, 6, 2], [49, 1.8, 6, 3]]) flame2d(C, x, 19, w, h, { seed: s });
  C.set(13, 37, "#f07a1c"); C.set(12, 38, "#ffae3a"); C.set(14, 38, "#c43e0c"); C.set(13, 39, "#f07a1c");
  underglow(C, { skip: ["glow"] });
  embers(C, 8403, 22, [4, 2, 88, 60]);
  return C.toArt();
}

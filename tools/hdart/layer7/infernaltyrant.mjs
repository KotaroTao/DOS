import { sphere, ellipsoid, cone, tube, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, EMBER, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_infernaltyrant", key: "hd_infernaltyrant", w: 96, h: 96,
  note: "獄炎の暴君: 角の冠をいただく巨躯の悪魔の王。両腕を頭上に掲げ、その間に煮えたぎる業火の大玉を練り上げて隊のすべてへ浴びせようとする (全体呪文)。黒い肌に溶岩の血管が光り、足元には火の魔法陣が広がる。肩から焦げた王の外套" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030101", "#0a0304", "#140607", "#20090a", "#2e0d0d", "#3e1311", "#521a15"], 7), spec: 0.6, pow: 22, specCol: "#a8584a", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    horn: { ramp: ramp(["#060402", "#18120a", "#30261a", "#4e402c", "#746246", "#a08a66"], 6), spec: 0.9, pow: 26, dither: 0.4 },
    cloak: { ramp: ramp(["#020101", "#080304", "#110607", "#1c0a0a"], 4), dither: 0.6 },
    orb: { ramp: ["#7a1a06", "#d24e10", "#f07a1c", "#ffc04a", "#ffe8a0", "#fffce8"], noRim: true, emit: p => 0.35 + 0.6 * Math.max(0, p.nz) + 0.15 * fbm(p.x * 0.3, p.y * 0.3, 2) },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const J = { head: [48, 30, 2], neck: [48, 36, 1], chest: [48, 46, 0], waist: [48, 58, 0], hip: [48, 66, 0],
    shL: [36, 40, 2], elL: [28, 30, 6], haL: [34, 18, 8], shR: [60, 40, -2], elR: [68, 30, 2], haR: [62, 18, 4],
    hpL: [42, 68, 4], knL: [38, 78, 6], ftL: [36, 88, 6], hpR: [54, 68, -4], knR: [58, 78, -4], ftR: [60, 88, -4] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5, headY: 5.6, chestX: 13, chestY: 9, waistX: 9, hipX: 9, arm: 4, arm2: 3.4, wrist: 2.4, thigh: 5, knee: 3.8, ankle: 3 } });
  const brute = Disp(body, (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5) + (y > 42 && y < 56 ? -0.4 * Math.max(0, Math.sin(x * 0.8)) : 0));
  const hands = [...fingers(J.haL, -40, "skin", { n: 4, len: 5, spread: 30, r: 0.9, curl: 0.4, z: 1 }), ...fingers(J.haR, -140, "skin", { n: 4, len: 5, spread: 30, r: 0.9, curl: -0.4, z: 1 })];
  // 角の冠: 頭のまわりに放射する 5 本
  const crown = [];
  for (const a of [-60, -30, 0, 30, 60]) { const r = a * Math.PI / 180; crown.push(cone([48 + Math.sin(r) * 4, 26, 2], [48 + Math.sin(r) * 12, 26 - Math.cos(r) * 11, 1], 1.8, 0.3, "horn")); }
  const cloak = Disp(slab([[34, 38], [62, 38], [74, 60], [76, 84], [64, 80], [56, 88], [48, 80], [40, 88], [32, 80], [20, 84], [22, 60]], -8, 1, "cloak", 0.8, 1), (x, y, z) => 1 * fbm(x * 0.2, y * 0.2));
  const orb = Disp(sphere([48, 10, 8], 8, "orb"), (x, y, z) => 0.8 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const eyes = [sphere([46, 29.5, 6.6], 0.9, "eye"), sphere([50.2, 29.5, 6.6], 0.9, "eye")];
  const scene = U(0, lavaFloor(48, 92, 46, 13, { n: 3, seed: 8901, cracks: 0.92 }), cloak, brute, ...hands, ...crown, orb, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 10, 20], r: 40, k: 0.55 }] });
  const C = new Canvas(r);
  // 溶岩の血管
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "skin") continue;
    if (Math.pow(1 - Math.abs(vnoise(x * 0.18, y * 0.18, 4)), 10) > 0.75) C.set(x, y, "#d24e10");
  }
  // 足元の火の魔法陣 (楕円の二重環と印)
  for (const [rx, col] of [[40, "#c43e0c"], [34, "#f07a1c"]]) for (let a = 0; a < 6.283; a += 0.02) {
    const x = Math.round(48 + Math.cos(a) * rx), y = Math.round(90 + Math.sin(a) * rx * 0.12);
    const p = C.pix[y * 96 + x];
    if (Math.sin(a) < 0 && C.get(x, y) && !(p && (p.m === "basalt" || p.m === "lava" || p.m === "crust"))) continue;
    C.set(x, y, col);
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, x = 48 + Math.cos(a) * 37, y = 90 + Math.sin(a) * 37 * 0.12; C.set(x, y - 1, EMBER[3]); }
  // 大玉から渦巻く炎の粒
  const R = rand(8903);
  for (let i = 0; i < 30; i++) { const a = R() * 6.283, d = 9 + R() * 8, x = 48 + Math.cos(a) * d, y = 10 + Math.sin(a) * d * 0.8; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, EMBER[1 + Math.floor(R() * 4)]); }
  underglow(C, { skip: ["eye", "orb"] });
  embers(C, 8905, 20, [4, 20, 88, 50]);
  return C.toArt();
}

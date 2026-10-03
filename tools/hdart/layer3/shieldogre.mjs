import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_shieldogre", key: "hd_shieldogre", w: 96, h: 96,
  note: "大盾のオーガ: 鋲打ちの城門の扉を大盾に担ぐ灰青の巨躯のオーガ。扉の陰から突き出た顎と潰れた鼻、小さな眼。扉には矢が刺さり、右手は太い鎖を握る" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030304", "#090a0d", "#111318", "#1a1d24", "#242832", "#2f3440", "#3c4250", "#4c5262", "#5e6676"], 9), spec: 0.6, pow: 25, specCol: "#8c94a8", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    wood: { ramp: ramp(["#030201", "#0d0805", "#1a110a", "#281a0f", "#372415", "#48301c", "#5a3c24"], 7), dither: 0.55,
      shade: p => (Math.abs(((p.x - 20) % 7 + 7) % 7 - 3.5) > 3 ? -0.18 : 0) + 0.1 * fbm(p.x * 0.1, p.y * 0.6) },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66"], 7), spec: 1.1, pow: 40, specCol: "#a0a8b4", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    eye: { ramp: ["#2a1a00", "#6a4402", "#b07a0a", "#f0c040"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0a0304", "#160607"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const J = { head: [56, 24, 4], neck: [56, 30, 2], chest: [56, 42, -2], waist: [56, 56, -4], hip: [56, 64, -5],
    shL: [42, 36, 0], elL: [34, 50, 4], haL: [36, 58, 6], shR: [70, 36, -2], elR: [80, 52, 2], haR: [80, 66, 6],
    hpL: [48, 66, -4], knL: [44, 78, 0], ftL: [42, 90, 0], hpR: [64, 66, -5], knR: [70, 78, -1], ftR: [72, 90, -2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 6.4, headY: 6.5, headZ: 6.4, neck: 5, chestX: 15, chestY: 11, chestZ: 9, waistX: 12, waistY: 9, waistZ: 8, hipX: 12, hipY: 6,
    arm: 5.8, arm2: 4.8, wrist: 3.8, thigh: 6, knee: 4.8, ankle: 3.8 }, k: 2.8 });
  const jaw = ellipsoid([55, 29, 10], [6.5, 3.6, 4], "skin");
  const brow = ellipsoid([55, 21, 9], [6.5, 2.2, 3], "skin");
  const nose = ellipsoid([54, 25, 11], [2.2, 2, 2], "skin");
  const mouth = ellipsoid([55, 28.5, 14], [4, 1, 2], "maw");
  const eyes = [sphere([52, 23, 9.6], 0.9, "eye"), sphere([58, 23, 9.6], 0.9, "eye")];
  const tusks = [cone([51.5, 29, 13], [50.5, 24.5, 13], 1.1, 0.3, "iron"), cone([58.5, 29, 13], [59.5, 24.5, 13], 1.1, 0.3, "iron")];
  // 大盾: 城門の扉。縦の板に鉄の帯と鋲、ノッカーの輪
  const D = [30, 56];
  const door = Disp(box([D[0], D[1], 14], [17, 30, 2.6], "wood", 1.2, -6), (x, y, z) => 0.25 * fbm(x * 0.3, y * 0.3) + (Math.abs(((x - 20) % 7 + 7) % 7 - 3.5) > 3.1 ? 0.35 : 0));
  const bands = [];
  for (const dy of [-20, 0, 20]) bands.push(box([D[0] + dy * 0.1, D[1] + dy, 16.8], [17.4, 2, 0.6], "iron", 0.4, -6));
  const studs = [];
  for (const dy of [-20, 0, 20]) for (let i = -3; i <= 3; i++) studs.push(sphere([D[0] + i * 4.6 + dy * 0.1 - i * 0.48 * 0, D[1] + dy - i * 0.48, 17.6], 0.9, "iron"));
  const ring = torus([D[0] + 1, D[1] + 8, 17.6], 3.2, 0.8, "iron", 0, 90);
  const arrows = [cyl([22, 40, 17], [14, 34, 26], 0.4, "wood"), cyl([38, 64, 17], [32, 60, 26], 0.4, "wood")];
  // 右手の太い鎖
  const links = [];
  for (let i = 0; i < 6; i++) links.push(torus([81 + Math.sin(i) * 0.6, 70 + i * 3.4, 6], 1.9, 0.75, "iron", 90, i % 2 ? 0 : 90));
  const handR = fingers([80, 66, 6], 90, "skin", { n: 4, len: 4, spread: 16, r: 1.4, curl: 1.2, z: 1 });
  const scene = U(0, rubble(52, 92, 44, 14, { n: 6, seed: 101, big: 3.2 }), Sub(U(2.2, body, jaw, brow, nose), mouth, 0.5), ...eyes, ...tusks, door, ...bands, ...studs, ring, ...arrows, ...links, ...handR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 矢羽
  for (const [x, y] of [[14, 34], [32, 60]]) { C.set(x - 1, y - 1, "#6a6050"); C.set(x, y - 1, "#9a8c70"); C.set(x - 1, y, "#9a8c70"); }
  // 扉の傷 (斧の跡)
  for (const [x0, y0] of [[24, 48], [34, 70], [20, 66]]) C.line(x0, y0, x0 + 4, y0 - 3, "#0d0805");
  pebbles(C, 41, 52, 91, 40);
  return C.toArt();
}

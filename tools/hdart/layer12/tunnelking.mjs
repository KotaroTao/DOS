import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lampHeap, lantern, chain, soot, murkMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "el_tunnelking", key: "hd_tunnelking", w: 112, h: 128,
  note: "穴蔵の王 (強敵): 灯籠の山の奥に穴蔵を掘り、黒く濁った灯籠を宝として溜めこんできた、背の大きく曲がった大男。土気色の肌、長い腕、猫背で首を突き出す。頭には小さな灯籠を編んだ冠。背には灯籠を鎖でつないだ長いぼろのマントを引きずり、床の灯籠の山へ続く。胸の前に光る灯籠を一つ、大事そうに両手で抱える。闇這いの蟲を呼んで灯籠を運ばせ (招来)、隊の懐から金貨をかすめ取る (金貨奪い・多用) — 足元に金貨" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ["#070705", "#15140f", "#25231a", "#363326", "#4a4634", "#5f5a44", "#767056", "#8e876a"], dither: 0.5, amb: 0.24,
      shade: p => 0.07 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rag: { ramp: ["#030203", "#09070a", "#120e12", "#1b161b", "#251e24", "#30272e"], dither: 0.7, amb: 0.24,
      shade: p => 0.14 * Math.sin(p.x * 0.7 + 2 * fbm(p.x * 0.15, p.y * 0.15)) + 0.08 * fbm(p.x * 0.6, p.y * 0.6) },
    iron: FRAME,
    gold: { ramp: ["#100a02", "#3a2a0a", "#6a5018", "#a07e2c", "#d4b050", "#f4dc8a"], spec: 1.2, pow: 30, specCol: "#fff4c8", dither: 0.35 },
    eye: { ramp: ["#3a2a06", "#d0a040", "#fff0b0"], emit: () => 0.95 },
    maw: { ramp: ["#000000", "#100604", "#221008"], dither: 0.3 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 猫背の大男 (頭は前に突き出し、長い腕で灯籠を抱える)
  const J = { head: [42, 44, 10], neck: [48, 50, 6], chest: [58, 60, 0], waist: [62, 76, -2], hip: [62, 84, -2],
    shL: [46, 56, 8], elL: [34, 70, 14], haL: [42, 78, 18], shR: [72, 56, -2], elR: [64, 76, 12], haR: [52, 80, 18],
    hpL: [56, 88, 2], knL: [48, 104, 8], ftL: [44, 124, 8], hpR: [68, 88, -4], knR: [76, 104, 0], ftR: [78, 124, 0] };
  const body = Disp(humanoid(J, { skin: "skin", torso: "rag", hip: "rag", leg: "rag" }, { k: 3, w: { headX: 8.4, headY: 8.4, headZ: 8, neck: 4.6, chestX: 18, chestY: 14, chestZ: 13, waistX: 13, waistY: 9, hipX: 14, arm: 5, arm2: 4.2, wrist: 3.4, thigh: 7, knee: 5.6, ankle: 4.6 } }), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const hump = ellipsoid([62, 54, -6], [16, 12, 12], "rag", 20);
  const nose = cone([40, 46, 17], [34, 51, 19], 2.6, 0.9, "skin");
  const maw = ellipsoid([41, 53, 17], [3.6, 1.1, 2.4], "maw");
  const ears = [cone([48, 42, 6], [54, 36, 4], 2.4, 0.4, "skin"), cone([38, 42, 8], [33, 37, 8], 2, 0.4, "skin")];
  // 灯籠を編んだ冠
  const crown = [torus([42, 36, 10], 8, 1.2, "iron", 0, 14)];
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.05 + k * 0.15), x = 42 - Math.cos(a) * 8, z = 10 + Math.sin(a) * 8; crown.push(lantern([x, 36, z], 1.15, { lit: k % 2 === 0, handle: false })); }
  // 胸に抱えた光る灯籠
  const held = lantern([47, 86, 22], 2.4, { lit: true, handle: true });
  const hands = [...fingers([42, 78, 20], 30, "skin", { n: 4, len: 4, spread: 18, r: 1, curl: 0.6 }), ...fingers([52, 80, 20], 150, "skin", { n: 4, len: 4, spread: 18, r: 1, curl: -0.6 })];
  // 背のマント: 背中から床の灯籠の山へ。灯籠を鎖でつなぐ
  const cape = Disp(U(3, tube([[66, 52, -10, 9], [84, 72, -14, 11], [98, 100, -16, 12], [104, 122, -16, 10]], "rag", { seg: 4 })), (x, y, z) => 1.2 * Math.abs(Math.sin(x * 0.5 + y * 0.2)) + 0.5 * fbm(x * 0.3, y * 0.3));
  const capeLamps = [[78, 66, -2, 1.5], [88, 80, -2, 1.6], [96, 96, -2, 1.7], [104, 112, -4, 1.6], [86, 104, 0, 1.4]].map(([x, y, z, s], i) => lantern([x, y + 6 * s, z], s, { lit: i % 2 === 1, handle: false, rot: (i * 17 % 30) - 15 }));
  const links = [...chain([78, 66, -1], [88, 80, -1], 1.2, "iron", 0.4), ...chain([88, 80, -1], [96, 96, -1], 1.2, "iron", 0.4), ...chain([96, 96, -1], [104, 112, -3], 1.2, "iron", 0.4)];
  const heap = lampHeap(100, 126, -10, 16, 6, { seed: 14101, s: 1.8, lit: 0.3 });
  const eyes = [sphere([38.6, 43, 17.4], 1.1, "eye"), sphere([45, 43, 17.2], 1.1, "eye")];
  const scene = U(0, cavernFloor(56, 127, 54, 15, { seed: 14103, rocks: 3, lamps: 2 }), heap, cape, ...capeLamps, ...links, Sub(U(2, body, hump, nose, ...ears), maw, 0.2), ...crown, held, ...hands, ...eyes);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [47, 80, 32], r: 30, k: 0.55 }] });
  const C = new Canvas(r);
  // 足元にこぼれた金貨
  const R = rand(14105);
  for (let k = 0; k < 14; k++) { const x = Math.round(20 + R() * 40), y = Math.round(119 + R() * 6); const p = C.pix[y * W + x]; if (p && p.m === "bed") { C.set(x, y, k % 3 ? "#d4b050" : "#f4dc8a"); C.set(x + 1, y, "#6a5018"); } }
  murkHalo(C, 47, 82, 20, MURK.slice(0, 3), 0.6);
  murkMotes(C, 14107, 20, [8, 10, 96, 60]);
  shards(C, 14109, ["bed"], 16);
  soot(C, 14111, 44);
  return C.toArt();
}

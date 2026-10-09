import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, toxBubbles, slime, ooze } from "../swamp.mjs";
export const meta = { id: "el_offeringslime", key: "hd_offeringslime", w: 112, h: 128,
  note: "供物のるつぼ (強敵): 地上の人々が奈落の穴へ投げ入れてきた供物が、沼の底に溜まって意思を持った、紫黒の巨大な粘塊。半ば溶けた体の中に、金貨・杯・燭台・骨・小さな器の頭が透けて沈む。頂きの大口がるつぼのように開き、まわりの金貨が光の尾を引いて吸い込まれる (金貨奪い・多用)。突き立った槍も剣も呑まれたまま (物理75)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    ooze: { ramp: ramp(["#020103", "#06040a", "#0c0814", "#130d1e", "#1c1229", "#261936", "#322144", "#412b55"], 8), spec: 1.7, pow: 40, specCol: "#b49ad8", dither: 0.5, amb: 0.22,
      shade: p => 0.1 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2) },
    gold: { ramp: ramp(["#100a02", "#2a1c06", "#4e3810", "#7a5a1c", "#a8822c", "#d4ac48", "#f4d888"], 7), spec: 1.6, pow: 30, specCol: "#fff4c8", dither: 0.35, amb: 0.3 },
    bone: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054"], 5), dither: 0.45, amb: 0.3 },
    wood: { ramp: ramp(["#040302", "#0e0a06", "#1a130b", "#281e12", "#382a19", "#4a3822"], 6), dither: 0.5, amb: 0.24 },
    steel: { ramp: ramp(["#030304", "#0c0d10", "#1a1c20", "#2c2f34", "#44484e"], 5), spec: 1.2, pow: 30, dither: 0.4 },
    maw: { ramp: ["#000000", "#05020a", "#0e0618", "#1c0e2c"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: ["#5a3a0a", "#d4a030", "#fff0a0"], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 粘塊: るつぼ形 (下が広く、頂きが開く)
  const mass = Disp(U(6, ellipsoid([56, 104, -2], [48, 20, 22], "ooze"), ellipsoid([56, 78, 0], [36, 22, 18], "ooze"), ellipsoid([56, 56, 0], [30, 14, 16], "ooze")),
    (x, y, z) => ooze(1.6, 0.14)(x, y, z) + 0.8 * Math.max(0, vnoise(x * 0.3, y * 0.3, z * 0.3) - 0.3));
  const lip = Disp(ellipsoid([56, 48, 0], [30, 8, 16], "ooze"), ooze(1, 0.25));
  const maw = ellipsoid([56, 46, 4], [20, 7, 12], "maw");
  // 透けて沈む供物 (表面すれすれ)
  const R = rand(11101);
  const items = [];
  for (let i = 0; i < 9; i++) { const x = 20 + R() * 72, y = 66 + R() * 46, z = 14 + R() * 6; items.push(cyl([x, y, z], [x + 0.4, y + 0.6, z + 0.8], 2.4, "gold", 0.4)); }
  items.push(U(0.4, cone([36, 80, 18], [38, 70, 18], 1, 3, "gold"), cyl([36, 82, 18], [36, 80, 18], 2.4, "gold")));
  items.push(U(0.3, cyl([78, 90, 18], [78, 78, 18], 0.8, "gold"), torus([78, 78, 18], 2.2, 0.6, "gold", 0, 90)));
  items.push(ellipsoid([62, 98, 19], [4, 4, 3.4], "bone"), tube([[24, 98, 18, 1.2], [36, 102, 20, 1]], "bone"), sphere([48, 86, 18], 3.4, "wood"));
  const spear = cyl([88, 70, 10], [104, 30, 6], 1, "wood");
  const spearHead = cone([104, 30, 6], [107, 22, 6], 1.8, 0.2, "steel");
  const sword = U(0.3, cyl([22, 64, 10], [12, 38, 8], 1.2, "steel"), box([11, 36, 8], [3.4, 0.8, 1], "steel", 0.3, -20));
  // 頂きのまわりの金貨 (吸い込まれる)
  const coins = [];
  for (const [x, y, z] of [[20, 26, 10], [30, 18, 12], [86, 22, 10], [96, 32, 10], [42, 12, 8], [74, 10, 8], [12, 40, 10]]) coins.push(cyl([x, y, z], [x + 0.6, y, z + 0.8], 2.2, "gold", 0.4));
  const eyes = [sphere([42, 58, 15], 1.6, "eye"), sphere([70, 58, 15], 1.6, "eye"), sphere([56, 62, 17], 1.2, "eye")];
  const slimeBody = Sub(U(3, mass, lip), maw, 1);
  const scene = U(0, bogFloor(56, 124, 54, 18, { n: 2, seed: 11103, wet: 0.2, logs: 1 }), slimeBody, ...items, spear, spearHead, sword, ...coins, ...eyes);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 40, 20], r: 30, k: 0.35 }] });
  const C = new Canvas(r);
  // 供物を粘液で半ば覆う (透け)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = C.pix[y * W + x]; if (p && (p.m === "gold" || p.m === "bone" || p.m === "wood") && p.y > 60 && (x + y * 2) % 3 === 0) C.set(x, y, "#261936"); }
  // 金貨の光の尾 (口へ)
  for (const [x, y] of [[20, 26], [30, 18], [86, 22], [96, 32], [42, 12], [74, 10], [12, 40]]) for (let t = 0.2; t < 0.9; t += 0.05) { const X = x + (56 - x) * t, Y = y + (44 - y) * t; if (!C.get(Math.round(X), Math.round(Y))) C.set(X, Y, ["#7a5a1c", "#a8822c", "#d4ac48"][Math.floor(t * 3)]); }
  // 口の中の渦
  for (let a = 0; a < Math.PI * 6; a += 0.08) { const rr = 2 + a * 0.9, x = 56 + Math.cos(a) * rr, y = 46 + Math.sin(a) * rr * 0.32; const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && p.m === "maw" && Math.sin(a * 3) > 0) C.set(x, y, "#322144"); }
  toxBubbles(C, 11105, 26, [6, 30, W - 12, 30], ["#1c1229", "#412b55", "#b49ad8"]);
  slime(C, 11107, ["ooze"], 0.1, ["#0c0814", "#1c1229", "#412b55"]);
  scum(C, 11109);
  motes(C, 11111, 26, [2, 2, W - 4, 90], false, ["#2a1c06", "#4e3810", "#7a5a1c", "#d4ac48"]);
  return C.toArt();
}

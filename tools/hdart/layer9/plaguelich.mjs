import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, miasma } from "../swamp.mjs";
export const meta = { id: "bs_plaguelich", key: "hd_plaguelich", w: 96, h: 96,
  note: "疫病のリッチ: 病を術として究めた術師の死霊。干からびた骸に腐った法衣をまとい、帯には病の混ぜ薬の小瓶がいくつも下がる。片手に黄緑の膿の詰まった宝珠をかかげ、もう片手を振ると、ひび割れた禍言の輪が隊の加護をまとめて断ち切る (打ち消し)。砕けても宝珠を依代に一度だけ踏みとどまる (不屈)" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#030302", "#090906", "#12120b", "#1c1c11", "#272716", "#33331c"], 6), dither: 0.6, amb: 0.2,
      shade: p => 0.14 * Math.sin(p.x * 0.9 + 2 * fbm(p.x * 0.1, p.y * 0.08)) },
    bone: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054", "#9a9474"], 6), dither: 0.45, amb: 0.3 },
    glass: { ramp: ramp(["#08100a", "#14281a", "#244232", "#3a644c", "#5e8a6a"], 5), spec: 1.8, pow: 50, specCol: "#e0ffe8", dither: 0.4 },
    gold: { ramp: ramp(["#0e0a04", "#2a200c", "#4e3e1a", "#7a6430", "#a48c50"], 5), spec: 1, pow: 26, dither: 0.4 },
    hole: { ramp: ["#000000", "#020201"], amb: 0, dif: 0.05, noRim: true },
    orb: { ramp: ROT, noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [48, 24, 4], neck: [48, 30, 3], chest: [48, 40, 2], waist: [48, 52, 2], hip: [48, 60, 2],
    shL: [39, 35, 6], elL: [28, 40, 12], haL: [20, 34, 16], shR: [57, 35, 0], elR: [66, 44, 6], haR: [72, 38, 10] };
  const body = humanoid(J, { skin: "bone", torso: "robe", arm: "robe" }, { w: { headX: 4.6, headY: 5.6, chestX: 8.6, chestY: 8, waistX: 7, hipX: 8, arm: 2.8, arm2: 2.4, wrist: 1.4 } });
  const robe = Disp(slab([[36, 32], [60, 32], [66, 60], [70, 90], [56, 86], [48, 92], [38, 86], [26, 90], [30, 60]], 0, 6, "robe", 2, 2), (x, y, z) => 0.9 * Math.sin(x * 0.8 + fbm(x * 0.2, y * 0.2) * 2) * Math.max(0, (y - 44) / 46));
  const collar = Disp(U(1, cone([40, 30, 2], [32, 16, -2], 3.6, 0.5, "robe"), cone([56, 30, 2], [64, 16, -2], 3.6, 0.5, "robe")), (x, y, z) => 0.3 * fbm(x * 0.6, y * 0.6));
  const skull = Sub(U(1, ellipsoid([48, 23, 4], [5, 6, 5], "bone"), ellipsoid([48, 29, 6], [3.2, 2.4, 3], "bone")), U(0, ellipsoid([46, 22.4, 8.6], [1.4, 1.6, 1.2], "hole"), ellipsoid([50, 22.4, 8.6], [1.4, 1.6, 1.2], "hole")), 0.2);
  const crown = U(0.4, torus([48, 18.4, 4], 5, 0.8, "gold", 0, 12), ...[[-4, 0], [0, -1.6], [4, 0]].map(([dx, dy]) => cone([48 + dx, 18 + dy, 8], [48 + dx, 13 + dy, 8], 1, 0.2, "gold")));
  const eyes = [sphere([46, 22.6, 8], 0.7, "eye"), sphere([50, 22.6, 8], 0.7, "eye")];
  // 宝珠 (左手でかかげる)
  const orb = U(0.4, sphere([18, 28, 16], 4.4, "orb"), torus([18, 28, 16], 4.6, 0.6, "gold", 0, 20));
  const handL = [ellipsoid([20, 34, 16], [1.8, 2, 1.6], "bone"), ...fingers([20, 33, 16], -100, "bone", { n: 4, len: 4, spread: 30, r: 0.5, curl: 0.6, z: 0.4 })];
  const handR = [ellipsoid([73, 38, 11], [1.8, 2, 1.6], "bone"), ...fingers([74, 37, 11], -30, "bone", { n: 4, len: 5, spread: 40, r: 0.5, curl: 0.2, z: 0.4 })];
  // 帯の小瓶
  const vials = [];
  for (const [x, y, s] of [[40, 56, 1], [46, 58, 1.2], [53, 57, 0.9], [58, 55, 1]]) vials.push(U(0.3, ellipsoid([x, y + 3 * s, 9], [1.6 * s, 2.2 * s, 1.6 * s], "glass"), cyl([x, y, 9], [x, y + 1.4 * s, 9], 0.6 * s, "bone")));
  const belt = torus([48, 53, 2], 8, 1, "gold", 0, 12);
  const scene = U(0, bogFloor(48, 94, 44, 14, { n: 2, seed: 10801, wet: 0.2, logs: 1 }), robe, U(1, body, collar), skull, crown, ...eyes, orb, ...handL, ...handR, belt, ...vials);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [18, 28, 26], r: 28, k: 0.5 }] });
  const C = new Canvas(r);
  // 小瓶の中身 (黄緑・赤・紫)
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "glass" && p.y > 58) C.set(x, y, x < 44 ? ROT[2] : x < 50 ? "#7a1a20" : x < 56 ? "#5a3a7a" : ROT[3]); }
  // 右手から放つ、ひび割れた禍言の輪 (打ち消し)
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const x = 82 + Math.cos(a) * 10, y = 32 + Math.sin(a) * 14;
    if (C.get(Math.round(x), Math.round(y))) continue;
    if (Math.sin(a * 5) > -0.5) C.set(x, y, Math.sin(a * 9) > 0.5 ? ROT[4] : ROT[2]);
  }
  for (const [x0, y0] of [[80, 20], [86, 40], [76, 36]]) for (let k = 0; k < 4; k++) if (!C.get(x0 + k, y0 + (k % 2))) C.set(x0 + k, y0 + (k % 2), ROT[1]);
  // 宝珠の光の輪
  for (let a = 0; a < Math.PI * 2; a += 0.1) { const x = 18 + Math.cos(a) * 9, y = 28 + Math.sin(a) * 9; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 6) > 0.2) C.set(x, y, ROT[1]); }
  scum(C, 10803);
  miasma(C, 10805, 2, [0, 62, 96, 24], 0.25);
  motes(C, 10807, 18, [2, 2, 92, 70], true);
  return C.toArt();
}

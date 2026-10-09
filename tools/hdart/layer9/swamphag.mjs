import { sphere, ellipsoid, cone, tube, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, scum, motes, dissolve, slime } from "../swamp.mjs";
export const meta = { id: "bs_swamphag", key: "hd_swamphag", w: 96, h: 96,
  note: "沼の魔女: よどんだ水面の上に浮かぶ、藻と腐肉をまとった痩せた老婆の霊。長い灰色の髪が水草のように垂れ、裾は霧にほどけて水面に溶ける。口を開いて眠りの子守歌を歌うと、淡い紫の音の輪が広がり、聞いた者はまぶたが落ちる (眠り・多用)。片手の泥の灯からこぼれる雫で、仲間の傷を繕う (治癒役)" };
export function build() {
  const mats = {
    rag: { ramp: ramp(["#020302", "#070a06", "#0e140c", "#161f12", "#202c18", "#2b3a1f"], 6), dither: 0.6, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 1.1 + 2 * fbm(p.x * 0.12, p.y * 0.08)) },
    skin: { ramp: ramp(["#060706", "#121411", "#20241e", "#30352c", "#42483c", "#565c4e"], 6), dither: 0.45, amb: 0.3 },
    hair: { ramp: ramp(["#060606", "#121210", "#20201c", "#30302a", "#42423a", "#56564c"], 6), dither: 0.5, spec: 0.5, pow: 18 },
    maw: { ramp: ["#000000", "#060304"], amb: 0, dif: 0.05, noRim: true },
    lamp: { ramp: ROT, noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: ["#3a2a4a", "#8a6aa8", "#d8c0f0"], emit: () => 0.9 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [44, 24, 6], neck: [46, 30, 4], chest: [48, 40, 2], waist: [49, 52, 2], hip: [50, 60, 2],
    shL: [40, 35, 6], elL: [30, 42, 10], haL: [22, 40, 14], shR: [56, 35, 0], elR: [64, 46, 6], haR: [70, 52, 10] };
  const body = humanoid(J, { skin: "skin", torso: "rag", arm: "rag" }, { w: { headX: 5, headY: 6.4, chestX: 8, chestY: 8, waistX: 6.4, hipX: 7, arm: 2.2, arm2: 1.8, wrist: 1.2 }, headRot: -10 });
  // 霧にほどける裾 (下へ細く)
  const gown = Disp(slab([[38, 34], [58, 34], [64, 56], [66, 82], [54, 76], [48, 86], [40, 78], [30, 82], [32, 56]], 0, 6, "rag", 2, 2), (x, y, z) => 1.2 * Math.sin(x * 0.7 + y * 0.2 + fbm(x * 0.2, y * 0.2) * 2));
  // 背中へ垂れる長い髪
  const R = rand(10901);
  const hair = [];
  for (let i = 0; i < 9; i++) { const x0 = 40 + i * 1.6, l = 24 + R() * 22; hair.push(tube([[x0, 19, 2 - Math.abs(i - 4) * 0.4, 2], [x0 + 2 + (i - 4) * 0.8, 19 + l * 0.5, -2, 1.6], [x0 + 3 + (i - 4) * 1.4 + R() * 3, 19 + l, -4, 0.5]], "hair", { seg: 3 })); }
  const nose = cone([41, 25, 10], [37, 29, 12], 1.6, 0.4, "skin");
  const mouth = ellipsoid([42, 30, 9.6], [2, 2.4, 1.6], "maw");
  const eyes = [sphere([41, 23, 10], 0.8, "eye"), sphere([45, 22.6, 10.2], 0.8, "eye")];
  const handL = [ellipsoid([21, 40, 15], [1.8, 2, 1.6], "skin"), ...fingers([20, 40, 15], 200, "skin", { n: 4, len: 5, spread: 40, r: 0.55, curl: 0.4, z: 0.4 })];
  // 右手に提げた泥の灯 (治癒の雫がこぼれる)
  const lampCord = cyl([71, 53, 11], [72, 60, 11], 0.4, "rag");
  const lamp = U(0.4, sphere([72, 63, 11], 3.2, "lamp"), torus([72, 63, 11], 3.3, 0.6, "rag", 0, 20));
  const handR = [ellipsoid([70, 52, 11], [1.8, 2, 1.6], "skin"), ...fingers([71, 53, 11], 60, "skin", { n: 4, len: 3.4, spread: 20, r: 0.5, curl: 1.2, z: 0.4 })];
  const scene = U(0, bogFloor(48, 95, 46, 14, { n: 1, seed: 10903, wet: 0.7, logs: 1 }), gown, U(1, body, nose), ...hair, ...eyes, ...handL, ...handR, lampCord, lamp);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [72, 63, 20], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  // 歌う口
  for (let y = 28; y < 33; y++) for (let x = 40; x < 45; x++) if (Math.hypot((x - 42) / 1.6, (y - 30.4) / 2.2) < 1) C.only(x, y, "#060304");
  dissolve(C, 70, 88, { seed: 5, x0: 26, x1: 70, darken: mats.rag.ramp });
  // 眠りの子守歌の音の輪 (口から左へ広がる淡い紫)
  const vio = ["#1c1428", "#2e2240", "#4a3a64", "#76609a", "#b4a0d8"];
  for (const [rr, k] of [[8, 3], [14, 2], [20, 1], [27, 0]]) for (let a = Math.PI * 0.65; a < Math.PI * 1.35; a += 0.03) {
    const x = 38 + Math.cos(a) * rr, y = 30 + Math.sin(a) * rr * 0.9;
    if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 23 + rr) > -0.4) C.set(x, y, vio[k + 1]);
  }
  // 音符のような小さな光
  for (const [x, y] of [[10, 18], [16, 46], [6, 32]]) { C.set(x, y, vio[4]); C.set(x + 1, y, vio[3]); C.set(x + 1, y - 1, vio[3]); C.set(x + 1, y - 2, vio[3]); }
  // 灯からこぼれる癒しの雫
  for (let k = 0; k < 4; k++) { const y = 68 + k * 4; if (!C.get(72, y)) C.set(72, y, ROT[4 - (k > 1 ? 1 : 0)]); }
  slime(C, 10905, ["rag"], 0.08, ["#0e140c", "#202c18", "#3a4c24"]);
  // 水面に映る灯
  for (let y = 88; y < 95; y++) for (let x = 66; x < 78; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "pool" && (x + y) % 2 === 0 && Math.abs(x - 72) < 4 - (y - 88) * 0.4) C.set(x, y, ROT[1]); }
  scum(C, 10907);
  motes(C, 10909, 16, [2, 2, 92, 70], true);
  return C.toArt();
}

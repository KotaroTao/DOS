import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes, afterimage } from "../temple.mjs";
export const meta = { id: "bs_naga", key: "hd_naga", w: 96, h: 96,
  note: "蛇身の巫女: 上は金の頭飾りと薄布をまとった巫女、腰から下は青緑の鱗の大蛇。床に大きくとぐろを巻いて身を高くもたげ、両手に毒の滴る祭儀の短剣を逆手に構える。目にも止まらぬ速さで二度斬りかかり、体の後ろに残像と二筋の斬撃の軌跡が尾を引く" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#050606", "#121616", "#202626", "#30383a", "#424c4c", "#566262", "#6c7a78", "#86948e"], 6), spec: 0.5, pow: 22, dither: 0.45, amb: 0.24 },
    scale: { ramp: ramp(["#030606", "#081614", "#0e2420", "#16342e", "#20463c", "#2c5a4c", "#3a705e", "#4c8a72"], 8), spec: 1.3, pow: 34, specCol: "#a8e8d0", dither: 0.55, amb: 0.26,
      shade: p => (vnoise(p.x * 1.6, p.y * 1.6, p.z * 1.6) > 0.3 ? 0.12 : 0) },
    belly: { ramp: ramp(["#100e08", "#2a2618", "#48422e", "#6a6248", "#8e8462"], 5), dither: 0.5, amb: 0.3, shade: p => (Math.sin(p.y * 1.8) > 0.55 ? -0.18 : 0) },
    gold: { ramp: ramp(["#080502", "#1e1206", "#3a240a", "#5c3a12", "#80561c", "#a8782a", "#d0a040"], 6), spec: 1.6, pow: 36, specCol: "#fff0b0", dither: 0.4 },
    veil: { ramp: ramp(["#0a0610", "#1a1028", "#2c1c40", "#40285a", "#563874"], 4), dither: 0.7, amb: 0.3, shade: p => 0.14 * Math.sin(p.x * 1.2 + p.y * 0.2) },
    hair: { ramp: ramp(["#020203", "#06060a", "#0c0c14", "#14141e", "#1e1e2a"], 4), spec: 1, pow: 30, specCol: "#5a5a7a", dither: 0.5 },
    blade: { ramp: ramp(["#06080a", "#1a2228", "#34424a", "#56666e", "#86969c"], 4), spec: 1.8, pow: 50, specCol: "#e8ffff", dither: 0.3 },
    eye: { ramp: ["#4a3a08", "#c8a018", "#fff070"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  // 蛇身: 床に大きなとぐろ (手前へ張り出す) から、背後で立ち上がって腰へ
  const coilPts = [];
  for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 1.9 + Math.PI * 0.55, rr = 21 - k * 0.5; coilPts.push([46 + Math.cos(a) * rr, 84 - Math.max(0, k - 9) * 1.2, Math.sin(a) * rr * 0.7, 6 - k * 0.1]); }
  const e = coilPts[14];
  const rise = [[e[0], e[1], e[2], 4.6], [e[0] + 2, 72, e[2] - 2, 5], [50, 62, -1, 5.2], [47, 52, 1, 5.4], [46, 46, 2, 5.2]];
  const body = U(1.5, tube(coilPts, "scale", { seg: 3 }), tube(rise, "scale", { seg: 3 }));
  const tail = tube([[coilPts[0][0], coilPts[0][1], coilPts[0][2], 6], [16, 86, 6, 3.6], [8, 82, 7, 2], [6, 74, 6, 0.6]], "scale", { seg: 3 });
  // 腹板: 手前を向いた面と、立ち上がった胴の前
  const bellyPaint = (x, y, z, m) => m === "scale" && ((y < 70 && z > 5.4) || (y >= 70 && y < 80 && z > 8 && Math.abs(x - 46) < 6)) ? "belly" : m;
  // 上半身 (大きめ): 巫女の胴・腕。逆手の短剣を二振り
  const J = { head: [46, 17, 3], neck: [46, 24, 2], chest: [46, 32, 2], waist: [46, 41, 2], hip: [46, 47, 2],
    shL: [37, 28, 2], elL: [28, 34, 6], haL: [22, 26, 10], shR: [55, 28, 2], elR: [64, 35, 6], haR: [71, 28, 10] };
  const torso = humanoid(J, { skin: "skin" }, { w: { headX: 4.8, headY: 5.8, headZ: 5, chestX: 8, chestY: 6.6, waistX: 5.6, hipX: 6.6, arm: 2.3, arm2: 2, wrist: 1.4 } });
  const hands = [ellipsoid([22, 25.5, 10.6], [2, 2.2, 1.8], "skin"), ellipsoid([71, 27.5, 10.6], [2, 2.2, 1.8], "skin")];
  const daggers = [slab([[20.4, 25], [22.2, 25], [17.6, 11], [16.2, 10], [16.8, 13.6]], 11, 0.55, "blade", 0.2, 0.3), slab([[70.6, 27], [72.4, 27], [78, 13], [79.2, 12], [77.8, 16]], 11, 0.55, "blade", 0.2, 0.3)];
  const hilts = [cyl([21.4, 26, 10.6], [23, 31, 10.6], 0.9, "gold"), cyl([71.4, 28, 10.6], [70.6, 33, 10.6], 0.9, "gold"), cyl([18.6, 25.6, 10.6], [24.6, 24.6, 10.6], 0.7, "gold"), cyl([68.6, 27.4, 10.6], [74.6, 26.8, 10.6], 0.7, "gold")];
  // 頭飾り: 金の冠と、蛇の頭を象った額の飾り。左右に垂れる金の房
  const crown = U(0.5, Disp(torus([46, 12.6, 3], 5.2, 1, "gold", 0, -70), (x, y, z) => 0.3 * Math.abs(Math.sin(x * 3))), slab([[42.6, 12], [49.4, 12], [48.4, 4], [46, 1.6], [43.6, 4]], 6.4, 0.7, "gold", 0.3, 0.4));
  const tassel = [tube([[41, 13, 4, 0.7], [40, 18, 5, 0.6], [40.4, 22, 5, 0.4]], "gold"), tube([[51, 13, 4, 0.7], [52, 18, 5, 0.6], [51.6, 22, 5, 0.4]], "gold")];
  const hair = [Disp(ellipsoid([46, 14, 0], [5.6, 5.4, 5], "hair"), (x, y, z) => 0.3 * Math.sin(y * 2)), tube([[43.6, 14, -2, 2.6], [41, 28, -3, 2.8], [42, 42, -3, 1.4]], "hair"), tube([[48.4, 14, -2, 2.6], [51.6, 28, -3, 2.8], [50.6, 42, -3, 1.4]], "hair")];
  // 胸の薄布と金の胸飾り、腰の前垂れ
  const veil = [Disp(ellipsoid([46, 31.4, 4.6], [7.2, 3.4, 3.2], "veil"), (x, y, z) => 0.2 * Math.sin(x * 2)), Disp(slab([[39, 45], [53, 45], [56, 60], [50, 56], [46, 63], [42, 56], [36, 60]], 7.4, 0.6, "veil", 0.4), (x, y, z) => 0.5 * Math.sin(x * 0.9))];
  const neck = Disp(torus([46, 25.6, 3.8], 4.8, 0.9, "gold", 0, -40), (x, y, z) => 0.2 * Math.abs(Math.sin(x * 4)));
  const belt = torus([46, 45, 2], 6.4, 1, "gold", 0, -80);
  const eyes = [sphere([44.2, 17.4, 7.6], 0.75, "eye"), sphere([47.8, 17.4, 7.6], 0.75, "eye")];
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 3, seed: 783, wet: 0.2 }), Paint(U(1, body, tail), bellyPaint), torso, ...hands, ...daggers, ...hilts, crown, ...tassel, ...hair, ...veil, neck, belt, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.1, lights: [{ p: [46, 60, 30], r: 30, k: 0.2 }] });
  const C = new Canvas(r);
  // 残像 (神速): 上半身と立ち上がった胴の後ろへ、淡い影を二重に
  afterimage(C, [[7, -1, 0.55, "#183436"], [14, -2, 0.3, "#0f2224"]], [10, 0, 76, 74]);
  // 刃から滴る毒
  const V = ["#1a3a08", "#3e7a14", "#80c830", "#d0ff80"];
  for (const [x, y] of [[16, 11], [79, 13]]) { C.set(x, y, V[3]); C.set(x, y + 2, V[2]); C.set(x, y + 3, V[1]); C.set(x, y + 6, V[1]); }
  // 二度の斬撃の軌跡
  const T = ["#123236", "#25585e", "#5aa8ae", "#b8f0f0"];
  for (const [cx, cy, r0, a0, a1] of [[30, 30, 20, -2.9, -1.5], [64, 30, 20, -1.6, -0.2]]) for (let a = a0; a < a1; a += 0.008) {
    const t = (a - a0) / (a1 - a0);
    for (let k = 0; k < 2; k++) { const X = Math.round(cx + Math.cos(a) * (r0 + k)), Y = Math.round(cy + Math.sin(a) * (r0 + k)); if (!C.get(X, Y)) C.set(X, Y, T[Math.min(3, Math.floor(t * 3.5) - k < 0 ? 0 : Math.floor(t * 3.5) - k)]); }
  }
  C.set(44, 17, "#fff070"); C.set(47, 17, "#fff070");
  ripples(C, 785);
  bubbles(C, 787, 8);
  motes(C, 789, 8);
  return C.toArt();
}

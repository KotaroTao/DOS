import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall, puffs } from "../ice.mjs";
export const meta = { id: "bs_frostfiend", key: "hd_frostfiend", w: 96, h: 96,
  note: "氷の悪鬼: 奈落へ落ちていった魂が、氷棚で凍りついて鬼になったもの。痩せて背を丸めた青黒い鬼の体は、あちこちが透き通った氷に置き換わり、ひびの奥で凍った魂が青く光る。頭には折れた氷の角、口には氷の牙。両の手のひらから凍える霧を吐き出して、浴びた者の手足の力を奪う (弱体)。砕けた所はすぐに凍り直す (再生)" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030206", "#08060e", "#100c18", "#191424", "#241d32", "#312842", "#423654"], 7), dither: 0.55, spec: 0.5, pow: 20, specCol: "#7a9ab8",
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    ice: { ramp: ramp(["#0d1d31", "#1f3b58", "#2f5674", "#46728e", "#6290aa", "#8ab0c8", "#c4dcec"], 7), spec: 1.6, pow: 40, specCol: "#f0faff", dither: 0.45 },
    maw: { ramp: ["#020408", "#08142a", "#14304e"], dither: 0.4 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    core: { ramp: SOUL, noRim: true, emit: p => 0.35 + 0.5 * Math.max(0, p.nz) },
    shelf: SHELF, snow: SNOW,
  };
  const J = { head: [44, 28, 8], neck: [46, 34, 4], chest: [48, 44, 0], waist: [50, 56, -1], hip: [50, 64, -1],
    shL: [36, 38, 2], elL: [24, 46, 8], haL: [14, 42, 14], shR: [60, 38, 0], elR: [72, 46, 6], haR: [82, 40, 12],
    hpL: [44, 66, 0], knL: [34, 76, 8], ftL: [32, 90, 6], hpR: [56, 66, 0], knR: [66, 76, 6], ftR: [68, 90, 4] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 6, headY: 6, chestX: 14, chestY: 10, chestZ: 9, waistX: 8.5, hipX: 9.5, arm: 4.4, arm2: 3.6, wrist: 2.6, thigh: 5, knee: 4, ankle: 3 } });
  // 体のあちこちが透き通った氷に置き換わる
  const fiend = Paint(Disp(body, (x, y, z) => 0.25 * fbm(x * 0.5, y * 0.5, z * 0.5)), (x, y, z, m) => (m === "skin" && vnoise(x * 0.14, y * 0.14, z * 0.14 + 4) > 0.18) ? "ice" : m);
  const ribs = []; for (let i = 0; i < 4; i++) ribs.push(ellipsoid([48, 40 + i * 3.4, 7], [8 - i, 0.8, 1], "skin"));
  const horns = [tube([[40, 23, 6, 2.2], [32, 16, 4, 1.7], [30, 7, 2, 0.5]], "ice"), tube([[48, 23, 8, 2.2], [53, 17, 8, 1.6], [54, 13, 8, 1]], "ice")]; // 右の角は折れている
  const maw = ellipsoid([44, 32, 13.4], [3.4, 1.6, 1.4], "maw");
  const eyes = [sphere([41.6, 27, 13], 1.1, "eye"), sphere([46.6, 27, 13], 1.1, "eye")];
  const core = sphere([49, 46, 7.4], 2.2, "core");
  const claws = [...fingers([13, 42, 14], 170, "ice", { n: 4, len: 7, spread: 40, r: 0.8, curl: 0.3, z: 0.5 }), ...fingers([83, 40, 12], 10, "ice", { n: 4, len: 7, spread: 40, r: 0.8, curl: -0.3, z: 0.5 })];
  const scene = U(0, iceFloor(48, 94, 42, 13, { n: 3, seed: 10001, snow: 0.08, shards: 2 }), Sub(U(1.2, fiend, ...ribs), maw, 0.3), ...horns, ...eyes, core, ...claws);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [49, 46, 14], r: 14, k: 0.35 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 41, 47, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#3e6684", "#a8c4dc", "#e6f4ff"], seed: 10003 });
  // 氷の部分の奥で光る凍った魂の筋
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "ice" && Math.pow(1 - Math.abs(vnoise(x * 0.3, y * 0.3, 7)), 10) > 0.7) C.set(x, y, SOUL[2]); }
  // 手のひらから吐き出す凍える霧
  puffs(C, [[6, 36, 7], [4, 46, 5], [90, 34, 6], [92, 44, 5]], ["#0c1a2a", "#16304a", "#24486a", "#3e6a8e", "#6a98b8"], { dens: 0.9, seed: 35 });
  hoarfrost(C, ["skin"], { th: 0.4, seed: 37 });
  icicles(C, 10005, ["skin", "ice"], 0.1, 3);
  glints(C, 10007, ["ice"], 5);
  snowfall(C, 10009, 28);
  return C.toArt();
}

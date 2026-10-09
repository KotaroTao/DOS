import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, towerFloor, sparks, rain, clouds, spikes, wetGlint } from "../storm.mjs";
export const meta = { id: "el_stareater", key: "hd_stareater", w: 112, h: 128,
  note: "星喰らい (強敵): 塔の外壁にしがみつき、雷雲の切れ間から夜空の星をひとつずつ喰らってきた大悪魔。夜空を切り取ったような黒紫の肌に、呑みこんだ星の光が点々と透ける。腹まで裂けた大口に、引き寄せられた光の筋が吸いこまれていく。近づく者の命も同じように吸い上げる (吸命・多用)。分厚い闇の皮は突き立てた刃を呑みこむ (物理抵抗75)。背には破れた大翼、頭には曲がった角" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    hide: { ramp: ramp(["#020104", "#060309", "#0c0712", "#140b1d", "#1d1029", "#281637", "#341d46", "#432658"], 8), dither: 0.55, amb: 0.2, spec: 0.5, pow: 24, specCol: "#8a6ab8",
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    wing: { ramp: ramp(["#020104", "#05030a", "#0a0612", "#110a1c", "#190f28", "#221535"], 6), dither: 0.55, amb: 0.22,
      shade: p => 0.14 * (Math.abs(Math.sin(Math.atan2(p.y - 30, p.x - 56) * 6)) - 0.5) },
    horn: { ramp: ramp(["#0a0806", "#1e1a14", "#3a3226", "#5e523e", "#8a7c60", "#b4a888"], 6), spec: 0.8, pow: 24, dither: 0.4 },
    claw: { ramp: ramp(["#08080c", "#1c1c26", "#3a3a4e", "#62627e"], 4), spec: 1, pow: 30 },
    maw: { ramp: ["#000000", "#05020a", "#0e0618"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: ["#6a4a10", "#e8b840", "#fff4c0"], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  const J = { head: [56, 26, 4], neck: [56, 34, 2], chest: [56, 50, 0], waist: [56, 68, 0], hip: [56, 78, 0],
    shL: [40, 42, 4], elL: [26, 56, 10], haL: [22, 74, 14], shR: [72, 42, 0], elR: [88, 54, 6], haR: [92, 72, 10],
    hpL: [46, 82, 2], knL: [38, 96, 8], ftL: [34, 120, 8], hpR: [66, 82, 0], knR: [76, 96, 6], ftR: [80, 120, 6] };
  const body = Disp(humanoid(J, { skin: "hide" }, { w: { headX: 8, headY: 7.4, headZ: 7, chestX: 18, chestY: 13, chestZ: 11, waistX: 13, waistY: 10, waistZ: 9, hipX: 14, arm: 5.4, arm2: 4.4, wrist: 3.4, thigh: 6.4, knee: 5, ankle: 4 }, k: 3 }),
    (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 腹まで裂けた大口 (胸から腹へ縦に)
  const maw = ellipsoid([56, 58, 12], [8, 15, 6], "maw");
  const horns = [tube([[48, 22, 2, 2.6], [38, 14, 0, 2], [34, 4, -2, 1.2], [40, 0, -2, 0.4]], "horn"), tube([[64, 22, 2, 2.6], [74, 14, 0, 2], [78, 4, -2, 1.2], [72, 0, -2, 0.4]], "horn")];
  const eyes = [sphere([52, 26, 11.2], 1.3, "eye"), sphere([60, 26, 11.2], 1.3, "eye"), sphere([56, 22, 11.2], 0.9, "eye")];
  const wingL = slab([[42, 38], [28, 24], [12, 12], [0, 6], [4, 22], [0, 36], [8, 40], [2, 56], [14, 54], [12, 72], [26, 60], [36, 56]], -10, 1, "wing", 0.6, 0.8);
  const wingR = slab([[70, 38], [84, 24], [100, 12], [112, 6], [108, 22], [112, 36], [104, 40], [110, 56], [98, 54], [100, 72], [86, 60], [76, 56]], -10, 1, "wing", 0.6, 0.8);
  const clawsL = fingers([22, 74, 14], 100, "claw", { n: 4, len: 10, spread: 30, r: 1.2, curl: 0.5 });
  const clawsR = fingers([92, 72, 10], 80, "claw", { n: 4, len: 10, spread: 30, r: 1.2, curl: -0.5 });
  const dorsal = spikes([[[46, 36, -6], [44, 28, -10], 2], [[66, 36, -6], [68, 28, -10], 2]], "horn");
  const scene = U(0, towerFloor(56, 126, 52, 15, { n: 3, seed: 12201, wet: 0.2, big: 4 }), wingL, wingR, Sub(body, maw, 0.6), ...horns, ...eyes, ...clawsL, ...clawsR, ...dorsal);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 58, 30], r: 24, k: 0.3 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 49, 63, { step: 2, top: [2, 4], bot: [2, 4], cols: ["#3a3226", "#a09068", "#e8e0c0"], seed: 12203 });
  // 肌に透ける呑んだ星の光
  const R = rand(12205);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = C.pix[y * W + x]; if (!p || (p.m !== "hide" && p.m !== "wing")) continue;
    const v = vnoise(x * 0.9, y * 0.9, 3.3);
    if (v > 0.82 && R() < 0.5) C.set(x, y, v > 0.9 ? "#e8e0ff" : "#8a7ac0");
  }
  // 口へ吸いこまれる光の筋 (星・命)
  for (const [x0, y0, s] of [[4, 100, 1], [108, 104, 2], [14, 8, 3], [100, 6, 4], [8, 40, 5], [106, 40, 6]]) {
    const n = 40;
    for (let k = 0; k < n; k++) {
      const t = k / n, x = x0 + (56 - x0) * t + Math.sin(t * 6 + s) * 4 * (1 - t), y = y0 + (58 - y0) * t;
      if (C.get(Math.round(x), Math.round(y))) continue;
      C.set(x, y, t < 0.15 ? "#fff4c0" : (k % 3 ? "#8a7ac0" : "#4a3a78"));
    }
    C.set(x0, y0, "#ffffff");
  }
  wetGlint(C, 12207, ["hide"], 0.03);
  clouds(C, [[20, 110, 18, 6], [96, 112, 16, 6]], { dens: 0.6, seed: 23 });
  rain(C, 12209, 60, [0, 0, W, H]);
  sparks(C, 12211, 10, [0, 0, W, 40], ["#2a1e48", "#4a3a78", "#8a7ac0", "#c8c0f0", "#ffffff"]);
  return C.toArt();
}

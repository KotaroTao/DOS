import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { STONE, ASHBED, RIM, GHOST, SOULS, ASH, tiers, ashfall, shoutWaves, ashCoat } from "../arena.mjs";
export const meta = { id: "bs_spectreaudience", key: "hd_spectreaudience", w: 96, h: 96,
  note: "亡き観客: 観客席の石段に肩を寄せ合って座る、半ば透けた人々の霊 (群れ)。どの顔も身を乗り出し、拳を振り上げ、口を大きく開けて叫ぶ。口から広がるやじの波を浴びた者は腕の力が抜ける (弱体・多用)。体は薄く、石段が透けて見える (魔法に弱い)。灰の積もった石段の奥は夕暮れの雲海" };
export function build() {
  const mats = {
    ghost: { ramp: GHOST, dither: 0.7, amb: 0.3, noRim: false },
    far: { ramp: GHOST.slice(0, 5), dither: 0.75, amb: 0.3 },
    hole: { ramp: ["#000000", "#020308"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[1], SOULS[2], SOULS[3]], emit: () => 0.9 },
    stone: STONE, ashbed: ASHBED,
  };
  const seats = U(0, box([48, 80, 4], [52, 4.4, 9], "stone", 0.4), box([48, 62, -12], [56, 4.4, 9], "stone", 0.4), box([48, 44, -28], [60, 4.4, 9], "stone", 0.4), box([48, 90, 18], [52, 6, 4], "stone", 0.4));
  // 座る霊 (身を乗り出し、片腕を振り上げる): x, 座面 y, z, 大きさ, 材質, 腕の向き
  const sitter = (x, y, z, s, m, up = 1) => {
    const J = { head: [x - 1 * s, y - 24 * s, z + 3 * s], neck: [x, y - 19 * s, z + 2 * s], chest: [x, y - 13 * s, z + 1 * s], waist: [x, y - 6 * s, z], hip: [x, y - 2 * s, z],
      shL: [x - 6 * s, y - 16 * s, z + 2 * s], elL: [x - 12 * s, y - 22 * s * up, z + 5 * s], haL: [x - 13 * s, y - 30 * s * up, z + 6 * s],
      shR: [x + 6 * s, y - 16 * s, z], elR: [x + 8 * s, y - 8 * s, z + 4 * s], haR: [x + 4 * s, y - 4 * s, z + 7 * s],
      hpL: [x - 3 * s, y - 1 * s, z + 2 * s], knL: [x - 4 * s, y, z + 10 * s], ftL: [x - 4 * s, y + 9 * s, z + 11 * s],
      hpR: [x + 3 * s, y - 1 * s, z + 2 * s], knR: [x + 4 * s, y, z + 10 * s], ftR: [x + 4 * s, y + 9 * s, z + 11 * s] };
    const b = humanoid(J, { skin: m }, { scale: s, w: { headX: 4.6, headY: 5.4, chestX: 7, chestY: 6.4, waistX: 5.4, hipX: 6.4, arm: 2, arm2: 1.6, wrist: 1.3, thigh: 2.6, knee: 2, ankle: 1.5 } });
    const holes = U(0, ellipsoid([x - 2.6 * s, y - 25 * s, z + 7.4 * s], [1.1 * s, 1 * s, 1 * s], "hole"), ellipsoid([x + 0.6 * s, y - 25 * s, z + 7.6 * s], [1.1 * s, 1 * s, 1 * s], "hole"),
      ellipsoid([x - 1 * s, y - 20.6 * s, z + 7.6 * s], [1.8 * s, 2.4 * s, 1.4 * s], "hole"));
    return { body: Sub(b, holes, 0.2), eyes: [sphere([x - 2.6 * s, y - 25 * s, z + 6.8 * s], 0.6 * s, "eye"), sphere([x + 0.6 * s, y - 25 * s, z + 7 * s], 0.6 * s, "eye")], mouth: [x - 1 * s, y - 20.6 * s] };
  };
  const list = [sitter(24, 75, 4, 1, "ghost", 1), sitter(48, 75, 6, 1.05, "ghost", 0.6), sitter(72, 75, 4, 1, "ghost", 1.05), sitter(36, 57, -12, 0.78, "far", 0.9), sitter(60, 57, -12, 0.78, "far", 1), sitter(84, 57, -12, 0.75, "far", 0.7), sitter(12, 57, -12, 0.75, "far", 1)];
  const scene = U(0, seats, ...list.map(o => o.body), ...list.flatMap(o => o.eyes));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  ashCoat(C, ["stone"], { th: -0.7, seed: 5 });
  // 半ば透けた体: 霊の画素をまばらに抜いて奥の石を見せる
  const snap = r.pix;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = snap[y * 96 + x]; if (!p || (p.m !== "ghost" && p.m !== "far")) continue;
    if (((x * 3 + y * 5) % 7 === 0) && fbm(x * 0.2, y * 0.2, 4) < 0.1) C.px[y * 96 + x] = p.m === "far" ? "#16161a" : "#232328";
  }
  // 口から広がるやじの波
  for (const o of list.slice(0, 3)) shoutWaves(C, o.mouth[0], o.mouth[1] - 4, Math.PI * 1.38, { n: 3, gap: 4, spread: 0.45, r0: 8 });
  ashfall(C, 11403, 70);
  return C.toArt();
}

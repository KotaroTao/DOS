import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, GHOST, SOULS, sandFloor, ashfall, afterimage, dissolve } from "../arena.mjs";
export const meta = { id: "bs_ghostgladiator", key: "hd_ghostgladiator", w: 96, h: 96,
  note: "亡霊剣闘士: 砂の下に幾重にも埋もれた、名もない闘士たちの霊。古い四角い大盾と短い剣、羽根の折れた兜。輪郭は陽炎のように揺らぎ、刃を向ければふっとかわす (回避) — 横へ二重三重にぶれる写し。斬りつけるたびに生者の魂の光をかすめ取る (魂奪い・多用) — 剣先に青白い光の糸が絡みついて引かれてくる。脚は砂の中へほどけている (魔法に弱い)" };
export function build() {
  const mats = {
    ghost: { ramp: GHOST, dither: 0.6, amb: 0.3, shade: p => 0.08 * Math.sin(p.y * 0.9 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    pale: { ramp: GHOST.slice(2), dither: 0.5, amb: 0.34 },
    hole: { ramp: ["#000000", "#020308"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [52, 26, 2], neck: [52, 32, 1], chest: [52, 41, 0], waist: [52, 52, 0], hip: [52, 58, 0],
    shL: [44, 37, 4], elL: [36, 44, 10], haL: [32, 50, 14], shR: [60, 37, -2], elR: [68, 44, 4], haR: [74, 38, 10],
    hpL: [47, 61, 2], knL: [44, 72, 6], ftL: [42, 86, 6], hpR: [57, 61, -2], knR: [62, 72, 0], ftR: [64, 86, -2] };
  const body = humanoid(J, { skin: "ghost" }, { w: { headX: 4.6, headY: 5.4, chestX: 8.4, chestY: 7.4, chestZ: 6, waistX: 6.4, hipX: 7.4, arm: 2.6, arm2: 2.2, wrist: 1.6, thigh: 3.4, knee: 2.6, ankle: 2 } });
  const helm = U(0.6, ellipsoid([52, 25, 2], [5.6, 6, 5.6], "pale"), torus([52, 27, 2], 6, 0.9, "pale", 0, 8), Disp(ellipsoid([52, 18, 1], [7, 2.6, 1.8], "ghost"), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 1.8)) - 0.6 * Math.max(0, x - 54) * 0.2));
  const grille = U(0, box([52, 26, 7.6], [3.6, 2.4, 1.2], "hole", 0.3));
  const eyes = [sphere([50.4, 25.4, 6.6], 0.7, "eye"), sphere([53.6, 25.4, 6.6], 0.7, "eye")];
  // 四角い大盾 (左手) と短い剣 (右手)
  const shield = Disp(box([28, 54, 16], [7, 12, 1.4], "pale", 1.2), (x, y, z) => 0.012 * (x - 28) * (x - 28));
  const boss = sphere([28, 54, 17.6], 2.2, "ghost");
  const sword = U(0.3, cone([75, 37, 10], [86, 22, 10], 1.6, 0.3, "pale"), box([74, 38, 10], [2.6, 0.6, 0.8], "ghost", 0.2, 54));
  const scene = U(0, sandFloor(52, 95, 42, 13, { seed: 12901, blood: 0.05, ash: 0.12, flags: 1, swords: 1 }), Sub(U(1.2, body, helm), grille, 0.2), ...eyes, shield, boss, sword);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 盾の縁取りの紋
  for (let y = 44; y <= 64; y++) { C.only(22, y, GHOST[6]); C.only(34, y, GHOST[3]); }
  // 脚を砂の中へほどく (床は残す)
  for (let y = 70; y < 92; y++) for (let x = 30; x < 76; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "ghost" || p.m === "pale") && (y - 70) / 16 + 0.4 * fbm(x * 0.3, y * 0.2, 6) > 0.5 + ((x * 7 + y * 3) % 5) * 0.08) C.px[y * 96 + x] = null; }
  // 陽炎の揺らぎ: 行ごとに横へずれた写し
  afterimage(C, [[-6, 0, 0.32, GHOST[2]], [6, 0, 0.32, GHOST[2]], [-12, 0, 0.14, GHOST[1]]], [14, 6, 76, 70]);
  // 剣先に絡んで引かれてくる魂の光の糸 (左下の隊から)
  for (let t = 0; t <= 1; t += 0.006) { const x = 86 - t * 80, y = 22 + t * 60 + Math.sin(t * 12) * 5; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOULS[t < 0.2 ? 3 : t < 0.6 ? 2 : 1]); }
  for (const [x, y] of [[6, 82], [16, 74], [86, 22]]) { C.set(x, y, SOULS[4]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!C.get(x + dx, y + dy)) C.set(x + dx, y + dy, SOULS[2]); }
  ashfall(C, 12903, 50);
  return C.toArt();
}

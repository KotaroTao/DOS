import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, SOULS, sandFloor, chain, ashfall, sandDust, rough } from "../arena.mjs";
export const meta = { id: "bs_chaingang", key: "hd_chaingang", w: 96, h: 96,
  note: "鎖の囚徒: 足首を一本の鎖で数珠つなぎにされたまま、橋を渡って闘技場へ送られてきた囚人たちの骸 (群れ)。干からびた体にぼろ布、うつろな眼窩の小さな光。三人がつながったまま互いを引きずって押し寄せ、先頭の者は千切れた鎖を頭上で振り回す。倒れかけた者を隣の者が鎖で引き起こす (不屈) — 真ん中の一人は膝をつきかけ、両脇の鎖が張りつめる" };
export function build() {
  const mats = {
    husk: { ramp: ["#050403", "#110d0a", "#201913", "#30261d", "#423528", "#584734", "#6e5a43"], dither: 0.5, amb: 0.24,
      shade: p => 0.1 * Math.sin(p.y * 2.2) * (p.y > 30 && p.y < 60 ? 1 : 0) },
    far: { ramp: ["#040302", "#0d0a08", "#18130f", "#251d17", "#33281f", "#43352a"], dither: 0.55, amb: 0.24 },
    rag: { ramp: ["#040404", "#0c0b0a", "#181614", "#25221e", "#33302a"], dither: 0.6 },
    hole: { ramp: ["#000000", "#010101"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[1], SOULS[2], SOULS[3]], emit: () => 0.9 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const W = { headX: 3.6, headY: 4.4, chestX: 5.6, chestY: 6, chestZ: 4.2, waistX: 4, waistY: 5, hipX: 5, arm: 1.6, arm2: 1.3, wrist: 1, thigh: 2.2, knee: 1.7, ankle: 1.3 };
  // 囚徒: 足首の位置 [左足, 右足] を返す
  const prisoner = (x, foot, z, m, pose) => {
    const s = 1;
    let J;
    if (pose === "swing") J = { head: [x - 2, foot - 44, z + 2], neck: [x - 1, foot - 39, z + 1], chest: [x, foot - 32, z], waist: [x, foot - 24, z], hip: [x, foot - 19, z],
      shL: [x - 5, foot - 35, z + 2], elL: [x - 9, foot - 42, z + 4], haL: [x - 8, foot - 50, z + 4], shR: [x + 5, foot - 35, z], elR: [x + 8, foot - 28, z + 3], haR: [x + 6, foot - 22, z + 5],
      hpL: [x - 3, foot - 18, z + 2], knL: [x - 7, foot - 9, z + 4], ftL: [x - 9, foot, z + 4], hpR: [x + 3, foot - 18, z], knR: [x + 4, foot - 9, z], ftR: [x + 6, foot, z] };
    else if (pose === "kneel") J = { head: [x - 3, foot - 30, z + 3], neck: [x - 2, foot - 26, z + 2], chest: [x - 1, foot - 20, z + 1], waist: [x, foot - 13, z], hip: [x, foot - 9, z],
      shL: [x - 5, foot - 23, z + 2], elL: [x - 9, foot - 17, z + 3], haL: [x - 12, foot - 12, z + 4], shR: [x + 4, foot - 23, z], elR: [x + 8, foot - 18, z + 2], haR: [x + 11, foot - 13, z + 3],
      hpL: [x - 3, foot - 8, z + 2], knL: [x - 6, foot - 1, z + 6], ftL: [x - 4, foot, z + 2], hpR: [x + 3, foot - 8, z], knR: [x + 7, foot - 6, z + 2], ftR: [x + 8, foot, z] };
    else J = { head: [x - 1, foot - 42, z + 2], neck: [x, foot - 37, z + 1], chest: [x, foot - 30, z], waist: [x, foot - 23, z], hip: [x, foot - 18, z],
      shL: [x - 5, foot - 33, z + 2], elL: [x - 8, foot - 25, z + 4], haL: [x - 11, foot - 19, z + 5], shR: [x + 5, foot - 33, z], elR: [x + 7, foot - 25, z + 2], haR: [x + 6, foot - 18, z + 3],
      hpL: [x - 3, foot - 17, z + 2], knL: [x - 5, foot - 9, z + 4], ftL: [x - 6, foot, z + 4], hpR: [x + 3, foot - 17, z], knR: [x + 5, foot - 9, z], ftR: [x + 7, foot, z] };
    const b = Disp(humanoid(J, { skin: m }, { k: 1.2, w: W }), rough(0.3, 0.5));
    const rag = Disp(cone([x, J.hip[1] + 4, z], [x, J.chest[1], z], 6, 5.4, "rag"), (X, Y, Z) => 0.5 * fbm(X * 0.5, Y * 0.5));
    const h = J.head;
    const holes = U(0, ellipsoid([h[0] - 1.4, h[1] - 0.4, h[2] + 3], [0.9, 0.9, 0.9], "hole"), ellipsoid([h[0] + 1.4, h[1] - 0.4, h[2] + 3], [0.9, 0.9, 0.9], "hole"), ellipsoid([h[0], h[1] + 2.4, h[2] + 3], [1.2, 0.8, 0.8], "hole"));
    const eyes = [sphere([h[0] - 1.4, h[1] - 0.4, h[2] + 2.4], 0.5, "eye"), sphere([h[0] + 1.4, h[1] - 0.4, h[2] + 2.4], 0.5, "eye")];
    const cuffs = [torus(J.ftL, 2.2, 0.8, "iron", 0, 70), torus(J.ftR, 2.2, 0.8, "iron", 0, 70)];
    return { parts: [Sub(b, holes, 0.2), rag, ...eyes, ...cuffs], J };
  };
  const A = prisoner(22, 91, 6, "husk", "swing"), B = prisoner(50, 91, 2, "husk", "kneel"), Cc = prisoner(76, 89, -6, "far", "walk");
  // 足首をつなぐ一本の鎖 (張りつめて)
  const links = [...chain(A.J.ftR, B.J.ftL, 1.6, "iron", 0.65), ...chain(B.J.ftR, Cc.J.ftL, 1.6, "iron", 0.65)];
  // 先頭の振り回す千切れた鎖 (頭上で弧)
  const swing = [];
  for (let i = 0; i < 9; i++) { const a = -2.2 + i * 0.32; swing.push(torus([14 + Math.cos(a) * 12, 34 + Math.sin(a) * 10, 8], 1.3, 0.5, "iron", a * 57, i % 2 ? 0 : 90)); }
  const scene = U(0, sandFloor(48, 95, 46, 13, { seed: 13001, blood: 0.08, ash: 0.14, flags: 1 }), ...A.parts, ...B.parts, ...Cc.parts, ...links, ...swing);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 振り回す鎖の残す弧
  for (let a = -2.6; a < 0.8; a += 0.03) { const x = 14 + Math.cos(a) * 15, y = 34 + Math.sin(a) * 13; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 9) > 0) C.set(x, y, a < -1 ? "#232328" : "#323238"); }
  sandDust(C, 13003, 40, [4, 82, 90, 12]);
  ashfall(C, 13005, 50);
  return C.toArt();
}

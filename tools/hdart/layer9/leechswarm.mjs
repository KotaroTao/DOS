import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, slime, motes } from "../swamp.mjs";
export const meta = { id: "bs_leechswarm", key: "hd_leechswarm", w: 96, h: 96,
  note: "ヒルの群体: 朽ち木の切り株に、無数の黒いぬめったヒルが絡まり合って盛り上がった塊。先端の丸い口がいくつもこちらへ鎌首をもたげ、血を吸って赤黒く膨れた個体が混じる (吸血)。口からは痺れの粘液が糸を引いて垂れ (麻痺・多用)、泥の上にも何匹かが這い出す" };
export function build() {
  const mats = {
    leech: { ramp: ramp(["#020102", "#070508", "#0f0b10", "#18121a", "#231a26", "#302334", "#40304a"], 7), spec: 1.5, pow: 34, specCol: "#8a7a98", dither: 0.5, amb: 0.2 },
    gorged: { ramp: ramp(["#080102", "#1c0408", "#36080e", "#540e16", "#781a20", "#9e2c2a"], 6), spec: 1.4, pow: 30, specCol: "#e08a7a", dither: 0.45 },
    mouth: { ramp: ["#000000", "#140408", "#2c0a10"], amb: 0, dif: 0.2, noRim: true },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const R = rand(9401);
  const stump = Disp(U(2, tube([[46, 92, -6, 13], [46, 70, -6, 10], [47, 56, -6, 8]], "rotwood"), ellipsoid([47, 54, -6], [9, 3, 9], "rotwood")), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 1.2 + 2 * fbm(x * 0.2, y * 0.2))));
  const ls = [], mouths = [];
  // 塊を覆うヒル (切り株にまとわりつく)
  for (let i = 0; i < 30; i++) {
    const a = R() * Math.PI * 2, h = 50 + R() * 38, rr = 9 + (h - 50) * 0.14 + R() * 3;
    const x0 = 46 + Math.cos(a) * rr, z0 = -6 + Math.sin(a) * rr, l = 8 + R() * 6, ang = a + 1.3;
    const mat = R() < 0.18 ? "gorged" : "leech";
    const w = mat === "gorged" ? 2.8 : 2;
    ls.push(tube([[x0, h, z0, w * 0.7], [x0 + Math.cos(ang) * l * 0.5, h - 2 + R() * 4, z0 + Math.sin(ang) * l * 0.5, w], [x0 + Math.cos(ang) * l, h - 1 + R() * 3, z0 + Math.sin(ang) * l, w * 0.6]], mat, { seg: 3 }));
  }
  // 鎌首をもたげる頭 (口をこちらへ)
  const heads = [[30, 40, 10, -40], [44, 30, 8, -10], [60, 36, 8, 30], [70, 50, 6, 60], [24, 58, 12, -60], [52, 44, 14, 0]];
  for (const [x, y, z, a] of heads) {
    const rad = a * Math.PI / 180, bx = 46 + (x - 46) * 0.4, by = 60;
    ls.push(tube([[bx, by, z - 6, 2.4], [(bx + x) / 2 - Math.sin(rad) * 3, (by + y) / 2, z - 2, 2.6], [x, y, z, 2.2]], "leech", { seg: 4 }));
    mouths.push(sphere([x - Math.sin(rad) * 1.2, y - Math.cos(rad) * 1.2, z + 1.4], 1.5, "mouth"));
  }
  // 泥を這う個体
  const crawl = [tube([[14, 90, 8, 1.6], [20, 88, 10, 2], [26, 90, 10, 1.4]], "leech", { seg: 3 }), tube([[70, 92, 10, 1.8], [78, 90, 8, 2.2], [84, 92, 8, 1.4]], "gorged", { seg: 3 })];
  const swarm = Disp(U(1.2, ...ls), (x, y, z) => 0.25 * Math.sin(x * 2 + y * 1.5));
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 2, seed: 9403, wet: 0.1, logs: 0 }), stump, Sub(swarm, U(0, ...mouths), 0.3), ...crawl);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 口の歯の輪
  for (const [x, y] of heads) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; C.only(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, "#c8b8a0"); }
  // 体節の細い筋
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "leech" || p.m === "gorged") && Math.sin(p.x * 1.7 + p.y * 1.7) > 0.93) C.set(x, y, p.m === "leech" ? "#070508" : "#1c0408"); }
  // 痺れの粘液 (口から垂れる)
  slime(C, 9405, ["mouth", "leech"], 0.1, [ROT[1], ROT[2], ROT[4]]);
  scum(C, 9407);
  motes(C, 9409, 18, [2, 2, 92, 60], true);
  return C.toArt();
}

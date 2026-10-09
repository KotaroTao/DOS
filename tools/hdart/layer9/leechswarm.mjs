import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, slime, motes } from "../swamp.mjs";
export const meta = { id: "bs_leechswarm", key: "hd_leechswarm", w: 96, h: 96,
  note: "ヒルの群体: 無数の黒いぬめったヒルが絡まり合い、沼のほとりに盛り上がった塊。橙の筋の入った体がとぐろを巻き、いくつもの頭が鎌首をもたげて、歯の輪の並ぶ丸い口をこちらへ開く。血を吸って赤黒く膨れた個体が混じり (吸血)、口からは痺れの粘液が糸を引いて垂れる (麻痺・多用)。泥の上にも何匹かが這い出す" };
export function build() {
  const mats = {
    leech: { ramp: ramp(["#020201", "#070705", "#0f0e0a", "#181610", "#232017", "#302c1f", "#403a29"], 7), spec: 1.6, pow: 34, specCol: "#9a9468", dither: 0.5, amb: 0.2,
      shade: p => (Math.sin(p.x * 0.9 - p.y * 0.4 + p.z * 0.9) > 0.86 ? 0.25 : 0) },
    gorged: { ramp: ramp(["#080102", "#1c0408", "#36080e", "#540e16", "#781a20", "#9e2c2a"], 6), spec: 1.4, pow: 30, specCol: "#e08a7a", dither: 0.45 },
    mouth: { ramp: ["#000000", "#100306", "#24080c"], amb: 0, dif: 0.2, noRim: true },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const R = rand(9401);
  const ls = [];
  // とぐろの塊: 塚の表面を覆う短く太いヒルの体
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI, b = R() * Math.PI * 0.95;
    const x0 = 48 + Math.cos(a) * 26 * Math.sin(b + 0.1), y0 = 88 - Math.sin(a) * 22 * Math.sin(b + 0.2), z0 = -4 + Math.cos(b) * 14;
    const ang = R() * Math.PI * 2, l = 7 + R() * 6;
    const mat = R() < 0.16 ? "gorged" : "leech", w = mat === "gorged" ? 3.2 : 2.4;
    ls.push(tube([[x0 - Math.cos(ang) * l * 0.5, y0 - Math.sin(ang) * l * 0.3, z0, w * 0.6], [x0, y0 - 1, z0 + 2, w], [x0 + Math.cos(ang) * l * 0.5, y0 + Math.sin(ang) * l * 0.3, z0, w * 0.6]], mat, { seg: 3 }));
  }
  const core = Disp(ellipsoid([48, 88, -4], [26, 22, 14], "leech"), (x, y, z) => 0.8 * Math.sin(x * 0.8 + y * 0.6) * Math.sin(z * 0.7 + x * 0.3));
  // 鎌首をもたげ、口をこちらへ向ける頭
  const heads = [[26, 42, 16], [46, 30, 18], [66, 38, 16], [78, 58, 14], [16, 62, 14]];
  const mouths = [], rings = [];
  for (const [x, y, z] of heads) {
    const bx = 48 + (x - 48) * 0.5, by = 70;
    ls.push(tube([[bx, by, -2, 3.6], [(bx + x) / 2 + (x < 48 ? -5 : 5), (by + y) / 2 + 2, 4, 3.4], [x + (x < 48 ? -1 : 1), y + 5, z - 4, 3], [x, y, z - 1, 3.4]], "leech", { seg: 4 }));
    ls.push(ellipsoid([x, y, z + 1], [4.2, 4.2, 2.4], "leech"));
    mouths.push(ellipsoid([x, y, z + 3.4], [2.6, 2.6, 1.8], "mouth"));
    rings.push([x, y]);
  }
  const crawl = [tube([[12, 90, 10, 1.6], [18, 88, 12, 2.2], [24, 90, 12, 1.4]], "leech", { seg: 3 }), tube([[72, 92, 12, 1.8], [80, 90, 10, 2.6], [86, 92, 10, 1.4]], "gorged", { seg: 3 })];
  const swarm = Sub(U(1.2, core, ...ls), U(0, ...mouths), 0.4);
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 1, seed: 9403, wet: 0.1, logs: 1 }), swarm, ...crawl);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 口の歯の輪
  for (const [x, y] of rings) {
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; C.only(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, k % 2 ? "#5a1418" : "#d8ccb0"); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; C.only(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, "#3a0a10"); }
  }
  // 首の体節の輪
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "leech" && p.y < 72 && Math.sin(p.y * 2.1 + p.x * 0.2) > 0.9) C.set(x, y, "#070705"); }
  // 背の橙の筋
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "leech" && p.nz > 0.5 && Math.sin(p.x * 1.3 + p.y * 0.4 - p.z * 0.6) > 0.94) C.set(x, y, p.sh > 0.5 ? "#7a4a1a" : "#4a2a10"); }
  // 痺れの粘液 (口から垂れる糸)
  for (const [x, y] of rings) { const l = 4 + ((x * 7) % 5); for (let k = 3; k < 3 + l; k++) if (!C.get(x, y + k) || C.pix[(y + k) * 96 + x]?.m === "leech") C.set(x + (k > 5 ? 0 : 0), y + k, k === 2 + l ? ROT[4] : ROT[2]); }
  slime(C, 9405, ["leech", "gorged"], 0.05, [ROT[1], ROT[2], ROT[3]]);
  scum(C, 9407);
  motes(C, 9409, 18, [2, 2, 92, 50], true);
  return C.toArt();
}

import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, REED, ROTWOOD, RIM, ROT, bogFloor, reeds, reedTips, scum, motes } from "../swamp.mjs";
export const meta = { id: "bs_venomspider", key: "hd_venomspider", w: 96, h: 96,
  note: "猛毒の大蜘蛛: 枯れた葦のあいだに巣を張った、人を捕らえるほどの大蜘蛛。黒い体に、毒を蓄えた腹の黄緑の警告の縞。前脚を高く振り上げ、毒の滴る大きな牙で続けざまに噛みつく (毒・多用、二連撃)。巣には糸で巻かれた獲物が吊るされる" };
export function build() {
  const mats = {
    chitin: { ramp: ramp(["#020202", "#060605", "#0d0c0a", "#161410", "#201d17", "#2c281f", "#3a3428"], 7), spec: 1.3, pow: 32, specCol: "#8a8468", dither: 0.45, amb: 0.2 },
    hair: { ramp: ramp(["#020202", "#070605", "#100e0b", "#1a1712"], 4), dither: 0.6 },
    fang: { ramp: ramp(["#0a0806", "#2a2014", "#4a3a24", "#7a6440", "#a88e60"], 5), spec: 1, pow: 30, dither: 0.4 },
    cocoon: { ramp: ramp(["#0c0c0a", "#22221c", "#3a3a30", "#545446", "#70705e"], 5), dither: 0.6, amb: 0.3 },
    eye: { ramp: ["#3a0606", "#b01a10", "#ff7050"], emit: () => 0.95 },
    mud: MUD, pool: POOL, reed: REED, rotwood: ROTWOOD,
  };
  const ceph = ellipsoid([42, 56, 4], [10, 8, 9], "chitin", -10);
  const abd = ellipsoid([62, 48, -6], [15, 13, 13], "chitin", -20);
  const head = ellipsoid([32, 58, 8], [6, 5, 6], "chitin");
  const fangs = [tube([[28, 62, 12, 1.8], [26, 68, 13, 1.4], [28, 72, 12, 0.5]], "fang"), tube([[34, 63, 14, 1.8], [33, 69, 15, 1.4], [35, 73, 14, 0.5]], "fang")];
  // 脚: 根元 → 膝 → 先。前の二本は振り上げる
  const legDefs = [
    [[36, 52, 8], [24, 30, 12], [10, 22, 12], 2.6], [[38, 54, 10], [26, 36, 16], [16, 34, 18], 2.4],
    [[44, 60, 10], [28, 66, 16], [18, 90, 16], 2.4], [[46, 60, 4], [34, 70, 6], [26, 90, 6], 2.2],
    [[48, 60, -2], [62, 66, 6], [70, 90, 8], 2.2], [[50, 58, 6], [70, 62, 14], [82, 90, 14], 2.4],
    [[48, 56, -6], [64, 60, -10], [78, 90, -10], 2], [[46, 54, -8], [58, 40, -14], [88, 70, -14], 2],
  ];
  const legs = legDefs.map(([a, k, f, r]) => tube([[...a, r], [...k, r * 0.8], [...f, r * 0.35]], "chitin", { seg: 3 }));
  const eyes = [[30, 55, 12.6, 1.1], [34, 54, 12.6, 1.2], [28, 57, 12, 0.7], [36, 56, 12.8, 0.7], [31, 53, 11.8, 0.6], [33, 52.6, 11.8, 0.6]].map(([x, y, z, r]) => sphere([x, y, z], r, "eye"));
  // 糸で巻かれた獲物 (右上に吊るす)
  const cocoon = Disp(ellipsoid([84, 26, -10], [4.6, 9, 4], "cocoon", 10), (x, y, z) => 0.4 * Math.abs(Math.sin(y * 1.6 + x * 0.4)));
  const reedList = [[6, 92, -16, 64, 4], [10, 92, -18, 50, -3], [90, 92, -16, 70, -4], [94, 92, -18, 56, 2]];
  const body = Disp(U(1.4, ceph, abd, head), (x, y, z) => 0.2 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 1, seed: 10201, wet: 0.2, logs: 1 }), body, ...legs, ...fangs, ...eyes, cocoon, ...reeds(reedList));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  reedTips(C, reedList);
  // 腹の警告の縞 (黄緑)
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "chitin" || Math.hypot((p.x - 62) / 15, (p.y - 48) / 13) > 1) continue;
    const s = Math.sin((p.x - 62) * 0.5 + (p.y - 48) * 0.9);
    if (s > 0.7 && p.nz > 0.3) C.set(x, y, p.sh > 0.5 ? ROT[3] : ROT[2]);
  }
  // 巣の糸 (葦と葦のあいだ)
  const web = ["#2a2a24", "#45453c", "#6a6a5a"];
  const ctr = [76, 30];
  for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.95 + k * 0.42, L = 36; for (let t = 0.1; t < 1; t += 0.02) { const x = ctr[0] + Math.cos(a) * L * t, y = ctr[1] + Math.sin(a) * L * t * 0.8; if (!C.get(Math.round(x), Math.round(y)) && (Math.round(x * 3 + y) % 2 === 0)) C.set(x, y, web[1]); } }
  for (const rr of [8, 15, 23, 31]) for (let a = -Math.PI; a < 0.3; a += 0.03) { const x = ctr[0] + Math.cos(a) * rr, y = ctr[1] + Math.sin(a) * rr * 0.8; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 22) > -0.2) C.set(x, y, web[0]); }
  // 牙から滴る毒
  for (const [x, y, l] of [[28, 73, 6], [35, 74, 8]]) for (let k = 0; k < l; k++) if (!C.get(x, y + k)) C.set(x, y + k, k === l - 1 ? ROT[5] : ROT[3]);
  scum(C, 10203);
  motes(C, 10205, 10, [2, 2, 92, 40], true);
  return C.toArt();
}

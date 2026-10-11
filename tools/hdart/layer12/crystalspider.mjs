import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, CRYSTAL, RIM, cavernFloor, specks, glints, soot, shards } from "../cavern.mjs";
export const meta = { id: "bs_crystalspider", key: "hd_crystalspider", w: 96, h: 96,
  note: "晶蟲の大蜘蛛: 水晶の脚と甲殻の大蜘蛛。透きとおった白青の腹の奥に、呑んだ濁った魂の黒い粒が漂う。関節で折れ曲がる八本のとがった水晶の脚、前の二本を振り上げて続けざまに二度突く (2連撃)。水晶の甲殻は呪文をまったく通さない (魔法抵抗100) — 刃で継ぎ目を割るしかない。脚の間に切れた水晶の糸" };
export function build() {
  const mats = {
    xtal: CRYSTAL,
    joint: { ramp: ["#03050a", "#0a1420", "#142438", "#1e3650"], dither: 0.4, amb: 0.2 },
    eye: { ramp: ["#244258", "#9cc4d6", "#f0fbff"], emit: () => 0.95 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const facet = (x, y, z) => 0.4 * Math.abs(Math.sin(x * 0.7 + y * 0.4)) * Math.abs(Math.sin(y * 0.6 - z * 0.5));
  const abdomen = Disp(ellipsoid([60, 54, -2], [18, 14, 14], "xtal", -14), facet);
  const thorax = Disp(ellipsoid([38, 62, 4], [11, 8, 10], "xtal", 6), facet);
  const head = Disp(ellipsoid([28, 64, 8], [6.4, 5.4, 6.4], "xtal"), facet);
  const fangsS = [cone([24, 66, 12], [21, 74, 12], 1.6, 0.2, "xtal"), cone([28, 67, 13], [27, 75, 13], 1.6, 0.2, "xtal")];
  // 八本の脚: [付け根, 膝, 先]
  const legDefs = [
    [[34, 60, 10], [18, 40, 16], [8, 24, 16]], [[36, 60, 10], [22, 46, 14], [14, 36, 18]], // 振り上げた前脚
    [[38, 64, 10], [20, 56, 14], [10, 92, 12]], [[42, 66, 10], [32, 52, 14], [26, 92, 12]],
    [[44, 64, -4], [56, 44, -8], [66, 92, -8]], [[40, 64, -6], [44, 46, -8], [46, 92, -10]],
    [[46, 66, 8], [64, 58, 12], [80, 92, 10]], [[48, 64, -8], [80, 46, -10], [90, 92, -10]] ];
  const legs = [], joints = [];
  for (const [a, b, c] of legDefs) {
    legs.push(cone(a, b, 2.6, 1.9, "xtal"), cone(b, c, 1.9, 0.3, "xtal"));
    joints.push(sphere(b, 2.4, "joint"));
  }
  const eyes = [[25, 61, 13], [29, 60, 13.4], [27, 63.6, 13.6], [31, 62.4, 13]].map(p => sphere(p, 0.9, "eye"));
  const scene = U(0, cavernFloor(50, 95, 46, 13, { seed: 13101, rocks: 3, lamps: 2 }), U(1.2, abdomen, thorax, head), ...fangsS, ...legs, ...joints, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  specks(C, ["xtal"], { f: 0.32, th: 0.66, seed: 13103, cols: ["#000000", "#05080c"] });
  // 切れた水晶の糸
  for (const [x0, y0, x1, y1] of [[58, 40, 72, 8], [70, 44, 92, 18], [14, 36, 2, 6]]) for (let t = 0; t <= 1; t += 0.02) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * 9) * 1; if (!C.get(Math.round(x), Math.round(y)) && t < 0.85) C.set(x, y, t < 0.5 ? "#4e7e98" : "#244258"); }
  // 突きの軌跡
  for (const [x, y] of [[6, 22], [12, 34]]) for (let k = 1; k < 7; k++) C.only(x - k * 0.5, y - k, "#e6f6ff"), (!C.get(Math.round(x - k * 0.6), Math.round(y - k)) && C.set(x - k * 0.6, y - k, k < 4 ? "#9cc4d6" : "#365e78"));
  glints(C, 13105, ["xtal"], 10);
  shards(C, 13107, ["bed"], 12, ["#05080c", "#244258", "#9cc4d6"]);
  soot(C, 13109, 26);
  return C.toArt();
}

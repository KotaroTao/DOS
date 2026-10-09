import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, slime, motes, toxBubbles, ooze } from "../swamp.mjs";
export const meta = { id: "bs_sludgehydra", key: "hd_sludgehydra", w: 96, h: 96,
  note: "汚泥の多頭: 沼の泥の塚から、泥に塗れた蛇の首が五本もたげる。それぞれの頭が口を開き、続けざまに噛みつく (三連撃)。一本は落とされた首の切り口から、泥が盛り上がって新しい頭が生えかけている (再生)。首は黒緑の鱗に泥が垂れ、眼は腐った魂の黄緑" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020301", "#060904", "#0c1108", "#13190c", "#1c2411", "#263116", "#32401c", "#425224"], 8), spec: 1.1, pow: 28, specCol: "#7a8c4a", dither: 0.5, amb: 0.22,
      shade: p => 0.08 * Math.abs(Math.sin(p.x * 1.6 + p.y * 1.6)) },
    belly: { ramp: ramp(["#0a0905", "#1c1a0e", "#302c18", "#464026", "#5e5634"], 5), dither: 0.45 },
    sludge: { ramp: ramp(["#020201", "#070805", "#0e110a", "#161b0f", "#1f2614"], 5), spec: 1.4, pow: 40, specCol: "#5a6a34", dither: 0.6, amb: 0.25 },
    maw: { ramp: ["#060203", "#1e080a", "#3c1216", "#5c2024"], dither: 0.4 },
    eye: { ramp: [ROT[2], ROT[4], ROT[5]], emit: () => 0.9 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const mound = Disp(ellipsoid([50, 86, -4], [32, 14, 16], "sludge"), ooze(1.4, 0.2));
  // 首: 根元 (塚) → 頭。頭は口を開けて左右を向く
  const necks = [
    { pts: [[40, 80, 0, 5], [30, 64, 4, 4.4], [22, 48, 6, 4], [16, 40, 8, 3.6]], dir: -1 },
    { pts: [[46, 78, -2, 5], [42, 58, 0, 4.4], [36, 38, 2, 4], [32, 26, 6, 3.6]], dir: -1 },
    { pts: [[54, 78, -2, 5], [60, 56, 0, 4.4], [64, 36, 2, 4], [66, 22, 6, 3.6]], dir: 1 },
    { pts: [[60, 80, 0, 5], [72, 66, 2, 4.4], [80, 50, 4, 4], [84, 42, 6, 3.6]], dir: 1 },
  ];
  const parts = [], maws = [], eyes = [];
  for (const { pts, dir } of necks) {
    parts.push(tube(pts, "scale", { seg: 4 }));
    const [hx, hy, hz] = pts[pts.length - 1];
    const skull = ellipsoid([hx + dir * 2, hy - 1, hz + 2], [5.4, 4, 4.6], "scale", dir * 12);
    const snout = cone([hx + dir * 4, hy - 1, hz + 3], [hx + dir * 12, hy + 1, hz + 5], 3.4, 1.6, "scale");
    const jaw = cone([hx + dir * 3, hy + 3, hz + 3], [hx + dir * 11, hy + 7, hz + 5], 2.6, 1.2, "belly");
    parts.push(skull, snout, jaw);
    maws.push(ellipsoid([hx + dir * 9, hy + 3, hz + 6], [4.6, 2, 2.6], "maw", dir * 25));
    eyes.push(sphere([hx + dir * 3, hy - 3, hz + 6], 0.9, "eye"));
  }
  // 落とされた首の切り口から生えかけた新しい頭
  const stump = U(1.2, tube([[50, 78, 4, 4.6], [50, 66, 8, 4.2], [51, 60, 10, 4]], "scale"), ellipsoid([51, 58, 10.5], [4.6, 2, 4.2], "sludge"), ellipsoid([51, 54, 11], [3, 3.6, 2.8], "sludge"));
  const scene = U(0, bogFloor(50, 94, 46, 14, { n: 2, seed: 9701, wet: 0.2, logs: 1 }), mound, Sub(U(1.2, ...parts), U(0, ...maws), 0.4), stump, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 2, 94, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#4a4430", "#a89c74", "#e4dcbc"], seed: 9703 });
  // 生えかけの頭の小さな眼
  C.set(50, 53, ROT[4]); C.set(53, 53, ROT[3]);
  slime(C, 9705, ["scale", "sludge", "maw"], 0.1, ["#0e110a", "#1f2614", "#5a6a34"]);
  toxBubbles(C, 9707, 14, [10, 60, 76, 20]);
  scum(C, 9709);
  motes(C, 9711, 16, [2, 2, 92, 40], true);
  return C.toArt();
}

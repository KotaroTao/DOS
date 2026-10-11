import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, GLOOM, MURK, RIM, lampHeap, stalactite, soot, murkMotes, murkHalo, drips } from "../cavern.mjs";
export const meta = { id: "bs_stalactiteghost", key: "hd_stalactiteghost", w: 96, h: 96,
  note: "つらら石の霊: 天井の岩盤から垂れる大きなつらら石に、濁った魂がしみこんだ霊。石の中ほどに半ば溶けた下向きの顔が浮かび、口と目から紫黒の霊気がにじむ。石の先から黒いしずくが垂れ (石化・多用)、下には小さな灯籠の山。天井ごと描く (揺らさない)。石にしみた霊は呪文の光で散りやすい (魔法弱点)" };
export function build() {
  const mats = {
    stone: { ramp: ["#040404", "#0e0d0c", "#1a1816", "#282522", "#38342f", "#4a453f", "#5e5852", "#76706a"], spec: 0.35, pow: 18, dither: 0.55,
      shade: p => 0.1 * Math.sin(p.y * 1.3 + 2 * fbm(p.x * 0.3, p.y * 0.2)) + 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    face: { ramp: ["#08060c", "#141018", "#221c28", "#322a3a", "#463c50", "#5c5266", "#766c80", "#948aa0"], dither: 0.45, amb: 0.26, shade: p => 0.06 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    hole: { ramp: ["#000000", "#05030a"], amb: 0.02, dif: 0.08, noRim: true },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 天井の岩盤と主のつらら石 (中ほどがふくらみ、そこに顔)
  const roof = Disp(ellipsoid([48, -4, -6], [56, 12, 18], "stone"), (x, y, z) => 1.4 * fbm(x * 0.15, y * 0.2, z * 0.2));
  const main = Disp(U(4, cone([48, 4, 0], [46, 72, 2], 15, 0.6, "stone"), ellipsoid([47, 34, 2], [14, 16, 11], "stone")), (x, y, z) => 0.3 * Math.sin(y * 0.9 + 1.5 * fbm(x * 0.2, y * 0.2)) + 0.6 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const side = [stalactite(18, 6, -4, 26, 4.4, "stone", 1), stalactite(78, 6, -6, 32, 4.8, "stone", -1), stalactite(88, 4, -10, 16, 3, "stone"), stalactite(8, 4, -10, 14, 2.6, "stone")];
  // 半ば溶けた顔: 額は石に呑まれ、伏せた目と開いた口が下の灯籠の山を見下ろす
  const face = Disp(U(1.6, ellipsoid([47, 39, 8], [9.6, 12, 6], "face", 4), cone([47, 38, 12], [47.4, 44, 14.4], 2, 0.8, "face"), ellipsoid([47, 50, 9], [5.4, 3.6, 4.4], "face")),
    (x, y, z) => 0.45 * fbm(x * 0.4, y * 0.3, z * 0.4) - 0.8 * Math.exp(-((y - 33) ** 2) / 4) * (1 - Math.abs(x - 47) / 9));
  const holes = U(0, ellipsoid([43, 37, 12.6], [2.6, 1.2, 2], "hole", -18), ellipsoid([51, 37.6, 12.6], [2.6, 1.2, 2], "hole", 18), ellipsoid([47, 49, 13], [2.6, 2.4, 2.4], "hole"));
  const heap = lampHeap(48, 96, -2, 28, 10, { seed: 12101, s: 1.9, lit: 0.35 });
  const scene = U(0, roof, Sub(U(2, main, face), holes, 0.3), ...side, heap);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 84, 10], r: 30, k: 0.25 }] });
  const C = new Canvas(r);
  // 目と口からにじむ紫黒の霊気
  for (const [x, y] of [[43, 39], [51, 40], [47, 51]]) for (let k = 0; k < 18; k++) { const R = rand(x * 11 + y + k); const X = Math.round(x + (R() - 0.5) * 6), Y = Math.round(y + R() * 6); const p = C.pix[Y * 96 + X]; if (p && (p.m === "face" || p.m === "stone")) C.set(X, Y, GLOOM[R() < 0.5 ? 1 : 3]); }
  // 石の先から垂れる黒いしずく (2列)
  for (const [x, y0, n] of [[46, 72, 10], [78, 38, 6], [18, 32, 5]]) for (let k = 0; k < n; k++) { if (k % 4 === 3) continue; C.set(x, y0 + k + Math.floor(k / 4), k % 4 === 2 ? "#151020" : "#050308"); }
  C.set(46, 86, "#26203a"); C.set(45, 86, "#050308"); C.set(47, 86, "#050308");
  murkHalo(C, 48, 82, 14);
  murkMotes(C, 12103, 24, [6, 50, 84, 34]);
  drips(C, 12105, 4, [10, 40, 76, 30]);
  soot(C, 12107, 30);
  return C.toArt();
}

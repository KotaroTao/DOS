import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, SPORE, RIM, cavernFloor, lantern, soot, sporeMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "bs_glowspore", key: "hd_glowspore", w: 96, h: 96,
  note: "光胞子の群れ: 割れて横倒しになった大きな灯籠のガラスの内側とまわりに群生する、青白く光る小さな茸の群れ (7本)。かさの表は暗い茶灰で、かさの裏とひだが灯と同じ青白い燐光で光る。群れで胞子を吹きかけ (毒・多用)、胞子の光る粒が宙に舞う。薄いかさは呪文の熱ですぐにしおれる (魔法弱点)" };
export function build() {
  const mats = {
    cap: { ramp: ["#050403", "#110d0a", "#1f1812", "#2e241b", "#3e3125", "#4f3f30"], dither: 0.55, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    gill: { ramp: SPORE.slice(1, 6), noRim: true, emit: p => 0.35 + 0.5 * Math.max(0, p.ny) + 0.15 * Math.max(0, p.nz) },
    stem: { ramp: ["#0a1412", "#1a2a28", "#2c4440", "#46645e", "#6a8c84"], dither: 0.5, amb: 0.3 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 立ったまま割れた大きな灯籠 (割れ目の中にも茸)
  const big = Sub(lantern([46, 92, -4], 3.4, { glass: "glass", handle: true }), ellipsoid([48, 74, 8], [9, 10, 8], "glass"), 0.6);
  // 茸 [x, y(かさの中心), z, かさ半径, 柄の長さ, 傾き]
  const shrooms = [[47, 70, 2, 6, 8, -4], [26, 64, 6, 6.4, 22, 14], [68, 60, 4, 7, 24, -14], [42, 80, 6, 4, 6, 10], [55, 80, 4, 3.6, 5, -10], [14, 80, 6, 4.2, 9, 18], [80, 80, 4, 4.6, 9, -20]];
  const parts = [];
  for (const [x, y, z, r, h, lean] of shrooms) {
    const a = lean * Math.PI / 180, bx = x - Math.sin(a) * h, by = y + Math.cos(a) * h;
    parts.push(tube([[bx, by, z, r * 0.32], [x - Math.sin(a) * h * 0.5, y + h * 0.5, z, r * 0.26], [x, y + 1, z, r * 0.24]], "stem", { seg: 2 }));
    parts.push(Sub(ellipsoid([x, y, z], [r, r * 0.72, r], "cap", lean), ellipsoid([x - Math.sin(a) * r * 0.1, y + r * 0.62, z], [r * 0.96, r * 0.5, r * 0.96], "gill", lean), 0.3));
  }
  const scene = U(0, cavernFloor(48, 95, 46, 13, { seed: 12001, rocks: 2, lamps: 1 }), big, ...parts);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [47, 76, 14], r: 24, k: 0.4 }, { p: [47, 74, 2], r: 14, k: 0.7 }] });
  const C = new Canvas(r);
  // かさの表の斑点
  for (const [x, y, z, r] of shrooms) for (let k = 0; k < 4; k++) { const X = Math.round(x + (k - 1.5) * r * 0.4), Y = Math.round(y - r * 0.3 - (k % 2)); const p = C.pix[Y * 96 + X]; if (p && p.m === "cap") C.set(X, Y, "#4f3f30"); }
  // かさの下から吹き出す胞子の煙
  for (const [x, y, z, r] of shrooms.slice(0, 4)) for (let k = 0; k < 14; k++) { const R = rand(x * 7 + k); const X = Math.round(x + (R() - 0.5) * r * 3), Y = Math.round(y + r * 0.6 + R() * 6); if (!C.get(X, Y)) C.set(X, Y, SPORE[R() < 0.3 ? 2 : 1]); }
  // かさの裏のひだ (縁のすぐ下に光る帯)
  for (const [x, y, z, r] of shrooms) for (let X = Math.round(x - r); X <= x + r; X++) {
    let yb = -1; for (let Y = Math.round(y - r); Y <= y + r; Y++) { const p = C.pix[Y * 96 + X]; if (p && p.m === "cap") yb = Y; }
    if (yb < 0) continue;
    const e = Math.abs(X - x) / r;
    C.set(X, yb + 1, SPORE[e > 0.8 ? 3 : 5]); if (e < 0.75) C.set(X, yb + 2, SPORE[X % 2 ? 3 : 4]); if (e < 0.5 && X % 2) C.set(X, yb + 3, SPORE[2]);
  }
  murkHalo(C, 47, 72, 30, SPORE.slice(0, 2), 0.5);
  sporeMotes(C, 12003, 70, [4, 4, 88, 80]);
  shards(C, 12005, ["bed"], 14);
  soot(C, 12007, 30);
  return C.toArt();
}

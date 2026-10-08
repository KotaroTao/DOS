import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, PHOS, bubbles, motes, drips, dissolve } from "../temple.mjs";
export const meta = { id: "bs_drownedpriest", key: "hd_drownedpriest", w: 96, h: 96,
  note: "水底の祈り手: 水を吸って重く垂れた法衣の、溺れた神官の霊。ふやけた白い顔をうつむけて眼を閉じ、濡れた髪が頬に張りつく。胸の前で組んだ手に祈りの数珠と聖印を握り、手元に癒しの青緑の光をともす。背には欠けた文字の輪が回り、隊の加護をほどく禍言を唱える。裾は水の筋にほどけて宙に浮く" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    skin: { ramp: ramp(["#060808", "#141a1a", "#243030", "#384646", "#4e5e5c", "#687a76", "#86988e", "#a6b6aa"], 8), spec: 0.6, pow: 24, specCol: "#c8dcd0", dither: 0.45, amb: 0.24 },
    hair: { ramp: ramp(["#020304", "#060a0c", "#0c1416", "#141e20", "#1e2a2c"], 5), spec: 1.2, pow: 36, specCol: "#5a7a7a", dither: 0.5, amb: 0.2 },
    robe: { ramp: ramp(["#040506", "#0a0e10", "#11181a", "#1a2426", "#243234", "#304244", "#3e5454", "#506866"], 8), spec: 0.7, pow: 22, specCol: "#7a9a96", dither: 0.6, amb: 0.2,
      shade: p => 0.14 * Math.sin((p.x - 48) * 0.75 + p.y * 0.05) + 0.05 * fbm(p.x * 0.4, p.y * 0.4) },
    stole: { ramp: ramp(["#060402", "#140e06", "#24180a", "#382610", "#4e3816", "#6a4c1e", "#86642a"], 7), spec: 1.0, pow: 28, specCol: "#c8a868", dither: 0.5, amb: 0.2 },
    bead: { ramp: ramp(["#050403", "#1a140c", "#3a2e1c", "#62523a"], 4), spec: 1.4, pow: 30, specCol: "#c0a878", dither: 0.3 },
    glow: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#010202", "#030505"], amb: 0.05, dif: 0.1, noRim: true },
  };
  const cx = 48;
  // 顔: うつむいたふやけた顔。閉じた眼のくぼみと、半ば開いた口
  const head = U(1.2, ellipsoid([cx, 25, 3], [6, 7.2, 6], "skin", 0, 18), ellipsoid([cx, 31, 5], [3.6, 2.6, 3.6], "skin"));
  const lids = U(0, ellipsoid([cx - 2.6, 26, 8], [1.8, 0.5, 0.8], "hole"), ellipsoid([cx + 2.6, 26, 8], [1.8, 0.5, 0.8], "hole"), ellipsoid([cx, 31.4, 8.2], [1.6, 0.9, 1], "hole"));
  // 濡れて張りつく髪 (頭頂から肩へ垂れる房)
  const hair = [Disp(ellipsoid([cx, 21, 1], [6.6, 5, 6.2], "hair"), (x, y, z) => 0.3 * Math.sin(x * 2))];
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) hair.push(tube([[cx + s * (3 + j * 1.6), 20, 3 - j, 1.6], [cx + s * (5.6 + j * 1.2), 28, 4 - j, 1.4], [cx + s * (6.2 + j), 38 + j * 3, 3 - j, 0.6]], "hair", { seg: 3 }));
  // 法衣: 首から裾へ大きく広がり、水を吸って重く垂れる
  const robe = Disp(U(2.2, ellipsoid([cx, 40, 0], [11, 6.6, 7], "robe"), cone([cx, 42, 0], [cx, 88, 0], 10, 15, "robe")),
    (x, y, z) => 1.0 * Math.sin(Math.atan2(z, x - cx) * 7 + y * 0.05) * Math.max(0, (y - 46) / 32) + 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4));
  // 裾: 下へ向かって千切れ、水の筋にほどける
  const hemCut = Disp(cyl([cx, 92, 0], [cx, 72, 0], 22, "robe"), (x, y, z) => -7 * Math.max(0, Math.sin(x * 0.55) * 0.6 + vnoise(x * 0.3, 1) * 0.6));
  const robeCut = robe;
  // 頸垂帯 (ストラ): 両肩から前へ垂れる金茶の帯
  const stoles = [slab([[cx - 6.5, 36], [cx - 3, 36], [cx - 3.6, 74], [cx - 7.6, 74]], 7.6, 0.6, "stole", 0.4), slab([[cx + 3, 36], [cx + 6.5, 36], [cx + 7.6, 74], [cx + 3.6, 74]], 7.6, 0.6, "stole", 0.4)];
  const stoleSig = (x, y, z, m) => m === "stole" && y > 60 && y < 66 && (Math.abs(Math.abs(x - cx) - 5.3) < 0.6 || Math.abs(y - 63) < 0.6) ? "hole" : m;
  // 袖と、胸の前で組んだ手
  const sleeves = [Disp(cone([cx - 9, 40, 1], [cx - 3, 54, 9], 3.6, 5.6, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2)), Disp(cone([cx + 9, 40, 1], [cx + 3, 54, 9], 3.6, 5.6, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2))];
  const hands = U(0.8, ellipsoid([cx - 1.6, 50, 12], [2.6, 3.2, 2.4], "skin", 20), ellipsoid([cx + 1.6, 50, 12], [2.6, 3.2, 2.4], "skin", -20));
  // 数珠と聖印 (手から垂れる)
  const beads = [];
  for (let k = 0; k < 9; k++) { const t = k / 8, a = Math.PI * (0.15 + t * 0.7); beads.push(sphere([cx + Math.cos(a) * 6.5, 52 + Math.sin(a) * 9, 12.5], 0.95, "bead")); }
  const sym = U(0.3, cyl([cx, 61, 13], [cx, 68, 13], 0.7, "stole"), cyl([cx - 2.6, 63.4, 13], [cx + 2.6, 63.4, 13], 0.7, "stole"));
  const charm = sphere([cx, 47.5, 13.5], 2, "glow");
  const priest = U(0, Paint(Sub(U(1, head, ...hair), lids, 0.3), (x, y, z, m) => m), U(1.2, robeCut, ...sleeves), ...stoles.map(s => Paint(s, stoleSig)), hands, ...beads, sym, charm);
  const r = render(priest, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [cx, 47, 20], r: 20, k: 0.5 }] });
  const C = new Canvas(r);
  // 背の文字の輪: 青緑の欠けた輪と、ほどけて散る文字の欠片 (打ち消し)
  const P = PHOS;
  for (let a = 0; a < Math.PI * 2; a += 0.012) {
    const x = cx + Math.cos(a) * 25, y = 32 + Math.sin(a) * 25;
    if (Math.sin(a * 5 + 0.6) > 0.55) continue; // 欠け
    const X = Math.round(x), Y = Math.round(y);
    if (!C.get(X, Y)) C.set(X, Y, P[1]);
  }
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2, x = cx + Math.cos(a) * 21.5, y = 32 + Math.sin(a) * 21.5;
    if (Math.sin(a * 5 + 0.6) > 0.55) { // 欠けた所の文字は外へ散る
      const X = Math.round(cx + Math.cos(a) * 30), Y = Math.round(32 + Math.sin(a) * 30);
      if (!C.get(X, Y)) { C.set(X, Y, P[2]); if (!C.get(X + 1, Y - 1)) C.set(X + 1, Y - 1, P[1]); }
      continue;
    }
    const X = Math.round(x), Y = Math.round(y);
    if (C.get(X, Y)) continue;
    const g = i % 3;
    C.set(X, Y, P[2]);
    if (g === 0) C.set(X, Y - 1, P[1]); else if (g === 1) C.set(X + 1, Y, P[1]); else C.set(X - 1, Y + 1, P[1]);
  }
  // 手元の癒しの光の滲み
  for (let a = 0; a < Math.PI * 2; a += 0.3) { const X = Math.round(cx + Math.cos(a) * 5.5), Y = Math.round(47.5 + Math.sin(a) * 4.5); if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, P[1]); }
  C.set(cx - 1, 46, P[4]);
  // 裾は水にほどける
  dissolve(C, 60, 88, { seed: 4, darken: mats.robe.ramp });
  drips(C, 683, ["hair"], 0.06);
  bubbles(C, 685, 10, [4, 4, 88, 88]);
  motes(C, 687, 8, [4, 4, 88, 88], true);
  return C.toArt();
}

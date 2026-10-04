// 足 (長靴・鉄靴・靴・サンダル) と小手 (手袋・籠手) の絵
// 奥と手前の一組を重ねて描く。形 × 筒の高さ × 口 × 留め具 × 爪先 × 飾りを組み合わせる
import { MAT, inPoly, sphereTone } from "./core.js";
import { lit, clampT, layered } from "./front.js";

// ===================== 足 =====================
export function feet(g, th, it) {
  const r = th.r, d = th.deco;
  const heavy = it.weight === "heavy";
  const cloth = it.weight === "cloth";
  const kind = heavy ? r.wpick([["greave", 4], ["sabaton", 1.5]]) : cloth ? r.wpick([["boot", 2], ["shoe", 2], ["slipper", 1.5], ["sandal", 1]]) : r.wpick([["boot", 4], ["shoe", 1], ["sandal", th.motifs.has("wind") || th.motifs.has("wing") ? 1.2 : 0.4]]);
  const mat = heavy ? "M" : cloth ? r.pick(["C", "L", "C", "D"]) : r.pick(["L", "L", "L", "C"]);
  const shaftTop = kind === "shoe" || kind === "slipper" || kind === "sandal" ? r.pick([12, 13]) : kind === "sabaton" ? r.pick([8, 9]) : heavy ? r.pick([2, 3, 4]) : r.pick([3, 4, 5, 6, 7]);
  const toe = r.wpick([["round", 3], ["pointed", 1.5], ["curl", th.motifs.has("demon") || cloth ? 1.5 : 0.3], ["square", heavy ? 2 : 0.5]]);
  const cuff = kind === "shoe" || kind === "slipper" || kind === "sandal" ? r.pick(["flat", "fold"])
    : r.wpick(heavy ? [["knee", 3], ["flat", 1.2], ["spike", th.motifs.has("demon") ? 2 : 0.5], ["flare", 1]] : [["fold", 2], ["fur", th.motifs.has("beast") || th.el === "water" ? 2 : 0.8], ["flat", 2], ["knee", 0.8], ["flare", 1]]);
  const sw = r.pick([4, 5, 5, 6]);
  const ties = kind === "sandal" ? "sandal" : r.wpick([["none", 1.5], ["straps", 1.5], ["buckles", 1.5], ["lace", 1.2], ["studs", 1]]);
  const nTie = r.pick([1, 2, 3]);
  const toeCap = heavy || r.chance(0.25 + d * 0.08);
  const spur = !cloth && r.chance(0.2);
  const twoTone = !heavy && r.chance(0.35);
  const wings = th.motifs.has("wing") || (th.el === "wind" && r.chance(0.6));
  const boot = (G, ox, oy, shade) => {
    const sx0 = ox, sx1 = ox + sw - 1, ank = 13 + oy, sole = 19 + oy;
    const top = shaftTop + oy;
    const tipX = sx0 - (toe === "pointed" ? 6 : 5);
    const pts = [[sx0, top], [sx1 + 1, top], [sx1 + 1.2, sole + 1], [tipX, sole + 1],
      [tipX, sole - (toe === "square" ? 2 : 1)], [tipX + (toe === "square" ? 0 : 1.5), sole - 3.2], [sx0 - 1.2, Math.max(top, ank + 0.5)], [sx0, Math.max(top, ank - 1)]];
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      if (!inPoly(x + 0.5, y + 0.5, pts)) continue;
      if (kind === "sandal" && y < sole - 1 && (y - top) % 3 !== 0 && x >= sx0) continue; // 紐の間は素足
      let t = lit(x + 12 - ox, y, 2 + shade, 1.6, 0.4);
      const rx = x - sx0;
      if (rx >= sw - 1) t -= 1;
      if (rx === 0 && y < ank) t += 0.8;
      if (y >= sole - 2 && x < sx0) t += 0.6;
      if (heavy && y < ank && (y - top) % 3 === 2) t -= 0.9;
      if (heavy && y >= ank && x < sx0 && (sx0 - x) % 2 === 0) t -= 0.6;
      const m = twoTone && y < ank - 2 ? (mat === "L" ? "C" : "L") : mat;
      G.set(x, y, m, clampT(t));
    }
    if (kind === "sandal") for (let y = top; y < sole; y++) for (let x = sx0; x <= sx1; x++) if (!G.get(x, y)) G.set(x, y, "H", clampT(lit(x + 12 - ox, y, 2 + shade, 1.4, 0)));
    // 底と踵
    for (let x = Math.ceil(tipX); x <= sx1 + 1; x++) G.set(x, sole + 1, heavy ? "M" : "D", heavy ? 0 : 1);
    for (let x = sx1 - 1; x <= sx1 + 1; x++) G.set(x, sole + 2, heavy ? "M" : "D", 0);
    if (toe === "curl") { G.set(Math.round(tipX) - 1, sole - 1, mat, 3); G.set(Math.round(tipX) - 1, sole - 2, mat, 3); G.set(Math.round(tipX), sole - 3, mat, 2); }
    if (toeCap) for (let x = Math.ceil(tipX); x <= Math.ceil(tipX) + 2; x++) for (let y = sole - 1; y <= sole; y++) G.set(x, y, "T", clampT(lit(x, y, y === sole - 1 ? 3 : 2, 1, 0)));
    // 筒の口
    const cy = top;
    if (cuff === "fold" || cuff === "fur") for (let x = sx0 - 1; x <= sx1 + 1; x++) for (let y = cy; y <= cy + 2; y++) G.set(x, y, cuff === "fur" ? "B" : "D", clampT(lit(x + 6, y, 2.6 + shade, 1.4, 0) - (y === cy + 2 ? 1.2 : 0) + (cuff === "fur" && (x * 3 + y) % 3 === 0 ? 1 : 0)));
    if (cuff === "knee" || cuff === "spike") for (let x = sx0 - 1; x <= sx1 + 1; x++) for (let y = cy; y <= cy + 3; y++) G.set(x, y, heavy ? "M" : "L", clampT(sphereTone(x + 0.5, y + 0.5, sx0 + sw / 2 - 0.5, cy + 1.2, sw / 2 + 1.6, 2.6, 2.2 + shade)));
    if (cuff === "flare") for (let y = cy; y <= cy + 1; y++) for (let x = sx0 - 2 + (y - cy); x <= sx1 + 2 - (y - cy); x++) G.set(x, y, heavy ? "T" : "D", clampT(lit(x + 6, y, 2.4 + shade, 1.4, 0) - (y - cy)));
    if (cuff === "spike") { G.set(sx0 - 2, cy + 1, "F", 3); G.set(sx0 - 3, cy + 1, "F", 4); }
    // 留め具
    const span = Math.max(1, ank - cy - 3);
    for (let i = 0; i < nTie; i++) {
      const yy = Math.round(cy + 3 + ((i + 0.5) / nTie) * span);
      if (yy >= ank + 1) continue;
      if (ties === "straps") for (let x = sx0; x <= sx1; x++) G.set(x, yy, "T", x === sx0 + 1 ? 3.5 : 1.5);
      else if (ties === "buckles") { for (let x = sx0; x <= sx1; x++) G.set(x, yy, "D", 1); G.set(sx0 + 1, yy, "T", 4); G.set(sx0 + 2, yy, "T", 2); }
      else if (ties === "studs") { G.set(sx0 + 1, yy, "T", 4); G.set(sx1 - 1, yy, "T", 2); }
    }
    if (ties === "lace") for (let y = cy + 2; y <= ank; y += 2) { G.set(sx0 + 1, y, "F", 3); G.set(sx0 + 2, y + 1, "F", 2); }
    if (ties === "sandal") for (let y = cy; y < sole; y += 3) for (let x = sx0 - 1; x <= sx1; x++) G.set(x, y, "L", clampT(lit(x + 6, y, 2.6, 1.4, 0)));
    // 足首の金具
    if (r.chance(0.4) || d >= 1) { G.set(sx0 + 1, ank, "T", 3); G.set(sx0 + 2, ank, "T", 2); }
    if (d >= 2 && cy + 4 < ank) G.set(sx0 + 2, cy + 4, "G", 3);
    if (heavy && d >= 1) for (let x = Math.ceil(tipX) + 1; x < sx0; x++) G.set(x, sole - 1, "T", 2);
    if (spur) { G.set(sx1 + 2, sole, "T", 3); G.set(sx1 + 3, sole, "T", 4); }
  };
  g.def("H", MAT.flesh);
  const dx = r.pick([5, 6, 7]);
  layered(g, (G) => boot(G, 9 + dx, -1, 0.2), (G) => boot(G, 9, 1, 0));
  if (wings) for (let k = 0; k < 4; k++) for (let j = 0; j <= 3 - k; j++) g.set(9 + sw + k, shaftTop + 3 - j + k, "F", 3 - (k >> 1));
}

// ===================== 小手 =====================
export function hands(g, th, it) {
  const r = th.r, d = th.deco;
  const gaunt = it.weight === "heavy";
  const mat = gaunt ? "M" : it.weight === "cloth" ? r.pick(["C", "L", "F", "D"]) : r.pick(["L", "L", "C"]);
  const pair = r.chance(0.55);
  const claws = th.motifs.has("beast") || th.motifs.has("demon") ? r.chance(0.6) : r.chance(0.06);
  const cuffL = gaunt ? r.pick([4, 5, 6]) : r.pick([2, 3, 4, 5]);
  const flare = gaunt ? r.pick([0, 1, 2]) : r.pick([0, 1, 1, 2]);
  const cuffM = gaunt ? r.pick(["M", "M", "T"]) : mat === "F" ? "C" : r.pick(["D", "L", "C", "B"]);
  const fingerless = !gaunt && r.chance(0.18);
  const tips = !gaunt && !fingerless && r.chance(0.2); // 指先の金具
  const knuckle = r.wpick([["none", 2], ["studs", 1.5], ["plate", gaunt ? 2 : 0.5], ["spikes", th.motifs.has("demon") || gaunt ? 1 : 0.2], ["gem", d >= 1 ? 1.5 : 0.3], ["emblem", d >= 2 ? 1 : 0]]);
  const cuffPat = r.wpick([["plain", 2], ["band", 1.5], ["stripes", 1], ["fur", th.motifs.has("beast") ? 2 : 0.4], ["point", gaunt ? 1.5 : 0.3]]);
  const wrap = !gaunt && r.chance(0.15);
  const ringOn = r.chance(0.12 + d * 0.06);
  const fl = r.pick([[4, 5, 5, 4], [4, 5, 5, 3], [3, 4, 4, 3], [5, 6, 6, 4]]);
  const hand = (G, ox, oy, shade) => {
    for (let f = 0; f < 4; f++) for (let k = 0; k < fl[f]; k++) {
      const x0 = ox + f * 2, y = oy + (6 - fl[f]) + k - 1;
      for (let dx = 0; dx < 2; dx++) {
        let t = lit(x0 + dx + 4, y, 2.2 + shade, 1.4, 0.2);
        if (dx === 1 && f < 3) t -= 1.4;
        if (k === 0) t += 0.7;
        if (gaunt && k % 2 === 1) t -= 0.7;
        if (fingerless && k < 2) { if (k === 1) G.set(x0 + dx, y, "H", 3 - dx); continue; }
        G.set(x0 + dx, y, tips && k === 0 ? "T" : mat, clampT(t));
      }
      if (claws && k === 0) { G.set(x0, y - 1, "F", 4); G.set(x0 + 1, y - 1, "F", 2); }
    }
    if (ringOn) { G.set(ox + 4, oy + 3, "T", 4); G.set(ox + 5, oy + 3, "G", 3); }
    for (let y = oy + 5; y <= oy + 10; y++) for (let x = ox; x <= ox + 7; x++) {
      let t = lit(x + 4, y, 2 + shade, 1.8, 0.2) - (x === ox + 7 ? 1 : 0) + (x === ox ? 0.6 : 0);
      if (wrap && (y + x) % 3 === 0) t -= 1;
      G.set(x, y, mat, clampT(t));
    }
    for (let k = 0; k < 4; k++) { const x = ox - 1 - (k > 1 ? 1 : 0); G.set(x, oy + 6 + k, mat, clampT(2.8 + shade)); G.set(x + 1, oy + 6 + k, mat, clampT(1.4 + shade)); }
    if (gaunt || knuckle === "plate") for (let x = ox; x <= ox + 7; x++) { G.set(x, oy + 5, gaunt ? mat : "M", clampT(lit(x + 4, oy + 5, 3.2 + shade, 1.4, 0))); G.set(x, oy + 6, gaunt ? mat : "M", clampT(lit(x + 4, oy + 6, 1.2 + shade, 1.4, 0))); }
    if (knuckle === "studs") for (let x = ox + 1; x <= ox + 6; x += 2) G.set(x, oy + 5, "T", 4);
    if (knuckle === "spikes") for (let x = ox; x <= ox + 6; x += 2) { G.set(x, oy + 4, "F", 4); G.set(x + 1, oy + 5, "F", 2); }
    if (knuckle === "gem") { G.set(ox + 3, oy + 8, "G", 4); G.set(ox + 4, oy + 8, "G", 2); G.set(ox + 3, oy + 9, "G", 2); G.set(ox + 4, oy + 9, "G", 1); }
    if (knuckle === "emblem") for (const [dx, dy, t] of [[3, 7, 4], [4, 7, 3], [2, 8, 3], [3, 8, 3], [4, 8, 2], [5, 8, 1], [3, 9, 2], [4, 9, 1]]) G.set(ox + dx, oy + dy, "T", t);
    for (let y = oy + 11; y <= oy + 11 + cuffL; y++) {
      const w = (y - oy - 11) * flare * 0.35;
      for (let x = Math.round(ox - w); x <= Math.round(ox + 7 + w); x++) {
        const band = y === oy + 11;
        let t = lit(x + 4, y, (band ? 2.8 : 2) + shade, 1.8, 0) - (x === Math.round(ox + 7 + w) ? 1 : 0);
        if (y === oy + 11 + cuffL) t -= 0.8;
        let m = band ? "T" : cuffM;
        if (cuffPat === "stripes" && (y - oy) % 2 === 0) m = "T";
        if (cuffPat === "band" && y === oy + 11 + cuffL - 1) m = "T";
        if (cuffPat === "fur" && y >= oy + 11 + cuffL - 1) { m = "B"; if ((x * 3 + y) % 3 === 0) t += 1; }
        G.set(x, y, m, clampT(t));
      }
    }
    if (cuffPat === "point") { const y = oy + 11 + cuffL + 1; G.set(ox + 3, y, cuffM, 2); G.set(ox + 4, y, cuffM, 1); }
  };
  g.def("H", MAT.flesh);
  if (pair) layered(g, (G) => hand(G, 12, 2, 0.2), (G) => hand(G, 5, 4, 0));
  else hand(g, 8, 3, 0);
}

// 盾・鎧・頭・足・小手・装飾の絵 (24×24、正面向き。左右対称に描いてから光を左上から当てる)
import { MAT, ELEM_COL, tintRamp, Grid, inPoly, sphereTone, line } from "./core.js";
import { stamp, pickEmblem } from "./emblems.js";
import { helm, lightHat, clothHead } from "./head.js";
import { feet, hands } from "./limbs.js";
import { ring, amulet, trinket } from "./accs.js";

import { CX, lit, clampT, shape, layered } from "./front.js";

function mats(g, th, it) {
  let metal = MAT[th.metal] || MAT.steel;
  if (it.eDef) metal = tintRamp(metal, ELEM_COL[it.eDef.el], 0.14);
  g.def("M", metal);
  g.def("T", MAT[th.trim] || MAT.gold);
  g.def("W", MAT[th.wood] || MAT.wood);
  g.def("L", MAT[th.leather] || MAT.leather);
  g.def("G", MAT[th.gem] || MAT.red);
  g.def("C", MAT[th.cloth] || MAT.cloth);
  // 二つ目の布 (裏地・縁取り): 布の色と違う色
  const alt = { red: "amber", blue: "white", green: "amber", purple: "gold", white: "blue", shadow: "red", cloth: "red", teal: "white", amber: "red", pink: "white" }[th.cloth] || "white";
  g.def("D", MAT[alt]);
  g.def("E", MAT[th.glow || th.gem] || MAT.blue);
  g.def("B", MAT.bone);
  g.def("F", MAT.white);
  g.def("P", ["#2a2620", "#57503f", "#8f8670", "#c9c0a6", "#ece4ca"]); // 紙・羊皮紙
}

// ===================== 盾 =====================
// 紋地の塗り分け
function fieldPattern(r) {
  return r.wpick([["plain", 3], ["pale", 1.5], ["fess", 1], ["quarter", 1.5], ["bend", 1], ["chevron", 1], ["cross", 1.2], ["chief", 1], ["bordure", 1]]);
}
function fieldAt(pat, x, y, top, bottom) {
  const mx = x - CX, my = y - (top + bottom) / 2;
  switch (pat) {
    case "pale": return mx < 0 ? 0 : 1;
    case "fess": return my < 0 ? 0 : 1;
    case "quarter": return (mx < 0) === (my < 0) ? 0 : 1;
    case "bend": return mx - my * 1.0 < 0 ? 0 : 1;
    case "chevron": return y > top + 6 + Math.abs(mx) * 0.9 ? 1 : 0;
    case "cross": return Math.abs(mx) < 1.6 || Math.abs(my + 1) < 1.6 ? 1 : 0;
    case "chief": return y < top + 5 ? 1 : 0;
    default: return 0;
  }
}

function kiteShield(g, th, it) {
  const r = th.r, o = th.orn;
  const top = r.pick([1, 2]), bot = 22;
  const Wd = r.pick([9.5, 10, 10.5]);
  const form = r.wpick([["heater", 3], ["kite", 2], ["tower", 1.2], ["flared", 1]]);
  const ym = top + (form === "tower" ? 13 : form === "kite" ? 6 : 9);
  const topForm = r.wpick([["flat", 3], ["arch", 1.5], ["dip", 1], ["notch", 1.2]]);
  const hw = (y) => {
    if (y < ym) return form === "flared" ? Wd - (y - top) * 0.12 : Wd;
    const u = (y - ym) / (bot - ym);
    if (form === "kite") return Wd * (1 - u) ** 0.9;
    if (form === "tower") return Wd * Math.sqrt(Math.max(0, 1 - u * u));
    return Wd * Math.sqrt(Math.max(0, 1 - u ** 1.6));
  };
  const topAt = (x) => {
    const mx = Math.abs(x - CX);
    if (topForm === "arch") return top + (mx / Wd) * 1.6;
    if (topForm === "dip") return top + 1.4 - (mx / Wd) * 1.4;
    if (topForm === "notch") return mx > Wd - 2.2 ? top + 1.5 : top;
    return top;
  };
  const inside = (x, y) => y >= topAt(x) && y <= bot && Math.abs(x - CX) <= hw(y);
  const pat = o === 0 && r.chance(0.5) ? "plain" : fieldPattern(r);
  const t0 = r.pick(["C", "M", "C"]), t1 = t0 === "M" ? "C" : r.pick(["M", "D", "T"]);
  const metalField = t0 === "M" && pat === "plain";
  shape(g, inside, r.pick([1, 2, 2]), "T", (x, y) => {
    const k = pat === "bordure" ? (Math.abs(x - CX) > hw(y) - 3.2 || y < topAt(x) + 3.2 || y > bot - 3 ? 1 : 0) : fieldAt(pat, x, y, top, bot);
    const m = k ? t1 : t0;
    let t = lit(x, y, 2, 1.8, 0.7);
    // 縦の稜線 (金属の盾は中央に稜線)
    if (metalField && Math.abs(x - CX) < 0.6) t = x < CX ? 4 : 1;
    return [m, t];
  });
  // 紋章
  if (o >= 1 || r.chance(0.55)) {
    const em = pickEmblem(th);
    stamp(g, em, 8, top + r.pick([5, 6]), r.pick(["T", "T", "F"]), "G", { base: 2 });
  } else if (r.chance(0.6)) {
    // 鋲
    for (const [x, y] of [[6, top + 4], [17, top + 4], [11, 17], [12, 17]]) g.set(x, y, "T", 3);
  }
  if (o >= 3) { g.set(11, top + 1, "G", 3); g.set(12, top + 1, "G", 2); }
}

function roundShield(g, th, it, small) {
  const r = th.r, o = th.deco;
  const R = small ? r.pick([7, 7.5, 8, 8.5, 9]) : r.pick([9.5, 10, 10.5]);
  const cy = 11.5;
  const notch = small && r.chance(0.2); // 縁の切り欠き (8 つの花弁)
  const inside = (x, y) => {
    const a = Math.atan2(y - cy, x - CX);
    const rr = notch ? R - (Math.cos(a * 8) > 0.8 ? 1 : 0) : R;
    return (x - CX) ** 2 + (y - cy) ** 2 <= rr * rr;
  };
  const face = small ? r.pick(["M", "M", "W", "L", "T"]) : r.pick(["W", "M", "C", "W"]);
  const planks = face === "W" && r.chance(0.7);
  const ringR = r.pick([0, 0.45, 0.6, 0.75]);
  const pat = r.wpick([["plain", 3], ["quarter", face === "C" ? 2 : 0.6], ["pale", face === "C" ? 1 : 0.3], ["rays", 1], ["spiral", 0.6], ["checker", 0.4]]);
  const rim = r.pick([1, 1, 2]);
  shape(g, inside, rim, r.pick(["T", "T", "M"]), (x, y) => {
    const d = Math.hypot(x + 0.5 - CX, y + 0.5 - cy);
    const a = Math.atan2(y + 0.5 - cy, x + 0.5 - CX);
    let m = face;
    if ((pat === "quarter" || pat === "pale") && fieldAt(pat, x + 0.5, y + 0.5, cy - R, cy + R)) m = "D";
    if (pat === "checker" && (Math.floor(a / (Math.PI / 4)) & 1)) m = "D";
    let t = sphereTone(x + 0.5, y + 0.5, CX, cy, R + 1, R + 1, 2);
    if (planks && Math.round(x) % 4 === 0) t -= 1;
    if (ringR && Math.abs(d - R * ringR) < 0.6) t = Math.max(0, t - 1.2);
    if (pat === "rays" && Math.cos(a * r0(o)) > 0.84) m = "T";
    if (pat === "spiral" && Math.abs(((a + d * 0.45) % 1.57 + 1.57) % 1.57 - 0.78) < 0.14) t -= 1;
    return [m, t];
  });
  // 鋲 (縁に沿って)
  if (r.chance(0.7)) {
    const n = r.pick([4, 6, 8, 12]);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const x = Math.round(CX - 0.5 + Math.cos(a) * (R - 1.6 - rim)), y = Math.round(cy - 0.5 + Math.sin(a) * (R - 1.6 - rim));
      g.set(x, y, "T", Math.cos(a) + Math.sin(a) < 0 ? 4 : 2);
    }
  }
  // 盾心 (ボス) か紋章
  const center = r.wpick([["dome", small ? 3 : 1.5], ["spike", 1], ["star", 0.7], ["emblem", small ? 0.6 : 1.5], ["gemboss", o >= 1 ? 1.2 : 0.2]]);
  if (center === "emblem") stamp(g, pickEmblem(th), 8, 8, r.pick(["T", "F", "D"]), "G");
  else {
    const br = small ? r.pick([2.2, 2.6, 3.2]) : r.pick([2.4, 3]);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx);
      const rr = center === "star" ? br * (0.7 + 0.5 * Math.max(0, Math.cos(a * 4)) ** 2) : br;
      if (dx * dx + dy * dy <= rr * rr) g.set(x, y, "T", sphereTone(x + 0.5, y + 0.5, CX, cy, br + 0.6, br + 0.6, 2));
    }
    if (center === "gemboss" || (o >= 2 && r.chance(0.5))) { g.set(11, Math.round(cy) - 1, "G", 4); g.set(12, Math.round(cy) - 1, "G", 2); g.set(11, Math.round(cy), "G", 2); g.set(12, Math.round(cy), "G", 1); }
    if (center === "spike") { g.set(11, Math.round(cy) - 1, "F", 4); g.set(10, Math.round(cy) - 2, "F", 4); g.set(12, Math.round(cy), "F", 2); }
  }
}
const r0 = (o) => 6 + o * 2;

function orbShield(g, th, it) {
  const r = th.r, o = th.deco;
  const R = r.pick([5.5, 6, 6.5, 7, 7.5]);
  const cy = r.pick([9, 9.5, 10, 10.5]);
  const inner = r.pick(["swirl", "star", "eye", "flame", "glint", "cloud", "core", "rune"]);
  // 台座
  const cradle = r.wpick([["claws", 3], ["stand", 2], ["ring", 2], ["wings", th.motifs.has("wing") ? 3 : 0.6], ["chain", 0.8], ["lotus", th.motifs.has("holy") || th.motifs.has("leaf") ? 2 : 0.8], ["pillar", 1]]);
  if (cradle === "pillar") for (let y = Math.round(cy + R - 1); y <= 21; y++) for (let x = 10; x <= 13; x++) g.set(x, y, "T", lit(x, y, y === 21 ? 1 : 2.4, 2.4, 0) - ((y & 1) && x > 11 ? 0.6 : 0));
  if (cradle === "stand" || cradle === "claws") {
    // 脚つきの台
    for (let y = Math.round(cy + R - 2); y <= 21; y++) {
      const w = y >= 19 ? 4.5 : y >= Math.round(cy + R) ? 1.5 : 3;
      for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w) - 1; x++) g.set(x, y, "T", lit(x, y, y >= 20 ? 1 : 2, 2, 0));
    }
  }
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const dx = x + 0.5 - CX, dy = y + 0.5 - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > R * R) continue;
    let t = sphereTone(x + 0.5, y + 0.5, CX, cy, R + 0.8, R + 0.8, 2);
    const a = Math.atan2(dy, dx), d = Math.sqrt(d2);
    if (inner === "swirl" && Math.abs(((a + d * 0.55) % 1.6 + 1.6) % 1.6 - 0.8) < 0.16 && d < R - 1) t = Math.min(4, t + 1);
    if (inner === "star" && d < 3 && Math.cos(a * 4) > 0.75 - d * 0.1) t = 4;
    if (inner === "eye" && Math.abs(dy) < 1.6 - Math.abs(dx) * 0.4 && Math.abs(dx) < 3.6) t = Math.abs(dx) < 0.9 ? 0 : 4;
    if (inner === "core" && d < R * 0.45) { g.set(x, y, "G", Math.min(4, t + 1)); continue; }
    if (inner === "rune" && d < R - 1.5 && (Math.round(x + y) % 4 === 0) && Math.abs(Math.round(x - y) % 4) === 0) t = 4;
    if (inner === "flame" && dy > -3 && dy < 2 && Math.abs(dx) < (2 - dy) * 0.5) t = Math.min(4, t + 2);
    if (inner === "cloud" && Math.sin(x * 1.3 + y * 0.7) > 0.7 && d < R - 1.5) t = Math.max(0, t - 1);
    g.set(x, y, "E", t);
  }
  // 光沢
  g.set(Math.round(CX - R * 0.45) - 1, Math.round(cy - R * 0.5) - 1, "F", 4);
  g.set(Math.round(CX - R * 0.45), Math.round(cy - R * 0.5) - 1, "F", 3);
  if (cradle === "claws") {
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const x = Math.round(CX - 0.5 + s * (R - 0.5 - Math.max(0, k - 2) * 0.6)), y = Math.round(cy + R - 1 - k * 1.3);
      g.set(x, y, "T", s < 0 ? 3 : 1);
    }
  } else if (cradle === "ring") {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = Math.round(CX - 0.5 + Math.cos(a) * (R + 2.5)), y = Math.round(cy - 0.5 + Math.sin(a) * (R * 0.32 + 0.5) + 1);
      if (Math.sin(a) < 0 && g.get(x, y) && g.get(x, y).m === "E") continue; // 奥側は球に隠れる
      g.set(x, y, "T", Math.cos(a) < 0 ? 3 : 1);
    }
  } else if (cradle === "wings") {
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) for (let j = 0; j <= 3 - k; j++) g.set(Math.round(CX - 0.5 + s * (R + 1 + k)), Math.round(cy - 1 + j - k * 0.5), "F", s < 0 ? 3 : 2);
  } else if (cradle === "chain") {
    for (let y = 0; y < Math.round(cy - R); y++) g.set(y % 2 ? 11 : 12, y, "T", y % 2 ? 3 : 1);
  }
  if (cradle === "lotus") for (const [dx, h] of [[-4, 2], [-2, 3], [0, 3], [2, 3], [4, 2]]) for (let k = 0; k < h; k++) { const x = Math.round(CX - 0.5 + dx * 0.9), y = Math.round(cy + R - 1 + k); g.set(x, y, "T", clampT(lit(x, y, 2.6 - k * 0.5, 2, 0))); g.set(x + 1, y, "T", clampT(lit(x + 1, y, 1.6 - k * 0.5, 2, 0))); }
  // 周りを回る小さな石
  const orbit = r.pick([0, 0, 2, 3]);
  for (let i = 0; i < orbit; i++) { const a = -Math.PI * 0.8 + i * (Math.PI * 1.6 / Math.max(1, orbit - 1)); const x = Math.round(CX - 0.5 + Math.cos(a) * (R + 2.2)), y = Math.round(cy - 0.5 + Math.sin(a) * (R + 1.5)); if (!g.get(x, y)) { g.set(x, y, "G", 3); g.set(x + 1, y, "G", 1); } }
  if (o >= 2) { // 台座の宝石
    const y = cradle === "stand" || cradle === "claws" ? 20 : Math.round(cy + R) + 1;
    g.set(11, y, "G", 3); g.set(12, y, "G", 2);
  }
}

function tomeShield(g, th, it) {
  const r = th.r, o = th.deco;
  const open = r.chance(0.18);
  if (open) return openTome(g, th, it, r, o);
  const x0 = r.pick([3, 4, 5]), x1 = r.pick([17, 18, 19]), y0 = r.pick([1, 2, 3]), y1 = r.pick([20, 21]);
  const cover = r.pick(["C", "C", "L", "D", "M"]);
  const pageW = r.pick([1, 2]);
  for (let y = y0 + 1; y <= y1 + 1; y++) for (let x = x1 + 1; x <= x1 + pageW; x++) g.set(x, y, "P", x === x1 + 1 ? 3 : 2);
  for (let x = x0 + 2; x <= x1 + pageW; x++) g.set(x, y1 + 1, "P", 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let t = lit(x, y, 2, 1.2, 0.8);
    if (x <= x0 + 1) t -= 1; // 背
    g.set(x, y, cover, clampT(t));
  }
  // 背の帯
  const bands = r.pick([0, 2, 3]);
  for (let b = 0; b < bands; b++) { const y = Math.round(y0 + 2 + (b * (y1 - y0 - 4)) / Math.max(1, bands - 1)); g.set(x0, y, "T", 3); g.set(x0 + 1, y, "T", 2); }
  // 縁取り
  const border = r.pick(["none", "line", "double", "studs"]);
  const bx0 = x0 + 3, bx1 = x1 - 2, by0 = y0 + 2, by1 = y1 - 2;
  if (border !== "none") for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const edge = x === bx0 || x === bx1 || y === by0 || y === by1;
    const inner = border === "double" && (x === bx0 + 2 || x === bx1 - 2 || y === by0 + 2 || y === by1 - 2) && x >= bx0 + 2 && x <= bx1 - 2 && y >= by0 + 2 && y <= by1 - 2;
    if (border === "studs") { if (edge && (x + y) % 3 === 0) g.set(x, y, "T", 3); continue; }
    if (edge || inner) g.set(x, y, "T", clampT(lit(x, y, 2, 1, 0.5)));
  }
  // 角金具
  const corner = r.wpick([["none", o >= 1 ? 0.5 : 2], ["small", 2], ["big", 1.2]]);
  if (corner !== "none") for (const [cx, cy, sx, sy] of [[x0 + 2, y0, 1, 1], [x1, y0, -1, 1], [x0 + 2, y1, 1, -1], [x1, y1, -1, -1]]) {
    g.set(cx, cy, "T", 3); g.set(cx + sx, cy, "T", 2); g.set(cx, cy + sy, "T", 2);
    if (corner === "big") { g.set(cx + 2 * sx, cy, "T", 2); g.set(cx, cy + 2 * sy, "T", 2); g.set(cx + sx, cy + sy, "T", 1); }
  }
  // 留め金 / 鎖の錠
  const lock = r.wpick([["none", 1], ["clasp", 2], ["strap", 1], ["chain", th.motifs.has("chain") || th.motifs.has("demon") ? 3 : 0.5]]);
  const my = Math.round((y0 + y1) / 2);
  if (lock === "clasp") { g.set(x1, my, "T", 3); g.set(x1 + 1, my, "T", 2); g.set(x1 + 2, my, "T", 1); }
  if (lock === "strap") for (let x = x1 - 3; x <= x1 + pageW; x++) { g.set(x, my, "L", 2); g.set(x, my + 1, "L", 1); }
  if (lock === "chain") for (let x = x0; x <= x1 + pageW; x++) g.set(x, my + ((x & 1) ? 0 : 1), "M", (x & 1) ? 3 : 1);
  // 表紙の飾り: 紋章 / 嵌め石 / 窓
  const face = r.wpick([["emblem", 3], ["gem", o >= 1 ? 1.5 : 0.4], ["eye", th.motifs.has("eye") || th.motifs.has("demon") ? 2 : 0.3]]);
  const ex = Math.round((x0 + x1) / 2) - 2, ey = my - 3 + (lock === "chain" ? -3 : 0);
  if (face === "emblem") stamp(g, pickEmblem(th), ex, ey, "T", "G");
  else if (face === "eye") stamp(g, "eye", ex, ey, "F", "G");
  else { for (let y = ey + 1; y <= ey + 5; y++) for (let x = ex + 1; x <= ex + 5; x++) { const dd = Math.abs(x - ex - 3) + Math.abs(y - ey - 3); if (dd <= 2) g.set(x, y, "G", dd === 0 ? 4 : x + y < ex + ey + 6 ? 3 : 1); else if (dd === 3) g.set(x, y, "T", 2); } }
  // しおり紐
  if (r.chance(0.6)) { const x = r.pick([8, 11, 14]); for (let y = y1 + 1; y <= y1 + 2; y++) g.set(x, y, r.pick(["G", "C", "D"]), 2); }
}
// 開いた本 (見開き)
function openTome(g, th, it, r, o) {
  const y0 = r.pick([5, 6, 7]), y1 = r.pick([17, 18]);
  const cover = r.pick(["C", "L", "D"]);
  for (let y = y0 + 1; y <= y1 + 1; y++) for (let x = 1; x <= 22; x++) g.set(x, y, cover, clampT(lit(x, y, 1.6, 1.2, 0.4)));
  for (let y = y0; y <= y1; y++) for (let x = 2; x <= 21; x++) {
    const sag = Math.abs(x + 0.5 - CX) < 1 ? 1 : 0;
    if (y < y0 + sag + (Math.abs(x + 0.5 - CX) > 8 ? 1 : 0)) continue;
    g.set(x, y, "P", clampT(lit(x, y, 2.6, 1.4, 0.3) - (Math.abs(x + 0.5 - CX) < 1.5 ? 1 : 0)));
  }
  // 文字の行
  for (let y = y0 + 3; y <= y1 - 2; y += 2) for (let x = 4; x <= 19; x++) if (Math.abs(x + 0.5 - CX) > 1.5 && (x * 7 + y * 3) % 5 !== 0) g.set(x, y, "P", 1);
  // 光る紋
  if (r.chance(0.7)) stamp(g, r.pick(["star", "eye", "sun", "moon", "diamond", "flame"]), 8, y0 - 6 < 0 ? 0 : y0 - 6, "E", "G", { base: 2 });
  if (r.chance(0.5)) for (let k = 0; k < 3; k++) g.set(11 + (k & 1), y1 + 2 + k > 23 ? 23 : y1 + 2 + k, "G", 2);
}

// ===================== 鎧 =====================
function plateArmor(g, th, it) {
  const r = th.r, o = th.orn;
  const light = it.weight === "light";
  const body = light ? r.pick(["L", "L", "L", "M"]) : "M";
  const shoulder = r.wpick(light ? [["pad", 3], ["none", 1.2], ["round", 1], ["fur", th.motifs.has("beast") ? 3 : 1]] : [["round", 3], ["layered", 2], ["spiked", th.motifs.has("demon") ? 3 : 1], ["flared", 1.5]]);
  const skirt = r.wpick(light ? [["strips", 2], ["cloth", 1.5], ["none", 1], ["chain", 0.6]] : [["chain", 2.5], ["plates", 2], ["tassets", 1.5], ["cloth", 1]]);
  const waist = r.pick([5, 5.5, 6]);
  const chestW = r.pick([6.5, 7, 7.5]);
  const top = 5, waistY = r.pick([15, 16]);
  const hw = (y) => {
    if (y < top + 1) return chestW - 1.2;
    const u = Math.max(0, (y - top - 3) / (waistY - top - 3));
    return chestW - (chestW - waist) * u * u;
  };
  const inside = (x, y) => y >= top && y <= waistY && Math.abs(x - CX) <= hw(y);
  const lines = !light && r.chance(0.7);
  const pecY = top + r.pick([4, 5]);
  shape(g, inside, 1, body, (x, y) => {
    const ax = Math.abs(x + 0.5 - CX);
    let t = lit(x, y, 2, 2.6, 0.7);
    if (!light) {
      // 胸の稜線: 左は明るく右は暗い
      if (ax < 0.6) t += x < 12 ? 1.2 : -1;
      // 胸板の下の段 (V の溝)
      if (Math.round(y) === Math.round(pecY + ax * 0.35) && ax > 0.6) t -= 1.4;
      // 腹の小札 (横の継ぎ目)
      if (lines && y > pecY + 3 && (y - pecY) % 3 === 0) t -= 1;
      // 左上の照り
      if (x < 10 && x > CX - chestW + 2 && y > top + 1 && y < pecY) t += 0.5;
    } else {
      // 革の継ぎ目 (縦の縫い目)
      if (Math.abs(ax - 3.5) < 0.5 && y > top + 1) t -= 1;
    }
    return [body, t];
  });
  // 襟 (喉当て): 中央の盛り上がり + 首の開き
  const collar = r.wpick(light ? [["fur", th.motifs.has("beast") ? 3 : 1], ["leather", 2], ["cloth", 1.5]] : [["gorget", 3], ["chain", 1], ["high", 1], ["fur", 0.5]]);
  const cm = collar === "fur" ? "B" : collar === "chain" ? "M" : collar === "cloth" ? "C" : collar === "leather" ? "L" : "T";
  const cw = r.pick([3, 3.5, 4]);
  for (let y = top - 2; y <= top + 1; y++) for (let x = Math.round(CX - cw); x <= Math.round(CX + cw) - 1; x++) {
    const ax = Math.abs(x + 0.5 - CX);
    if (y === top - 2 && ax > cw - 1.2 && collar !== "high") continue;
    let t = lit(x, y, 2.3, 2, 0);
    if (y === top - 1 && ax < cw - 1.5) t = 0.4; // 首の開き
    if (y === top - 2 && collar === "high") t = 3;
    if (collar === "chain" && (x + y) % 2) t -= 1;
    if (collar === "fur" && (x * 7 + y * 3) % 5 === 0) t += 1;
    if (y === top + 1) t -= 0.7;
    g.set(x, y, cm, clampT(t));
  }
  // 肩当て (左右)
  if (shoulder !== "none") for (const s of [-1, 1]) {
    const sx = CX + s * (chestW + 0.2), sy = top + 1.2;
    const rx = shoulder === "flared" ? 3.6 : shoulder === "pad" ? 2.6 : 3.1, ry = shoulder === "layered" ? 3.6 : 2.8;
    const sm = shoulder === "fur" ? "B" : shoulder === "pad" ? "L" : light ? "L" : "M";
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = (x + 0.5 - sx) / rx, dy = (y + 0.5 - sy) / ry;
      if (dx * dx + dy * dy > 1 || y + 0.5 > sy + ry * 0.95) continue;
      let t = sphereTone(x + 0.5, y + 0.5, sx, sy - 0.5, rx + 0.6, ry + 0.6, 2.2) - (s > 0 ? 0.7 : 0);
      if (shoulder === "layered" && (Math.round(y + 0.5 - sy) === 0 || Math.round(y + 0.5 - sy) === 2)) t -= 1.2;
      if (shoulder === "fur" && (x * 5 + y * 3) % 4 === 0) t += 1;
      g.set(x, y, sm, clampT(t));
    }
    // 縁の帯
    if (!light && r) for (let x = Math.round(sx - rx); x <= Math.round(sx + rx) - 1; x++) { const y = Math.round(sy + ry * 0.95) - 1; if (g.get(x, y) && g.get(x, y).m === sm) g.set(x, y, "T", clampT(lit(x, y, 2.2, 2, 0))); }
    if (shoulder === "spiked") { const x = Math.round(sx - 0.5), y = Math.round(sy - ry) - 1; g.set(x, y, "F", 3); g.set(x, y - 1, "F", 4); g.set(x + s, y, "F", 1); }
    if (o >= 2) g.set(Math.round(sx - 0.5), Math.round(sy - 0.5), "G", 3);
  }
  // 革鎧: 前の編み上げ
  if (light && r.chance(0.6)) for (let y = top + 2; y <= waistY - 2; y += 2) { g.set(11, y, "T", 3); g.set(12, y, "T", 1); g.set(11, y + 1, body, 0); g.set(12, y + 1, body, 0); }
  else if (light && r.chance(0.6)) for (let y = top + 1; y <= waistY; y++) { const x = Math.round(CX - chestW + 2 + (y - top) * 0.75); if (inside(x + 0.5, y + 0.5)) { g.set(x, y, "D", 2); g.set(x + 1, y, "D", 1); } }
  // 帯
  const belt = light ? "D" : r.pick(["T", "L", "T"]);
  for (let x = Math.round(CX - waist); x <= Math.round(CX + waist) - 1; x++) g.set(x, waistY, belt, clampT(lit(x, waistY, 2, 1.8, 0)));
  g.set(11, waistY, "T", 4); g.set(12, waistY, "T", 2);
  if (light && r.chance(0.5)) for (let y = waistY + 1; y <= waistY + 2; y++) for (let x = 15; x <= 16; x++) g.set(x, y, "L", y === waistY + 1 ? 2 : 1); // 革袋
  // 腰の下
  const sb = waistY + 1;
  if (skirt === "chain") for (let y = sb; y <= 21; y++) for (let x = Math.round(CX - waist + (y - sb) * 0.1); x <= Math.round(CX + waist - (y - sb) * 0.1) - 1; x++) g.set(x, y, "M", clampT(lit(x, y, (x + y) % 2 ? 2 : 1, 2, 0) - (y === 21 ? 0.6 : 0)));
  else if (skirt === "plates" || skirt === "strips") for (let y = sb; y <= 21; y++) for (let x = Math.round(CX - waist); x <= Math.round(CX + waist) - 1; x++) {
    const col = Math.floor((x - Math.round(CX - waist)) / 3);
    if ((x - Math.round(CX - waist)) % 3 === 2 && y > sb) continue;
    if (y > 19 && col % 2) continue;
    g.set(x, y, skirt === "strips" ? "L" : "M", clampT(lit(x, y, 2.2 - (y - sb) * 0.2, 2, 0)));
  }
  else if (skirt === "tassets") for (const s of [-1, 1]) for (let y = sb; y <= 21; y++) for (let k = 0; k < 4; k++) { const x = Math.round(CX - 0.5 + s * (1.5 + k)); g.set(x, y, "M", clampT(lit(x, y, 2.2, 2.2, 0) - ((y - sb) % 2 && k === 3 ? 1 : 0))); }
  else if (skirt === "cloth") for (let y = sb; y <= 22; y++) for (let x = Math.round(CX - 3); x <= Math.round(CX + 2); x++) g.set(x, y, "C", clampT(lit(x, y, 2, 1.6, 0.4) - (y === 22 ? 1 : 0)));
  // 胸の紋 / 宝石
  if (o >= 2 || (o >= 1 && r.chance(0.5))) {
    if (!light && r.chance(0.55)) stamp(g, pickEmblem(th), 8, top + 3, "T", "G");
    else { g.set(11, pecY - 1, "G", 4); g.set(12, pecY - 1, "G", 2); g.set(11, pecY, "G", 2); g.set(12, pecY, "G", 1); }
  } else if (!light && r.chance(0.4)) for (const x of [8, 15]) g.set(x, top + 2, "T", 3); // 鋲
  if (o >= 3) for (let y = top + 1; y < waistY; y++) { const x = Math.round(CX - hw(y)); g.set(x, y, "T", 3); g.set(Math.round(CX + hw(y)) - 1, y, "T", 1); }
}

function robe(g, th, it) {
  const r = th.r, o = th.orn;
  const top = r.pick([3, 4]), bot = 22;
  const sleeve = r.wpick([["bell", 3], ["narrow", 1.5], ["cape", 1.5]]);
  const hood = r.wpick([["hood", 2], ["collar", 2], ["mantle", 1.5], ["none", 1]]);
  const hwAt = (y) => {
    const u = (y - top) / (bot - top);
    return 4 + u * r.pick([7]) + (u > 0.85 ? 0.6 : 0);
  };
  const inside = (x, y) => y >= top + 1 && y <= bot && Math.abs(x - CX) <= hwAt(y);
  const split = r.chance(0.5); // 前合わせが別の色
  shape(g, inside, 0, null, (x, y) => {
    let t = lit(x, y, 2, 2.2, 0.4);
    // 布の襞
    if (Math.round(x - CX) % 3 === 0 && y > top + 8) t -= 0.8;
    const front = Math.abs(x + 0.5 - CX) < 1.4;
    return [split && front ? "D" : "C", t];
  });
  // 袖
  for (const s of [-1, 1]) {
    for (let y = top + 2; y <= top + (sleeve === "cape" ? 13 : 11); y++) {
      const k = y - top - 2;
      const w = sleeve === "bell" ? 2 + k * 0.35 : sleeve === "cape" ? 3 + k * 0.2 : 2;
      const xc = CX + s * (5.5 + k * 0.45);
      for (let x = Math.round(xc - w / 2); x <= Math.round(xc + w / 2); x++) {
        if (g.get(x, y) && g.get(x, y).m !== "k" && Math.abs(x + 0.5 - CX) < 4.5) continue;
        g.set(x, y, "C", clampT(lit(x, y, s < 0 ? 2 : 1.5, 1.6, 0.4) - (x === Math.round(xc + w / 2) ? 1 : 0)));
      }
      if (y === top + (sleeve === "cape" ? 13 : 11)) for (let x = Math.round(xc - w / 2); x <= Math.round(xc + w / 2); x++) g.set(x, y, "D", 2);
    }
  }
  // 頭巾・襟
  if (hood === "hood") for (let y = top - 2; y <= top + 2; y++) for (let x = 7; x <= 16; x++) {
    const dx = (x + 0.5 - CX) / 4.6, dy = (y + 0.5 - top) / 3.4;
    if (dx * dx + dy * dy > 1) continue;
    const inner = Math.abs(x + 0.5 - CX) < 2.5 && y >= top;
    g.set(x, y, inner ? "C" : "C", inner ? 0 : clampT(lit(x, y, 2.4, 1.6, 0.6)));
  } else if (hood === "collar") for (let y = top; y <= top + 2; y++) for (let x = 7; x <= 16; x++) {
    if (Math.abs(x + 0.5 - CX) < 1.6 && y > top) continue;
    g.set(x, y, "D", clampT(lit(x, y, 2.5, 1.4, 0)));
  } else if (hood === "mantle") for (let y = top + 1; y <= top + 4; y++) for (let x = Math.round(CX - 5.5 - (y - top) * 0.4); x <= Math.round(CX + 4.5 + (y - top) * 0.4); x++) g.set(x, y, "D", clampT(lit(x, y, y === top + 4 ? 1.5 : 2.5, 1.6, 0)));
  // 帯
  const sash = r.chance(0.7);
  if (sash) { const y = r.pick([12, 13]); for (let x = Math.round(CX - hwAt(y)); x <= Math.round(CX + hwAt(y)) - 1; x++) g.set(x, y, "T", clampT(lit(x, y, 2, 1.4, 0))); if (r.chance(0.5)) for (let k = 1; k <= 3; k++) g.set(13, y + k, "T", 2 - (k >> 1)); }
  // 裾の縁取り
  if (o >= 1) for (let x = Math.round(CX - hwAt(bot)); x <= Math.round(CX + hwAt(bot)) - 1; x++) g.set(x, bot, "T", clampT(lit(x, bot, 2, 1.4, 0)));
  if (o >= 2) for (let y = top + 3; y < bot; y++) { g.set(10, y, "T", 3); g.set(13, y, "T", 1); }
  // 胸の紋
  if (o >= 2 || r.chance(0.35)) stamp(g, pickEmblem(th), 9, top + 4, "T", "G");
}

export function armorArt(it, th) {
  const g = new Grid();
  mats(g, th, it);
  const s = it.slot;
  if (s === "shield") {
    const sk = it.sk;
    if (sk === "kite") kiteShield(g, th, it);
    else if (sk === "round") roundShield(g, th, it, false);
    else if (sk === "buckler") roundShield(g, th, it, true);
    else if (sk === "orb") orbShield(g, th, it);
    else tomeShield(g, th, it);
  } else if (s === "body") {
    if (it.weight === "cloth") robe(g, th, it);
    else plateArmor(g, th, it);
  } else if (s === "head") {
    const sh = it.shape;
    if (sh === "helm" || (!sh && it.weight === "heavy")) helm(g, th, it);
    else if (sh === "circlet" || it.weight === "cloth") clothHead(g, th, it);
    else lightHat(g, th, it);
  } else if (s === "feet") feet(g, th, it);
  else if (s === "hands") hands(g, th, it);
  else if (s === "acc") {
    const nm = th.name;
    if (it.shape === "ring" || /指輪|リング/.test(nm)) ring(g, th, it);
    else if (it.shape === "amulet" || /護符|首飾|アミュレット|ペンダント|ロザリオ|お守り|数珠|勾玉|タリスマン/.test(nm)) amulet(g, th, it);
    else trinket(g, th, it);
  }
  g.outline(true);
  g.tidy();
  return g;
}

export { line, inPoly };

// 武器の絵 (24×24、左下の柄頭 → 右上の切っ先へ斜めに置く)
// 部品 (刃・鍔・柄・柄頭・斧頭・槌頭・穂先・杖頭・弓の腕) を品ごとの乱数と意匠で組み合わせる。
import { MAT, ELEM_COL, tintRamp, Grid, diagAP, diagXY, diagFill, bladeTone, rodTone, sphereTone } from "./core.js";

// ---- 素材の登録 ----
function mats(g, th, it) {
  let blade = MAT[th.metal] || MAT.steel;
  if (it.eAtk) blade = tintRamp(blade, ELEM_COL[it.eAtk.el], 0.16);
  else if (th.el) blade = tintRamp(blade, ELEM_COL[th.el], 0.07);
  g.def("M", blade);
  g.def("T", MAT[th.trim] || MAT.gold);
  g.def("W", MAT[th.wood] || MAT.wood);
  g.def("L", MAT[th.leather] || MAT.leather);
  g.def("G", MAT[th.gem] || MAT.red);
  g.def("C", MAT[th.cloth] || MAT.cloth);
  g.def("E", MAT[th.glow || th.gem] || MAT.blue);
  g.def("B", MAT.bone);
  g.def("S", MAT.steel);
  g.def("F", MAT.white);
  g.def("D", MAT[{ red: "amber", blue: "white", green: "amber", purple: "gold", white: "blue", shadow: "red", cloth: "red", teal: "white", amber: "red" }[th.cloth] || "white"]);
}

// 斜めの点 (a, p) を中心にした小さな円 (画面座標で半径 rad)
function blob(g, a, p, rad, mat, base = 2, tone) {
  const [cx, cy] = diagXY(a, p);
  for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy > rad * rad + 0.25) continue;
    g.set(x, y, mat, tone != null ? tone : sphereTone(x, y, cx, cy, rad + 0.5, rad + 0.5, base));
  }
}
// 斜めの帯 (中心 c(a)、光の側 lw、影の側 hw)
function band(g, a0, a1, c, lw, hw, mat, tone = bladeTone) {
  diagFill(g, a0, a1, (a) => Math.round(c(a) - lw(a)), (a) => Math.round(c(a) + hw(a)), mat, (a, p, lo, hi) => tone(p, lo, hi, a));
}
const K = (v) => () => v;

// ---- 刃 ----
// 形: straight / broad / taper / leaf / wavy / curved / serrated / spatula / hooked
function blade(g, th, aB, aT, o) {
  const r = th.r;
  const len = aT - aB;
  const t = (a) => (a - aB) / len;
  const shape = o.shape;
  const L0 = o.lw, H0 = o.hw;
  const cv = o.curve || 0;
  const c = (a) => {
    const u = t(a);
    let v = o.c0 || 0;
    if (shape === "wavy") v += Math.round(Math.sin(u * Math.PI * 5) * 0.9);
    if (cv) v -= cv * u * u;
    return v;
  };
  const prof = (a) => {
    const u = t(a);
    let k = 1;
    if (shape === "taper") k = 1 - 0.45 * u;
    else if (shape === "leaf") k = 0.75 + 0.45 * Math.sin(Math.min(1, u * 1.15) * Math.PI);
    else if (shape === "broad") k = 1.05;
    else if (shape === "spatula") k = u > 0.6 ? 1.25 : 1;
    return k;
  };
  // 切っ先: 最後の数歩で両側 (または影の側だけ) が細る
  const tipN = o.tip === "blunt" ? 2 : o.tip === "long" ? 8 : 5;
  const tipK = (a) => Math.max(0, Math.min(1, (aT - a) / tipN));
  const lw = (a) => {
    const k = o.tip === "clip" ? 1 : tipK(a);
    return Math.max(0, L0 * prof(a) * (o.tip === "clip" ? Math.max(0.2, tipK(a) * 1.2) : k));
  };
  const hw = (a) => {
    const k = o.tip === "chisel" ? Math.max(0.15, tipK(a)) : tipK(a);
    let v = H0 * prof(a) * k;
    if (shape === "serrated" && ((a - aB) % 6 + 6) % 6 < 2 && t(a) < 0.85) v += 1;
    return Math.max(0, v);
  };
  band(g, aB, aT, c, lw, hw, "M");
  // 樋 (血溝) / ルーンの光
  if (o.fuller) {
    const fm = o.fuller === "glow" ? "E" : o.fuller === "gem" ? "G" : "M";
    for (let a = aB + 2; a < aT - tipN - 1; a++) {
      const p = Math.round(c(a) + (H0 - L0) / 2);
      const [x, y] = diagXY(a, p);
      if (Number.isInteger(x) && g.get(x, y)) g.set(x, y, fm, fm === "M" ? 1 : (a % 4 < 2 ? 3 : 2));
    }
  }
  if (o.runes) {
    for (let a = aB + 3; a < aT - tipN; a += o.runes) {
      const p = Math.round(c(a));
      for (const pp of [p, p + 1]) {
        const [x, y] = diagXY(a, pp);
        if (Number.isInteger(x) && g.get(x, y)) { g.set(x, y, "E", 4); break; }
      }
    }
  }
  // 属性の刃: 刃先 (影の側の縁) を属性の光で縁どる
  if (o.edgeGlow) {
    for (let a = aB; a <= aT; a++) {
      const p = Math.round(c(a) + hw(a));
      const [x, y] = diagXY(a, p);
      if (Number.isInteger(x) && g.get(x, y)) g.set(x, y, "E", 3);
    }
  }
  return { c };
}

// ---- 柄 ----
function grip(g, th, a0, a1, c, o) {
  const mat = o.mat || "L";
  const w = o.w || 1; // 0 = 細い (1升)、1 = 2升
  diagFill(g, a0, a1, () => c - (w ? 1 : 0), () => c, mat, (a, p, lo, hi) => {
    let tn = rodTone(p, lo, hi);
    if (o.wrap === "band" && ((a - a0) % 4 + 4) % 4 < 2) tn = Math.max(0, tn - 1);
    if (o.wrap === "diamond" && (((a + p) % 4) + 4) % 4 === 0) tn = 4;
    if (o.wrap === "spiral" && (((a - p) % 6) + 6) % 6 < 2) tn = Math.max(0, tn - 2);
    return tn;
  });
}

// ---- 鍔 ----
// cross / curved / disc / wing / bar / ring / spiked / none
function guard(g, th, aG, c, o) {
  const type = o.type;
  const half = o.half;
  if (type === "none") return;
  if (type === "disc") {
    blob(g, aG, c, o.half / 2 + 0.6, "T");
    return;
  }
  const lo = c - half, hi = c + half;
  diagFill(g, aG - 2, aG + (o.thick ? 2 : 1), () => lo, () => hi, "T", (a, p) => {
    let t = a >= aG ? 3 : 1;
    if (p - lo < 2) t = Math.min(4, t + 1);
    if (hi - p < 2) t = Math.max(0, t - 1);
    return t;
  });
  // 端の形
  const ends = [[lo, -1], [hi, 1]];
  for (const [p, s] of ends) {
    if (type === "curved") { // 鍔の先が切っ先へ反る
      for (const k of [1, 2]) { const [x, y] = diagXY(aG + k, p + s * (k === 2 ? 0 : 1) - s); if (Number.isInteger(x)) g.set(x, y, "T", s < 0 ? 3 : 1); }
    } else if (type === "wing") { // 柄頭の側へ垂れる翼
      for (const k of [1, 2, 3]) { const [x, y] = diagXY(aG - 1 - k, p + s * k - s); if (Number.isInteger(x)) g.set(x, y, "T", s < 0 ? 3 : 1); }
    } else if (type === "spiked") {
      const [x, y] = diagXY(aG + 1, p + s);
      if (Number.isInteger(x)) g.set(x, y, "T", 4);
    } else if (type === "ring") {
      blob(g, aG - 1, p + s, 1.1, "T");
    } else if (type === "ball") {
      blob(g, aG - 1, p + s, 1.0, "T");
    }
  }
  if (o.gem) blob(g, aG - 0.5, c, 1.2, "G", 3);
}

// ---- 柄頭 ----
// ball / gem / ring / spike / disc / skull / fishtail / tassel
function pommel(g, th, a, c, type) {
  if (type === "ball") blob(g, a, c, 1.7, "T");
  else if (type === "gem") { blob(g, a, c, 1.9, "T"); blob(g, a, c, 1.0, "G", 3); }
  else if (type === "ring") {
    blob(g, a - 1, c, 1.8, "T");
    const [cx, cy] = diagXY(a - 1, c);
    g.set(Math.round(cx), Math.round(cy), null);
  } else if (type === "spike") {
    diagFill(g, a - 4, a, () => c - 1, () => c, "T", (aa, p, lo, hi) => (aa < a - 2 ? (p === lo ? 3 : 1) : rodTone(p, lo, hi)));
  } else if (type === "disc") {
    diagFill(g, a - 1, a, () => c - 2, () => c + 2, "T", (aa, p, lo, hi) => (p - lo < 2 ? 3 : 1));
  } else if (type === "skull") { blob(g, a - 1, c, 1.6, "B"); const [x, y] = diagXY(a - 1, c); g.ink(Math.round(x), Math.round(y)); }
  else if (type === "fishtail") {
    diagFill(g, a - 2, a, () => c - 2, () => c + 2, "T", (aa, p) => (Math.abs(p - c) === 2 && aa === a - 2 ? 3 : p < c ? 3 : 1));
  } else if (type === "tassel") {
    blob(g, a, c, 1.1, "T");
    for (let k = 1; k <= 3; k++) { const [x, y] = diagXY(a - 1 - k, c + k); if (Number.isInteger(x)) g.set(x, y, "C", 3 - (k > 1 ? 1 : 0)); else { const [x2, y2] = diagXY(a - k, c + k); g.set(x2, y2, "C", 2); } }
  }
}

// 隠しレベル → 武器の大きさの目安
const pickW = (r, pairs) => r.wpick(pairs);

// 柄・柄の飾り: 帯金の数と位置、垂れ飾り (房・鈴・羽根)。棒の武器 (槌・杖・槍・斧) で共通
function shaftDeco(g, th, a0, a1, opt = {}) {
  const r = th.r;
  const n = r.pick([0, 1, 1, 2, 3]);
  for (let i = 0; i < n; i++) {
    const a = Math.round(a0 + (a1 - a0) * (0.2 + 0.6 * r.f()));
    diagFill(g, a - 1, a, () => -2, () => 1, "T", (aa, p, lo, hi) => (p === lo ? 3 : p === hi ? 0 : 2));
  }
  const charm = r.wpick([["none", 3], ["ribbon", 1.2], ["bell", th.motifs.has("holy") ? 1.5 : 0.4], ["feather", th.motifs.has("wing") ? 2 : 0.5], ["bead", 0.8]]);
  if (charm === "none" || opt.noCharm) return;
  const at = a1 - r.pick([1, 2, 3]);
  const [x0, y0] = diagXY(at, 1 + ((at + 1) & 1 ? 0 : 1));
  const X = Math.round(x0), Y = Math.round(y0);
  if (charm === "ribbon") for (let k = 1; k <= 5; k++) { g.set(X + (k > 3 ? 1 : 0), Y + k, "C", 3 - (k >> 1)); if (k > 1) g.set(X + 1 + (k > 3 ? 1 : 0), Y + k, "C", 1); }
  else if (charm === "bell") { for (let k = 1; k <= 2; k++) g.set(X, Y + k, "T", 2); g.set(X - 1, Y + 3, "T", 3); g.set(X, Y + 3, "T", 3); g.set(X + 1, Y + 3, "T", 1); g.set(X, Y + 4, "T", 1); }
  else if (charm === "feather") for (let k = 1; k <= 5; k++) { g.set(X + (k >> 2), Y + k, "F", 3); g.set(X + 1 + (k >> 2), Y + k, "F", 1); }
  else if (charm === "bead") { for (let k = 1; k <= 3; k++) g.set(X, Y + k, "T", 2); g.set(X, Y + 4, "G", 3); g.set(X + 1, Y + 4, "G", 1); }
}

// ===== 長剣 (片手 / 両手の大剣) =====
function longsword(g, th, it) {
  const r = th.r, o = th.deco, two = !!it.twoHanded;
  const shape = pickW(r, two
    ? [["broad", 3], ["straight", 2], ["serrated", 1.5], ["wavy", th.motifs.has("flame") ? 3 : 0.8], ["taper", 1]]
    : [["straight", 3], ["taper", 1.5], ["leaf", 1], ["wavy", th.motifs.has("flame") ? 3 : 0.4], ["curved", 0.8], ["broad", 1]]);
  const lw = two ? r.pick([3, 3, 4]) : r.pick([2, 3, 3]);
  const hw = two ? r.pick([2, 3]) : r.pick([1, 2, 2]);
  const aT = 21, aG = two ? r.pick([-9, -8]) : r.pick([-9, -8, -7]);
  const gripN = two ? r.pick([7, 8, 9]) : r.pick([5, 6]);
  const aP = aG - 2 - gripN;
  const fuller = o >= 2 || r.chance(0.35) ? (th.glow && o >= 1 ? "glow" : r.chance(0.3) && o >= 2 ? "gem" : "plain") : null;
  blade(g, th, aG + 1, aT, {
    shape, lw, hw, c0: 0, curve: shape === "curved" ? 2.2 : 0,
    tip: r.pick(shape === "curved" ? ["clip", "normal"] : ["normal", "normal", "long", "clip"]),
    fuller, runes: o >= 3 && r.chance(0.6) ? r.pick([4, 6]) : 0, edgeGlow: !!it.eAtk && o >= 2 && r.chance(0.5),
  });
  grip(g, th, aP + 1, aG - 2, 0, { mat: r.pick(["L", "L", "W"]), w: 1, wrap: r.pick(["band", "spiral", "plain", "diamond"]) });
  guard(g, th, aG, 0, {
    type: pickW(r, [["cross", 3], ["curved", 2], ["wing", o >= 2 ? 1.5 : 0.4], ["bar", 1], ["ring", 0.8], ["spiked", 0.8], ["ball", 1]]),
    half: two ? r.pick([7, 8, 9]) : r.pick([5, 6, 7]), thick: r.chance(two ? 0.6 : 0.3), gem: o >= 1 && r.chance(0.3 + o * 0.15),
  });
  pommel(g, th, aP, 0, pickW(r, [["ball", 3], ["gem", o >= 1 ? 2 : 0.3], ["disc", 1.5], ["ring", 1], ["spike", 0.8], ["fishtail", 0.8], ["skull", th.motifs.has("skull") ? 3 : 0], ["tassel", 0.8]]));
}

// ===== 短剣 =====
function dagger(g, th, it) {
  const r = th.r, o = th.deco;
  const shape = pickW(r, [["straight", 2], ["leaf", 2], ["taper", 2], ["curved", 1.5], ["wavy", th.motifs.has("serpent") || th.motifs.has("flame") ? 3 : 0.6], ["serrated", 0.8]]);
  const aT = r.pick([19, 20, 21]), aG = r.pick([1, 2, 3]);
  const aP = aG - 2 - r.pick([5, 6]);
  blade(g, th, aG + 1, aT, {
    shape, lw: r.pick([2, 3, 3]), hw: r.pick([1, 2, 2]), curve: shape === "curved" ? 2.6 : 0,
    tip: r.pick(["normal", "normal", "clip", "long"]),
    fuller: o >= 2 && r.chance(0.6) ? (th.glow ? "glow" : "plain") : null, runes: 0, edgeGlow: !!it.eAtk && r.chance(0.4),
  });
  grip(g, th, aP + 1, aG - 2, 0, { mat: r.pick(["L", "W", "B", "L"]), w: 1, wrap: r.pick(["band", "plain", "spiral"]) });
  guard(g, th, aG, 0, { type: pickW(r, [["cross", 2], ["curved", 2], ["bar", 1], ["ball", 1], ["none", 0.6], ["spiked", 0.6], ["wing", o >= 2 ? 1 : 0.2]]), half: r.pick([3, 4, 5]), thick: r.chance(0.3), gem: o >= 1 && r.chance(0.35 + o * 0.12) });
  pommel(g, th, aP, 0, pickW(r, [["ball", 3], ["gem", o >= 1 ? 2 : 0.3], ["disc", 1], ["ring", 1.2], ["spike", 0.6], ["tassel", 0.6]]));
  g.shift(r.pick([-2, -1]), r.pick([1, 2]));
  g.shift(-1, 1);
}

// ===== 刀 =====
function katana(g, th, it) {
  const r = th.r, o = th.deco, two = !!it.twoHanded;
  const aT = r.pick([19, 20, 21, 22]), aG = two ? r.pick([-8, -7]) : r.pick([-6, -5, -4]);
  const gripN = two ? r.pick([9, 10]) : r.pick([6, 7, 8]);
  const aP = aG - 2 - gripN;
  const curve = r.pick([1.4, 1.8, 2.4, 3.0]);
  const lw = two ? r.pick([2, 3]) : r.pick([1, 2, 2]), hw = 1;
  // 刀身: 鎬 (しのぎ) と刃文 (はもん) — 刃の側 (影の側の縁) に明るい波
  const { c } = blade(g, th, aG + 1, aT, { shape: "curved", lw, hw, curve, tip: "chisel", fuller: r.chance(0.3 + o * 0.08) ? (th.glow && o >= 2 ? "glow" : "plain") : null, edgeGlow: !!it.eAtk });
  const hamon = r.pick(["straight", "wave", "gunome", "choji", "none"]);
  for (let a = aG + 2; a < aT - 3; a++) {
    const p = Math.round(c(a) + hw);
    const [x, y] = diagXY(a, p);
    if (!Number.isInteger(x) || !g.get(x, y)) continue;
    const on = hamon === "straight" ? true : hamon === "wave" ? Math.sin(a * 0.8) > -0.2 : hamon === "gunome" ? (a % 5) < 3 : hamon === "choji" ? (a % 3) !== 0 : false;
    if (on) g.set(x, y, it.eAtk ? "E" : "M", 4);
  }
  // 鎺 (はばき)
  diagFill(g, aG + 1, aG + 2, () => -lw, () => hw, "T", (a, p, lo, hi) => (p === lo ? 3 : 2));
  // 鍔: 丸・角・木瓜・花・透かし・葵
  const tsuba = pickW(r, [["disc", 3], ["square", 1.5], ["mokko", 1], ["flower", 1], ["open", 1.2], ["aoi", 0.8], ["small", 1]]);
  const tr = r.pick([1.8, 2.2, 2.6]);
  if (tsuba === "disc") blob(g, aG, 0, tr, "T");
  else if (tsuba === "small") blob(g, aG, 0, 1.3, "T");
  else if (tsuba === "open") { blob(g, aG, 0, tr, "T"); const [x, y] = diagXY(aG, -2); if (Number.isInteger(x)) g.set(x, y, null); const [x2, y2] = diagXY(aG, 3); if (Number.isInteger(x2)) g.set(x2, y2, null); }
  else if (tsuba === "square") diagFill(g, aG - 1, aG, () => -3, () => 3, "T", (a, p, lo, hi) => (p - lo < 2 ? 3 : hi - p < 1 ? 0 : 2));
  else if (tsuba === "flower") for (const [da, dp] of [[0, -3], [0, 3], [-2, 0], [2, 0]]) blob(g, aG + da, dp, 1.1, "T");
  else if (tsuba === "aoi") { blob(g, aG, -2, 1.3, "T"); blob(g, aG, 2, 1.3, "T"); blob(g, aG - 2, 0, 1.2, "T"); }
  else { blob(g, aG, -2, 1.3, "T"); blob(g, aG, 2, 1.3, "T"); blob(g, aG, 0, 1.5, "T"); }
  if (o >= 3) blob(g, aG, 0, 0.8, "G", 3);
  // 柄: 鮫皮 + 柄巻 (菱)
  g.def("H", tintRamp(MAT.bone, "#ffffff", 0.2));
  diagFill(g, aP + 1, aG - 2, () => -1, () => 0, "H", (a, p, lo, hi) => rodTone(p, lo, hi));
  const wrapM = r.pick(["C", "L", "C", "D"]);
  const wrapPat = r.pick([4, 4, 3, 6]);
  diagFill(g, aP + 1, aG - 2, () => -1, () => 0, (a, p) => ((((a + p) % wrapPat) + wrapPat) % wrapPat < 2 ? wrapM : null), (a, p, lo, hi) => (p === lo ? 2 : 1));
  // 柄頭 (かしら)
  const kas = r.pick(["cap", "ring", "long"]);
  if (kas === "ring") blob(g, aP - 1, 0, 1.2, "T");
  else diagFill(g, aP - (kas === "long" ? 3 : 1), aP, () => -1, () => 0, "T", (a, p, lo) => (p === lo ? 3 : 1));
  // 下げ緒 (房)
  if (r.chance(0.35 + o * 0.12)) { const n = r.pick([3, 4, 5]); for (let k = 1; k <= n; k++) { const [x, y] = diagXY(aP - k, k + 1); if (Number.isInteger(x)) g.set(x, y, "C", 3); else { const [x2, y2] = diagXY(aP - k + 1, k + 1); g.set(x2, y2, "C", 2); } } }
}

// ===== 斧 =====
function axe(g, th, it) {
  const r = th.r, o = th.deco, two = !!it.twoHanded;
  const aTop = two ? r.pick([13, 14]) : r.pick([14, 15, 16]);
  const aBot = two ? -21 : r.pick([-19, -17]);
  // 柄
  grip(g, th, aBot, aTop, 0, { mat: "W", w: 1, wrap: "plain" });
  if (r.chance(0.6)) grip(g, th, aBot, aBot + r.pick([5, 7]), 0, { mat: "L", w: 1, wrap: "band" });
  // 斧頭: 柄の上寄り、光の側 (左上) へ張り出す刃 + 反対側の峰
  const aH = aTop - r.pick([4, 5, 6]);
  const kind = pickW(r, two ? [["double", 3], ["crescent", 2], ["bearded", 1.5], ["single", 1]] : [["single", 3], ["bearded", 2], ["crescent", 1.5], ["double", 1]]);
  const reach = two ? r.pick([12, 13, 14]) : r.pick([9, 10, 11]);
  const halfA = two ? r.pick([6, 7, 8]) : r.pick([5, 6]);
  const bit = (side) => {
    // side = -1 (左上) / +1 (右下)。柄の近く (首) は細く、刃先へ大きく広がる。刃先は外へ膨らむ弧
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const [a, p] = diagAP(x, y);
      const d = side < 0 ? -p - 1 : p;
      if (d < 1) continue;
      const u = Math.min(1, d / reach);
      const ha = halfA * (kind === "crescent" ? 0.22 + 0.95 * u ** 2.2 : kind === "bearded" ? 0.25 + 0.8 * u ** 1.8 : 0.28 + 0.78 * u ** 1.9) + (kind === "crescent" && u > 0.85 ? 1 : 0);
      const off = kind === "bearded" ? -u * u * 3 : 0;
      const da = a - aH - off;
      if (Math.abs(da) > ha) continue;
      // 刃先は外へ膨らむ (中央が遠く、上下の角は手前)
      const rch = reach + Math.round(2.2 * (1 - (da / Math.max(1, ha)) ** 2)) - 1;
      if (d > rch) continue;
      // 陰影: 刃の面は上 (a の大きい側) が明るく、刃先の帯 (2升) は鏡面
      let t = da > ha * 0.35 ? 3 : da < -ha * 0.45 ? 1 : 2;
      if (d >= rch - 1) t = 4;
      else if (d >= rch - 2) t = 3;
      if (d <= 2) t = 1;
      if (Math.abs(da) > ha - 1 && d < rch - 1) t = Math.max(0, t - 1); // 上下の縁
      g.set(x, y, "M", t);
    }
  };
  bit(-1);
  if (kind === "double") bit(1);
  else {
    // 峰: 小さな角か突起
    const spike = r.pick(["spike", "block", "hook"]);
    const n = spike === "spike" ? 3 : 2;
    diagFill(g, aH - (spike === "block" ? 3 : 2), aH + (spike === "block" ? 3 : 1), () => 1, () => 1 + n * 2, "M", (a, p, lo, hi) => (p === hi ? 3 : 1));
  }
  // 斧頭を柄に留める金具
  diagFill(g, aH - 2, aH + 2, () => -1, () => 0, "T", (a, p, lo, hi) => (p === lo ? 3 : 1));
  if (o >= 1 && r.chance(0.5)) blob(g, aH, -1, 0.8, "G", 3);
  // 柄の先の石突き
  diagFill(g, aTop + 1, aTop + 2, () => -1, () => 0, "T", (a, p, lo) => (p === lo ? 3 : 1));
  if (o >= 3 || th.motifs.has("rune") || (th.glow && o >= 2)) { // 刃の刻印 (ルーン・属性の光)
    for (let k = 0; k < 3; k++) { const pp = -4 - k * 2, aa = aH + (k - 1) * 2; for (const da of [0, 1]) { const [x, y] = diagXY(aa + da, pp); if (Number.isInteger(x) && g.get(x, y) && g.get(x, y).m === "M") { g.set(x, y, "E", 4); break; } } }
  }
}

// ===== 槌・鎚矛 =====
function mace(g, th, it) {
  const r = th.r, o = th.deco, two = !!it.twoHanded;
  const R0 = two ? r.pick([4.4, 4.8, 5.2]) : r.pick([3.4, 3.8, 4.2, 4.6]);
  const ac = two ? r.pick([9, 10]) : r.pick([10, 11, 12, 13]);
  const aTop = ac - Math.round(R0 * 1.2);
    const aBot = two ? -21 : r.pick([-17, -15]);
  grip(g, th, aBot, aTop, 0, { mat: r.pick(["W", "W", "M"]), w: two ? 1 : r.pick([0, 1]), wrap: "plain" });
  grip(g, th, aBot, aBot + r.pick([5, 6, 8]), 0, { mat: "L", w: 1, wrap: r.pick(["band", "spiral"]) });
  const kind = pickW(r, [["ball", 2], ["flanged", 2.5], ["spiked", th.motifs.has("thorn") || th.motifs.has("demon") ? 3 : 1.5], ["hammer", two ? 3 : 1.5], ["star", 1.2], ["bell", th.motifs.has("holy") ? 1.5 : 0.4]]);
  const [cx, cy] = diagXY(ac, -0.5);
  if (kind === "hammer") {
    // 柄に直交する四角い槌頭 (左上と右下へ伸びる)
    const ha = two ? 4 : 3, hp = two ? r.pick([9, 10]) : r.pick([7, 8]);
    diagFill(g, aTop - ha, aTop + ha, () => -hp, () => hp, "M", (a, p, lo, hi) => {
      let t = a >= aTop + ha - 1 ? 3 : a <= aTop - ha + 1 ? 1 : 2;
      if (p <= lo + 1) t = 4 - (a <= aTop - ha + 1 ? 2 : 0);
      if (p >= hi) t = 0;
      return t;
    });
    // 帯金
    diagFill(g, aTop - ha, aTop + ha, () => -1, () => 0, "T", (a, p, lo) => (p === lo ? 3 : 1));
    if (r.chance(0.5)) diagFill(g, aTop - 1, aTop + 1, () => -hp - 2, () => -hp, "M", (a, p, lo, hi) => (p === lo ? 3 : 2)); // 鉤
  } else if (kind === "bell") {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > R0 * R0) continue;
      g.set(x, y, "T", sphereTone(x, y, cx, cy, R0, R0, 2));
    }
    blob(g, aTop + 2, -0.5, 1.0, "G", 3);
  } else {
    const mat = kind === "ball" && r.chance(0.4) ? "T" : "M";
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      let rr = R0;
      if (kind === "flanged") rr = R0 * (0.82 + 0.28 * Math.max(0, Math.cos(ang * 4)));
      if (kind === "star") rr = R0 * (0.7 + 0.45 * Math.max(0, Math.cos(ang * 5 + 0.3)) ** 3);
      if (d > rr) continue;
      let t = sphereTone(x, y, cx, cy, R0, R0, 2);
      if (kind === "flanged" && Math.cos(ang * 4) > 0.6) t = Math.min(4, t + 1);
      g.set(x, y, mat, t);
    }
    if (kind === "spiked") {
      const n = r.pick([6, 8]);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + r.f() * 0.3;
        const x = Math.round(cx + Math.cos(ang) * (R0 + 1)), y = Math.round(cy + Math.sin(ang) * (R0 + 1));
        g.set(x, y, "S", Math.cos(ang) + Math.sin(ang) < 0 ? 4 : 2);
      }
    }
    if (o >= 1 && r.chance(0.5)) { const [gx, gy] = [Math.round(cx), Math.round(cy)]; g.set(gx, gy, "G", 3); g.set(gx - 1, gy, "G", 2); }
  }
  shaftDeco(g, th, aBot + 6, aTop - 4, { noCharm: kind === "hammer" });
  // 頭の下の飾り輪
  if (r.chance(0.75)) diagFill(g, aTop - (kind === "hammer" ? 4 : 3), aTop - (kind === "hammer" ? 3 : 2), () => -2, () => 1, "T", (a, p, lo, hi) => (p === lo ? 3 : p === hi ? 0 : 2));
  if (o >= 2 && r.chance(0.6)) pommel(g, th, aBot - 1, 0, r.pick(["ball", "gem", "spike"]));
}

// ===== 槍 =====
function spear(g, th, it) {
  const r = th.r, o = th.deco;
  const aTip = 22, aBot = -22;
  const kind = pickW(r, [["leaf", 3], ["long", 2], ["winged", 2], ["halberd", it.twoHanded ? 2.5 : 1], ["trident", th.motifs.has("wave") ? 3 : 1], ["hook", 1], ["flame", th.motifs.has("flame") ? 3 : 0.3]]);
  const hLen = kind === "long" ? 15 : kind === "trident" ? 12 : r.pick([12, 13, 14]);
  const aH = aTip - hLen;
  // 柄 (細い)
  diagFill(g, aBot, aH, () => -1, () => 0, r.chance(0.2) ? "M" : "W", (a, p, lo, hi) => {
    let t = rodTone(p, lo, hi);
    if (o >= 1 && ((a % 10) + 10) % 10 < 2 && a > aBot + 6) t = Math.max(0, t - 2);
    return t;
  });
  // 石突き
  diagFill(g, aBot, aBot + 3, () => -1, () => 0, "T", (a, p, lo) => (p === lo ? 3 : 1));
  // 柄の握り
  if (r.chance(0.6)) diagFill(g, -6, 2, () => -1, () => 0, "L", (a, p, lo, hi) => (((a % 4) + 4) % 4 < 2 ? rodTone(p, lo, hi) : 1));
  // 口金
  diagFill(g, aH - 1, aH + 1, () => -2, () => 1, "T", (a, p, lo, hi) => (p === lo ? 3 : p === hi ? 0 : 2));
  if (kind === "trident") {
    // 三叉: 中の穂 + 左右の叉
    blade(g, th, aH + 2, aTip, { shape: "taper", lw: 1, hw: 1, tip: "normal" });
    diagFill(g, aH + 1, aH + 2, () => -4, () => 4, "M", (a, p, lo, hi) => (p - lo < 2 ? 3 : 1));
    for (const s of [-1, 1]) blade(g, th, aH + 2, aTip - 4, { shape: "straight", lw: 0, hw: 1, c0: s * 4, tip: "normal" });
  } else {
    const lw = kind === "long" ? 3 : kind === "flame" ? 4 : r.pick([4, 4, 5]);
    blade(g, th, aH + 2, aTip, { shape: kind === "flame" ? "wavy" : kind === "long" ? "taper" : "leaf", lw, hw: lw - (r.chance(0.5) ? 1 : 0), tip: "normal", fuller: o >= 2 && th.glow ? "glow" : null, edgeGlow: !!it.eAtk && r.chance(0.3) });
    if (kind === "winged") for (const s of [-1, 1]) diagFill(g, aH + 1, aH + 3, () => (s < 0 ? -5 : 2), () => (s < 0 ? -3 : 4), "M", (a, p, lo, hi) => (s < 0 ? (p === lo ? 1 : 3) : (p === hi ? 0 : 2)));
    if (kind === "halberd") {
      // 斧刃 (左上) + 鉤 (右下)
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const [a, p] = diagAP(x, y);
        const d = -p - 1;
        if (d < 1 || d > 6) continue;
        if (Math.abs(a - (aH + 3)) > 1.5 + d * 0.5) continue;
        g.set(x, y, "M", d >= 6 ? 4 : d >= 5 ? 3 : 2);
      }
      diagFill(g, aH + 2, aH + 4, () => 1, () => 4, "M", (a, p, lo, hi) => (p === hi ? 3 : 1));
    }
    if (kind === "hook") diagFill(g, aH + 2, aH + 5, () => 1, () => 3, "M", (a, p, lo, hi) => (a >= aH + 4 && p === hi ? 3 : 1));
  }
  shaftDeco(g, th, aBot + 6, aH - 3, { noCharm: true });
  // 房飾り
  if (r.chance(0.45 + o * 0.08)) {
    for (let k = 0; k < 4; k++) for (const pp of [1, 2, 3]) {
      const [x, y] = diagXY(aH - 1 - k, pp + k);
      if (Number.isInteger(x) && !g.get(x, y)) g.set(x, y, "C", 3 - Math.min(2, Math.floor(k / 1.5)));
    }
  }
  if (o >= 1 && r.chance(0.45)) blob(g, aH, -0.5, 0.8, "G", 3);
}

// ===== 杖 =====
function staff(g, th, it) {
  const r = th.r, o = th.deco, two = !!it.twoHanded;
  const gemR = two ? r.pick([3.0, 3.4]) : r.pick([2.3, 2.6, 2.9, 3.2]);
  const ac = two ? r.pick([11, 12]) : r.pick([12, 13, 14]);
  const aTop = ac - Math.round(gemR * 2) - 1;
    const aBot = two ? -22 : r.pick([-19, -17]);
  const gnarl = th.wood === "darkwood" || th.motifs.has("leaf") || r.chance(0.3);
  diagFill(g, aBot, aTop, (a) => -1 + (gnarl ? Math.round(Math.sin(a * 0.5) * 0.6) : 0), (a) => (gnarl ? Math.round(Math.sin(a * 0.5) * 0.6) : 0), r.chance(0.18) ? "M" : "W", (a, p, lo, hi) => {
    let t = rodTone(p, lo, hi);
    if (gnarl && ((a % 7) + 7) % 7 === 0) t = Math.max(0, t - 2);
    return t;
  });
  if (r.chance(0.6)) diagFill(g, aBot + 2, aBot + 4, () => -1, () => 0, "T", (a, p, lo) => (p === lo ? 3 : 1));
  if (o >= 1 && r.chance(0.6)) diagFill(g, -3, 3, () => -1, () => 0, "L", (a, p, lo, hi) => (((a % 4) + 4) % 4 < 2 ? 2 : 1));
  const head = pickW(r, [
    ["orb", 3], ["claw", 2.5], ["crook", 1.5], ["crescent", th.motifs.has("moon") ? 4 : 1], ["crystal", th.motifs.has("crystal") ? 4 : 1.2],
    ["ring", 1.5], ["skull", th.motifs.has("skull") ? 4 : 0.6], ["star", th.motifs.has("star") ? 4 : 0.5], ["branch", th.motifs.has("leaf") ? 4 : 1], ["flame", th.motifs.has("flame") ? 3 : 0.4],
  ]);
  const [hx, hy] = diagXY(ac, -0.5);
  const orb = (R) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const dx = x - hx, dy = y - hy; if (dx * dx + dy * dy <= R * R + 0.3) g.set(x, y, "E", sphereTone(x, y, hx, hy, R + 0.4, R + 0.4, 2)); } };
  if (head === "orb" || head === "claw") {
    orb(gemR);
    if (head === "claw") for (const [s, tt] of [[-1, 3], [1, 1], [0, 2]]) {
      const ang = Math.PI * 0.75 + s * 0.9;
      for (let k = 0; k <= 2; k++) { const x = Math.round(hx + Math.cos(ang) * (gemR + 0.6 - k * 0.4) * 1), y = Math.round(hy + Math.sin(ang) * (gemR + 0.6)) - (k === 2 ? 1 : 0) + (s === 0 ? 1 : 0); g.set(x + (s === 0 ? -k : 0), y - (s === 0 ? -k : 0), "T", tt); }
    }
    else diagFill(g, aTop + 1, aTop + 2, () => -2, () => 1, "T", (a, p, lo, hi) => (p === lo ? 3 : p === hi ? 0 : 2));
  } else if (head === "crook") {
    // 先が巻く (渦)
    const pts = [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1], [2, 2], [1, 2]];
    const [bx, by] = diagXY(aTop, -0.5);
    for (const [dx, dy] of pts) { g.set(Math.round(bx + dx), Math.round(by + dy - 3), "W", dy < 1 ? 3 : 1); g.set(Math.round(bx + dx), Math.round(by + dy - 2), "W", 2); }
    blob(g, ac, 2, 1.2, "E", 3);
  } else if (head === "crescent") {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d1 = Math.hypot(x - hx, y - hy), d2 = Math.hypot(x - hx - 1.3, y - hy + 1.3);
      if (d1 <= gemR + 1.4 && d2 > gemR + 0.5) g.set(x, y, "T", sphereTone(x, y, hx, hy, gemR + 1.5, gemR + 1.5, 2));
    }
    blob(g, ac, 1.5, 1.0, "E", 4);
  } else if (head === "crystal") {
    // 縦長の結晶の束
    const shards = [[0, 0, 4], [-2, 1, 2.5], [2, 1, 2.5]];
    for (const [sx, sy, ln] of shards) for (let k = 0; k < ln * 1.4; k++) {
      const w = k < ln * 1.1 ? 1 : 0;
      for (let d = 0; d <= w; d++) g.set(Math.round(hx + sx + d + k * 0.35), Math.round(hy + sy + 1 - k), "E", d === 0 ? 3 : 1);
    }
    diagFill(g, aTop, aTop + 1, () => -2, () => 1, "T", (a, p, lo, hi) => (p === lo ? 3 : 1));
  } else if (head === "ring") {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d = Math.hypot(x - hx, y - hy);
      if (d <= gemR + 1.3 && d >= gemR) g.set(x, y, "T", sphereTone(x, y, hx, hy, gemR + 1.5, gemR + 1.5, 2));
    }
    blob(g, ac, -0.5, 1.2, "E", 3);
    // 輪の中の小さな環
    if (o >= 2) for (const k of [-1, 1]) { const [x, y] = diagXY(ac, -0.5 + k * 3); if (Number.isInteger(x)) g.set(x, y, "T", 3); }
  } else if (head === "skull") {
    blob(g, ac, -0.5, gemR, "B");
    const [sx, sy] = diagXY(ac, -0.5);
    g.set(Math.round(sx) - 1, Math.round(sy), "E", 4); g.set(Math.round(sx) + 1, Math.round(sy), "E", 4);
    g.ink(Math.round(sx), Math.round(sy) + 2);
  } else if (head === "star") {
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      for (let k = 0; k <= 3; k++) g.set(Math.round(hx + Math.cos(ang) * k), Math.round(hy + Math.sin(ang) * k), "T", k === 3 ? 4 : 3 - (Math.cos(ang) + Math.sin(ang) > 0 ? 1 : 0));
    }
    blob(g, ac, -0.5, 1.2, "E", 3);
  } else if (head === "branch") {
    // 二股の枝 + 葉 + 実 (宝石)
    for (const [ang, ln] of [[-2.4, 4], [-0.8, 4], [-1.6, 3]]) for (let k = 0; k <= ln; k++) g.set(Math.round(hx - 1 + Math.cos(ang) * k), Math.round(hy + 2 + Math.sin(ang) * k), "W", 2 - (k % 2));
    g.def("V", MAT.green);
    for (const [dx, dy] of [[-3, -1], [2, -2], [-1, -3], [3, 0]]) { g.set(Math.round(hx + dx), Math.round(hy + dy), "V", 3); g.set(Math.round(hx + dx) + 1, Math.round(hy + dy), "V", 1); }
    blob(g, ac, -0.5, 1.2, "E", 3);
  } else if (head === "flame") {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const dx = x - hx, dy = y - hy;
      if (dy > 1.5 || dy < -4.5) continue;
      const wdt = (1.5 - dy) * 0.45 * (1 - Math.max(0, -dy - 1) / 4);
      if (Math.abs(dx + dy * 0.2) > wdt + 0.6) continue;
      g.set(x, y, "E", Math.abs(dx) < 0.8 ? 4 : 2);
    }
    diagFill(g, aTop, aTop + 2, () => -2, () => 1, "T", (a, p, lo, hi) => (p === lo ? 3 : 1));
  }
  shaftDeco(g, th, aBot + 4, aTop - 1);
  // 宝石の帯
  if (o >= 2 && r.chance(0.5)) blob(g, aTop - 3, -0.5, 0.8, "G", 3);
}

// ===== 弓 =====
function bow(g, th, it) {
  const r = th.r, o = th.deco;
  const kind = pickW(r, [["long", 3], ["recurve", 2.5], ["composite", th.motifs.has("bone") || th.motifs.has("beast") ? 3 : 1.2], ["horn", th.motifs.has("demon") ? 2 : 0.6], ["wing", th.motifs.has("wing") ? 4 : 0.5], ["blade", th.motifs.has("demon") || th.motifs.has("flame") ? 1.2 : 0.4]]);
  const A = r.pick([18, 19, 20, 21]); // 腕の両端 (a = ±A)
  const bulge = kind === "long" ? r.pick([11, 12, 13]) : r.pick([9, 10, 11]);
  const mat = kind === "composite" || kind === "horn" ? (r.chance(0.5) ? "B" : "W") : r.chance(0.2) ? "M" : "W";
  const thick = r.pick([1.3, 1.6, 1.9]);
  const twoTone = kind === "composite" || r.chance(0.2);
  const bands = r.pick([0, 0, 1, 2]);
  const runes = !!th.glow && o >= 2 && r.chance(0.6);
  const tipStyle = r.pick(["plain", "ball", "hook", "gem", "spike", "flower"]);
  // 腕: p = -bulge × (1 − (a/A)²)。光の側 (左上) へ膨らむ弧
  const pc = (a) => {
    const u = a / A;
    let v = -bulge * (1 - u * u);
    if (kind === "recurve" && Math.abs(u) > 0.72) v += (Math.abs(u) - 0.72) * 30;
    return v;
  };
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const [a, p] = diagAP(x, y);
    if (Math.abs(a) > A) continue;
    const c = pc(a);
    const th2 = Math.abs(a) < 4 ? thick + 0.6 : Math.abs(a) > A - 4 ? thick * 0.7 : thick;
    if (p < c - th2 || p > c + th2) continue;
    let t = p < c - 0.4 ? 3 : p > c + 0.6 ? 1 : 2;
    if (Math.abs(a) > A - 2) t = 3;
    const m = twoTone && p > c ? (mat === "B" ? "W" : "B") : mat;
    g.set(x, y, m, t);
  }
  // 腕の帯金
  for (let b = 1; b <= bands; b++) for (const s of [-1, 1]) {
    const a0 = s * Math.round(A * (0.35 + 0.25 * b));
    diagFill(g, a0 - 1, a0 + 1, (a) => Math.round(pc(a)) - 2, (a) => Math.round(pc(a)) + 2, (a, p) => (g.get(...diagXY(a, p)) ? "T" : null), (a, p, lo) => (p - lo < 2 ? 3 : 1));
  }
  // 属性の刻み
  if (runes) for (let a = -A + 4; a <= A - 4; a += 5) { const [x, y] = diagXY(a, Math.round(pc(a)) + (((a + Math.round(pc(a))) & 1) ? 0 : 1)); if (Number.isInteger(x) && g.get(x, y)) g.set(x, y, "E", 4); }
  // 刃のついた弓
  if (kind === "blade") for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const a = s * (A - 4 - k * 2); const [x, y] = diagXY(a, Math.round(pc(a)) - 3 + (((a + Math.round(pc(a))) & 1) ? 0 : 1)); if (Number.isInteger(x)) g.set(x, y, "S", 4 - (k >> 1)); }
  // 握り
  const gm = r.pick(["L", "L", "C", "T"]);
  diagFill(g, -3, 3, (a) => Math.round(pc(a)) - 1, (a) => Math.round(pc(a)) + 1, gm, (a, p, lo, hi) => (((a % 2) + 2) % 2 ? 2 : rodTone(p, lo, hi)));
  // 弦 (腕の両端を結ぶ細い線)
  g.def("Z", r.pick([["#3a3640", "#6a6470", "#a8a2a0", "#d8d2c8", "#f4f0e8"], ["#2a1a10", "#5a3a20", "#a07a4a", "#d8b880", "#f4e0b0"], ["#1a2030", "#3a4a6a", "#7a90b0", "#b8d0e8", "#eef6ff"]]));
  const sp = r.pick([0, 0, 2]);
  for (let a = -A + 1; a <= A - 1; a++) {
    if (((a + sp) % 2 + 2) % 2 !== 1) continue;
    const [x, y] = diagXY(a, sp);
    if (Number.isInteger(x) && !g.get(x, y)) g.set(x, y, "Z", 2);
  }
  // 弭 (ゆはず) の飾り
  for (const s of [-1, 1]) {
    const [x, y] = diagXY(s * A, Math.round(pc(s * A)) + (s * A % 2 === 0 ? 0 : 1));
    if (!Number.isInteger(x)) continue;
    if (tipStyle === "ball") blob(g, s * A, Math.round(pc(s * A)), 1.0, "T");
    else if (tipStyle === "gem") blob(g, s * A, Math.round(pc(s * A)), 0.9, "G", 3);
    else if (tipStyle === "hook") { g.set(x, y, "T", 3); g.set(x + s, y + s, "T", 2); }
    else if (tipStyle === "spike") { g.set(x, y, "S", 4); g.set(x + s, y - s, "S", 3); }
    else if (tipStyle === "flower") { g.set(x, y, "C", 3); g.set(x - 1, y, "C", 2); g.set(x, y - 1, "C", 3); }
    else g.set(x, y, "T", 3);
  }
  if (kind === "wing") for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const [x, y] = diagXY(s * (A - 6 - k), Math.round(pc(s * (A - 6))) - 2 - k); if (Number.isInteger(x)) g.set(x, y, "C", 3 - (k >> 1)); }
  if (kind === "horn") for (const s of [-1, 1]) { const [x, y] = diagXY(s * (A - 2), Math.round(pc(s * (A - 2))) - 2); if (Number.isInteger(x)) { g.set(x, y, "B", 3); g.set(x - 1, y - 1, "B", 4); } }
  // 宝石 (握りの上)
  if (o >= 1 && r.chance(0.4 + o * 0.12)) blob(g, 4, Math.round(pc(4)) - 1, 0.8, "G", 3);
  // 握りから垂れる房
  if (r.chance(0.3)) { const [x, y] = diagXY(-1, Math.round(pc(-1)) + 2); for (let k = 0; k < 4; k++) g.set(Math.round(x) + (k >> 1), Math.round(y) + k, "C", 3 - (k >> 1)); }
  // 矢をつがえた弓 (一部)
  if (r.chance(0.28)) {
    const ay = r.pick([11, 12]);
    for (let x = 3; x <= 21; x++) if (!g.get(x, ay) || x > 6) g.set(x, ay, x > 19 ? "S" : "W", x > 19 ? 4 : 3);
    g.set(22, ay, "S", 3); g.set(21, ay - 1, "S", 3); g.set(21, ay + 1, "S", 1);
    g.def("V", MAT[th.cloth] || MAT.red);
    g.set(3, ay - 1, "V", 3); g.set(4, ay - 1, "V", 3); g.set(3, ay + 1, "V", 1); g.set(4, ay + 1, "V", 1);
  }
}

const BY_CAT = { ls: longsword, dg: dagger, kt: katana, ax: axe, mc: mace, sp: spear, st: staff, bw: bow };

export function weaponArt(it, th) {
  const g = new Grid();
  mats(g, th, it);
  const fn = BY_CAT[it.cat] || longsword;
  fn(g, th, it);
  g.outline();
  g.tidy();
  return g;
}

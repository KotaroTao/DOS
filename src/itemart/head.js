// 頭の防具の絵: 兜 (重) / 帽子・頭巾 (軽) / 冠・宝冠・魔法帽 (布)
// 品ごとに「形 × 覗き穴 × 額の帯 × 飾り (前立・角・翼・羽根) × 頬・首の守り × 宝石」を組み合わせる
import { MAT, sphereTone } from "./core.js";
import { CX, lit, clampT, shape } from "./front.js";
import { stamp } from "./emblems.js";

const dot2 = (g, x, y, m, t1 = 3, t2 = 2) => { g.set(x, y, m, t1); g.set(x + 1, y, m, t2); };
const gem4 = (g, x, y) => { g.set(x, y, "G", 4); g.set(x + 1, y, "G", 3); g.set(x, y + 1, "G", 2); g.set(x + 1, y + 1, "G", 1); };

// ---------- 兜 ----------
export function helm(g, th, it) {
  const r = th.r, d = th.deco;
  const shell = r.wpick([["great", 2], ["bascinet", 1.5], ["barbute", 1.5], ["sallet", 1.2], ["armet", 1.5], ["kabuto", th.motifs.has("demon") || /鬼|武者|侍/.test(th.name) ? 3 : 0.8], ["spangen", 1.2], ["close", 1.2]]);
  const top = r.pick([3, 4, 5]);
  const R = r.pick([6.5, 7, 7.5, 8]);
  const bot = shell === "kabuto" ? 17 : r.pick([19, 20]);
  const cy = top + R;
  const inside = (x, y) => {
    if (y < top || y > bot) return false;
    const dx = x - CX;
    if (shell === "great" || shell === "close") {
      const w = R - (y < top + 1.5 ? 1.4 : 0) + (shell === "close" && y > cy + 2 ? -(y - cy - 2) * 0.3 : 0);
      return Math.abs(dx) <= w;
    }
    if (shell === "bascinet") { // 尖った頂
      const dy = y - cy;
      if (dy < 0) return Math.abs(dx) <= R * Math.sqrt(Math.max(0, 1 - (dy / (R + 1.5)) ** 2)) * (1 + dy / (R * 3.2));
      return Math.abs(dx) <= R - dy * 0.15;
    }
    if (shell === "spangen") { // 先の尖った鉢
      const dy = y - cy;
      if (dy < 0) return Math.abs(dx) <= R * (1 + dy / (R + 1.2)) ** 0.7;
      return Math.abs(dx) <= R;
    }
    if (y > cy) {
      if (shell === "sallet") return Math.abs(dx) <= R + (y - cy) * 0.35;
      if (shell === "kabuto") return Math.abs(dx) <= R + (y - cy) * 0.8;
      return Math.abs(dx) <= R - (y - cy) * 0.12;
    }
    return dx * dx + ((y - cy) * 1.05) ** 2 <= R * R;
  };
  shape(g, inside, 1, "M", (x, y) => {
    let t = sphereTone(x + 0.5, y + 0.5, CX, cy - 1, R + 2, R + 3, 2);
    if (Math.abs(x + 0.5 - CX) < 0.8 && y < cy + 2) t += x < 12 ? 1 : -0.5; // 稜線
    if (shell === "spangen" && Math.abs(Math.abs(x + 0.5 - CX) - R * 0.55) < 0.5 && y < cy) t -= 1.2; // 筋
    if (shell === "kabuto" && y > cy && (y - cy) % 2 === 0) t -= 1; // 錣 (しころ) の段
    return ["M", t];
  });
  // 覗き穴
  const ey = Math.round(cy) + r.pick([-2, -1, 0]);
  const visor = shell === "great" ? r.pick(["slit", "cross", "eyes", "grille"]) : shell === "barbute" ? r.pick(["T", "Y"]) : shell === "kabuto" ? r.pick(["mask", "open"]) : shell === "spangen" ? r.pick(["nasal", "spectacle"]) : shell === "close" ? r.pick(["bars", "slit", "grille"]) : r.pick(["slit", "slit2", "eyes", "visorline"]);
  const half = Math.round(R) - 1;
  if (visor === "slit" || visor === "slit2" || visor === "visorline") {
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) if (!(visor === "slit" && shell === "great" && Math.abs(x + 0.5 - CX) < 0.8)) g.ink(x, ey);
    if (visor === "slit2") for (let x = Math.round(CX - half) + 1; x <= Math.round(CX + half) - 2; x++) g.ink(x, ey + 2);
    if (visor === "visorline") for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) g.set(x, ey - 1, "M", 1), g.set(x, ey + 1, "M", 3);
  } else if (visor === "cross") {
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) if (Math.abs(x + 0.5 - CX) > 0.8) g.ink(x, ey);
    for (let y = ey + 1; y <= ey + 5; y++) { g.ink(11, y); g.ink(12, y); }
  } else if (visor === "eyes") {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.ink(Math.round(CX - 0.5 + s * (2 + k)), ey);
  } else if (visor === "grille") {
    for (let y = ey; y <= ey + 3; y++) for (let x = Math.round(CX - half) + 1; x <= Math.round(CX + half) - 2; x++) if ((x + y) % 2 === 0) g.ink(x, y);
  } else if (visor === "bars") {
    for (let x = Math.round(CX - half) + 1; x <= Math.round(CX + half) - 2; x++) for (let y = ey; y <= ey + 4; y++) if (x % 2 === 0) g.ink(x, y);
  } else if (visor === "T" || visor === "Y") {
    for (let x = Math.round(CX - half) + 1; x <= Math.round(CX + half) - 2; x++) g.ink(x, ey);
    for (let y = ey + 1; y <= bot - 1; y++) { const w = visor === "Y" ? Math.max(0, 2 - (y - ey)) : 0; for (let x = 11 - w; x <= 12 + w; x++) g.ink(x, y); }
  } else if (visor === "nasal") {
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) g.set(x, ey, "M", 0);
    for (let y = ey; y <= ey + 4; y++) { g.set(11, y, "T", 3); g.set(12, y, "T", 1); }
    for (let y = ey + 1; y <= bot; y++) for (let x = 7; x <= 16; x++) if (x < 11 || x > 12) { const p = g.get(x, y); if (p && p.m === "M" && Math.abs(x + 0.5 - CX) < half - 0.5) g.set(x, y, "M", 0); }
  } else if (visor === "spectacle") {
    for (const s of [-1, 1]) for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [1, 1], [3, 1], [1, 2], [2, 2], [3, 2]]) g.set(Math.round(CX - 0.5 + s * dx), ey + dy, "T", s < 0 ? 3 : 2);
    for (const s of [-1, 1]) g.ink(Math.round(CX - 0.5 + s * 2), ey + 1);
  } else if (visor === "mask") { // 面頬 (鬼の面)
    g.def("V", MAT[th.metal === "black" ? "red" : "black"]);
    for (let y = ey; y <= ey + 5; y++) for (let x = 7; x <= 16; x++) { const ax = Math.abs(x + 0.5 - CX); if (ax < 4.5 - (y - ey) * 0.3) g.set(x, y, "V", clampT(lit(x, y, 2.2, 2, 0.4))); }
    for (const s of [-1, 1]) g.ink(Math.round(CX - 0.5 + s * 2), ey + 1);
    for (let x = 10; x <= 13; x++) g.ink(x, ey + 4);
    g.set(10, ey + 4, "F", 4); g.set(13, ey + 4, "F", 4);
  }
  // 額の帯
  const band = r.wpick([["none", 1.5], ["brow", 2], ["rivets", 1.5], ["ridges", 1]]);
  const by = ey - 2;
  if (band === "brow") for (let x = 0; x < 24; x++) { const p = g.get(x, by); if (p && p.m === "M") g.set(x, by, "T", clampT(lit(x, by, 2.6, 2, 0))); }
  if (band === "rivets") for (let x = Math.round(CX - half) + 1; x <= Math.round(CX + half) - 1; x += 2) { const p = g.get(x, by); if (p && p.m === "M") g.set(x, by, "T", 4); }
  if (band === "ridges") for (const s of [-1, 1]) for (let y = top + 1; y < ey; y++) { const x = Math.round(CX - 0.5 + s * 3); const p = g.get(x, y); if (p && p.m === "M") g.set(x, y, "T", s < 0 ? 3 : 1); }
  // 頬・首の守り
  const neck = shell === "kabuto" ? "none" : r.wpick([["none", 2], ["aventail", 1.2], ["plates", 1]]);
  if (neck === "aventail") for (let y = bot + 1; y <= Math.min(22, bot + 3); y++) for (let x = Math.round(CX - R); x <= Math.round(CX + R) - 1; x++) g.set(x, y, "M", clampT(lit(x, y, (x + y) % 2 ? 2 : 1, 2, 0)));
  if (neck === "plates") for (let y = bot + 1; y <= Math.min(22, bot + 2); y++) for (let x = Math.round(CX - R + 1 + (y - bot)); x <= Math.round(CX + R - 2 - (y - bot)); x++) g.set(x, y, "M", clampT(lit(x, y, y === bot + 1 ? 2.6 : 1.5, 2, 0)));
  // 飾り (前立・角・翼・羽根・棘・冠)
  const crest = r.wpick([
    ["none", 1.8 - d * 0.3], ["plume", 1.5], ["ridge", 1], ["horns", th.motifs.has("demon") || th.motifs.has("beast") ? 4 : 0.9], ["ram", th.motifs.has("beast") ? 2 : 0.5],
    ["unicorn", th.motifs.has("holy") ? 1 : 0.3], ["wings", th.motifs.has("wing") || th.motifs.has("holy") ? 4 : 0.8], ["spikes", th.motifs.has("demon") ? 2 : 0.6], ["crown", th.motifs.has("crown") ? 4 : d >= 3 ? 1 : 0.2],
    ["kuwagata", shell === "kabuto" ? 5 : 0], ["fan", 0.6],
  ]);
  if (crest === "plume") {
    const dir = r.pick([-1, 1]), pm = r.pick(["C", "D", "F"]);
    for (let k = 0; k < 7; k++) for (let w = 0; w < 3; w++) {
      const x = Math.round(CX - 0.5 + dir * k * 0.9) + w - 1, y = top - 1 - Math.round(Math.sin((k / 6) * Math.PI) * 2.6) + (w === 2 ? 1 : 0);
      if (y >= 0) g.set(x, y, pm, clampT(lit(x, y, 2.8 - w * 0.6, 1.4, 0)));
    }
  } else if (crest === "ridge") {
    for (let y = Math.max(0, top - 2); y < cy - 1; y++) { g.set(11, y, "T", 3); g.set(12, y, "T", 1); }
  } else if (crest === "horns") {
    const hl = r.pick([5, 6, 7]);
    for (const s of [-1, 1]) for (let k = 0; k < hl; k++) {
      const x = Math.round(CX - 0.5 + s * (R - 1 + Math.min(k, 3) * 0.7)), y = Math.round(cy - 2 - k);
      g.set(x, y, "B", s < 0 ? 3 : 2); if (k < hl - 2) g.set(x + s, y, "B", 1);
    }
  } else if (crest === "ram") {
    for (const s of [-1, 1]) for (const [dx, dy] of [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1], [2, 2], [1, 2], [1, 1]]) g.set(Math.round(CX - 0.5 + s * (R - 1 + dx)), Math.round(cy - 2 + dy), "B", s < 0 ? 3 - (dy > 0 ? 1 : 0) : 1);
  } else if (crest === "unicorn") {
    for (let k = 0; k < 6; k++) g.set(11, top - k, "T", 3 - (k & 1)), g.set(12, top - k + 1, "T", 1);
  } else if (crest === "wings") {
    const wl = r.pick([4, 5]);
    for (const s of [-1, 1]) for (let k = 0; k < wl; k++) for (let j = 0; j <= wl - 1 - k; j++) g.set(Math.round(CX - 0.5 + s * (R + k)), Math.round(cy - 3 - j + k * 0.6), "F", s < 0 ? 3 - (j === 0 ? 0 : 1) : 2);
  } else if (crest === "spikes") {
    for (let i = -2; i <= 2; i++) { const x = Math.round(CX - 0.5 + i * 2.2); for (let k = 1; k <= (i === 0 ? 3 : 2); k++) g.set(x, top - k + Math.abs(i) * 0.5, "F", k === 1 ? 2 : 4); }
  } else if (crest === "crown") {
    for (let x = Math.round(CX - 4); x <= Math.round(CX + 3); x++) { g.set(x, top - 1, "T", clampT(lit(x, top, 2.6, 2, 0))); if ((x - 7) % 2 === 0) g.set(x, top - 2, "T", 3); }
    g.set(11, top - 1, "G", 3);
  } else if (crest === "kuwagata") { // 鍬形
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const x = Math.round(CX - 0.5 + s * (1.5 + k * 0.8)), y = Math.round(cy - 3 - k * 1.1 + Math.max(0, k - 4) * 0.8); g.set(x, y, "T", s < 0 ? 3 : 2); }
    gem4(g, 11, Math.round(cy) - 3);
  } else if (crest === "fan") {
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 8)); for (let k = 2; k <= 5; k++) { const x = Math.round(CX - 0.5 + Math.cos(a) * k), y = Math.round(top + 1 - Math.sin(a) * k); if (y >= 0) g.set(x, y, "C", clampT(lit(x, y, 2.6, 1.6, 0) - (i % 2))); } }
  }
  // 額の宝石・紋
  if (d >= 3 && crest !== "kuwagata") gem4(g, 11, by - 2 < top ? top + 1 : by - 2);
  else if (d >= 2 && r.chance(0.6)) dot2(g, 11, by, "G", 3, 2);
  // 息抜きの穴
  if (r.chance(0.4) && visor !== "mask") for (let k = 0; k < 3; k++) g.ink(Math.round(CX + half - 2), ey + 2 + k * 2 < bot ? ey + 2 + k * 2 : ey + 2);
}

// ---------- 帽子・頭巾 (軽) ----------
export function lightHat(g, th, it) {
  const r = th.r, d = th.deco;
  const kind = r.wpick([["hood", 2.5], ["cap", 2], ["feather", 1.5], ["bandana", 1.2], ["kettle", 1.2], ["coif", 1.2], ["skull", 1.2], ["headband", 1], ["horned", th.motifs.has("beast") || th.motifs.has("demon") ? 2.5 : 0.4], ["mask", th.motifs.has("demon") || th.motifs.has("eye") ? 1.5 : 0.4]]);
  hatKinds[kind](g, th, it, r, d);
}
// ---------- 冠・魔法帽 (布) ----------
export function clothHead(g, th, it) {
  const r = th.r, d = th.deco;
  if (it.shape === "circlet" || (!it.shape && !/帽|頭巾|フード/.test(th.name) && r.chance(0.75))) return circlet(g, th, it, r, d);
  const kind = r.wpick([["wizard", 3], ["mitre", th.motifs.has("holy") ? 3 : 0.8], ["turban", 1], ["hood", 1.2], ["witch", 1]]);
  hatKinds[kind](g, th, it, r, d);
}

function hoodShape(g, m, r, opt) {
  const tall = opt.tall || 0;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const dx = (x + 0.5 - CX) / (y > 13 ? 9.6 : 8 + tall * 0.3), dy = (y + 0.5 - 11.5) / (9.5 + tall * 0.5);
    let ins = dx * dx + dy * dy <= 1 && y >= 2 - tall;
    if (opt.point && y < 7) ins = ins || (Math.abs(x + 0.5 - CX - (7 - y) * 0.5 * opt.point) < (y - (1 - tall)) * 0.9 && y >= 1 - tall);
    if (!ins || y > 21) continue;
    g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 9, 10, 11, 2)));
  }
  // 顔の陰
  const fw = opt.fw || 4.5;
  for (let y = 9; y <= 20; y++) for (let x = 6; x <= 17; x++) {
    const dx = (x + 0.5 - CX) / fw, dy = (y + 0.5 - 14.5) / 5.5;
    if (dx * dx + dy * dy <= 1) g.set(x, y, m, 0);
  }
}

const hatKinds = {
  hood(g, th, it, r, d) {
    const m = it.weight === "cloth" ? "C" : r.pick(["L", "C", "C"]);
    hoodShape(g, m, r, { point: r.pick([0, 0, 1, -1]), tall: r.pick([0, 1]), fw: r.pick([4, 4.5, 5]) });
    const eyes = r.pick(["none", "glow", "glow", "dots"]);
    if (eyes === "glow") { g.set(10, 14, "E", 4); g.set(13, 14, "E", 4); }
    if (eyes === "dots") { g.set(10, 14, "F", 2); g.set(13, 14, "F", 2); }
    const trim = r.wpick([["none", 2], ["rim", 2], ["fur", th.motifs.has("beast") || th.el === "water" ? 2 : 0.5], ["clasp", 1.5]]);
    if (trim === "rim") for (let y = 8; y <= 21; y++) for (let x = 5; x <= 18; x++) { const p = g.get(x, y); if (p && p.m === m && p.t > 0) { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const q = g.get(x + a, y + b); return q && q.m === m && q.t === 0; }); if (n) g.set(x, y, "T", clampT(lit(x, y, 2.4, 1.6, 0))); } }
    if (trim === "fur") for (let x = 3; x <= 20; x++) for (let y = 19; y <= 21; y++) if (g.get(x, y)) g.set(x, y, "B", clampT(lit(x, y, 2.6, 1.6, 0) + ((x * 3 + y) % 3 === 0 ? 1 : 0)));
    if (trim === "clasp") { dot2(g, 11, 20, "T", 4, 2); }
    // 頭巾の作り: 獣の耳 / 縞 / 肩掛け / 二色
    const extra = r.wpick([["none", 2], ["ears", th.motifs.has("beast") ? 3 : 0.6], ["stripes", 1], ["mantle", 1.2], ["split", 1]]);
    if (extra === "ears") for (const s of [-1, 1]) for (let k = 0; k < 3; k++) for (let w = 0; w <= 2 - k; w++) g.set(Math.round(CX - 0.5 + s * (5 + w)), 3 - k, m, s < 0 ? 3 : 1);
    if (extra === "stripes") for (let y = 2; y <= 21; y++) for (let x = 0; x < 24; x++) { const p = g.get(x, y); if (p && p.m === m && p.t > 0 && (y % 4 === 0)) g.set(x, y, "D", clampT(p.t)); }
    if (extra === "mantle") for (let y = 19; y <= 22; y++) for (let x = Math.round(CX - 9.5 + (22 - y) * 0.3); x <= Math.round(CX + 8.5 - (22 - y) * 0.3); x++) g.set(x, y, "D", clampT(lit(x, y, y === 19 ? 2.6 : 1.8, 1.8, 0)));
    if (extra === "split") for (let y = 2; y <= 21; y++) for (let x = 12; x < 24; x++) { const p = g.get(x, y); if (p && p.m === m && p.t > 0) g.set(x, y, "D", p.t); }
    if (d >= 2) stamp(g, r.pick(["eye", "star", "moon", "diamond"]), 8, 2, "T", "G", { base: 2 });
  },
  cap(g, th, it, r, d) {
    const m = r.pick(["L", "L", "C"]);
    const flaps = r.chance(0.7), crown = r.pick([7, 7.5, 8]);
    for (let y = 3; y <= 20; y++) for (let x = 3; x <= 20; x++) {
      const dx = (x + 0.5 - CX) / crown, dy = (y + 0.5 - 11.5) / 8.5;
      const flap = flaps && y >= 11 && y <= 19 && Math.abs(x + 0.5 - CX) >= 4 && Math.abs(x + 0.5 - CX) <= crown - (y - 11) * 0.25;
      if (!(dx * dx + dy * dy <= 1 && y <= 12) && !flap) continue;
      g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 9, 9, 10, 2)));
    }
    if (flaps) for (let y = 12; y <= 18; y++) for (let x = 8; x <= 15; x++) g.set(x, y, "F", 0);
    const bd = r.pick(["T", "D", "M"]);
    for (let x = 4; x <= 19; x++) if (g.get(x, 11)) g.set(x, 11, bd, clampT(lit(x, 11, 2.4, 1.6, 0)));
    if (r.chance(0.6)) for (let y = 4; y <= 10; y++) g.set(11, y, m, 1);
    if (r.chance(0.5)) for (let y = 5; y <= 10; y += 2) { g.set(8, y, "T", 3); g.set(15, y, "T", 2); }
    if (d >= 2) gem4(g, 11, 6);
    if (flaps && r.chance(0.5)) for (const x of [5, 18]) for (const y of [14, 17]) g.set(x, y, "T", 3);
    if (r.chance(0.35)) for (let k = 0; k < 4; k++) g.set(16 + k, 3 - (k >> 1) + 4, "F", 3 - (k & 1)); // 小さな羽根
  },
  feather(g, th, it, r, d) {
    const m = r.pick(["C", "C", "L"]);
    const brim = r.pick([10, 11]), ch = r.pick([6, 7, 8]);
    for (let y = 16 - ch; y <= 16; y++) for (let x = 3; x <= 20; x++) {
      const dx = (x + 0.5 - CX) / 6.8, dy = (y + 0.5 - 16) / ch;
      if (dx * dx + dy * dy > 1 || y > 15) continue;
      g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 12, 8, 8, 2)));
    }
    for (let x = 0; x < 24; x++) for (let y = 14; y <= 18; y++) { const dx = (x + 0.5 - CX) / brim, dy = (y - 16) / 1.5; if (dx * dx + dy * dy <= 1) g.set(x, y, m, clampT(lit(x, y, y <= 15 ? 2.5 : 1.2, 1.6, 0))); }
    for (let x = 5; x <= 18; x++) if (g.get(x, 14)) g.set(x, 14, "D", 2);
    const fm = r.pick(["F", "G", "E", "D"]), fl = r.pick([8, 10, 12]), side = r.pick([1, -1]);
    for (let k = 0; k < fl; k++) { const x = Math.round(CX - 0.5 + side * (2.5 + k * 0.7)), y = 13 - k; if (y < 0) break; g.set(x, y, fm, 3); g.set(x + side, y, fm, 2); if (k > 2 && k < fl - 1) g.set(x - side, y, fm, 4); }
    if (d >= 2) dot2(g, side > 0 ? 13 : 9, 14, "G", 4, 3);
  },
  bandana(g, th, it, r, d) {
    const m = r.pick(["C", "D"]);
    for (let y = 6; y <= 15; y++) for (let x = 4; x <= 19; x++) {
      const dx = (x + 0.5 - CX) / 7.5, dy = (y + 0.5 - 15) / 8.5;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 11, 8, 8, 2)));
    }
    if (r.chance(0.5)) for (let y = 7; y <= 14; y++) for (let x = 4; x <= 19; x++) if (g.get(x, y) && (x + y) % 4 === 0) g.shade(x, y, -1); // 柄
    const tie = r.pick(["T", "D", "C"]);
    for (let x = 4; x <= 19; x++) { g.set(x, 14, tie, clampT(lit(x, 14, 2.5, 1.6, 0))); g.set(x, 15, tie, clampT(lit(x, 15, 1.5, 1.6, 0))); }
    const tl = r.pick([4, 5, 6]);
    for (let k = 0; k < tl; k++) { g.set(19 + (k >> 1), 15 + k, tie, 2 - (k & 1)); g.set(20 + (k >> 1), 15 + k, tie, 1); }
    if (d >= 2) dot2(g, 11, 14, "G", 4, 2);
  },
  kettle(g, th, it, r, d) {
    const brim = r.pick([10, 10.5, 11]), crown = r.pick([6, 6.5, 7]), h = r.pick([7, 8, 9]);
    for (let y = 16 - h; y <= 15; y++) for (let x = 3; x <= 20; x++) {
      const dx = (x + 0.5 - CX) / crown, dy = (y + 0.5 - 16) / h;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, "M", clampT(sphereTone(x + 0.5, y + 0.5, CX, 11, 8, 8, 2)));
    }
    for (let y = 15; y <= 17; y++) for (let x = Math.round(CX - brim); x <= Math.round(CX + brim) - 1; x++) g.set(x, y, "M", clampT(lit(x, y, y === 15 ? 3 : y === 16 ? 2 : 1, 1.6, 0)));
    if (r.chance(0.6)) for (let y = 16 - h + 1; y <= 15; y++) { g.set(11, y, "T", 3); g.set(12, y, "T", 1); }
    if (r.chance(0.5)) for (let x = Math.round(CX - crown) + 1; x <= Math.round(CX + crown) - 1; x += 2) g.set(x, 14, "T", 3);
    if (d >= 2) gem4(g, 11, 11);
  },
  coif(g, th, it, r, d) { // 鎖頭巾
    for (let y = 3; y <= 21; y++) for (let x = 2; x <= 21; x++) {
      const dx = (x + 0.5 - CX) / (y > 14 ? 9.5 : 7.5), dy = (y + 0.5 - 12) / 9.5;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, "M", clampT(sphereTone(x + 0.5, y + 0.5, CX, 9, 10, 11, 2) - ((x + y) % 2 ? 0.8 : 0)));
    }
    for (let y = 9; y <= 17; y++) for (let x = 8; x <= 15; x++) { const dx = (x + 0.5 - CX) / 4, dy = (y + 0.5 - 13) / 4.6; if (dx * dx + dy * dy <= 1) g.set(x, y, "F", 0); }
    if (r.chance(0.6)) for (let x = 6; x <= 17; x++) if (g.get(x, 8)) g.set(x, 8, "L", clampT(lit(x, 8, 2.4, 1.6, 0)));
    if (d >= 2) dot2(g, 11, 6, "G", 4, 2);
  },
  skull(g, th, it, r, d) { // 鉢金 + 鼻当て
    const R = r.pick([7, 7.5]);
    for (let y = 4; y <= 13; y++) for (let x = 3; x <= 20; x++) {
      const dx = (x + 0.5 - CX) / R, dy = (y + 0.5 - 13) / 8.5;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, "M", clampT(sphereTone(x + 0.5, y + 0.5, CX, 9, 9, 9, 2)));
    }
    for (let x = Math.round(CX - R); x <= Math.round(CX + R) - 1; x++) g.set(x, 13, "L", clampT(lit(x, 13, 2, 1.6, 0)));
    if (r.chance(0.6)) for (let y = 13; y <= 17; y++) { g.set(11, y, "M", 3); g.set(12, y, "M", 1); }
    if (r.chance(0.5)) for (const s of [-1, 1]) for (let y = 13; y <= 18; y++) g.set(Math.round(CX - 0.5 + s * (R - 1)), y, "L", s < 0 ? 2 : 1);
    if (r.chance(0.5)) for (let y = 5; y <= 12; y++) g.set(11, y, "T", 3);
    if (d >= 2) gem4(g, 11, 9);
  },
  headband(g, th, it, r, d) {
    const m = r.pick(["C", "D", "L"]);
    for (let x = 2; x <= 21; x++) for (let y = 11; y <= 14; y++) { const dx = (x + 0.5 - CX) / 10, dy = (y + 0.5 - 13) / 2; if (dx * dx + dy * dy <= 1) g.set(x, y, m, clampT(lit(x, y, y <= 12 ? 2.6 : 1.4, 2, 0))); }
    stamp(g, r.pick(["diamond", "sun", "eye", "star", "leaf"]), 8, 9, "T", "G", { base: 2 });
    const tails = r.pick([0, 1, 2]);
    for (let t = 0; t < tails; t++) for (let k = 0; k < 6; k++) g.set(20 + t + (k >> 1), 14 + k, m, 2 - (k & 1));
    if (r.chance(0.5)) for (let k = 0; k < 8; k++) g.set(4 + Math.round(k * 0.3), 10 - k, "F", 3 - (k & 1));
  },
  horned(g, th, it, r, d) {
    const m = r.pick(["L", "B", "C"]);
    for (let y = 6; y <= 15; y++) for (let x = 4; x <= 19; x++) { const dx = (x + 0.5 - CX) / 7, dy = (y + 0.5 - 15) / 8.5; if (dx * dx + dy * dy <= 1) g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 11, 8, 8, 2))); }
    for (let x = 4; x <= 19; x++) g.set(x, 15, "T", clampT(lit(x, 15, 2, 1.6, 0)));
    const hl = r.pick([6, 7, 8]), curl = r.pick([0, 1]);
    for (const s of [-1, 1]) for (let k = 0; k < hl; k++) { const x = Math.round(CX - 0.5 + s * (5 + k * 0.6 + (curl ? Math.sin(k * 0.6) * 1.5 : 0))), y = 9 - k; g.set(x, y, "B", s < 0 ? 3 : 2); if (k < hl - 2) g.set(x + s, y, "B", 1); }
    if (d >= 2) gem4(g, 11, 11);
  },
  mask(g, th, it, r, d) { // 仮面つきの頭巾
    hatKinds.hood(g, th, it, r, 0);
    for (let y = 11; y <= 18; y++) for (let x = 7; x <= 16; x++) { const dx = (x + 0.5 - CX) / 4.5, dy = (y + 0.5 - 14.5) / 4.5; if (dx * dx + dy * dy <= 1) g.set(x, y, "F", clampT(lit(x, y, 2.8, 2, 0.4))); }
    g.ink(10, 13); g.ink(9, 13); g.ink(13, 13); g.ink(14, 13);
    if (r.chance(0.5)) { g.ink(11, 16); g.ink(12, 16); } else for (let x = 10; x <= 13; x++) g.set(x, 16, "G", 2);
  },
  wizard(g, th, it, r, d) {
    const tip = r.pick([-3, -2, 2, 3, 4]), brim = r.pick([10, 10.5, 11]), h = r.pick([14, 15, 16]);
    const m = "C";
    for (let y = 17; y <= 21; y++) for (let x = 0; x < 24; x++) { const dx = (x + 0.5 - CX) / brim, dy = (y + 0.5 - 19.2) / 1.7; if (dx * dx + dy * dy <= 1) g.set(x, y, m, clampT(lit(x, y, y <= 18 ? 2.5 : 1.4, 1.6, 0))); }
    for (let y = 19 - h; y <= 18; y++) {
      const u = (y - (19 - h)) / h;
      const w = 0.6 + u * 6;
      const sx = (1 - u) ** 2 * tip * 1.5;
      for (let x = Math.round(CX + sx - w); x <= Math.round(CX + sx + w) - 1; x++) if (y >= 0) g.set(x, y, m, clampT(lit(x - sx, y, 2.2, 2, 0.3)));
    }
    const by = r.pick([15, 16]);
    for (let x = 4; x <= 19; x++) if (g.get(x, by)) g.set(x, by, "D", clampT(lit(x, by, 2, 1.6, 0)));
    const deco = r.pick(["emblem", "stars", "none", "patch"]);
    if (deco === "emblem") stamp(g, r.pick(["star", "moon", "diamond", "sun", "eye"]), 8, 8, "T", "G");
    if (deco === "stars") for (const [x, y] of [[9, 10], [14, 12], [11, 6], [13, 8]]) g.set(x + Math.round(tip * 0.2), y, "T", 4);
    if (deco === "patch") { for (let y = 10; y <= 12; y++) for (let x = 13; x <= 15; x++) g.set(x, y, "L", 2); }
    if (d >= 2) dot2(g, 11, by, "G", 4, 2);
  },
  witch(g, th, it, r, d) { // 鍔広の尖り帽 + 曲がった先
    hatKinds.wizard(g, th, it, r, 0);
    g.def("V", MAT.purple);
    for (let x = 6; x <= 17; x++) if (g.get(x, 17)) g.set(x, 17, "V", 2);
    if (r.chance(0.6)) for (let k = 0; k < 4; k++) g.set(17 + k, 14 + (k >> 1), "D", 3 - (k & 1)); // 帯の結び
  },
  mitre(g, th, it, r, d) {
    const w0 = r.pick([6, 6.5]), pk = r.pick([7, 8, 9]);
    for (let y = 2; y <= 20; y++) {
      const w = y < pk ? 1.5 + (y - 2) * (w0 - 1.5) / (pk - 2) : w0;
      for (let x = Math.round(CX - w); x <= Math.round(CX + w) - 1; x++) g.set(x, y, "F", clampT(lit(x, y, 2.4, 1.8, 0.3)));
    }
    if (r.chance(0.5)) for (let x = 0; x < 24; x++) for (let y = 3; y < pk; y++) if (g.get(x, y) && Math.abs(x + 0.5 - CX) < 0.6) g.ink(x, y); // 二つ山
    for (let y = 4; y <= 20; y++) { g.set(11, y, "T", 3); g.set(12, y, "T", 2); }
    for (let x = Math.round(CX - w0); x <= Math.round(CX + w0) - 1; x++) { g.set(x, 19, "T", clampT(lit(x, 19, 2.4, 1.6, 0))); g.set(x, 20, "T", clampT(lit(x, 20, 1.2, 1.6, 0))); }
    stamp(g, r.pick(["cross", "cross2", "sun", "eye"]), 8, 10, "T", "G");
  },
  turban(g, th, it, r, d) {
    const m = r.pick(["C", "F", "D"]);
    for (let y = 5; y <= 17; y++) for (let x = 2; x <= 21; x++) { const dx = (x + 0.5 - CX) / 9, dy = (y + 0.5 - 12) / 6.5; if (dx * dx + dy * dy <= 1) g.set(x, y, m, clampT(sphereTone(x + 0.5, y + 0.5, CX, 10, 10, 8, 2) - (Math.round(y + x * 0.4) % 3 === 0 ? 1 : 0))); }
    gem4(g, 11, 10);
    for (let k = 0; k < 6; k++) g.set(12 + Math.round(k * 0.4), 9 - k, r.pick(["F", "E"]), 3 - (k & 1));
  },
};

// ---------- 冠・宝冠 ----------
function circlet(g, th, it, r, d) {
  const kind = r.wpick([["circlet", 3], ["crown", th.motifs.has("crown") ? 4 : 1.5], ["tiara", 1.5], ["laurel", th.motifs.has("leaf") ? 3 : 0.8], ["horned", th.motifs.has("demon") || th.motifs.has("beast") ? 2.5 : 0.4], ["winged", th.motifs.has("wing") ? 3 : 0.6], ["chain", 1]]);
  const cy = r.pick([12, 13, 14]), rx = r.pick([8.5, 9, 9.5, 10]), ry = r.pick([2.8, 3.2, 3.6]);
  const thick = r.pick([1, 2, 2]);
  const braid = r.chance(0.3);
  const m = kind === "laurel" ? "W" : "T";
  // 環 (楕円の帯)。奥は細く暗い
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const x = Math.round(CX - 0.5 + Math.cos(a) * rx), y = Math.round(cy - 0.5 + Math.sin(a) * ry);
    const front = Math.sin(a) > 0;
    let t = lit(x, y, front ? 2.6 : 1.2, 1.8, 0);
    if (braid && i % 8 < 4) t -= 0.8;
    g.set(x, y, m, clampT(t));
    if (front && thick === 2) g.set(x, y + 1, m, clampT(t - 1));
  }
  const fy = Math.round(cy - 0.5 + ry); // 額 (手前の中央) の y
  // 横の宝石
  const side = d >= 1 ? r.pick([0, 2, 4]) : r.pick([0, 0, 2]);
  for (let i = 0; i < side; i++) { const a = Math.PI * (0.25 + 0.5 * ((i + 0.5) / side)); const x = Math.round(CX - 0.5 + Math.cos(a) * rx), y = Math.round(cy - 0.5 + Math.sin(a) * ry); g.set(x, y, "E", 3); }
  if (kind === "crown") {
    const n = r.pick([5, 7]), hc = r.pick([6, 7, 8]), hs = r.pick([4, 5]);
    const tipShape = r.pick(["point", "ball", "cross", "fleur"]);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i / (n - 1)));
      const x = Math.round(CX - 0.5 + Math.cos(a) * rx), yb = Math.round(cy - 0.5 + Math.sin(a) * ry);
      const h = i === (n >> 1) ? hc : hs;
      for (let k = 1; k <= h; k++) { g.set(x, yb - k, "T", clampT(lit(x, yb - k, 2.6, 1.6, 0))); if (k < h - 1) g.set(x + 1, yb - k, "T", 1); }
      if (tipShape === "ball") g.set(x, yb - h - 1, "G", 3);
      else if (tipShape === "cross") { g.set(x, yb - h - 1, "T", 4); g.set(x - 1, yb - h, "T", 3); g.set(x + 1, yb - h, "T", 2); }
      else if (tipShape === "fleur") { g.set(x - 1, yb - h, "T", 3); g.set(x + 1, yb - h, "T", 2); g.set(x, yb - h - 1, "T", 4); }
    }
    if (r.chance(0.6)) gem4(g, 11, fy - 2);
  } else if (kind === "tiara") {
    const pk = r.pick([5, 6, 7]), wdt = r.pick([3, 4]);
    for (let k = -wdt; k <= wdt - 1; k++) { const h = Math.max(1, pk - Math.abs(k + 0.5) * (pk / wdt)); for (let j = 0; j < h; j++) g.set(12 + k, fy - j, "T", clampT(lit(12 + k, fy - j, 2.6, 1.6, 0) - (j === 0 ? 1 : 0))); }
    gem4(g, 11, fy - Math.round(pk * 0.6));
  } else if (kind === "laurel") {
    g.def("V", MAT.green);
    for (let i = 0; i < 20; i++) { const a = Math.PI * (0.05 + 0.9 * (i / 19)); const x = Math.round(CX - 0.5 + Math.cos(a) * rx), y = Math.round(cy - 0.5 + Math.sin(a) * ry); g.set(x, y - 1, "V", 3); g.set(x + (x < 12 ? -1 : 1), y - 1, "V", 1); }
    if (r.chance(0.5)) { g.def("Q", MAT.amber); for (const x of [8, 15]) g.set(x, fy - 1, "Q", 3); }
  } else if (kind === "horned") {
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const x = Math.round(CX - 0.5 + s * (rx * 0.6 + k * 0.4)), y = fy - 1 - k; g.set(x, y, "B", s < 0 ? 3 : 2); if (k < 4) g.set(x + s, y, "B", 1); }
    gem4(g, 11, fy - 1);
  } else if (kind === "winged") {
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) for (let j = 0; j <= 3 - k; j++) g.set(Math.round(CX - 0.5 + s * (rx - 1 + k)), fy - 2 - j - (k >> 1), "F", s < 0 ? 3 : 2);
    gem4(g, 11, fy - 1);
  } else if (kind === "chain") {
    // 額に垂れる飾り
    for (let k = 1; k <= 3; k++) g.set(11 + (k & 1), fy + k, "T", 2);
    gem4(g, 11, fy + 4);
    for (const s of [-1, 1]) for (let k = 1; k <= 2; k++) g.set(Math.round(CX - 0.5 + s * 4), fy + k, "T", 2);
  } else {
    // 額の飾り: 宝石の形を選ぶ
    const c = r.pick(["round", "diamond", "drop", "eye", "sun", "moon"]);
    if (c === "round") gem4(g, 11, fy - 1);
    else if (c === "diamond") { g.set(11, fy - 2, "G", 4); g.set(12, fy - 2, "G", 3); g.set(10, fy - 1, "G", 3); g.set(11, fy - 1, "G", 3); g.set(12, fy - 1, "G", 2); g.set(13, fy - 1, "G", 1); g.set(11, fy, "G", 2); g.set(12, fy, "G", 1); }
    else if (c === "drop") { g.set(11, fy - 2, "G", 3); g.set(11, fy - 1, "G", 4); g.set(12, fy - 1, "G", 2); g.set(11, fy, "G", 2); g.set(12, fy, "G", 1); g.set(11, fy + 1, "G", 1); }
    else stamp(g, c === "eye" ? "eye" : c === "sun" ? "sun" : "moon", 8, fy - 4, "T", "G", { base: 2 });
    g.set(11, fy - 3, "T", 3); g.set(12, fy - 3, "T", 2);
  }
  g.shift(0, r.pick([-1, 0, 1]));
}

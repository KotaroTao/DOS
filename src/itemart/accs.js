// 装飾 (指輪・首飾り) の絵: 環の作り × 台座 × 石の形と数 × 添え飾り / 鎖の作り × 飾りの形 × 枠
import { MAT, sphereTone } from "./core.js";
import { CX, lit, clampT } from "./front.js";
import { stamp } from "./emblems.js";

function gemAt(g, cx, cy, R, m, shape = "round") {
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    let ins;
    if (shape === "square") ins = Math.abs(dx) <= R * 0.85 && Math.abs(dy) <= R * 0.85;
    else if (shape === "marquise") ins = (dx / (R * 1.35)) ** 2 + (dy / (R * 0.7)) ** 2 <= 1;
    else if (shape === "tall") ins = (dx / (R * 0.7)) ** 2 + (dy / (R * 1.25)) ** 2 <= 1;
    else if (shape === "diamond") ins = Math.abs(dx) / R + Math.abs(dy) / (R * 1.2) <= 1;
    else ins = dx * dx + dy * dy <= R * R;
    if (!ins) continue;
    let t = sphereTone(x + 0.5, y + 0.5, cx, cy, R + 0.6, R + 0.6, 2);
    if (shape === "diamond" || shape === "square") t = dx + dy < -0.5 ? 3 : dx + dy > 0.5 ? 1 : 2;
    g.set(x, y, m, t);
  }
  g.set(Math.round(cx - R * 0.45) - 1, Math.round(cy - R * 0.5) - 1, "F", 4);
}

// ===================== 指輪 =====================
export function ring(g, th, it) {
  const r = th.r, d = th.deco;
  const band = r.pick(["T", "T", "M", "F", "B"]);
  const cy = r.pick([14, 15, 16]), rx = r.pick([5.5, 6, 6.5, 7]), ry = r.pick([4.5, 5, 5.5]);
  const thick = r.pick([1.2, 1.6, 2, 2.4]);
  const style = r.wpick([["plain", 2], ["twist", 1], ["double", 1], ["engraved", d >= 1 ? 1.5 : 0.4], ["studded", 1]]);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const dx = (x + 0.5 - CX) / rx, dy = (y + 0.5 - cy) / ry;
    const dd = Math.sqrt(dx * dx + dy * dy);
    if (dd > 1 || dd < 1 - thick / rx) continue;
    if (style === "double" && Math.abs(dd - (1 - thick / rx / 2)) < 0.07) continue;
    let t = lit(x, y, 2, 2, 0.8);
    if (dd > 1 - 0.5 / rx) t -= 0.6;
    const a = Math.atan2(dy, dx);
    if (style === "twist" && Math.round(a * 6) % 2 === 0) t += 1;
    if (style === "engraved" && Math.round(a * 8) % 3 === 0) t -= 1.2;
    if (style === "studded" && Math.round(a * 5) % 2 === 0 && dd > 1 - 1.2 / rx) { g.set(x, y, "E", 3); continue; }
    g.set(x, y, band, clampT(t));
  }
  const sy = Math.round(cy - ry) - r.pick([1, 2]);
  const setting = r.wpick([["gem", 3], ["cluster", 1.5], ["signet", 1.2], ["skull", th.motifs.has("skull") ? 3 : 0.4], ["eye", th.motifs.has("eye") ? 3 : 0.4], ["claw", 1.2], ["crown", th.motifs.has("crown") ? 3 : 0.5], ["wings", th.motifs.has("wing") ? 3 : 0.5], ["serpent", th.motifs.has("serpent") ? 4 : 0.3]]);
  const gshape = r.pick(["round", "round", "square", "marquise", "tall", "diamond"]);
  const gr = r.pick([2.4, 2.8, 3.2]);
  if (setting === "gem" || setting === "claw" || setting === "crown" || setting === "wings") {
    if (r.chance(0.5)) gemAt(g, CX, sy + 0.5, gr + 0.9, band); // 台座の枠
    gemAt(g, CX, sy + 0.5, gr, "G", gshape);
    if (setting === "claw") for (const [dx, dy] of [[-gr, -gr * 0.6], [gr - 1, -gr * 0.6], [-gr, gr * 0.5], [gr - 1, gr * 0.5]]) g.set(Math.round(CX + dx), Math.round(sy + dy), band, 3);
    if (setting === "crown") for (const dx of [-2, 0, 2]) { g.set(Math.round(CX - 0.5 + dx), Math.round(sy - gr) - 1, band, 3); }
    if (setting === "wings") for (const s of [-1, 1]) for (let k = 0; k < 3; k++) for (let j = 0; j <= 2 - k; j++) g.set(Math.round(CX - 0.5 + s * (gr + 1 + k)), sy - j + k, "F", s < 0 ? 3 : 2);
  } else if (setting === "cluster") {
    for (const [dx, dy, rr, m] of [[0, -1, 1.8, "G"], [-2.6, 1, 1.3, "E"], [2.6, 1, 1.3, "E"]]) gemAt(g, CX + dx, sy + dy, rr, m);
  } else if (setting === "signet") {
    for (let y = sy - 2; y <= sy + 2; y++) for (let x = 8; x <= 15; x++) g.set(x, y, band, clampT(lit(x, y, 2.5, 1.6, 0.6)));
    stamp(g, r.pick(["cross", "star", "crown", "sword", "diamond", "beast", "tree"]), 8, sy - 3, band, "G", { base: 1 });
  } else if (setting === "skull") stamp(g, "skull", 8, sy - 3, "B", "E");
  else if (setting === "eye") stamp(g, "eye", 8, sy - 3, band, "E");
  else if (setting === "serpent") { stamp(g, "serpent", 8, sy - 3, band, "G"); }
  if (d >= 3 && setting !== "cluster") for (const s of [-1, 1]) g.set(Math.round(CX - 0.5 + s * (rx - 0.5)), cy, "E", 3);
}

// ===================== 首飾り =====================
export function amulet(g, th, it) {
  const r = th.r, d = th.deco;
  const chain = r.pick(["T", "T", "M", "L"]);
  const chainStyle = r.pick(["links", "beads", "cord", "links"]);
  const depth = r.pick([9, 10, 11]);
  for (let i = 0; i <= depth; i++) {
    const t = i / depth;
    const x = Math.round(2 + t * 9), y = Math.round(1 + t * depth);
    const tone = chainStyle === "cord" ? 2 : i % 2 ? 3 : 1;
    const m = chainStyle === "beads" && i % 2 ? "E" : chain;
    g.set(x, y, m, tone);
    g.set(23 - x, y, m, Math.max(0, tone - 1));
  }
  const kind = r.wpick([["drop", 2], ["disc", 2], ["sun", th.motifs.has("sun") || th.motifs.has("holy") ? 3 : 1], ["moon", th.motifs.has("moon") ? 4 : 0.8], ["star", th.motifs.has("star") ? 4 : 0.8], ["cross", th.motifs.has("holy") ? 3 : 0.8], ["eye", th.motifs.has("eye") ? 3 : 0.5], ["skull", th.motifs.has("skull") ? 3 : 0.4], ["fang", th.motifs.has("beast") || th.motifs.has("bone") ? 3 : 0.4], ["leaf", th.motifs.has("leaf") ? 3 : 0.4], ["frame", 1.5], ["triple", 1], ["heart", 0.6], ["key", 0.5]]);
  const cy = depth + 5 + r.pick([0, 1]);
  const ly = depth + 1;
  g.set(11, ly, chain, 3); g.set(12, ly, chain, 2); g.set(11, ly + 1, chain, 2); g.set(12, ly + 1, chain, 1);
  if (kind === "drop" || kind === "disc" || kind === "frame") {
    const R = kind === "disc" ? r.pick([3.8, 4.4]) : kind === "frame" ? 4.2 : r.pick([3.2, 3.6]);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - cy;
      const inS = kind === "drop" ? (dy < 0 ? Math.abs(dx) <= (dy + R + 1) * 0.85 && dy > -R - 1 : dx * dx + dy * dy <= R * R) : dx * dx + dy * dy <= R * R;
      if (!inS) continue;
      const rim = (kind === "disc" || kind === "frame") && dx * dx + dy * dy > (R - 1.2) ** 2;
      g.set(x, y, rim ? chain : kind === "disc" ? chain : "G", rim ? clampT(lit(x, y, 2, 1.6, 0.6)) : sphereTone(x + 0.5, y + 0.5, CX, cy, R + 0.6, R + 0.6, 2));
    }
    if (kind === "disc") stamp(g, r.pick(["star", "sun", "eye", "cross", "diamond", "crown", "tree", "wave"]), 8, cy - 3, "G", "E", { base: 2 });
    else if (kind === "frame") gemAt(g, CX, cy, 2.4, "G", r.pick(["round", "tall", "diamond", "square"]));
    else g.set(10, cy - 2, "F", 4);
  } else if (kind === "triple") {
    for (const [dx, dy, rr] of [[0, 1, 2], [-3.5, -1, 1.4], [3.5, -1, 1.4]]) gemAt(g, CX + dx, cy + dy, rr, dx === 0 ? "G" : "E");
  } else if (kind === "heart") {
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const dx = (x + 0.5 - CX) / 3.6, dy = (y + 0.5 - cy) / 3.6; const v = (dx * dx + dy * dy - 1) ** 3 - dx * dx * (-dy) ** 3; if (v <= 0) g.set(x, y, "G", sphereTone(x + 0.5, y + 0.5, CX, cy, 4, 4, 2)); }
  } else if (kind === "key") {
    for (let y = cy - 3; y <= cy + 4; y++) { g.set(11, y, chain, 3); g.set(12, y, chain, 1); }
    gemAt(g, CX, cy - 3, 1.8, chain); g.set(11, cy - 3, "G", 3);
    for (const y of [cy + 2, cy + 4]) { g.set(13, y, chain, 2); g.set(14, y, chain, 1); }
  } else {
    const map = { sun: "sun", moon: "moon", star: "star", cross: "cross2", eye: "eye", skull: "skull", fang: "fang", leaf: "leaf" };
    stamp(g, map[kind], 8, cy - 3, kind === "skull" || kind === "fang" ? "B" : chain, "G");
  }
  if (d >= 2) for (const s of [-1, 1]) g.set(Math.round(CX - 0.5 + s * 3.5), ly - 1, "E", 3);
  if (d >= 3 && r.chance(0.6)) for (let k = 1; k <= 2; k++) g.set(11 + (k & 1), cy + 5 + k > 23 ? 23 : cy + 4 + k, "E", 3);
}

export function trinket(g, th, it) { return th.r.chance(0.5) ? ring(g, th, it) : amulet(g, th, it); }
export { MAT };

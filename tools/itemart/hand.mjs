// 手描きの装備の絵 (src/itemart/hand/*.js) の道具
//   node tools/itemart/hand.mjs list <組>              → その組の品 (id・名・部位・種類・属性・説明) を並べる
//   node tools/itemart/hand.mjs check <file.js>        → 形式を調べる (24×24・色の文字・id・組の網羅)
//   node tools/itemart/hand.mjs sheet <file.js> <out.png> [自動生成と並べる: --vs]  → 見本 PNG (6倍、燐光つき)
//   node tools/itemart/hand.mjs ref <out.png>          → 既存の手描きの原型 (catalog/defs.js ARTS) の見本 = 画風の基準
// 組: sr1 (伝説 + 職業専用) / l12 (第1・2層の逸品) / l34 / l5 (第5層 + 層の LR) / acc (LR 装飾) / arm1-arm3 (LR 防具) / job1-job4 (LR 武器)
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { ARTS } from "../../src/catalog/defs.js";
import { P } from "../../src/itemart/hand/pal.js";
import { drawItem, isRelic } from "../../src/itemart/index.js";
import { sheet } from "./sheet.mjs";

const SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
const HANDS = Object.values(CATALOG_ITEMS).filter((i) => SLOTS.has(i.slot) && (i.rar === "sr" || i.rar === "lr")).sort((a, b) => (a.id < b.id ? -1 : 1));
const JOBS = [...new Set(HANDS.filter((i) => i.id.startsWith("lr_") && i.forJob).map((i) => i.forJob))].sort();
const armor = HANDS.filter((i) => i.id.startsWith("lr_") && !i.forJob && !i.layer && i.slot !== "acc");
const third = Math.ceil(armor.length / 3);
const GROUPS = {
  sr1: HANDS.filter((i) => !i.id.startsWith("lr_") && !i.layer),
  l12: HANDS.filter((i) => !i.id.startsWith("lr_") && (i.layer === 1 || i.layer === 2)),
  l34: HANDS.filter((i) => !i.id.startsWith("lr_") && (i.layer === 3 || i.layer === 4)),
  l5: HANDS.filter((i) => (!i.id.startsWith("lr_") && i.layer === 5) || (i.id.startsWith("lr_") && i.layer)),
  acc: HANDS.filter((i) => i.id.startsWith("lr_") && !i.forJob && !i.layer && i.slot === "acc"),
  arm1: armor.slice(0, third), arm2: armor.slice(third, third * 2), arm3: armor.slice(third * 2),
};
for (let q = 0; q < 4; q++) {
  const js = JOBS.slice(q * 9, q * 9 + 9);
  GROUPS["job" + (q + 1)] = HANDS.filter((i) => i.id.startsWith("lr_") && js.includes(i.forJob));
}
// 組に入らなかった品が無いか
const inGroup = new Set(Object.values(GROUPS).flat().map((i) => i.id));
const left = HANDS.filter((i) => !inGroup.has(i.id));
if (left.length) throw new Error("組に入らない品: " + left.map((i) => i.id).join(","));

const desc = (it) => {
  const k = [it.slot, it.cat, it.sk, it.weight, it.twoHanded ? "両手" : it.slot === "weapon" ? "片手" : "", it.shape].filter(Boolean).join("/");
  const el = [it.eAtk ? "攻:" + it.eAtk.el : "", it.eDef ? "防:" + it.eDef.el : ""].filter(Boolean).join(" ");
  return `${it.id}\t${it.rar}\t${it.name}\t${k}${el ? "\t" + el : ""}${isRelic(it) ? "\t(燐光)" : ""}\n    ${it.desc}`;
};
async function load(file) {
  const m = await import(pathToFileURL(path.resolve(file)).href);
  const key = Object.keys(m).find((k) => k.startsWith("ART_"));
  if (!key) throw new Error("ART_ で始まる export が無い");
  return m[key];
}
function withGlow(art) {
  const at = (x, y) => (art[y] && art[y][x]) || ".";
  return art.map((row, y) => [...row].map((c, x) => (c === "." && (at(x + 1, y) !== "." || at(x - 1, y) !== "." || at(x, y + 1) !== "." || at(x, y - 1) !== ".") ? "*" : c)).join(""));
}
const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === "list") {
  const g = GROUPS[a1];
  if (!g) { console.log("組: " + Object.keys(GROUPS).map((k) => `${k}(${GROUPS[k].length})`).join(" ")); process.exit(1); }
  console.log(g.map(desc).join("\n"));
} else if (cmd === "check") {
  const A = await load(a1);
  let bad = 0;
  for (const id in A) {
    const it = CATALOG_ITEMS[id];
    const err = (m) => { console.log(`✗ ${id}: ${m}`); bad++; };
    if (!it) { err("目録に無い id"); continue; }
    if (!(it.rar === "sr" || it.rar === "lr")) err("SR/LR ではない");
    const { art, palette } = A[id];
    if (!Array.isArray(art) || art.length !== 24) { err("行の数が 24 ではない (" + (art && art.length) + ")"); continue; }
    art.forEach((row, y) => {
      if (row.length !== 24) err(`${y} 行目の長さ ${row.length}`);
      for (const ch of row) if (ch !== "." && !(ch in palette)) err(`${y} 行目の文字 "${ch}" がパレットに無い`);
      if (row.includes("*")) err("* (燐光) は自動で付く。描かない");
    });
    for (const k in palette) if (palette[k] !== null && !/^#[0-9a-f]{6}$/i.test(palette[k])) err(`色 ${k}=${palette[k]}`);
    const filled = art.join("").replace(/\./g, "").length;
    if (filled < 60) err("塗りが少なすぎる (" + filled + ")");
  }
  // 組の網羅
  for (const [k, g] of Object.entries(GROUPS)) {
    const ids = g.map((i) => i.id);
    const have = ids.filter((id) => A[id]).length;
    if (have) console.log(`組 ${k}: ${have}/${ids.length}` + (have < ids.length ? " 足りない: " + ids.filter((id) => !A[id]).join(",") : ""));
  }
  console.log(bad ? `問題 ${bad} 件` : `OK (${Object.keys(A).length} 点)`);
  process.exit(bad ? 1 : 0);
} else if (cmd === "sheet") {
  const A = await load(a1);
  const vs = process.argv.includes("--vs");
  const list = [];
  for (const id in A) {
    const it = CATALOG_ITEMS[id];
    const relic = it && isRelic(it);
    const el = it && ((it.eAtk && it.eAtk.el) || (it.eDef && it.eDef.el));
    const glowC = { fire: "rgba(255,107,58,0.24)", water: "rgba(74,163,255,0.24)", wind: "rgba(95,208,138,0.24)", earth: "rgba(200,154,74,0.24)", light: "rgba(255,226,122,0.24)", dark: "rgba(155,107,208,0.24)" }[el] || "rgba(168,196,255,0.24)";
    list.push(relic ? { art: withGlow(A[id].art), palette: { ...A[id].palette, "*": glowC } } : A[id]);
    if (vs && it) list.push(drawItem(it));
  }
  sheet(a2, list, { s: 6, cols: vs ? 8 : 8 });
  console.log(`${Object.keys(A).length} 点 → ${a2}` + (vs ? " (手描き, 自動生成 の順に交互)" : "") + "\n" + Object.keys(A).map((id, i) => `${i}:${CATALOG_ITEMS[id] ? CATALOG_ITEMS[id].name : id}`).join(" "));
} else if (cmd === "ref") {
  const out = [];
  for (const k of Object.keys(ARTS)) { const a = ARTS[k]; for (const art of Array.isArray(a[0]) ? a : [a]) out.push({ palette: P, art }); }
  sheet(a1, out, { s: 5, cols: 10 });
  console.log("原型 " + out.length + " 点 → " + a1 + "\n" + Object.keys(ARTS).join(" "));
} else {
  console.log("使い方: list <組> / check <file> / sheet <file> <out.png> [--vs] / ref <out.png>");
  console.log("組: " + Object.keys(GROUPS).map((k) => `${k}(${GROUPS[k].length})`).join(" "));
}

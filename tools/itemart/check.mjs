// 装備の絵の検査: 全装備を描き、形と陰影の同じ絵 (色違いの同じ絵) が無いかを調べる
//   node tools/itemart/check.mjs            → 調べるだけ (重なりの数・手描きの数・似すぎの組)
//   node tools/itemart/check.mjs --apply    → 重なる品の乱数のずらし幅を src/itemart/salts.js に書き出す
//   node tools/itemart/check.mjs --sheet out.png [slot[:cat]] [rar,...]  → 見本 PNG
// 品を足した・生成の部品を変えたら --apply を回す (ずらし幅は描き方が変わると変わる)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { ITEMS } from "../../src/items.js";
import { drawItem, shapeSig, ART_SLOTS, HAND_ART, itemArt } from "../../src/itemart/index.js";
import { sheet } from "./sheet.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SALTS = path.join(here, "../../src/itemart/salts.js");
const all = { ...ITEMS, ...CATALOG_ITEMS };
// game.js と同じく、レア度の無い装備はコモン
for (const id in all) { const it = all[id]; if (!it.rar && ART_SLOTS.has(it.slot)) it.rar = it.lr ? "lr" : "c"; }
const ids = Object.keys(all).filter((id) => ART_SLOTS.has(all[id].slot)).sort();
const args = process.argv.slice(2);

if (args[0] === "--sheet") {
  const [, out, filt, rars] = args;
  const [slot, cat] = (filt || "").split(":");
  const list = ids.map((id) => all[id]).filter((it) => (!slot || it.slot === slot) && (!cat || it.cat === cat || it.sk === cat || it.weight === cat) && (!rars || rars.split(",").includes(it.rar)));
  sheet(out, list.map((it) => itemArt(it)), { s: +(process.env.S || 4), cols: +(process.env.COLS || 16) });
  console.log(list.length + " 点 → " + out);
  process.exit(0);
}

const seen = new Map();
const salts = {};
let hand = 0;
const CLOSE = 20;
const groupOf = (it) => it.slot + ":" + (it.cat || it.sk || it.weight || "");
const accepted = {}; // 部類 → 決まった絵の指紋
const flat = (a) => shapeSig(a.art, a.palette).replace(/\//g, "");
const minDist = (sig, list) => {
  let m = 999;
  for (const B of list) { let d = 0; for (let q = 0; q < sig.length && d < m; q++) if (sig[q] !== B[q]) d++; if (d < m) m = d; }
  return m;
};
for (const id of ids) if (HAND_ART[id]) {
  seen.set(shapeSig(HAND_ART[id].art, HAND_ART[id].palette), id); hand++;
  (accepted[groupOf(all[id])] = accepted[groupOf(all[id])] || []).push(flat(HAND_ART[id]));
}
// 同じ形の絵を避け、同じ部類の絵と CLOSE 升以上違う絵になるまで乱数をずらす (40 回で一番離れたものを採る)
for (const id of ids) {
  if (HAND_ART[id]) continue;
  const grp = accepted[groupOf(all[id])] = accepted[groupOf(all[id])] || [];
  let best = null, bestD = -1, bestSalt = 0;
  for (let salt = 0; salt < 40; salt++) {
    const a = drawItem(all[id], salt);
    const sig = shapeSig(a.art, a.palette);
    if (seen.has(sig)) continue;
    const d = minDist(flat(a), grp);
    if (d > bestD) { best = sig; bestD = d; bestSalt = salt; }
    if (d >= CLOSE) break;
  }
  if (!best) throw new Error("同じ形の絵を避けられない: " + id);
  seen.set(best, id);
  grp.push(best.replace(/\//g, ""));
  if (bestSalt) salts[id] = bestSalt;
}
// 似すぎの組 (同じ部位・同じ種類で、形と陰影の違う升が CLOSE 未満)
const bySlot = {};
for (const id of ids) {
  const it = all[id];
  const k = it.slot + ":" + (it.cat || it.sk || it.weight || "");
  (bySlot[k] = bySlot[k] || []).push(id);
}
let close = 0;
const worst = [];
for (const k in bySlot) {
  const list = bySlot[k].map((id) => { const a = HAND_ART[id] || drawItem(all[id], salts[id] || 0); return [id, shapeSig(a.art, a.palette).replace(/\//g, "")]; });
  for (let i = 0; i < list.length; i++) {
    let m = 999, mj = -1;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const A = list[i][1], B = list[j][1];
      let d = 0;
      for (let q = 0; q < A.length && d < m; q++) if (A[q] !== B[q]) d++;
      if (d < m) { m = d; mj = j; }
    }
    if (m < CLOSE) { close++; if (worst.length < 12) worst.push(`${list[i][0]} ~ ${list[mj][0]} (${m})`); }
  }
}
console.log(`装備 ${ids.length} 点 / 手描き ${hand} / ずらした品 ${Object.keys(salts).length} / よく似た絵 (違い ${CLOSE} 升未満) ${close} 点`);
if (worst.length) console.log("  例: " + worst.join(", "));
if (args.includes("--apply")) {
  const body = Object.keys(salts).sort().map((id) => `  ${JSON.stringify(id)}: ${salts[id]},`).join("\n");
  const src = fs.readFileSync(SALTS, "utf8").replace(/\/\/ <<SALTS>>[\s\S]*\/\/ <<\/SALTS>>/, `// <<SALTS>>\n${body}\n// <</SALTS>>`);
  fs.writeFileSync(SALTS, src);
  console.log("salts.js を更新した");
}

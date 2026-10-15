// 全品の固定通し番号と制作台帳を検査する。--update は新しい品を末尾へ追加する。
import fs from "node:fs";
import { ITEMS } from "../../src/items.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { NUMBERED_ITEM_IDS } from "../../src/itemnumbers.js";

const all = { ...ITEMS, ...CATALOG_ITEMS };
const ids = [...NUMBERED_ITEM_IDS];
const update = process.argv.includes("--update");
const root = new URL("../../", import.meta.url);
const fail = (message) => { throw new Error(message); };
if (new Set(ids).size !== ids.length) fail("制作番号の台帳にIDの重複があります");
for (const id of ids) if (!all[id]) fail("制作番号のある品が削除されています: " + id);
for (const id of Object.keys(all)) {
  if (ids.includes(id)) continue;
  if (!update) fail("未採番の品があります。--update で末尾へ追加してください: " + id);
  ids.push(id);
}
const sourcePath = new URL("src/itemnumbers.js", root);
const source = fs.readFileSync(sourcePath, "utf8").replace(
  /export const NUMBERED_ITEM_IDS = Object.freeze\(\[[\s\S]*?\n\]\);/,
  `export const NUMBERED_ITEM_IDS = Object.freeze([\n${ids.map(id => "  " + JSON.stringify(id) + ",").join("\n")}\n]);`,
);
const cell = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
const rows = [["制作番号", "担当範囲", "既存ID", "名前", "部位", "レア度", "説明", "既存WebP"]];
const photoDirs = ["art/items/", "art/collectibles/", "art/offerings/", "art/misc/", "art/treasury/"];
ids.forEach((id, i) => {
  const it = all[id], number = i + 1, start = Math.floor(i / 100) * 100 + 1;
  if (!update && it.number !== number) fail("品の制作番号が一致しません: " + id);
  const photo = photoDirs.map(dir => dir + id + ".webp").find(path => fs.existsSync(new URL(path, root))) || "";
  rows.push([number, `${start}-${Math.min(start + 99, ids.length)}`, id, it.name, it.slot,
    it.rar || (["use", "misc"].includes(it.slot) ? "" : it.lr ? "lr" : "c"), it.desc, photo]);
});
const csv = "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\n") + "\n";
const csvPath = new URL("docs/art/item-number-ledger.csv", root);
if (update) {
  fs.writeFileSync(sourcePath, source);
  fs.writeFileSync(csvPath, csv);
} else if (fs.readFileSync(csvPath, "utf8") !== csv) {
  fail("制作台帳が古くなっています。--update で更新してください");
}
const [from, to = from] = process.argv.slice(2).filter(arg => arg !== "--update").map(Number);
if (from !== undefined) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > ids.length) fail("範囲は1から全品数までの整数で指定してください");
  for (let n = from; n <= to; n++) console.log(`${n}\t${ids[n - 1]}\t${all[ids[n - 1]].name}`);
}
console.log(`全${ids.length}点 / 制作番号1〜${ids.length} / 重複・欠番なし`);

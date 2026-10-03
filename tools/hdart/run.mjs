// 魔物の高精細ドット絵 (hd_*) を描く — SDF レイマーチャで立体を組み、光源・リム・ディザで段階色に落とす
//   node tools/hdart/run.mjs layer2 [名前...]     → 描画して JSON と見本 PNG を書き出す (名前を省くと層の全部)
//   node tools/hdart/run.mjs layer2 --apply      → 描画して schema.js の該当層の hd_* 区画を書き換え、bestiary/d0x の artKey を差し替える
// 見本は OUTDIR (既定: OS の一時フォルダ/hdart) の preview.png。S=倍率, COLS=列数 の環境変数で並べ方を変える。
// 各魔物の描画スクリプトは layerN/<名前>.mjs: export const meta = {id, key, w, h, note} と export function build() → {palette, art}
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preview } from "./sdf.mjs";
import { applyLayer } from "./integrate.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const layer = args.shift();
if (!layer || !fs.existsSync(path.join(HERE, layer))) { console.error("使い方: node tools/hdart/run.mjs <layerN> [名前...] [--apply]"); process.exit(1); }
const apply = args.includes("--apply");
let names = args.filter(a => !a.startsWith("--"));
if (!names.length) names = fs.readdirSync(path.join(HERE, layer)).filter(f => f.endsWith(".mjs")).map(f => f.slice(0, -4)).sort();
const OUT = process.env.OUTDIR || path.join(os.tmpdir(), "hdart");
fs.mkdirSync(OUT, { recursive: true });
// 並び: 通常 (96 幅) を名前順、層ボス・強敵 (幅広) を最後に
const mods = [];
for (const n of names) mods.push([n, await import(pathToFileURL(path.join(HERE, layer, n + ".mjs")).href + "?" + Date.now())]);
if (!args.some(a => !a.startsWith("--"))) mods.sort((a, b) => (a[1].meta.w - b[1].meta.w) || a[0].localeCompare(b[0]));
const done = [];
for (const [n, mod] of mods) {
  const t = Date.now();
  const a = mod.build();
  const rec = { meta: mod.meta, ...a };
  fs.writeFileSync(path.join(OUT, n + ".json"), JSON.stringify(rec));
  console.log(n, Date.now() - t + "ms", Object.keys(a.palette).length + "色", a.art[0].length + "x" + a.art.length);
  done.push(rec);
}
preview(path.join(OUT, "preview.png"), done, Number(process.env.S || 3), Number(process.env.COLS || Math.min(done.length, 4)));
console.log("見本:", path.join(OUT, "preview.png"));
if (apply) applyLayer(layer, done);

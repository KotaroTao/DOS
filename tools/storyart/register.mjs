// 物語・由来の絵の登録を、art/story/ にある WebP から書き出す (手で台帳を直さない)。
//
//   node tools/storyart/register.mjs           # src/storyimages.js と sw.js の ASSETS の絵の欄を書き直す
//   node tools/storyart/register.mjs --check   # 書き直さずに食い違いだけを調べる (tools/journal/check.mjs も呼ぶ)
//
// 置き場所の決まり (ファイル名がそのまま登録になる):
//   art/story/chapterN/<場面ID>.webp   第N章の場面 (場面ID = archive-stories.js の scene("…", N, …) の ID。章も一致させる)
//   art/story/<名前>.webp              序章の場面 (名前と場面IDの対応は下の PROLOGUE)
//   art/story/dungeons/lore_<迷宮ID>.webp  踏破した迷宮の由来 (迷宮ID = world.js の WORLD)
// どれも 1536×1024 の WebP。原画 PNG は art/story-review/ に置き、tools/storyart/to-webp.py で変換する。
// 直しを待つ絵は tools/storyart/hold.json に書く (出荷先に置かない)。
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WORLD } from "../../src/dungeons/world.js";
import { imageSize } from "./imagesize.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = "src/storyimages.js";
const SW = "sw.js";
const BEGIN = "  // <<STORY_ART>> 物語・由来の絵 (tools/storyart/register.mjs が書く。手で直さない)";
const END = "  // <</STORY_ART>>";
// 序章の絵は場面IDと違う名前で置いてある (2026-10 以前からの名前)。新しい章は <場面ID>.webp で置く
export const PROLOGUE = {
  "road-to-roadal": "opening",
  "irene-soul-lamp": "irene_lamp",
  "first-vessel-awakening": "first_vessel",
  "three-vessels-audience": "three",
  "four-vessels-departure": "departure",
  "first-descent-gatekeeper": "first_descent",
  "irene-meeting": "irene_meeting",
  "royal-audience": "arrival",
  "irene-repair": "irene_repair",
};

const webps = (dir) => existsSync(ROOT + dir)
  ? readdirSync(ROOT + dir).filter((f) => f.endsWith(".webp") && statSync(ROOT + dir + "/" + f).isFile()).sort()
  : [];

// archive-stories.js の場面ID → 章 (モジュールは読み込まない: storyimages.js が壊れていても動くように)
function sceneChapters() {
  const src = readFileSync(ROOT + "src/archive-stories.js", "utf8");
  const out = {};
  for (const m of src.matchAll(/\bscene\("([^"]+)",\s*(\d+)\s*,/g)) out[m[1]] = +m[2];
  return out;
}

const lists = () => JSON.parse(readFileSync(ROOT + "tools/storyart/hold.json", "utf8"));

// ---- 原画 (art/story-review/) と出荷 (art/story/) の対応 ----
// 出荷した WebP がどの原画から作られたかを masters.json (原画のパス → git のブロブのハッシュ) に残す。
// 原画を直したのに WebP を作り直していない・原画だけ置いて変換していない、を見つける (CI でも)。
export const MASTERS_FILE = "tools/storyart/masters.json";
export const shippedFor = (master) => { // "art/story-review/chapter5/x.png" → "art/story/chapter5/x.webp"
  const m = master.match(/^art\/story-review\/(prologue|chapter\d+|dungeons)\/([^/]+)\.png$/);
  if (!m) return null;
  return m[1] === "prologue" ? `art/story/${m[2]}.webp` : `art/story/${m[1]}/${m[2]}.webp`;
};
const git = (args, input) => execFileSync("git", args, { cwd: ROOT, input, encoding: "utf8", maxBuffer: 1 << 26 }).trim();
// 対象の原画と、そのハッシュ (手元にあればファイルから、無ければ git の索引から — CI の部分チェックアウト用)
export function masterHashes() {
  const { hold, skip } = lists();
  const ok = (p) => {
    if (!shippedFor(p)) return false;
    const key = p.slice("art/story-review/".length, -4);
    return !hold.includes(key) && !skip.includes(key);
  };
  const out = {};
  let indexed = [];
  try { indexed = git(["ls-files", "-s", "--", "art/story-review"]).split("\n").filter(Boolean); } catch { /* git が無い */ }
  for (const line of indexed) {
    const [meta, path] = line.split("\t");
    if (ok(path)) out[path] = meta.split(" ")[1];
  }
  const local = [];
  const scan = (dir) => { if (existsSync(ROOT + dir)) for (const f of readdirSync(ROOT + dir)) if (f.endsWith(".png")) local.push(`${dir}/${f}`); };
  scan("art/story-review/prologue");
  scan("art/story-review/dungeons");
  if (existsSync(ROOT + "art/story-review")) for (const d of readdirSync(ROOT + "art/story-review")) if (/^chapter\d+$/.test(d)) scan(`art/story-review/${d}`);
  const mine = local.filter(ok);
  if (mine.length) {
    const hs = git(["hash-object", "--stdin-paths"], mine.join("\n") + "\n").split("\n");
    mine.forEach((p, i) => { out[p] = hs[i]; });
  }
  return out;
}
export function masterDrift(hashes = masterHashes()) {
  const rec = existsSync(ROOT + MASTERS_FILE) ? JSON.parse(readFileSync(ROOT + MASTERS_FILE, "utf8")) : {};
  const out = [];
  for (const [m, h] of Object.entries(hashes)) {
    const w = shippedFor(m);
    if (!existsSync(ROOT + w) && !indexHas(w)) out.push(`原画 ${m} の WebP (${w}) が無い — python3 tools/storyart/build.py`);
    else if (rec[m] !== h) out.push(`原画 ${m} が変わったのに WebP を作り直していない — python3 tools/storyart/build.py`);
  }
  for (const m of Object.keys(rec)) if (!hashes[m]) out.push(`${MASTERS_FILE} の ${m} は原画が無い (消したなら build.py で記録も直る)`);
  return out;
}
let _index = null;
const indexHas = (p) => {
  if (!_index) { try { _index = new Set(git(["ls-files", "--", "art/story"]).split("\n")); } catch { _index = new Set(); } }
  return _index.has(p);
};

// 登録の中身を組み立てる (ファイルは書かない)。errors があれば書き出さない
export function registerPlan() {
  const errors = [];
  const scenes = sceneChapters();
  const { hold } = lists();
  const story = {}, lore = {};
  const check = (path) => {
    const { w, h } = imageSize(readFileSync(ROOT + path));
    if (w !== 1536 || h !== 1024) errors.push(`${path} は ${w}×${h} (1536×1024 にする)`);
  };
  const addScene = (id, path, chapter) => {
    if (!(id in scenes)) return errors.push(`${path}: 場面ID「${id}」が archive-stories.js に無い`);
    if (scenes[id] !== chapter) return errors.push(`${path}: 場面「${id}」は第${scenes[id]}章 (置き場所は${chapter ? `第${chapter}章` : "序章"})`);
    if (story[id]) return errors.push(`${path}: 場面「${id}」の絵が二つある (${story[id]})`);
    story[id] = path; check(path);
  };
  for (const f of webps("art/story")) {
    const stem = f.slice(0, -5), id = PROLOGUE[stem];
    if (!id) errors.push(`art/story/${f}: 序章の対応表 (register.mjs の PROLOGUE) に無い。第N章の場面なら art/story/chapterN/ へ`);
    else addScene(id, `art/story/${f}`, 0);
  }
  const chapters = existsSync(ROOT + "art/story") ? readdirSync(ROOT + "art/story").map((d) => d.match(/^chapter(\d+)$/)).filter(Boolean)
    .map((m) => +m[1]).sort((a, b) => a - b) : [];
  for (const n of chapters) for (const f of webps(`art/story/chapter${n}`)) addScene(f.slice(0, -5), `art/story/chapter${n}/${f}`, n);
  const worldIds = new Set(WORLD.map((d) => d.id));
  for (const f of webps("art/story/dungeons")) {
    const path = `art/story/dungeons/${f}`, m = f.match(/^lore_(.+)\.webp$/);
    if (!m || !worldIds.has(m[1])) { errors.push(`${path}: lore_<迷宮ID>.webp の迷宮IDが world.js に無い`); continue; }
    lore[m[1]] = path; check(path);
  }
  for (const h of hold) if (existsSync(ROOT + "art/story/" + h + ".webp")) errors.push(`art/story/${h}.webp は直しを待つ絵 (hold.json)。出荷先から消すか、直したら hold.json から外す`);
  // 並びは章の順・台帳の順 (差分を読みやすく)
  const order = Object.keys(scenes);
  const storyOut = Object.fromEntries(Object.entries(story).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])));
  const worldOrder = WORLD.map((d) => d.id);
  const loreOut = Object.fromEntries(Object.entries(lore).sort((a, b) => worldOrder.indexOf(a[0]) - worldOrder.indexOf(b[0])));
  const q = (o) => Object.entries(o).map(([k, v]) => `  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  const module = [
    "// 自動生成 ── node tools/storyart/register.mjs が art/story/ の WebP から書く。手で直さない。",
    "// 物語の場面の絵 (場面ID → 絵)。ストーリーの一覧とゲーム内の場面 (storyImage) が使う",
    "export const STORY_IMAGES = {", q(storyOut), "};",
    "// 踏破した迷宮の由来の絵 (迷宮ID → 絵)",
    "export const LORE_IMAGES = {", q(loreOut), "};", "",
  ].join("\n");
  const swLines = [...Object.values(storyOut), ...Object.values(loreOut)].map((p) => `  "./${p}",`);
  return { errors, story: storyOut, lore: loreOut, module, swBlock: [BEGIN, ...swLines, END].join("\n") };
}

// sw.js の絵の欄を差し替えた全文 (欄が無ければ null)
export function swWith(block, sw = readFileSync(ROOT + SW, "utf8")) {
  const a = sw.indexOf(BEGIN), b = sw.indexOf(END);
  if (a < 0 || b < a) return null;
  return sw.slice(0, a) + block + sw.slice(b + END.length);
}

// 書き出した結果と、いまのファイルとの食い違い (空なら一致)
export function registerDrift(plan = registerPlan()) {
  const out = [...plan.errors, ...masterDrift()];
  const cur = existsSync(ROOT + OUT) ? readFileSync(ROOT + OUT, "utf8") : "";
  if (cur !== plan.module) out.push(`${OUT} が art/story/ の絵と食い違う (node tools/storyart/register.mjs で書き直す)`);
  const sw = readFileSync(ROOT + SW, "utf8"), next = swWith(plan.swBlock, sw);
  if (next == null) out.push(`${SW} に <<STORY_ART>> の欄が無い`);
  else if (next !== sw) out.push(`${SW} の ASSETS の絵が art/story/ と食い違う (node tools/storyart/register.mjs で書き直す)`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = registerPlan();
  if (process.argv.includes("--check")) {
    const drift = registerDrift(plan);
    for (const d of drift) console.error("✗ " + d);
    if (drift.length) process.exit(1);
    console.log(`登録は art/story/ と一致 (場面 ${Object.keys(plan.story).length} 枚・由来 ${Object.keys(plan.lore).length} 枚)`);
  } else {
    if (plan.errors.length) { for (const e of plan.errors) console.error("✗ " + e); process.exit(1); }
    const sw = swWith(plan.swBlock);
    if (sw == null) { console.error(`✗ ${SW} に <<STORY_ART>> の欄が無い`); process.exit(1); }
    writeFileSync(ROOT + OUT, plan.module);
    writeFileSync(ROOT + SW, sw);
    console.log(`${OUT} と ${SW} を書き直した (場面 ${Object.keys(plan.story).length} 枚・由来 ${Object.keys(plan.lore).length} 枚)`);
  }
}

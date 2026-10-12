// 制作担当への割り当てと途中停止後の再開用。画像生成は Codex の担当が行う。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SCENES, scenePaths } from "./scenes.mjs";
import { WORLD } from "../../src/dungeons/world.js";
import { promptFor } from "./prompt.mjs";
import { registerPlan, swWith } from "./register.mjs";
import { imageSize } from "./imagesize.mjs";

const folder = join(ROOT, "art/story-review/batches");
const manifest = join(folder, "queue.json");
const digest = (file) => createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex");
const read = () => JSON.parse(readFileSync(manifest, "utf8"));
function save(queue) {
  mkdirSync(folder, { recursive: true });
  const temporary = manifest + ".tmp";
  writeFileSync(temporary, JSON.stringify(queue, null, 2) + "\n");
  renameSync(temporary, manifest);
}
function checkReferences(queue) {
  for (const [file, hash] of Object.entries(queue.references)) {
    if (!existsSync(join(ROOT, file)) || digest(file) !== hash) {
      throw new Error(`基準画像が開始時から変わっている: ${file}。担当間の基準を確認してから進める`);
    }
  }
}
function batchById(queue, id) {
  const batch = queue.batches.find((b) => b.id === id);
  if (!batch) throw new Error(`バッチが無い: ${id}`);
  return batch;
}
function receipt(batch) {
  const path = join(folder, `${batch.id}-worker.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}
function init(baseCommit) {
  if (existsSync(manifest)) throw new Error("制作台帳は作成済み。status / next で続ける");
  if (!/^[0-9a-f]{40}$/.test(baseCommit || "")) throw new Error("init に開始コミットの40桁SHAを渡す");
  const groups = new Map();
  for (const scene of SCENES) {
    if (existsSync(join(ROOT, scenePaths(scene.id).shipped))) continue;
    const key = `chapter${scene.chapter}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scene.id);
  }
  const lore = WORLD.map((d) => `lore_${d.id}`).filter((id) => !existsSync(join(ROOT, scenePaths(id).shipped)));
  if (lore.length) groups.set("dungeons", lore);
  const batches = [];
  for (const [group, ids] of groups) {
    for (let i = 0; i < ids.length; i += 5) {
      batches.push({ id: `batch-${String(batches.length + 1).padStart(3, "0")}`, group,
        scenes: ids.slice(i, i + 5), state: "pending", worker: null, note: "" });
    }
  }
  const refDir = "docs/art/story-refs";
  const refs = readdirSync(join(ROOT, refDir)).filter((name) => name.endsWith(".png") && !/candidates|ordo-[abc]\.png/.test(name));
  refs.push("../sera/sera-r1-final.png");
  const references = Object.fromEntries(refs.map((name) => [join(refDir, name), digest(join(refDir, name))]));
  save({ version: 1, baseCommit,
    maxNewImages: 5, maxGenerationCalls: 7, references, batches });
  console.log(`${batches.length} バッチ、${batches.reduce((n, b) => n + b.scenes.length, 0)} 枚を登録`);
}
function next(queue) {
  const batch = queue.batches.find((b) => b.state === "pending");
  if (!batch) return console.log("未割り当てのバッチは無い。status で停止中・確認待ちを調べる");
  console.log(`${batch.id} (${batch.group}): ${batch.scenes.join(", ")}`);
  console.log(`基準コミット: ${queue.baseCommit}\n生成は合計${queue.maxGenerationCalls}回まで。失敗と修正も含める。`);
  console.log("基準画像を実際に画像生成へ渡す。各画像を保存するたび worker.json に記録する。");
  console.log("参照は最大5枚。人物・印・セラの必須原画を優先し、建物の重複参照を減らす。");
  console.log(`記録先: art/story-review/batches/${batch.id}-worker.json`);
  console.log("原画だけを制作し、変換・登録・本文・基準画像の変更は統合担当に任せる。\n");
  for (const id of batch.scenes) console.log(promptFor(id) + "\n");
}
function collect(queue, batch) {
  const report = receipt(batch);
  if (!report || !Array.isArray(report.scenes)) throw new Error("担当の記録が無い。README の形式で保存する");
  if (!Number.isInteger(report.generationCalls) || report.generationCalls < 0) throw new Error("生成試行回数が無い");
  if (report.generationCalls > queue.maxGenerationCalls) throw new Error("生成試行回数がバッチ上限を超えている");
  const seen = new Set();
  const masterHashes = {};
  for (const item of report.scenes) {
    if (!batch.scenes.includes(item.id) || seen.has(item.id)) throw new Error(`担当外または重複したID: ${item.id}`);
    if (!["ready", "needs-fix", "blocked"].includes(item.state)) throw new Error(`確認状態が不正: ${item.id}`);
    seen.add(item.id);
    const path = scenePaths(item.id).master;
    if (item.state === "ready" && (!existsSync(join(ROOT, path)) || !item.note?.trim())) {
      throw new Error(`原画または目視確認の記録が無い: ${item.id}`);
    }
    if (item.state === "ready") {
      const { w, h } = imageSize(readFileSync(join(ROOT, path)));
      if (w !== 1536 || h !== 1024) throw new Error(`原画の寸法が不正: ${item.id} (${w}×${h})`);
      masterHashes[path] = digest(path);
    }
  }
  batch.state = batch.scenes.every((id) => report.scenes.some((s) => s.id === id && s.state === "ready")) ? "review" : "blocked";
  batch.note = report.note || "";
  batch.generationCalls = report.generationCalls;
  batch.masterHashes = masterHashes;
  save(queue);
  console.log(`${batch.id}: ${batch.state} (生成${report.generationCalls}回)`);
}

try {
  const [command = "status", id, ...words] = process.argv.slice(2);
  if (command === "init") init(id);
  else {
    const queue = read();
    if (command !== "status") checkReferences(queue);
    if (command === "next") next(queue);
    else if (command === "claim") {
      const batch = batchById(queue, id);
      if (batch.state !== "pending") throw new Error("このバッチは割り当て済み。担当を確認してから resume する");
      if (!words.length) throw new Error("担当のエージェントIDが必要");
      batch.state = "working";
      batch.worker = words.join(" ");
      save(queue);
    } else if (command === "collect") collect(queue, batchById(queue, id));
    else if (command === "block") {
      const batch = batchById(queue, id);
      if (!words.length) throw new Error("停止理由が必要");
      batch.state = "blocked";
      batch.note = words.join(" ");
      save(queue);
    } else if (command === "resume") {
      const batch = batchById(queue, id);
      if (batch.state !== "blocked") throw new Error("停止中のバッチだけ再開できる");
      const report = receipt(batch);
      if (report) {
        batch.attempts ??= [];
        const archive = `${batch.id}-attempt-${batch.attempts.length + 1}.json`;
        renameSync(join(folder, `${batch.id}-worker.json`), join(folder, archive));
        batch.attempts.push({ worker: batch.worker, receipt: archive });
        writeFileSync(join(folder, `${batch.id}-worker.json`), JSON.stringify({
          generationCalls: 0, note: "担当交代。完成済みの原画を再利用して未完成分を進める", scenes: report.scenes,
        }, null, 2) + "\n");
      }
      batch.state = "pending";
      batch.worker = null;
      save(queue);
    } else if (command === "integrated") {
      const batch = batchById(queue, id);
      if (!["review", "integrated"].includes(batch.state)) throw new Error("担当の目視確認が終わっていない");
      const masters = JSON.parse(readFileSync(join(ROOT, "tools/storyart/masters.json"), "utf8"));
      for (const scene of batch.scenes) {
        const master = scenePaths(scene).master;
        if (digest(master) !== batch.masterHashes?.[master]) throw new Error(`確認後に原画が変わった: ${scene}`);
        const bytes = readFileSync(join(ROOT, master));
        const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
        if (masters[master] !== blob) throw new Error(`原画のWebP変換記録が古い: ${scene}`);
        if (!existsSync(join(ROOT, scenePaths(scene).shipped))) throw new Error(`出荷WebPが無い: ${scene}`);
      }
      const plan = registerPlan();
      if (plan.errors.length) throw new Error(plan.errors.join("\n"));
      if (readFileSync(join(ROOT, "src/storyimages.js"), "utf8") !== plan.module
          || readFileSync(join(ROOT, "sw.js"), "utf8") !== swWith(plan.swBlock)) {
        throw new Error("WebPの登録が最新ではない。build.py を実行する");
      }
      batch.state = "integrated";
      batch.note = words.join(" ");
      save(queue);
    } else if (command === "status") {
      for (const batch of queue.batches) console.log(`${batch.id}\t${batch.state}\t${batch.scenes.join(", ")}\t${batch.note}`);
    } else throw new Error("使い方: batches.mjs init SHA | next | status | claim ID 担当 | collect ID | block ID 理由 | resume ID | integrated ID [記録]");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

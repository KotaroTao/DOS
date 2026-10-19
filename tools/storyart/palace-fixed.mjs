// 第一章の玉座の間: 人物だけを重ね、王宮背景の未遮蔽画素を完全に保つ。
// node tools/storyart/palace-fixed.mjs [場面ID ...] [--check]
// 合成はImageMagick、検査は原画PNGの画素を直接比較する。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = root + "docs/art/story-refs/palace-front.png";
const assetDir = root + "docs/art/story-refs/palace-chapter1-overlays/";
const baseHash = "895fc33f9c26d5d230fdd361dcbb3d7641364e78f7d7ed2c21797496709987de";
const sha = p => createHash("sha256").update(readFileSync(p)).digest("hex");
const run = args => execFileSync("magick", args, { maxBuffer: 30 * 1024 * 1024 });
const dimensions = p => run(["identify", "-format", "%w %h", p]).toString().split(" ").map(Number);
const ids = ["report_w02", "report_w03", "report_w04", "minePass", "report_w05"];
const args = process.argv.slice(2);
const selected = args.filter(a => !a.startsWith("--"));
const chosen = selected.length ? selected : ids;
assert.equal(sha(base), baseHash, "王宮の基準原画が変わっています");
assert.deepEqual(dimensions(base), [1536, 1024]);
mkdirSync(assetDir, { recursive: true });
const rgb = p => run([p, "-alpha", "off", "-depth", "8", "RGB:-"]);
const background = rgb(base);
const evidence = [];

for (const id of chosen) {
  assert(ids.includes(id), "対象外の場面: " + id);
  const layer = assetDir + id + "-foreground.png";
  const master = root + `art/story-review/chapter1/${id}.png`;
  if (!args.includes("--check")) {
    const sheet = assetDir + id + "-sheet.png";
    assert.deepEqual(dimensions(sheet), [1536, 1024]);
    const listing = run([sheet, "-alpha", "extract", "-threshold", "50%",
      "-define", "connected-components:verbose=true", "-connected-components", "8", "null:"]).toString();
    const figures = [...listing.matchAll(/^\s*(\d+):\s+\d+x\d+\+\d+\+\d+\s+([\d.]+),[\d.]+\s+(\d+)\s+srgb\(255,255,255\)/gm)]
      .map(m => ({ label: +m[1], center: +m[2], area: +m[3] }))
      .filter(x => x.area > 20000).sort((a, b) => a.center - b.center);
    // 通行証の受け渡しだけは王と弟子の手が接するため、一組の素材として保つ。
    const sharedPass = id === "minePass" && figures.length === 2;
    assert.equal(figures.length, sharedPass ? 2 : 3, "人物の透明素材を分離できません: " + id);
    // [画像内の横中心, 足元, 高さ]。椅子の座面と床に合わせ、背景側は動かさない。
    const standingMorden = ["report_w04", "report_w05"].includes(id);
    const positions = sharedPass ? [[808, 625, 210], [946, 630, 165]]
      : [[766, 600, 180], id === "minePass" ? [868, 625, 200] : [625, 775, 280],
        [946, standingMorden ? 600 : 630, standingMorden ? 230 : 165]];
    const temp = mkdtempSync(join(tmpdir(), "dos-palace-"));
    try {
      const composite = ["-size", "1536x1024", "xc:none"];
      for (const i of sharedPass ? [1, 0] : [0, 2, 1]) {
        const mask = join(temp, `mask${i}.png`), part = join(temp, `part${i}.png`);
        run([sheet, "-alpha", "extract", "-threshold", "50%", "-define", `connected-components:keep=${figures[i].label}`,
          "-define", "connected-components:mean-color=true", "-connected-components", "8", "-threshold", "50%",
          "-morphology", "Dilate", "Disk:2", mask]);
        const [center, bottom, height] = positions[i];
        run([sheet, "(", mask, "-alpha", "copy", ")", "-compose", "DstIn", "-composite", "-trim", "+repage",
          "-resize", `x${height}`, ...(id === "report_w05" && i === 0 ? ["-flop"] : []), part]);
        const [width] = dimensions(part);
        composite.push(part, "-geometry", `+${Math.round(center - width / 2)}+${bottom - height}`, "-compose", "Over", "-composite");
      }
      run([...composite, layer]);
      run([base, layer, "-compose", "Over", "-composite", master]);
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.deepEqual(dimensions(master), [1536, 1024]);
  const alpha = run([layer, "-alpha", "extract", "-depth", "8", "gray:-"]);
  const output = rgb(master);
  let uncovered = 0, covered = 0;
  for (let p = 0; p < alpha.length; p++) {
    if (alpha[p]) { covered++; continue; }
    uncovered++;
    for (let c = 0; c < 3; c++) assert.equal(output[p * 3 + c], background[p * 3 + c], `${id}: 背景の画素が変わっています (${p % 1536},${Math.floor(p / 1536)})`);
  }
  assert(covered > 10000 && covered < alpha.length * 0.2, "人物以外の大きな領域が含まれています");
  if (args.includes("--check")) {
    const shipped = root + `art/story/chapter1/${id}.webp`;
    assert.deepEqual(rgb(shipped), output, `${id}: 出荷WebPが原画の画素と一致しません`);
  }
  evidence.push({ id, backgroundSha256: baseHash, foregroundSha256: sha(layer), masterSha256: sha(master), uncoveredPixels: uncovered, changedUncoveredPixels: 0 });
  console.log(`${id}: 未遮蔽 ${uncovered} 画素すべて背景と一致 (差分0)`);
}
if (!args.includes("--check") && chosen.length === ids.length) writeFileSync(assetDir + "verification.json", JSON.stringify(evidence, null, 2) + "\n");

// 出荷画像・原画・登録の対応を検査する。変換後に --record でハッシュを記録する。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { OPENING_IMAGES, SCENES } from "../../src/openingillustrations.js";
import { imageSize } from "../storyart/imagesize.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MANIFEST = ROOT + "art/story-review/opening/assets.json";
const read = (path) => readFileSync(ROOT + path);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assets = new Set(read("sw.js").toString().split("\n").map((line) => line.trim()));
const records = {};

try {
  assert.equal(SCENES.length, 6);
  assert.equal(OPENING_IMAGES.length, SCENES.length);
  for (const [index, { src, focus }] of OPENING_IMAGES.entries()) {
    assert.equal(SCENES[index].photo, src);
    assert.equal(focus.length, 2);
    assert.ok(focus.every((value) => value >= 0 && value <= 1), src + " の主題の位置が不正");
    assert.ok(assets.has(JSON.stringify("./" + src) + ","), src + " のSW登録が無い");
    const shipped = read(src);
    assert.equal(shipped.toString("ascii", 0, 4), "RIFF", src + " はWebPではない");
    assert.equal(shipped.toString("ascii", 8, 12), "WEBP", src + " はWebPではない");
    assert.deepEqual(imageSize(shipped), { w: 1536, h: 1024 }, src + " の寸法が不正");
    if (!src.startsWith("art/opening/")) continue;
    const master = "art/story-review/opening/" + basename(src, ".webp") + ".png";
    const png = read(master);
    assert.deepEqual(imageSize(png), { w: 1536, h: 1024 }, master + " の寸法が不正");
    records[src] = { master, masterHash: hash(png), shippedHash: hash(shipped) };
  }
  if (process.argv.includes("--record")) {
    writeFileSync(MANIFEST, JSON.stringify(records, null, 2) + "\n");
  } else {
    assert.deepEqual(JSON.parse(readFileSync(MANIFEST, "utf8")), records,
      "原画かWebPが記録と違う。再変換して node tools/openingart/check.mjs --record を実行する");
  }
  console.log("オープニング6幕: WebP・寸法・SW登録・主題の位置・専用原画4枚の変換記録 OK");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

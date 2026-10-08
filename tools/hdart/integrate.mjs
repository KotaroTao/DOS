// 描いた hd_* を schema.js の ARTS に書き込み、魔物の artKey を差し替える
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA = path.join(ROOT, "src/dungeons/schema.js");
const DEFS = ["bestiary.js", "common.js", "d01.js", "d02.js", "d03.js", "d04.js"].map(f => path.join(ROOT, "src/dungeons", f));
// 層ごとの見出し (区画の目印)。新しい層を足す時はここにも足す
const HEAD = {
  layer2: ["第2層「地下水路」", [
    "  // 第1層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に寒色のリム。'o' は完全な闇。",
    "  // 濁った水の照り返しと濡れた鏡面、足元の汚水の水溜まりで層の空気を揃える。",
    "  // 生成元: tools/hdart/layer2/*.mjs (node tools/hdart/run.mjs layer2 --apply で描き直せる)",
  ]],
  layer3: ["第3層「廃坑」", [
    "  // 第1・2層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に寒色のリム。'o' は完全な闇。",
    "  // 乾いた岩肌と炭塵、足元の砂利と落石、鉱脈や坑火の暖色の灯りで層の空気を揃える。",
    "  // 生成元: tools/hdart/layer3/*.mjs (node tools/hdart/run.mjs layer3 --apply で描き直せる)",
  ], { open: "  // ── 第3層「廃坑」写実ダーク高解像度プロトタイプ (hd_*): 通常 96x96 / 層ボス・強敵 112x128 ──", close: "  // ── 第3層 hd_* ここまで ──", after: "  // ── 出来事の魔物 hd_* ここまで ──\n" }],
  layer4: ["第4層「捨て砦」", [
    "  // 第1〜3層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に月明かりの青灰のリム。'o' は完全な闇。",
    "  // 錆びた鉄と朽ちた布、足元の割れた石畳と崩れた石積み・折れ矢、篝火の暖色と灰で落城した砦の空気を揃える。",
    "  // 生成元: tools/hdart/layer4/*.mjs (node tools/hdart/run.mjs layer4 --apply で描き直せる)",
  ]],
  layer5: ["第5層「霧の森」", [
    "  // 第1〜4層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に霧に散った月明かりの青緑灰のリム。'o' は完全な闇。",
    "  // 湿った腐葉土と苔むした根、漂う霧の筋と胞子、眼や呪文の燐光だけが鮮やかに光る。神速の残像・ブレス・呪文の輪など戦い方の特色を絵で押し出す。",
    "  // 生成元: tools/hdart/layer5/*.mjs (node tools/hdart/run.mjs layer5 --apply で描き直せる)",
  ]],
  layer6: ["第6層「沈没神殿」", [
    "  // 第1〜5層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に水面に散った月明かりの青緑のリム。'o' は完全な闇。",
    "  // 水に沈んだ石畳と水たまり、崩れた柱、立ちのぼる泡と沈んだ燭台の燐光。神速の残像・ブレス・呪文の輪・溜めの光など戦い方の特色を絵で押し出す。",
    "  // 生成元: tools/hdart/layer6/*.mjs (node tools/hdart/run.mjs layer6 --apply で描き直せる)",
  ]],
  // 第7層は第6層の区画の後ろに置く
  layer7: ["第7層「灼熱の洞」", [
    "  // 第1〜5層と同じ流儀: 左上の主光源と明暗法、輪郭線なしで影側の縁は最暗色、背面に溶岩の照り返しが煙に散った暗い赤紫のリム。'o' は完全な闇。",
    "  // ひび割れた玄武岩の床と溶岩の筋、下を向いた面への赤い照り返し、宙を舞う火の粉と灰。神速の残像・ブレス・呪文の輪・溜めの熱など戦い方の特色を絵で押し出す。",
    "  // 生成元: tools/hdart/layer7/*.mjs (node tools/hdart/run.mjs layer7 --apply で描き直せる)",
  ], { open: "  // ── 第7層「灼熱の洞」写実ダーク高解像度プロトタイプ (hd_*): 通常 96x96 / 層ボス・強敵 112x128 ──", close: "  // ── 第7層 hd_* ここまで ──", after: "  // ── 第6層 hd_* ここまで ──\n" }],
  // 金属の魔物 (メタル系・マスコット)。層に属さず第3層から稀に紛れ込む。第3層の区画の後ろに置く
  metal: ["金属の魔物", [
    "  // 銀業・金業・銀業の王: 鏡のような貴金属の肌 (空を映す明るい上面・暗い水平の帯・床の照り返し) の小さな人業。",
    "  // 流儀は層の hd_* と同じ (左上の主光源、輪郭線なし、背面に寒色のリム)。魂の双眸と胸の小窓だけが自ら光る。",
    "  // 生成元: tools/hdart/metal/*.mjs (node tools/hdart/run.mjs metal --apply で描き直せる)",
  ], { open: "  // ── 金属の魔物 写実ダーク高解像度プロトタイプ (hd_*): 96x96 ──", close: "  // ── 金属の魔物 hd_* ここまで ──", after: "  // ── 第3層 hd_* ここまで ──\n" }],
  // 層に属さない出来事 (events.js) 専用の魔物。第2層の区画の後ろに置く
  event: ["出来事の魔物", [
    "  // 層を問わず出来事にだけ現れる魔物。流儀は層の hd_* と同じ (左上の主光源、輪郭線なし、背面に寒色のリム)。",
    "  // 生成元: tools/hdart/event/*.mjs (node tools/hdart/run.mjs event --apply で描き直せる)",
  ], { open: "  // ── 出来事の魔物 写実ダーク高解像度プロトタイプ (hd_*): 96x96 ──", close: "  // ── 出来事の魔物 hd_* ここまで ──", after: "  // ── 第2層 hd_* ここまで ──\n" }],
};
export function applyLayer(layer, recs) {
  const [title, notes, mark] = HEAD[layer] || (() => { throw new Error("integrate.mjs の HEAD に " + layer + " がない"); })();
  const n = layer.replace("layer", "");
  const open = mark ? mark.open : `  // ── ${title}写実ダーク高解像度プロトタイプ (hd_*): 通常 96x96 / 層ボス・強敵 112x128 ──`;
  const close = mark ? mark.close : `  // ── 第${n}層 hd_* ここまで ──`;
  const lines = [open, ...notes];
  // 層の見出し順 (ボス・強敵は最後) は、呼び出し側の並びをそのまま使う
  for (const a of recs) {
    const { key, note, w, h } = a.meta;
    if (a.art.length !== h || a.art.some(r => r.length !== w)) throw new Error(key + ": 寸法が meta と合わない");
    lines.push(`  ${key}: { // ${note}`, `    palette: ${JSON.stringify(a.palette)},`, `    art: [`, ...a.art.map(r => `      "${r}",`), `    ],`, `  },`);
  }
  lines.push(close);
  let s = fs.readFileSync(SCHEMA, "utf8");
  const st = s.indexOf(open), en = s.indexOf(close + "\n");
  if (st >= 0 && en > st) s = s.slice(0, st) + lines.join("\n") + "\n" + s.slice(en + close.length + 1);
  else {
    const prev = mark ? mark.after : `  // ── 第${n - 1}層 hd_* ここまで ──\n`;
    if (!s.includes(prev)) throw new Error("schema.js に挿入位置 (" + prev.trim() + ") がない");
    s = s.replace(prev, () => prev + lines.join("\n") + "\n"); // 置換文字列にすると色記号の $ & が置換パターンとして解釈される
  }
  fs.writeFileSync(SCHEMA, s);
  for (const f of DEFS) {
    let t = fs.readFileSync(f, "utf8"), changed = false;
    for (const { meta: { id, key } } of recs) {
      const re = new RegExp(`(\\{ id: "${id}",[^\\n]*?artKey: ")([^"]+)(")`);
      if (re.test(t)) { const before = t; t = t.replace(re, `$1${key}$3`); if (t !== before) { changed = true; console.log(path.basename(f), id, "→", key); } }
    }
    if (changed) fs.writeFileSync(f, t);
  }
  console.log("schema.js に", recs.length, "体を書き込んだ。sw.js の CACHE を上げること");
}

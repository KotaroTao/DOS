// 魔物の伝承 (src/dungeons/monlore.js) の検査: node tools/lore/check.mjs
// ・第1〜7層の魔物 (層の出現表・強敵・主、本筋と寄り道の迷宮の出現表) に漏れなく伝承がある
// ・出典と本文の長さ、難しい漢字、層ごとの出典の偏り (似た内容にしない)、章ごとのネタばれの語
import { MONSTER_LORE } from "../../src/dungeons/monlore.js";
import { BESTIARY, LAYER_POOLS, LAYER_ELITES, LAYER_BOSS } from "../../src/dungeons/bestiary.js";
import { WORLD } from "../../src/dungeons/world.js";

const LAYERS = 7;
const errs = [];
const layerOf = {}, where = {};
for (let L = 1; L <= LAYERS; L++)
  for (const id of [...(LAYER_POOLS[L] || []), ...(LAYER_ELITES[L] || []), LAYER_BOSS[L - 1]]) if (id && !layerOf[id]) layerOf[id] = L;
for (const d of WORLD) {
  if (d.layer > LAYERS) continue;
  for (const id of [...(d.bands || []).flat(), ...(d.elites || []), d.boss].filter(Boolean)) {
    if (!layerOf[id]) layerOf[id] = d.layer;
    (where[id] ||= new Set()).add(d.id);
  }
}
for (const id of Object.keys(layerOf)) if (!MONSTER_LORE[id]) errs.push(`伝承が無い: ${id} ${BESTIARY[id]?.name}`);
for (const id of Object.keys(MONSTER_LORE)) if (!BESTIARY[id]) errs.push(`魔物がいない: ${id}`);

// 読みにくい漢字 (CLAUDE.md「難しすぎる漢字・言い回しは使わない」)
const HARD = /[鑿刎齧頷埃纏詛蒐邂逅贄慟哭咆哮蠢蝋]/;
// 章ごとにまだ明かされていない秘密の語 (層 → 書いてはいけない語)
const SPOIL = {
  1: /大樹|旧都|霊薬|モルデン|神官王|奈落|最初の操霊師|百年を生き/,
  2: /大樹|旧都|霊薬|モルデン|神官王|奈落|最初の操霊師|百年を生き/,
  3: /大樹|旧都|霊薬|モルデン|神官王|奈落|最初の操霊師|百年を生き/,
  4: /大樹|旧都|霊薬|モルデン|神官王|奈落|最初の操霊師/,
  5: /霊薬|神官王|奈落|最初の操霊師/,
  6: /霊薬|奈落|最初の操霊師/,
  7: /奈落|最初の操霊師/,
};
const BOSS_FREE = new Set(["bs_infernolord"]); // 主の伝承は1体討てば読める — 業火の主だけは第五章の真相に触れてよい
const SERA_OK = new Set(["w16", "w17", "w18", "w19", "w20", "w21"]);
const WS5_SPOIL = /モルデン|神官王|苗木|セラ/; // 古井戸 (第二章から開く) に出る魔物

const byLayer = {};
for (const [id, v] of Object.entries(MONSTER_LORE)) {
  const L = layerOf[id];
  const name = `${id} ${BESTIARY[id]?.name || ""}`;
  if (!v || typeof v.by !== "string" || !v.by.trim()) { errs.push(`出典が無い: ${name}`); continue; }
  if (typeof v.text !== "string" || !v.text.trim()) { errs.push(`本文が無い: ${name}`); continue; }
  const len = v.text.replace(/\n/g, "").length;
  if (len < 40 || len > 200) errs.push(`本文の長さ ${len}字 (40〜200): ${name}`);
  if (v.by.length > 20) errs.push(`出典が長い (${v.by.length}字): ${name}`);
  if ((v.text.match(/\n/g) || []).length > 1) errs.push(`改行は1回まで: ${name}`);
  const hard = [...v.text + v.by].filter((c) => HARD.test(c));
  if (hard.length) errs.push(`読みにくい漢字 ${hard.join("")}: ${name}`);
  if (L && SPOIL[L] && !BOSS_FREE.has(id)) {
    const m = (v.text + v.by).match(SPOIL[L]);
    if (m) errs.push(`第${L}層ではまだ明かされない語「${m[0]}」: ${name}`);
  }
  if (where[id] && where[id].has("ws5") && L === 6) {
    const m = (v.text + v.by).match(WS5_SPOIL);
    if (m) errs.push(`古井戸 (第二章から) に出る魔物に「${m[0]}」: ${name}`);
  }
  // 霧の迷い森 (第二章の大手門の報告から開く) に出る第5層の魔物: 第三章の手記・大樹・モルデンに触れない
  if (where[id] && where[id].has("ws3") && L === 5) {
    const m = (v.text + v.by).match(/ヴェルナー|モルデン|大樹/);
    if (m) errs.push(`迷い森 (第二章から) に出る魔物に「${m[0]}」: ${name}`);
  }
  // セラが語れるのは、目覚めた後 (洗礼の大水槽 w16 で脚を見つけた後) にしか会えない魔物だけ
  if (/セラ/.test(v.text + v.by) && [...(where[id] || [])].some((d) => !SERA_OK.has(d))) errs.push(`セラが目覚める前に会える魔物にセラの声: ${name}`);
  if (L) (byLayer[L] ||= []).push({ id, by: v.by });
}

// 似た内容にしない: 1つの層で出典7種以上・同じ出典は3回まで・同じ出典が2つ続かない
const voice = (by) => by.replace(/（.*?）|\(.*?\)/g, "").trim();
for (const [L, rows] of Object.entries(byLayer)) {
  const count = {};
  rows.forEach((r, i) => {
    const k = voice(r.by);
    count[k] = (count[k] || 0) + 1;
    if (i && voice(rows[i - 1].by) === k) errs.push(`第${L}層: 同じ出典が続く「${k}」 (${rows[i - 1].id} → ${r.id})`);
  });
  const kinds = Object.keys(count).length;
  if (kinds < 7) errs.push(`第${L}層: 出典が${kinds}種しかない (7種以上)`);
  for (const [k, n] of Object.entries(count)) if (n > 3) errs.push(`第${L}層: 出典「${k}」が${n}回 (3回まで)`);
  console.log(`第${L}層 ${rows.length}体 / 出典${kinds}種`);
}

console.log(`伝承 ${Object.keys(MONSTER_LORE).length}体`);
if (errs.length) { console.log(errs.map((e) => "✗ " + e).join("\n")); process.exit(1); }
console.log("✓ 問題なし");

// 魔物の伝承 (src/dungeons/monlore.js) の検査: node tools/lore/check.mjs
// ・第1〜12層の魔物 (層の出現表・強敵・主、本筋と寄り道の迷宮の出現表) に漏れなく伝承がある
// ・出典と本文の長さ、難しい漢字、層ごとの出典の偏り (似た内容にしない)、章ごとのネタばれの語、伝承の形 (地の文で語るもの)
// ・説明文・懸賞文の属性の向き (魔物の属性に有利でない属性を「効く・弱い」と書かない)
import { MONSTER_LORE } from "../../src/dungeons/monlore.js";
import { BESTIARY, LAYER_POOLS, LAYER_ELITES, LAYER_BOSS } from "../../src/dungeons/bestiary.js";
import { WORLD } from "../../src/dungeons/world.js";
import { NAMED_FOES } from "../../src/dungeons/named.js";
import { elemBeats } from "../../src/dungeons/schema.js";

const LAYERS = 12;
const errs = [];
const layerOf = {}, where = {};
for (let L = 1; L <= LAYERS; L++)
  for (const id of [...(LAYER_POOLS[L] || []), ...(LAYER_ELITES[L] || []), LAYER_BOSS[L - 1]]) if (id && !layerOf[id]) layerOf[id] = L;
layerOf.bs_moldern ||= 12; // 第十章の結びの主 (w41)。LAYER_BOSS には載らないので台帳が無くても第12層として数える
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
  8: /最初の操霊師|一門の祖|イザーク/, // 凍王の正体と一門の祖は主の記憶で明かす
  9: /腐らせるな|灯の工房|尖塔|塔/, // 主の命令・島の工房・その先の塔は主の記憶で明かす
  10: /雨になって|雨となり|闘技場|観客席|石の橋|灯台/, // 還した魂が雨になって腐ること・頂の灯台・その先の橋は主の記憶で明かす
  11: /灯番|休ませないと|休ませず|休めず|町を焼いた|穴の底|地底|大空洞|最初の操霊師|モルデン/, // 祖が灯番の子・魂は休ませないと腐る・町を焼いた火・興行主の灯籠は主の記憶で明かす。第十章 (穴の底・地底大空洞)・祖の名・モルデンの居場所には触れない
  12: /魂の王|本当の目的|本当の理由|モルデン|名を書いた札|三百年ぶりに/, // 師が迷宮を潜る本当の理由 (魂の王) は主 (宰相モルデン) の記憶で明かす。灯籠の山に出る魔物 (灯籠の吹き溜まり w38) は札の手がかり (w39) より前に会えるので、モルデンの名も主の伝承だけ
};
const BOSS_FREE = new Set(["bs_infernolord", "bs_glaciallord", "bs_swamplord", "bs_stormlord", "bs_arenalord", "bs_moldern"]); // 主の伝承は1体討てば読める — 業火の主・凍王・よどみの主・嵐の主・闘技場の支配者・宰相モルデンは、その章の主の記憶の真相に触れてよい
const SERA_OK = new Set(["w16", "w17", "w18", "w19", "w20", "w21", "ws8", "ws9", "ws10",
  "w22", "w23", "w24", "w25", "ws11", "ws12", "w26", "w27", "w28", "w29", "ws13", "ws14",
  "w30", "w31", "w32", "w33", "ws15", "ws16", "ws17",
  "w34", "w35", "w36", "w37", "ws18", "ws19",
  "w38", "w39", "w40", "w41", "ws20", "ws21", "ws22"]); // ws8 は脚 (w16_legs) を見つけた後、ws9〜ws22 は第五章以降の依頼で開く
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

// 伝承の形: 引用 (「」『』) で始まり地の文を一言添える形ばかりにしない — どの層にも地の文で語る伝承を2件以上
for (const [L, rows] of Object.entries(byLayer)) {
  const plain = rows.filter((r) => !/^[「『]/.test(MONSTER_LORE[r.id].text)).length;
  if (plain < 2) errs.push(`第${L}層: 地の文で始まる伝承が${plain}件 (2件以上)`);
}

// 属性の向き: 説明文・懸賞文で、魔物の属性に有利でない属性 (不利・無関係) を「効く・弱い・焼ける」と名指ししない
// (水の敵に「火の魔法でよく焼ける」は、実際には火が水に負けて威力が半分になる。魔法弱点 magWeak はどの属性の呪文にも効く)
const EL_WORDS = [["fire", "業火|火|炎|熱"], ["wind", "雷|稲妻|風"], ["light", "聖なる光|光"], ["dark", "闇"], ["earth", "土|岩"], ["water", "水|冷気"]];
const EL_ANY = EL_WORDS.map((e) => e[1]).join("|");
const EL_ATK = new RegExp(`(?:呪文の|魔の|魔法の)(${EL_ANY})|(${EL_ANY})(?:の(?:魔法|呪文|気|刃|得物)|を浴び(?!せ)|が(?:よく)?(?:通る|効く))`, "g");
const EL_WEAK = /弱|効く|効き|よく焼け|焼かれ|焼き払|焼き落と|焼け|燃え上が|燃え盛|ひとたまり|一たまり|もろ(?!とも)|脆|崩れ|かき消|掻き消|弾け|散ら|通る|割れ|割る|削れ|しおれ|ちぎれ|泡を吹|砕け/;
const EL_NEG = /効か[んな]|通ら[んな]|通さ|弾き返/;
const elOfWord = (w) => EL_WORDS.find(([, re]) => new RegExp(`^(?:${re})$`).test(w))?.[0];
function elemMisuse(text, monEl) {
  const out = [];
  for (const s of text.split(/[。\n]/)) {
    if (!EL_WEAK.test(s) || EL_NEG.test(s)) continue;
    for (const m of s.matchAll(EL_ATK)) {
      const el = elOfWord(m[1] || m[2]);
      if (el && !elemBeats(el, monEl || "none")) out.push(`「${m[0]}」が${monEl || "none"}の敵に効くと書いている: ${s}`);
    }
  }
  return out;
}
for (const id of Object.keys(layerOf)) for (const e of elemMisuse(BESTIARY[id]?.desc || "", BESTIARY[id]?.element)) errs.push(`説明文 ${id} ${BESTIARY[id].name}: ${e}`);
for (const [id, v] of Object.entries(NAMED_FOES)) for (const l of [...v.bounty.lines, ...v.bounty.done]) for (const e of elemMisuse(l, BESTIARY[id]?.element)) errs.push(`懸賞文 ${id}: ${e}`);

console.log(`伝承 ${Object.keys(MONSTER_LORE).length}体`);
if (errs.length) { console.log(errs.map((e) => "✗ " + e).join("\n")); process.exit(1); }
console.log("✓ 問題なし");

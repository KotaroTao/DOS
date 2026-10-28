import { equipmentCombatState, equipmentPercentScore } from "../equipmentscore.js";
import { elementValues, elementalReduction } from "../combatrules.js";
import { bukonText } from "../bukon.js";
import { revealSteps } from "../monsterreveal.js";
import { MONSTER_LORE, monsterLoreReady } from "../dungeons/monlore.js";
import { previewStats, trialEquip, equipmentTraitTexts } from "../autoequip.js";
import { RESIST_LABEL, onHitEffects } from "../resistance.js";
// ===== 品・スキルの表示まわり (game.js から移設した純粋な表示ヘルパ) =====
// 状態を変えない。G が要るものは引数で受け取るか、ctx の game.G を読む。
// 呼び出し側 (game.js・各パッケージ) は同じ名前のまま import して使う。

import { game } from "./ctx.js";
import { el, sheet, setText, statDelta } from "./kit.js";
import { ELEMENTS, RACE_LABEL, unknownLabel, UNK_OPEN, UNK_CLOSE } from "../dungeons/index.js";
import { SPELLS, spellMpLabel, spellCureKinds, soulTierRate, healsHp, MP_DRAIN_CAP, stanceMulOf, spellAilments } from "../combat.js";
import { STAGED, stageOf, stageMul, stageLabel, ENEMY_STAT_LABEL, effectStage, isBattleLong } from "../buffstage.js";
import { ATTR_LABEL, SOUL_CLASSES, dollBust, PASSIVES, passiveName, passiveByName } from "../souls.js";
import { WEAPON_CAT_LABEL, SHIELD_KIND_LABEL, HAND_LABEL, handOf, shieldKind, RANGE_LABEL, weaponRange, slotKeyFor, recalc, canEquip, equipLevelOf, AIL_LABEL, attackPower, fightPower, useLines, itemName, hasQuality, qualityOf, QUALITY_MID, QUALITY_SPREAD } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { HERO, spriteCanvas, crispCanvas } from "../sprites.js";

// 魂のステータス寄与を「HP+7 STR+2.4 …」形式で列挙 (0は省略)
export function soulStatText(st, sep = " ") {
  const keys = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
  const lbl = { hp: "HP", mp: "MP", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  return keys.filter((k) => st[k]).map((k) => `${lbl[k]}+${st[k]}`).join(sep);
}

// ===== 属性攻撃/属性防御の表示ヘルパ =====
// 各属性の [強い相手, 弱い相手] (表示用)。光↔闇は相互有利で弱点なし
export const ELEM_ADV = {
  fire: ["wind", "water"], wind: ["earth", "fire"], earth: ["water", "wind"], water: ["fire", "earth"],
  light: ["dark", null], dark: ["light", null],
};
export function elemName(el) { return (ELEMENTS[el] || ELEMENTS.none).label; }
// 属攻補正・属性耐性力を百分率で表示する。旧Lv形式も共通変換で読む。
export function elemStatText(kind, e) {
  const entries = Object.entries(elementValues(e, kind === "攻撃" ? "attack" : "defense"));
  return entries.length ? entries.map(([k, v]) => `${elemName(k)}${kind === "攻撃" ? "属攻" : "耐性力"}+${v}%`).join(" / ") : null;
}
export function elemDetailLines(kind, e) {
  return Object.entries(elementValues(e, kind === "攻撃" ? "attack" : "defense")).map(([k, v]) => kind === "攻撃"
    ? `${elemName(k)}属攻+${v}%（基準100%に加算。属性の付与は武器・技で決まる）`
    : `${elemName(k)}耐性力${v}%（単体で${Math.round(elementalReduction(v) * 1000) / 10}%軽減。同属性を加算、軽減上限80%）`);
}
export function elemStatChip(e) { return `<b>${elemStatShort(e)}</b>`; }
export function elemStatEq(a, b) { return JSON.stringify([elementValues(a,a?.kind),a?.reductions])===JSON.stringify([elementValues(b,b?.kind),b?.reductions]); }
export function elemStatShort(e) {
  const defense = e?.kind === "defense";
  const values = elementValues(e, defense ? "defense" : "attack");
  if(defense&&e?.reductions){const keys=new Set([...Object.keys(values),...Object.keys(e.reductions)]);return [...keys].map(k=>`${elemName(k)}${Math.round(Math.min(.8,elementalReduction(values[k]||0)+(e.reductions[k]||0))*1000)/10}%軽減`).join(" / ")||"—";}
  return Object.entries(values).map(([k, v]) => defense
    ? `${elemName(k)}耐性力${v}%／${Math.round(elementalReduction(v) * 1000) / 10}%軽減`
    : `${elemName(k)}${100 + v}%`).join(" / ") || "—";
}

// ===== スキル詳細 =====
export const SPELL_KIND_LABEL = { atk: "攻撃呪文", heal: "回復呪文", phys: "物理技", buff: "支援", debuff: "弱体", sleep: "状態異常", cure: "治療", mana: "魔力譲渡", escape: "逃走", field: "迷宮の術" };
// 能力の倍率キーの呼び名 (STR/VIT… 以外の効果)
export const BUFF_NAME = { hit: "命中率", int: "INT", pie: "PIE", omen: "大技の予兆", taunt: "挑発", shield: "仁王立ち", ctr: "反撃の構え", rfl: "反射の陣", charge: "溜め", regen: "リジェネ", seal: "特技封じ", wardB: "ブレス避け", wardS: "呪文避け",
  r_fire: "火耐性", r_water: "水耐性", r_wind: "風耐性", r_earth: "土耐性", r_light: "光耐性", r_dark: "闇耐性", r_all: "全属性耐性" };
// 掛かっている強化・弱体の1つを札に (長押しの「人業の様子」・戦闘中の「敵の姿」)。
// 戦闘の札には残りターンを出さないので、ここで段・倍率・残りターンを確かめる (2026-10 ユーザーの指示)
export function effectChip(ef, { enemy = false } = {}) {
  if (ef.stat === "omen") return el("span", "dg-chip bad", "大技の予兆");
  const st = effectStage(ef);
  const name = (enemy && ENEMY_STAT_LABEL[ef.stat]) || ATTR_LABEL[ef.stat] || BUFF_NAME[ef.stat] || (ef.stat || "").toUpperCase();
  const mul = st && ef.mult ? ` ×${Math.round(ef.mult * 100) / 100}` : "";
  const extra = ef.stat === "ctr" && ef.mult > 1 ? ` 攻撃力×${Math.round((ef.mult - 1) * 100) / 100}`
    : ef.stat === "rfl" && ef.mult > 1 ? ` 魔力${ef.pow || 0}×${Math.round((ef.mult - 1) * 100) / 100}` : "";
  const turns = isBattleLong(ef.turns) ? "戦闘の終わりまで" : `残り${ef.turns}ターン`;
  return el("span", "dg-chip " + (ef.mult > 1 ? "up" : "bad"), `${name}${st ? stageLabel(st) : ef.mult > 1 ? "▲" : "▼"}${mul}${extra}・${turns}`);
}
export const SPELL_TARGET_LABEL = { enemy: "敵単体", "all-enemy": "敵全体", ally: "味方単体", "all-ally": "味方全員", self: "自分" };
export const SPELL_KIND_COLOR = { atk: "#e0743f", heal: "#46c08f", phys: "#d8b04a", buff: "#5fa8e0", debuff: "#a06fd6", sleep: "#a06fd6", cure: "#46c08f", mana: "#5fa8e0", escape: "#8f96a3", field: "#8fd0c8" };

// ===== 種別・属性アイコン (敵の特徴・味方のスキルに添える小さな札) =====
// 物 = 物理 / 魔 = 魔法 (ブレス含む) / 回復 / その他 (強化・弱体・招来など)。属性は「火」「水」…の札を並べる
// 物貫・魔貫 = 耐性貫通の技。全体 = 敵全体・味方全員を対象にする技
const TAG_KIND = {
  phys:  { t: "物", c: "#d8b04a" },
  mag:   { t: "魔", c: "#b48ae8" },
  physPierce: { t: "物貫", c: "#d8b04a" },
  magPierce:  { t: "魔貫", c: "#b48ae8" },
  heal:  { t: "回復", c: "#46c08f" },
  other: { t: "その他", c: "#8f96a3" },
  all:   { t: "全体", c: "#e0b45a" },
};
const SPELL_TAG_KIND = { phys: "phys", atk: "mag", heal: "heal", cure: "heal", mana: "heal" };
// 敵の特徴 → 種別。elem = 攻撃に魔物の固有属性が乗る (物理攻撃・ブレスは固有属性で打つ)
const TRAIT_TAG = {
  swift: ["other"], evasive: ["phys"], physResist: ["phys"], magWeak: ["mag"], magResist: ["mag"],
  regen: ["heal"], pack: ["other"], summon: ["other"], heal: ["heal"], guard: ["other"],
  breath: ["mag", true], poison: ["phys", true], paralyze: ["phys", true], stone: ["other"],
  drain: ["phys", true], soulSteal: ["other"], goldSteal: ["other"], critical: ["phys", true],
  enrage: ["other"], endure: ["other"], lifesteal: ["phys", true], multistrike: ["phys", true],
  barrier: ["other"], warcry: ["other"], weaken: ["phys", true],
  sleep: ["other"], charm: ["other"], confuse: ["other"], haste: ["other"], spell: ["mag", true],
  charge: ["phys", true], sunder: ["phys", true], dispel: ["other"], shake: ["other"],
};
function hasElem(e) { return !!(e && e !== "none" && ELEMENTS[e]); }
// 1枚の札。kind は TAG_KIND のキー、または "el:fire" のような属性
export function tagIcon(kind) {
  const isEl = kind.startsWith("el:");
  const d = isEl ? ELEMENTS[kind.slice(3)] : TAG_KIND[kind];
  if (!d) return null;
  const t = el("span", "ui-tag" + (isEl ? " el" : " k-" + kind), isEl ? d.label : d.t);
  t.style.setProperty("--tag-c", isEl ? d.color : d.c);
  return t;
}
// 札の並び (span.ui-tags)。空なら null
export function tagRow(kinds, cls = "") {
  const ks = (kinds || []).filter(Boolean);
  if (!ks.length) return null;
  const r = el("span", "ui-tags" + (cls ? " " + cls : ""));
  for (const k of ks) { const t = tagIcon(k); if (t) r.appendChild(t); }
  return r;
}
// 味方のスキルの札: 種別 + 属性。物理技に属性が無ければ、使い手の武器の属性攻撃が乗る (actor 指定時)
export function spellTagKinds(sp, actor) {
  if (!sp) return [];
  let kind = SPELL_TAG_KIND[sp.kind] || "other";
  if (sp.pierce > 0 && (kind === "phys" || kind === "mag")) kind += "Pierce";
  const out = [kind];
  let elk = sp.element;
  if (!hasElem(elk) && sp.kind === "phys" && actor) elk = actor.attackElement;
  if (hasElem(elk)) out.push("el:" + elk);
  // 全体を対象にする技 (敵全体・味方全員) には「全体」の札 (ユーザーの指示、2026-10)
  if (sp.target === "all-enemy" || sp.target === "all-ally") out.push("all");
  return out;
}
// 敵の特徴の札。element = その魔物の固有属性
export function traitTagKinds(key, element) {
  const d = TRAIT_TAG[key] || ["other"];
  const out = [d[0]];
  if (d[1] && hasElem(element)) out.push("el:" + element);
  return out;
}
// 固有属性から見た弱点 (受けるダメージ増) と耐性 (受けるダメージ減) の属性
export function elemAffinity(element, affinity = null) {
  return affinity || { weak: [], resist: [] };
}
// 「弱点 [土]　耐性 [火]」の行 (無属性・相性なしなら null)
export function affinityRow(element, cls = "", affinity = null) {
  const aff = elemAffinity(element, affinity);
  const weak = [...new Set([...(aff.weak || []), ...Object.keys(aff.weakness || {})])];
  const resist = [...new Set([...(aff.resist || []), ...Object.keys(aff.resistance || {})])];
  if (!weak.length && !resist.length && !aff.immune?.length && !aff.absorb?.length) return null;
  const r = el("div", "ui-affinity" + (cls ? " " + cls : ""));
  const part = (label, list, tone) => {
    if (!list.length) return;
    const g = el("span", "ui-aff " + tone);
    g.appendChild(el("span", "ui-aff-l", label));
    for (const k of list) g.appendChild(el("span", "ui-aff-l", tone === "weak" ? `${elemName(k)}ダメージ×${aff.weakness?.[k] ?? 1.5}` : `${elemName(k)}耐性力${aff.resistance?.[k] ?? 100}%／${Math.round(elementalReduction(aff.resistance?.[k] ?? 100) * 1000) / 10}%軽減`));
    r.appendChild(g);
  };
  part("弱点", weak, "weak");
  part("耐性", resist, "resist");
  for (const [label, values] of [["属性無効", aff.immune], ["属性吸収", aff.absorb]]) if (values?.length) r.appendChild(el("span", "ui-aff-l", `${label}：${values.map(elemName).join("・")}`));
  return r;
}

// ===== 敵の情報の段階開示 (討伐数しだい) =====
// 姿は最初から見える。1体 = 名前 / 5体 = 属性とHP / 10体 = 特徴・スキルと説明文。
// 迷宮の主は1体、強敵は10体で全てを明かす (強敵の属性とHPは1体)。主・名のある強敵は名前を最初から明かす。
// 戦闘画面 (名札・HPの小瓶)・「敵の姿」・図鑑の一枚で共通
export { MON_REVEAL, BOSS_REVEAL, NAMED_REVEAL, ELITE_REVEAL, revealSteps } from "../monsterreveal.js";
// その魔物を倒した数 (図鑑の記録を読むだけ。記録を作らない)
export function monKills(key) {
  const g = game.G;
  const e = g && g.codex && g.codex.mon ? g.codex.mon[key] : null;
  if (!e) return 0;
  if (e === true) return 1;
  return Math.max(0, Number(e.kills) || 0);
}
// 戦闘中の敵 1体について、いま何が明かされているか。
// 出来事だけの敵 (ev_*: 鏡の影など) は図鑑に載らないので、最初から全て明かす
export function enemyReveal(e) {
  const special = !e || String(e.key || "").startsWith("ev_");
  const kills = special ? 0 : monKills(e.key);
  const R = revealSteps(e && e.mon);
  return {
    special, kills, steps: R,
    name: special || kills >= R.name,
    stats: special || kills >= R.stats,
    lore: special || kills >= R.lore,
  };
}
// 敵の呼び名: 名前が明かされるまでは不確定名「小さく蠢くもの？」など (dungeons/unknown.js。正式な名と見分けるため「？」を添える。
// 同種が並ぶときの A/B… は残して見分けられるように)
export function enemyLabel(e) {
  if (!e) return "";
  if (enemyReveal(e).name) return e.name;
  const base = e.mon && e.mon.name;
  const tail = base && String(e.name || "").startsWith(base) ? String(e.name).slice(base.length) : "";
  return unknownLabel(e.mon) + tail;
}
// 名前がまだ明かされていない敵か (名札・ボタンの色分け用)
export function enemyUnknown(e) { return !!e && !enemyReveal(e).name; }
// 図鑑の全開示。無限迷宮だけで討った魔物は、本編で伝承が開くまで未完とする。
export function enemyCodexComplete(e) {
  const rv = enemyReveal(e);
  if (rv.special || !rv.name || !rv.stats || !rv.lore) return false;
  const rec = game.G?.codex?.mon?.[e.key];
  const mainKills = rec === true ? 1 : Math.max(0, Number(rec?.main ?? rec?.kills) || 0);
  return !MONSTER_LORE[e.key] || (mainKills > 0 && monsterLoreReady(e.key, game.G));
}
// 名前のまだわからない魔物の絵: 闇色の影に不確定名の色の淡い縁 (CSS の .unk-sil。戦闘の game.js monsterUnknownBitmap と揃える)
export function unknownArt(m, scale = 2) {
  const c = spriteCanvas(m, scale);
  c.classList.add("unk-sil");
  return c;
}
// 不確定名の色 (戦闘の名札・敵の姿シートの題。CSS の .unk-name と揃える)
export const UNKNOWN_COLOR = "#b9acd9";
// 記録の1行を書く: UNK_OPEN…UNK_CLOSE で囲んだ不確定名だけ .unk-name の色で (dungeons/unknown.js の unknownTag)
const UNK_RE = new RegExp(UNK_OPEN + "([^" + UNK_CLOSE + "]*)" + UNK_CLOSE, "g");
export function setLogText(node, text) {
  text = String(text == null ? "" : text);
  if (!text.includes(UNK_OPEN)) { node.textContent = text; return node; }
  node.textContent = "";
  let at = 0;
  for (const m of text.matchAll(UNK_RE)) {
    if (m.index > at) node.appendChild(document.createTextNode(text.slice(at, m.index)));
    node.appendChild(el("span", "unk-name", m[1]));
    at = m.index + m[0].length;
  }
  if (at < text.length) node.appendChild(document.createTextNode(text.slice(at)));
  return node;
}
// まだ明かされていない項目の札: 「属性・HP　5体討伐で開示」
export function revealLock(need, what, cls = "") {
  const r = el("div", "ui-reveal-lock" + (cls ? " " + cls : ""));
  if (what) r.appendChild(el("span", "ui-reveal-w", what));
  r.appendChild(el("span", "ui-reveal-n", `${need}体討伐で開示`));
  return r;
}

// スキルの効果をくわしい行に展開する
const pct = (v) => `${Math.round(v * 10000) / 100}%`;
// 技名の下の短い説明。命+は命中率への直接加算を表す。
export function skillDescription(sp) {
  if (!sp) return "";
  const bonuses = [];
  if ((sp.kind === "phys" || sp.kind === "atk") && !sp.gravity && sp.critBonus > 0)
    bonuses.push(sp.critBonus >= 1 ? "必ず会心" : `会+${pct(sp.critBonus)}`);
  if (sp.kind === "phys" && (sp.acc > 0 || sp.sureHit))
    bonuses.push(sp.sureHit ? "必中" : `命+${pct(sp.acc)}`);
  return [bonuses.join("・"), sp.desc].filter(Boolean).join("　");
}
const raceList = (rs) => [...new Set((rs || []).map((r) => RACE_LABEL[r] || r))].join("・");
const ELEM_NAME = (k) => (k === "all" ? "全属性" : (ELEMENTS[k] ? ELEMENTS[k].label : k));
export function skillDetailLines(sp) {
  const lines = [];
  lines.push(`種別: ${SPELL_KIND_LABEL[sp.kind] || sp.kind}　対象: ${SPELL_TARGET_LABEL[sp.target] || sp.target}`);
  if (sp.element && sp.element !== "none" && ELEMENTS[sp.element]) lines.push(`属性: ${ELEMENTS[sp.element].label}`);
  if (sp.kind === "atk" && sp.gravity) lines.push(`敵の今のHPの${pct(sp.gravity)}を削る（主には3割しか効かない・魔法耐性は受ける）`);
  else if (sp.kind === "atk") lines.push(`威力 ${sp.power}（術者の${sp.faith || sp.element === "light" ? "INT と PIE の高い方" : "INT"}で伸びる）`);
  if (sp.kind === "atk" && sp.gravity && sp.gravityIntCap != null) lines.push(`基本ダメージの上限: 強化・弱体込みのINT×${sp.gravityIntCap}（与ダメージ強化・魔法耐性・防御は上限適用後に計算）`);
  if (sp.kind === "heal") {
    const all = sp.target === "all-ally" ? "味方全員" : sp.target === "self" ? "自分" : "対象";
    const cap = sp.healCap ? `（${all === "対象" ? "" : "1人あたり"}最大HPの${pct(sp.healCap)}まで）` : "";
    if (sp.healPct) lines.push(`${all}の最大HPの${pct(sp.healPct)}を回復`);
    else if (sp.bodyHeal) lines.push(`回復量 使い手の最大HPの${pct(sp.bodyHeal)}${cap}`);
    else if (sp.healMul) lines.push(`回復量 ${sp.healMul === 1 ? "ヒールと同じ" : `ヒールの${sp.healMul}倍`}（術者のPIEで伸びる）${cap}`);
    else if (sp.power) lines.push(`回復量 ${sp.power}（術者のPIEで伸びる）${cap}`);
  }
  if (sp.kind === "mana") lines.push(`味方のMPを ${sp.power} 回復（術者のINTで少し伸びる。渡せるのは自分が使ったMPの8割まで）`);
  if (sp.kind === "escape") lines.push("必ず戦闘から逃げられる（退路が閉ざされている時を除く）");
  if (sp.kind === "sleep") lines.push("敵全体を基本60%で眠らせる（抵抗値で成功率が下がる）");
  if (sp.revive) lines.push(sp.revivePct ? `戦闘不能をHP${pct(sp.revivePct)}で蘇生する` : "戦闘不能も蘇生できる");
  if (sp.kind === "phys") {
    lines.push(sp.scatter ? `威力 攻撃力の${sp.power}倍 × ランダムな敵へ${sp.scatter}回` : `威力 攻撃力の${sp.power}倍${sp.hits ? ` × ${sp.hits}回` : ""}`);
    if (sp.intScale) lines.push("使い手のINTでも威力が伸びる");
    if (sp.agiScale) lines.push("使い手のAGIでも威力が伸びる");
    if (sp.vitScale) lines.push("使い手のVITでも威力が伸びる");
    if (sp.pieScale) lines.push("使い手のPIEでも威力が伸びる");
    if (sp.sureHit) lines.push("必中（回避・暗闇を無視。次の物理攻撃を無効化する守りは有効）");
    else if (sp.acc) lines.push(`命中力+${pct(sp.acc)}（命中力×〈1−回避力〉、最終20〜95%）`);
    if (sp.pierce) lines.push(`物理貫通 ${pct(sp.pierce)}（物理耐性による軽減を${pct(sp.pierce)}無視。防御は受け、物理無効は貫けない）`);
    if (sp.critBonus) lines.push(sp.critBonus >= 1 ? "必ず会心になる" : `会心率 +${pct(sp.critBonus)}`);
    if (sp.desperate) lines.push("自分のHPが減っているほど威力が上がる（最大2倍）");
    if (sp.steal) lines.push(`当てた敵から、所持金の${pct(sp.steal)}を盗む（1体につき1度・逃げても持ち帰る）`);
  }
  if (sp.execute) lines.push(`HP30%以下の敵には ×${sp.execute}（とどめ）`);
  if (sp.prey) lines.push(`${raceList(sp.prey.races)}に ×${sp.prey.mul}`);
  if (sp.kind === "atk" && sp.critBonus) lines.push(`呪文会心率 +${pct(sp.critBonus)}（会心は×1.5）`);
  // STR・VIT・AGI・INT・PIE は段 (buffstage.js) で示す: 「STR +2段 (×1.5)」
  const fx = (obj, enemy = false) => Object.entries(obj).map(([k, v]) => {
    const nm = (enemy && ENEMY_STAT_LABEL[k]) || ATTR_LABEL[k] || BUFF_NAME[k] || k.toUpperCase();
    if (!STAGED.has(k)) return `${nm} ×${v}`;
    const n = stageOf(v);
    return `${nm} ${stageLabel(n)}（×${stageMul(n)}）`;
  }).join("・");
  if (sp.buff) lines.push(`強化: ${fx(sp.buff, sp.target?.includes("enemy"))}`);
  if (sp.debuff) lines.push(`弱体: ${fx(sp.debuff, sp.target?.includes("enemy"))}`);
  if (sp.debuffAll) lines.push(`敵全体への弱体: ${fx(sp.debuffAll, true)}`);
  if (sp.vuln) { const nm = Object.keys(sp.vuln).map(ELEM_NAME).join("・"); lines.push(`${nm}耐性を下げる（${nm}の攻撃から受けるダメージ ×${(1 / Object.values(sp.vuln)[0]).toFixed(2)}）`); }
  if (sp.taunt) lines.push("挑発: 敵の単体攻撃が自分に向かいやすくなる");
  if (sp.shield) lines.push("仁王立ち: 味方への単体の物理攻撃を代わりに受ける");
  if (sp.stance === "counter") lines.push(`反撃の構え: 物理攻撃を受けると、必ず${sp.target === "all-ally" ? "それぞれの" : ""}攻撃力×${stanceMulOf(sp)}で反撃する`);
  if (sp.reflect) lines.push(`反射の陣: 敵の呪文・ブレスを受けると、必ず唱えた者のINT・PIEの高い方×${sp.reflect}の魔法の一撃で返す（魔法の抵抗値で減る）`);
  if (sp.charge) lines.push(`溜め: 次の物理攻撃・物理技の威力 ×${sp.charge}`);
  if (sp.regen) lines.push(`リジェネ: 毎ターン最大HPの${pct(sp.regen.pct)}を回復（${sp.regen.turns}ターン）`);
  if (sp.ward && sp.ward.breath) lines.push(`ブレス避け: 敵のブレスから受けるダメージ −${pct(sp.ward.breath)}（${sp.dur || 3}ターン）`);
  if (sp.ward && sp.ward.spell) lines.push(`呪文避け: 敵の全体呪文から受けるダメージ −${pct(sp.ward.spell)}（${sp.dur || 3}ターン）`);
  if (sp.float) lines.push(`迷宮で唱える: ${sp.float}階のあいだ隊が宙に浮き、足元の穴に落ちず、害のある床のダメージも受けない（戦闘では使わない）`);
  if (sp.sense === "stairs") lines.push("迷宮で唱える: この階の下り階段の在りかを示し、その周囲8マスのカードをめくる（戦闘では使わない）");
  else if (sp.sense) lines.push(`迷宮で唱える: この階のあいだ、まだめくっていないカードのうち、${{ enemy: "魔物の居場所を赤い光で（種類は分からない）", chest: "宝箱の在りかを青い光で" }[sp.sense]}示す（戦闘では使わない）`);
  // ---- 固有の追加効果 ----
  if (sp.hpCost) lines.push(`代償: 自分の最大HPの${pct(sp.hpCost)}を失う（HP1で踏みとどまる）`);
  if (sp.drain) lines.push(`与えたダメージの${pct(sp.drain)}だけ自分のHPを回復`);
  if (sp.mpDrain) lines.push(`与えたダメージの${pct(sp.mpDrain)}だけ自分のMPを回復（この技の消費MPの${sp.mpDrainCap || MP_DRAIN_CAP}倍まで）`);
  if (sp.poison) lines.push(`${pct(sp.poison.chance)}で${sp.poison.pct > 0.05 ? "猛毒" : "毒"}にする（毎ターン最大HPの${pct(sp.poison.pct)}${sp.poison.pct > 0.05 ? `・主には${pct(Math.max(0.05, sp.poison.pct * 0.5))}` : ""}）`);
  if (sp.para) lines.push(`${pct(sp.para)}で麻痺させる（手番を失いやすくなる・抵抗値で成功率が下がる）`);
  if (sp.seal) lines.push(`${pct(sp.seal.chance)}で特技を${sp.seal.turns}ターン封じる（ブレス・状態異常攻撃・回復・呼び出し・大技の溜めを使えなくなる・抵抗値で成功率が下がる）`);
  if (sp.strip) lines.push("敵にかかった強化を打ち消す");
  if (sp.instakill) lines.push(`${pct(sp.instakill.chance)}で即死させる${sp.instakill.races ? `（${raceList(sp.instakill.races)}のみ）` : ""}（主には効かない・抵抗値で成功率が下がる）`);
  if (sp.sleepChance) lines.push(`命中後 ${pct(sp.sleepChance)}で対象を眠らせる（抵抗値で成功率が下がる）`);
  if (sp.charm) lines.push(`${pct(sp.charm)}で魅了する（その敵が仲間に襲いかかる・傷を受けると解けやすい・主には効きにくい）`);
  if (sp.confuse) lines.push(`${pct(sp.confuse)}で混乱させる（敵味方を問わず殴る・ふらつく・抵抗値で成功率が下がる）`);
  if (sp.flinchChance) lines.push(`${pct(sp.flinchChance)}で怯ませる（主には効かない）`);
  if (sp.poison || sp.para || sp.seal || sp.instakill || sp.sleepChance || sp.charm || sp.confuse || sp.kind === "sleep") lines.push("※ 数字は付与力。付与力×（1−耐性）で成功率を求め、最後に最大95%。Lv差の補正なし。同じ行動・対象・異常は一回だけ判定。主の行動妨害は最大一手番、回復後は次の手番終了まで再付与無効");
  if (sp.plunder) lines.push("この技で倒した敵は、落とす金貨が2倍になる");
  if (sp.partyHeal) lines.push(`攻撃の後、味方全員のHPを ${sp.partyHeal} 回復（術者のPIEで伸びる）`);
  if (sp.bladeHeal) lines.push(`与えたダメージの${pct(sp.bladeHeal)}だけ味方全員のHPを回復（1人あたり最大HPの${pct(sp.healCap || 0.25)}まで）`);
  if (sp.cure || sp.kind === "cure") lines.push(`状態異常（${spellCureKinds(sp).map(k => k === "poison" ? "毒・猛毒" : AIL_LABEL[k]).join("・")}）を治す`);
  if (sp.purge) lines.push("かかっている弱体を解く");
  if (sp.grantEndure) lines.push("対象に「致死ダメージをHP1で耐える」を付与（1戦闘1回）");
  if (sp.grantBarrier) lines.push(`魔障壁${sp.grantBarrier}回分（ブレス・呪文の被ダメ半減）を付与`);
  if (sp.debuffAll) lines.push(`さらに敵全体を弱体: ${fx(sp.debuffAll)}`);
  // 効果の持続ターン数。STR〜PIE の段は強化と弱体で打ち消し合い、±3段で止まる (主・精鋭への弱体は −2段まで・持続 −1)
  if (sp.dur && (sp.buff || sp.debuff || sp.debuffAll || sp.vuln || sp.taunt || sp.shield || sp.stance || sp.reflect || sp.charge)) lines.push(`効果は ${sp.dur} ターン持続`);
  if ([sp.buff, sp.debuff, sp.debuffAll].some((o) => o && Object.keys(o).some((k) => STAGED.has(k)))) lines.push("能力の段は強化と弱体で打ち消し合い、±3段で止まる（主・強敵への弱体は −2段まで・持続 −1）");
  if (sp.strip) lines.push("敵の大技の予兆（溜め）も打ち消せる");
  const tier = soulTierRate(sp);
  // 割合で回復・蘇生する技 (フルヒール・リバイブ…) は量が変わらない (消費だけ増える)
  const tierScales = sp.kind !== "heal" || (healsHp(sp) && !sp.healPct);
  if (tier) lines.push(tierScales
    ? `魂の格: メイン魂のMPの${pct(tier)}が消費に加わり、そのぶん威力・効果が上がる（最大で×1.8に近づく。装備などで足したMPは含まない）`
    : `魂の格: メイン魂のMPの${pct(tier)}が消費に加わる（割合で回復・蘇生するので効果は変わらない。装備などで足したMPは含まない）`);
  return lines;
}

// 戦闘中の付与成功率。抵抗値が未判明なら上限の目安だけを出す。
// 単体の対象選択・全体技の一覧・長押しの詳細で、同じ戦闘ロジックを参照する。
export function spellStatusPreview(b, actor, sp, targets, compact = false) {
  if (!b || !actor || !spellAilments(sp).length || !targets.length) return null;
  const rows = targets.map(t => ({ t, rates: b.spellStatusChances(actor, sp, t, !!actor.gearMisc?.insight || enemyReveal(t).lore) }));
  const pct = rate => rate > 0 && rate < 0.001 ? "0.1未満" : String(Math.round(rate * 1000) / 10);
  const box = el("span", "sp-status-rates");
  const label = sp.kind === "phys" || sp.kind === "atk" ? "命中・生存後の付与（1回）" : "付与成功率";
  box.appendChild(el("span", "sp-status-label", label));
  if (compact) {
    for (const { kind, label } of spellAilments(sp)) {
      const rs = rows.flatMap(r => r.rates.filter(v => v.kind === kind));
      const lo = Math.min(...rs.map(v => v.rate)), hi = Math.max(...rs.map(v => v.rate));
      const value = lo === hi ? pct(lo) : `${pct(lo)}〜${pct(hi)}`;
      box.appendChild(el("span", "sp-status-line", `${label} ${value}%${rs.some(v => !v.known) ? "（目安・抵抗未判明）" : ""}`));
    }
  } else {
    for (const { t, rates } of rows) {
      const text = rates.map(v => `${v.label} ${v.known ? "" : "最大"}${pct(v.rate)}%${v.known ? "" : "（抵抗未判明）"}`).join("・");
      box.appendChild(el("span", "sp-status-line", `${enemyLabel(t)}：${text}`));
    }
  }
  return box;
}

// スキル名タップで開く詳細 (キットのシート)
export function showSkillPopup(key) {
  const sp = SPELLS[key];
  if (!sp) return null;
  const accent = SPELL_KIND_COLOR[sp.kind] || "#c9a227";
  const body = el("div", "ui-skill");
  const mpRow = el("div", "sk-mp", `消費 ${spellMpLabel(sp)}`);
  const tg = tagRow(spellTagKinds(sp));
  if (tg) mpRow.appendChild(tg);
  body.appendChild(mpRow);
  if (skillDescription(sp)) body.appendChild(el("div", "ig-desc", skillDescription(sp)));
  const box = el("div", "sk-lines");
  for (const ln of skillDetailLines(sp)) box.appendChild(el("div", "sk-line", ln));
  body.appendChild(box);
  const b = game.G?.state === "combat" ? game.G.battle : null;
  const actor = b?.current;
  if (actor?.side === "party") {
    const targets = sp.kind === "phys" && sp.target !== "all-enemy" && !sp.scatter ? b.attackableEnemies(actor) : b.livingEnemies();
    const rates = spellStatusPreview(b, actor, sp, targets);
    if (rates) body.appendChild(rates);
  }
  return sheet.open({
    kind: "info", banner: "技", accent, title: sp.name, titleColor: accent, body,
    className: "ui-skill-sheet",
    footer: [{ label: "閉じる", kind: "primary", onTap: (h) => h.close() }],
  });
}

// 加護 (パッシブ) の詳細。key+lv か、表示名 (「戦闘後回復Lv1」) で開く
export function showPassivePopup(keyOrName, lv) {
  let key = keyOrName;
  if (!PASSIVES[key]) {
    const hit = passiveByName(keyOrName);
    if (!hit) return null;
    key = hit.key; lv = hit.lv;
  }
  const def = PASSIVES[key];
  const cur = Math.max(1, Math.min(lv || 1, def.lv.length));
  const accent = "#c9a227";
  const body = el("div", "ui-skill");
  body.appendChild(el("div", "sk-mp", def.scope === "party" ? "常に働く力 ― 味方全員に効く" : "常に働く力 ― 自分にだけ効く"));
  body.appendChild(el("div", "ig-desc", def.lv[cur - 1] || ""));
  if (def.lv.length > 1) {
    const box = el("div", "sk-lines");
    def.lv.forEach((d, i) => box.appendChild(el("div", "sk-line" + (i + 1 === cur ? " on" : ""), `${i + 1 === cur ? "▶" : "・"} Lv${i + 1}: ${d}`)));
    body.appendChild(box);
  }
  return sheet.open({
    kind: "info", banner: "加護", accent, title: passiveName(key, cur), titleColor: accent, body,
    className: "ui-skill-sheet",
    footer: [{ label: "閉じる", kind: "primary", onTap: (h) => h.close() }],
  });
}

// 習得スキルのタップ可能なチップ列
export function skillChips(keys, label) {
  const row = el("div", "sk-chips");
  if (label) row.appendChild(el("span", "sk-chipl", label));
  for (const k of keys) {
    const sp = SPELLS[k];
    const c = el("span", "sk-chip", sp ? sp.name : k);
    if (sp) c.addEventListener("click", () => showSkillPopup(k));
    row.appendChild(c);
  }
  return row;
}

// ===== 状態異常の耐性・追加効果 (装備の aRes / onHit) =====
const AIL_SHORT = { poison: "毒", paralyze: "痺", sleep: "眠", charm: "魅", confuse: "乱", stone: "石" };
// 短い表記: 「魅30・乱30」 / 「痺15%」
export function ailResShort(r) { return r ? Object.entries(r).map(([k, v]) => `${AIL_SHORT[k] || k}${Math.round(v * 100)}%`).join("・") : "—"; }
export function onHitShort(o) { return o && o.length ? o.map((x) => `${AIL_LABEL[x.k] || x.k}${pct(x.chance)}${x.k === "poison" ? `（毎ターンHP${Math.round((x.pct || 0.05) * 1000) / 10}%）` : ""}`).join("・") : "—"; }
// 一覧の一行用 (statLines に添える)
function ailStatParts(it, { res = true } = {}) {
  const out = [];
  for (const o of onHitEffects(it.onHit)) out.push(`${AIL_LABEL[o.k]}付与力 ${pct(o.chance)}`);
  if (!res) return out;
  if (it.resists) out.push(Object.entries(it.resists).map(([k, v]) => `${RESIST_LABEL[k] || k}耐性${v}%`).join("・"));
  if (it.aRes) out.push(`耐性 ${Object.entries(it.aRes).map(([k, v]) => `${RESIST_LABEL[k] || k}${Math.round(v * 100)}%`).join("・")}`);
  if (it.bRes) out.push(`ブレス耐性 ${Math.round(it.bRes * 100)}%`);
  return out;
}
// くわしい行 (品の細目)
export function ailDetailLines(it) {
  const L = [];
  if (!it) return L;
  for (const o of onHitEffects(it.onHit)) {
    const tail = o.k === "poison" ? `（毎ターン最大HPの${Math.round((o.pct || 0.05) * 100)}%）` : o.k === "charm" ? "（敵が仲間を襲う）" : o.k === "confuse" ? "（敵が見境なく殴る）" : "";
    L.push(`追加付与力: ${pct(o.chance)}。物理命中後に${AIL_LABEL[o.k]}の付与を試みる${tail}（同じ種類の付与力は加算。耐性を掛けて最後に最大95%、一手につき一回判定）`);
  }
  if (it.resists) L.push(Object.entries(it.resists).map(([k, v]) => `${RESIST_LABEL[k] || k}耐性 +${v}%`).join("・"));
  if (it.aRes) L.push(`状態異常耐性: ${Object.entries(it.aRes).map(([k, v]) => `${RESIST_LABEL[k] || k} +${Math.round(v * 100)}%`).join("・")}（付与力を軽減、各95%まで）`);
  if (it.bRes) L.push(`ブレス耐性: 敵のブレスから受けるダメージ −${Math.round(it.bRes * 100)}%（装備どうしで足し合い、上限50%）`);
  return L;
}

// ===== 特殊効果 (eff = 戦闘効果 / mult = % 補正) =====
// items.js recalc が装備ごとに集め、combat.js (戦闘) と game.js (金貨・✦Soul) が読む。
// 表記は「何が・どれだけ・いつ」を数字で言い切る (combat.js の式と合わせる。式を変えたらここも)
const MULT_LABEL = { hp: "最大HP", mp: "最大MP", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
const MULT_ORDER = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
// 効果の名 (短い表記) と くわしい説明
export const EFF_INFO = {
  actFirst: { short: () => "一番手", line: () => "一番手: どのターンも、敵味方の誰よりも先に行動する" },
  multistrike: { short: (v) => `${Math.min(4, v)}連撃`, line: (v) => `連撃: 通常攻撃が一手で${Math.min(4, v)}回の攻撃になる（標的が倒れたら次の敵へ。技は1回のまま。連撃の装備は回数を足し合い、最大4回）` },
  lifesteal: { short: (v) => `吸血${pct(v)}`, line: (v) => `吸血: 物理攻撃（通常攻撃・物理技）で与えたダメージの${pct(v)}だけ、自分のHPを回復する` },
  guard: { short: (v) => `被ダメ−${pct(v)}`, line: (v) => `守り: 受けるダメージを常に${pct(v)}減らす（物理・呪文・ブレス。ほかの恒常軽減と合わせて90%まで）` },
  autoRevive: { short: (v) => `自動蘇生${pct(v)}`, line: (v) => `蘇生: 戦闘不能になった時、1戦闘に1回だけ最大HPの${pct(v)}で立ち上がる` },
  regen: { short: (v) => `再生${pct(v)}`, line: (v) => `再生: 2ターン目から毎ターン、最大HPの${pct(v)}だけHPを回復する` },
  counter: { short: (v) => `報復×${Math.round(v * 100) / 100}`, line: (v) => `報復: 敵の物理攻撃を受けるたび、攻撃力×${Math.round(v * 100) / 100}のダメージでやり返す (物理の抵抗値で減る)` },
  spellCostMul: { short: (v) => `消費MP−${pct(1 - v)}`, line: (v) => `節約: 技・呪文の消費MPが${pct(1 - v)}減る` },
  ailmentImmune: { short: () => "状態異常耐性95%", line: () => "状態異常耐性95%: 戦闘中の状態異常の付与率を95%軽減する（罠は無効）" },
  goldUp: { short: (v) => `金貨+${pct(v)}`, line: (v) => `金運: 迷宮で得る金貨が${pct(v)}増える（隊の中で一番高いものだけ効く）` },
  soulUp: { short: (v) => `✦Soul+${pct(v)}`, line: (v) => `魂導: 迷宮で得る✦Soulが${pct(v)}増える（隊の中で一番高いものだけ効く）` },
  disarmUp: { short: (v) => `解除+${pct(v)}`, line: (v) => `罠外し: この人業が宝箱・床の罠を外す時の解除率が${pct(v)}上がる（得意職でない者の頭打ちも越えて、最大95%。装飾どうしは強い方だけ）` },
  barrier: { short: (v) => `障壁${v}回`, line: (v) => `障壁: 戦闘のはじめに、受けるダメージを半分にする障壁を${v}回ぶん張る` },
};
// % 補正 (mult) を「最大HP・STR +20%」の形にまとめる (同じ率は一つに束ねる)
function multGroups(m) {
  const by = new Map();
  for (const k of MULT_ORDER) {
    const v = m && m[k];
    if (!v) continue;
    const key = Math.round(v * 100);
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(MULT_LABEL[k]);
  }
  return [...by].map(([v, ks]) => `${ks.join("・")} ${v > 0 ? "+" : ""}${v}%`);
}
// 一覧の一行用 (statLines に添える)
export function effStatParts(it) {
  const out = [];
  if (!it) return out;
  for (const g of multGroups(it.mult)) out.push(g);
  if (it.eff) for (const k in it.eff) {
    const v = it.eff[k];
    if (!v) continue;
    const f = EFF_INFO[k];
    out.push(f ? f.short(typeof v === "number" ? v : 1) : k);
  }
  return out;
}
// くわしい行 (品の細目・図鑑)
export function effDetailLines(it) {
  const L = [];
  if (!it) return L;
  const mg = multGroups(it.mult);
  if (mg.length) L.push(`能力の割合補正: ${mg.join("・")}（素の値と装備の合計に掛かる）`);
  if (it.eff) for (const k in it.eff) {
    const v = it.eff[k];
    if (!v) continue;
    const f = EFF_INFO[k];
    if (f) L.push(f.line(typeof v === "number" ? v : 1));
  }
  return L;
}
// 特殊効果の短い表記 (能力値を除く: 戦闘効果・%補正・補正/魔法・属性・状態異常)。無ければ ""
export function specialShort(it) {
  return specialParts(it).join("　");
}
// specialShort の一つ一つ (「2連撃」「吸血15%」…)。付け替えでの特殊効果の増減を比べるのに使う
// res: false = 抵抗値・ブレス耐性を除く (付け替えの比較では resistAmounts で種類ごとに差し引きする)
export function specialParts(it, { res = true } = {}) {
  if (!it || it.unidentified) return [];
  const parts = [...effStatParts(it), ...(it.bukon || []).map(b => `武魂 ${bukonText(b)}`)];
  // 無限迷宮の追加の能力・特性 (src/infaffix.js): 格の印と名で (くわしくは specialLines)
  for (const a of it.afxText || []) parts.push(`${a.tier === "x" ? "★" : a.tier === "r" ? "◆" : a.tier === "u" ? "◇" : "＋"}${a.name.replace(/の$/, "")}：${a.text}`);
  if (it.magic) parts.push("魔法属性");
  const ea = elemStatText("攻撃", it.eAtk), ed = elemStatText("防御", it.eDef);
  if (ea) parts.push(ea);
  if (ed) parts.push(ed);
  for (const x of ailStatParts(it, { res })) parts.push(x);
  return parts;
}
// 抵抗値 (resists と aRes は同じ物差しで足し合う) とブレス耐性 (breath, %) を種類ごとに
export function resistAmounts(it) {
  const m = {};
  if (!it || it.unidentified) return m;
  if (it.resists) for (const [k, v] of Object.entries(it.resists)) m[k] = (m[k] || 0) + v;
  if (it.aRes) for (const [k, v] of Object.entries(it.aRes)) m[k] = (m[k] || 0) + Math.round(v * 100);
  if (it.bRes) m.breath = (m.breath || 0) + Math.round(it.bRes * 100);
  return m;
}
// 付け替えでの抵抗値の差し引き (同じ種類の増減は合わせた結果だけ: 魅了 −19 と +22 → 魅了+3)
export function resistDeltaParts(before, after) {
  const sum = (list) => {
    const m = {};
    for (const it of list) for (const [k, v] of Object.entries(resistAmounts(it))) m[k] = (m[k] || 0) + v;
    return m;
  };
  const a = sum(before), b = sum(after);
  const out = [];
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (!d) continue;
    const n = `${d > 0 ? "+" : ""}${d}`;
    out.push({ d, text: k === "breath" ? `ブレス耐性${n}%` : `抵抗値 ${RESIST_LABEL[k] || k}${n}` });
  }
  return out;
}
// 特殊効果のくわしい行をまとめて (戦闘効果・武器の補正/魔法属性・属性・状態異常)。説明の文とは別に、数字で効果を言い切る
export function specialLines(it) {
  if (!it || it.unidentified) return [];
  const afx = (it.afxText || []).map((a) => `追加${a.tier === "x" ? "★" : a.tier === "r" ? "◆" : a.tier === "u" ? "◇" : ""}「${a.name.replace(/の$/, "")}」 ― ${a.text}`);
  return [...(it.bukon || []).map(b => `武魂 ${bukonText(b)}`), ...afx, ...effDetailLines(it), ...weaponTraitLines(it), ...elemDetailLines("攻撃", it.eAtk), ...elemDetailLines("防御", it.eDef), ...ailDetailLines(it)];
}

// 武器の能力補正 (scale) と魔法属性 (magic) のくわしい表記
export function weaponTraitLines(it) {
  const L = [];
  if (!it || it.slot !== "weapon") return L;
  const assigned = it.element || it.eAtk?.el || "none";
  L.push(`付与属性: ${assigned === "none" ? "無" : elemName(assigned)}（通常攻撃と、属性指定のない物理技に使う）`);
  if (it.magic) L.push("ダメージ種別: 魔法（通常攻撃の威力は攻撃力のまま、物理耐性ではなく魔法耐性で判定され、魔法弱点を突く。物理技は物理のまま）");
  return L;
}

// 武器の攻撃性能は特殊効果と分ける。装備者の能力・盾の持ち替えまで含めて計算する。
export function weaponPowerPreview(it, doll) {
  if (!it || it.slot !== "weapon" || it.unidentified || !doll || !doll.base || !doll.equip) return null;
  const equipped = doll.equip.weapon === it;
  if (!equipped && !canEquip(doll, it, { anyLv: true })) return null; // Lv が足りなくても、届いた時の攻撃力は見せる
  const trial = equipped ? { equip: doll.equip } : trialEquip(doll.equip, it, "weapon");
  if (!trial) return null;
  const stats = previewStats(doll, trial.equip);
  const before = attackPower(doll);
  return { stats, power: stats.power, before, delta: stats.power - before, equipped };
}

export function weaponPerformanceEl(it, doll = null) {
  if (!it || it.slot !== "weapon" || it.unidentified) return null;
  const result = weaponPowerPreview(it, doll);
  const box = el("section", "wp-performance");
  box.setAttribute("aria-label", "武器の攻撃性能");
  const head = el("div", "wp-performance-head");
  head.appendChild(el("span", "wp-performance-label", result ? (result.equipped ? "攻撃力" : "装備後の攻撃力") : "攻撃性能"));
  if (result) {
    const value = el("div", "wp-performance-value");
    value.appendChild(el("strong", "wp-performance-number", String(result.power)));
    if (!result.equipped) value.appendChild(el("span", "wp-performance-delta " + (result.delta > 0 ? "up" : result.delta < 0 ? "down" : ""), `${result.delta > 0 ? "+" : ""}${result.delta}（いま ${result.before}）`));
    head.appendChild(value);
  }
  box.appendChild(head);
  if (result) box.appendChild(el("div", "wp-performance-note", `${doll.name}の攻撃力 · 通常攻撃・物理技の基準`));
  const refs = el("div", "wp-performance-refs");
  refs.appendChild(el("span", "wp-performance-ref-label", "参照能力"));
  for (const [key, rate] of Object.entries(it.scale || { atk: 1 })) refs.appendChild(el("span", "wp-performance-ref", `${ATTR_LABEL[key]} ×${rate}`));
  box.appendChild(refs);
  if (result) {
    const details = el("details", "wp-performance-details");
    details.appendChild(el("summary", null, "計算の内訳"));
    details.appendChild(el("div", "wp-performance-formula", Object.entries(it.scale || { atk: 1 }).map(([key, rate]) => `${ATTR_LABEL[key]} ${result.stats[key]} × ${rate}`).join(" ＋ ") + ` = ${result.power}（四捨五入）`));
    box.appendChild(details);
  } else box.appendChild(el("div", "wp-performance-note", "攻撃力は装備する人業の能力で決まる。"));
  return box;
}

// ===== 品の表示 =====
export function statLines(it) {
  if (it && it.unidentified) return "未鑑定 — 鑑定が必要";
  const parts = [];
  const f = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`); };
  f("STR", it.atk); f("VIT", it.vit); f("AGI", it.agi);
  f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
  f("HP", it.hp); f("MP", it.mp);
  if (it.crit) parts.push(`会心 +${pct(it.crit)}`);
  if (it.critDamage) parts.push(`会心ダメージ +${pct(it.critDamage)}`);
  if (it.spellCrit) parts.push(`魔法会心 +${pct(it.spellCrit)}`);
  if (it.spellCritDamage) parts.push(`魔法会心ダメージ +${pct(it.spellCritDamage)}`);
  if (it.depth) parts.push(`無限迷宮 B${it.depth}F`);
  if (it.scale) parts.push(`参照 ${Object.keys(it.scale).map(k => ATTR_LABEL[k]).join("・")}`);
  if (it.magic) parts.push("魔法属性");
  const ea = elemStatText("攻撃", it.eAtk);
  const ed = elemStatText("防御", it.eDef);
  if (ea) parts.push(ea);
  if (ed) parts.push(ed);
  for (const x of ailStatParts(it)) parts.push(x);
  for (const x of effStatParts(it)) parts.push(x);
  if (it.use) for (const x of useLines(it, true)) parts.push(x);
  return parts.join("　");
}

// 品質の色分け (品質の札・目盛り): 90〜 = 極上 / 70〜 = 上 / 30〜 = 並 / それ未満 = 下
export function qualityTone(q) { return q == null ? "q-mid" : q >= 90 ? "q-top" : q >= 70 ? "q-hi" : q >= 30 ? "q-mid" : "q-lo"; }

// 装備品か (装備可能職業を表示する対象か)。use/misc/mat は対象外。
export const EQUIPPABLE_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
export function isEquippable(it) { return EQUIPPABLE_SLOTS.has(it.slot); }

// 候補 cand を p に装備した場合の最終ステータス増減を返す。
// items.js の recalc を仮の装備マップに流用するので、両手武器⇄盾の付け替え分も反映される。
// 数値ステ (atk…mp) のほか、会心率 (crit, %) と属性攻撃/防御 (elemAtk/elemDef) の変化も返す。
// slotKey = "shield" と片手武器を渡すと左手 (二刀流) に持たせた場合
export function equipPreviewDelta(p, cand, slotKey = null) {
  const key = slotKey === "shield" && cand.slot === "weapon" ? "shield" : slotKeyFor(cand, p);
  if (!key) return null;
  const eq = { ...p.equip };
  // equip() と同じ付け替え規則: 両手武器は盾 (左手) を、盾・左手の武器は両手武器を外す
  if (cand.slot === "weapon" && cand.twoHanded) eq.shield = null;
  if (key === "shield" && eq.weapon && eq.weapon.twoHanded) eq.weapon = null;
  eq[key] = cand;
  const fake = { base: p.base, equip: eq, hp: p.hp, mp: p.mp, dualWield: p.dualWield || 0 };
  recalc(fake);
  const offW = (e) => (e.shield && e.shield.slot === "weapon" ? e.shield : null);
  const wChanged = (eq.weapon || null) !== (p.equip.weapon || null) || offW(eq) !== offW(p.equip);
  return {
    combat: {from:equipmentCombatState({...p,primaryPower:attackPower(p),power:fightPower(p)},p),to:equipmentCombatState({...fake,primaryPower:attackPower(fake),power:fightPower(fake)},p)},
    power: fightPower(fake) - fightPower(p), // 攻撃力 (参照能力 × 武器の係数。二刀流なら左手も DUAL_VALUE_SHARE で)
    weapon: wChanged,
    // 持ち方の付け替え (両手武器に持ち替えて盾が外れる / 盾 ⇄ 左手の武器)。武器の良し悪しを攻撃力だけでなく盾の能力とも比べる
    handSwap: wChanged && (eq.shield || null) !== (p.equip.shield || null),
    atk: fake.atk - p.atk,
    vit: fake.vit - p.vit,
    agi: fake.agi - p.agi,
    int: fake.int - p.int,
    pie: fake.pie - p.pie,
    luk: fake.luk - p.luk,
    hp: fake.maxhp - p.maxhp,
    mp: fake.maxmp - p.maxmp,
    crit: Math.round(((fake.critBonus || 0) - (p.critBonus || 0)) * 10000) / 100,
    critDamage: Math.round(((fake.critDamageBonus || 0) - (p.critDamageBonus || 0)) * 10000) / 100,
    spellCrit: Math.round(((fake.spellCritBonus || 0) - (p.spellCritBonus || 0)) * 10000) / 100,
    spellCritDamage: Math.round(((fake.spellCritDamageBonus || 0) - (p.spellCritDamageBonus || 0)) * 10000) / 100,
    elemAtk: { from: p.elemAtk, to: fake.elemAtk },
    elemDef: { from: p.elemDef, to: fake.elemDef },
    physResist: (fake.physResist || 0) - (p.physResist || 0),
    magResist: (fake.magResist || 0) - (p.magResist || 0),
    ailRes: { from: p.ailRes || null, to: fake.ailRes || null },
    breathRes: Math.round(((fake.breathRes || 0) - (p.breathRes || 0)) * 10000) / 100,
    onHit: { from: p.onHit || null, to: fake.onHit || null },
    eff: { from: p.eff || null, to: fake.eff || null },
    traits: { from: equipmentTraitTexts(p.equip), to: equipmentTraitTexts(eq) },
    weaponMode: { from: p.equip.weapon || null, to: eq.weapon || null },
    offhandMode: { from: offW(p.equip), to: offW(eq) },
    abs: { power: fightPower(fake), maxhp: fake.maxhp || 0, maxmp: fake.maxmp || 0 },
  };
}

// 数値以外の付け替え結果。ほかの部位も含めた集計値で比べる。
export function equipEffectDeltaParts(delta) {
  if (!delta) return [];
  const out = [];
  for (const [label, ch] of [["属攻", delta.elemAtk], ["属防", delta.elemDef]]) {
    if (ch && !elemStatEq(ch.from, ch.to)) out.push({ text: `${label} ${elemStatShort(ch.from)}→${elemStatShort(ch.to)}`, d: 0 });
  }
  for (const [label, ch] of [["通常攻撃", delta.weaponMode], ["左手", delta.offhandMode]]) {
    if (!ch) continue;
    if (!!ch.from?.magic !== !!ch.to?.magic) out.push({ text: `${label} ${ch.from?.magic ? "魔法" : "物理"}→${ch.to?.magic ? "魔法" : "物理"}`, d: 0 });
    if (weaponRange(ch.from) !== weaponRange(ch.to)) out.push({ text: `${label}の射程 ${RANGE_LABEL[weaponRange(ch.from)]}→${RANGE_LABEL[weaponRange(ch.to)]}`, d: 0 });
  }
  const ar = delta.ailRes;
  if (ar) for (const k of new Set([...Object.keys(ar.from || {}), ...Object.keys(ar.to || {})])) {
    const v = Math.round((((ar.to || {})[k] || 0) - ((ar.from || {})[k] || 0)) * 1000) / 10;
    if (v) out.push({ text: `${RESIST_LABEL[k] || AIL_LABEL[k] || k}抵抗値${v > 0 ? "+" : ""}${v}`, d: v });
  }
  if (delta.onHit && onHitShort(delta.onHit.from) !== onHitShort(delta.onHit.to)) out.push({ text: `追加効果 ${onHitShort(delta.onHit.from)}→${onHitShort(delta.onHit.to)}`, d: 0 });
  const eff = delta.eff;
  if (eff) for (const k of new Set([...Object.keys(eff.from || {}), ...Object.keys(eff.to || {})])) {
    const a = (eff.from || {})[k] || 0, b = (eff.to || {})[k] || 0;
    if (a === b) continue;
    const info = EFF_INFO[k], text = v => v ? (info ? info.short(typeof v === "number" ? v : 1) : k) : "なし";
    if (text(a) === text(b)) continue;
    out.push({ text: `${text(a)}→${text(b)}`, d: k === "spellCostMul" ? (a || 1) - (b || 1) : b - a });
  }
  if (delta.traits) {
    const counts = list => { const m = new Map(); for (const text of list) m.set(text, (m.get(text) || 0) + 1); return m; };
    const a = counts(delta.traits.from), b = counts(delta.traits.to);
    for (const text of new Set([...a.keys(), ...b.keys()])) {
      const diff = (b.get(text) || 0) - (a.get(text) || 0);
      if (diff) out.push({ text: `${diff > 0 ? "得る" : "失う"} ${text}${Math.abs(diff) > 1 ? ` ×${Math.abs(diff)}` : ""}`, d: diff });
    }
  }
  return out;
}
export function equipEffectDeltaEl(delta) {
  const row = el("span", "ui-delta");
  for (const { text, d } of equipEffectDeltaParts(delta)) row.appendChild(el("span", d > 0 ? "up" : d < 0 ? "dn" : "elem", text));
  return row;
}
// 装備候補の増減。会心4種・抵抗値・耐性・追加効果・戦闘効果を共通の内容で示す。
export function equipCompareEl(p, cand) {
  const delta = equipPreviewDelta(p, cand), row = el("span", "eq-cd");
  row.appendChild(el("span", "eq-cd-lab", "装備すると"));
  const effects = equipEffectDeltaParts(delta);
  const stats = statDelta(delta || {}, { compact: false });
  if (effects.length) stats.querySelector(".eq")?.remove();
  row.appendChild(stats);
  row.appendChild(equipEffectDeltaEl(delta));
  return row;
}

// 装備の良し悪しの目安 (増減 → 1つの点数)。最適装備・装備候補の並び・最良の装備者の判定に使う。
// 重みは職業の能力の傾き (SOUL_CLASSES の stat) から作る: その職が最も伸ばす能力を 1.25、
// 伸ばさない能力を 0.35 とし、間は比例。HP は 0.25、MP は術を使う職だけ 0.15。属性の段は1段=4点。
const GEAR_W_CACHE = {};
export function gearWeights(doll) {
  const key = doll && (doll.jobKey || doll.clsKey);
  if (key && GEAR_W_CACHE[key]) return GEAR_W_CACHE[key];
  const st = key && SOUL_CLASSES[key] && SOUL_CLASSES[key].stat;
  let W;
  if (!st) {
    W = { atk: 1, vit: 1, agi: 0.8, int: 0.6, pie: 0.6, luk: 0.4, hp: 0.2, mp: 0.15 };
    if (doll) {
      const a = doll.atk || 0;
      if ((doll.int || 0) > a) { W.int = 1.2; W.atk = 0.4; }
      if ((doll.pie || 0) > a) { W.pie = 1.2; W.atk = Math.min(W.atk, 0.5); }
    }
    return W;
  }
  const ks = ["atk", "vit", "agi", "int", "pie", "luk"];
  const mx = Math.max(...ks.map((k) => st[k] || 0)) || 1;
  W = {};
  // 最低の重みは 0.15 (2026-10: 0.35 だと使わない能力も重く数え、騎士・戦士が神理の法衣 (VIT19・PIE37) を
  // 竜王の鎧 (VIT39) より良いとして法衣を着ていた)。一番伸びる能力の重みは 1.25 のまま
  for (const k of ks) W[k] = Math.round((0.15 + 1.1 * ((st[k] || 0) / mx)) * 100) / 100;
  W.hp = 0.25;
  W.mp = (st.mp || 0) >= 1.5 ? 0.15 : 0.03;
  return (GEAR_W_CACHE[key] = W);
}
// STR の代わりに攻撃力 (参照能力 × 武器の係数) の増減を数える。武器の付け替えは攻撃力の高い順が最優先
// (攻撃力1 = WEAPON_POWER_W 点。ほかの能力は攻撃力が同じ時の決め手になる)。
// ただし盾が付け外しされる持ち替え (片手+盾 ⇄ 両手武器、handSwap) は、攻撃力と盾の能力を同じ物差しで比べる:
// 全体を「攻撃力1 = WEAPON_POWER_W 点」に引き伸ばす (盾の VIT などはその職の重み ÷ STR の重み で攻撃力に換算)
// 攻撃力を最優先にするのは、打撃で戦う職だけ (weaponShare)。術者 (INT・PIE が STR より伸びる職) は
// 技の大半が INT・PIE で伸びるので、武器も能力の重みどおりに比べる (短剣の攻撃力 +12 で INT −22 を勧めない)
const WEAPON_POWER_W = 50;
// 武器の攻撃力を最優先する度合い 0〜1: STR・AGIの重みとINT・PIEを比較（弓・短剣も物理職として扱う）
// (聖騎士・審問官のような打撃と祈りの両刀は半ばほど)
export function weaponShare(W) {
  const mag = Math.max(W.int || 0, W.pie || 0);
  if (!mag) return 1;
  return Math.max(0, Math.min(1, (Math.max(W.atk || 0, W.agi || 0) / mag - 0.85) / 0.15));
}
// 戦闘効果 (eff) の値打ち。数字の能力には出ない効果を、この人業の攻撃力・最大HP/MP で測る (2026-10 ユーザーの指示:
// 最適装備が連撃・吸血などの特殊効果を見ずに、能力値だけで付け替えていた)。
//   offense = 攻撃力に換算した増減 (連撃・報復・先手。打撃で戦う度合い share を掛ける) → 攻撃力と同じ物差しで数える
//   points  = それ以外 (守り・再生・蘇生・障壁・吸血 = 最大HPの換算 × HPの重み / 状態異常無効・節約・金運・魂導)
// 効果の式は combat.js (連撃 = 通常攻撃の回数 最大4・2未満は効かない) と itemview の EFF_INFO に合わせる
const EFF_K = {
  strike: 0.6,   // 連撃: 1回増えるごとに攻撃力 ×0.6 ぶん (技を使う手番もあるので1回分よりは低く)
  counter: 0.25, // 報復: 攻撃力 × 率 × 0.25 (殴られた時だけ)
  first: 0.08,   // 先手: 攻撃力 ×0.08
  steal: 1.5,    // 吸血: 攻撃力 × 率 × 1.5 HP (1戦で吸える量の目安)
  guard: 2,      // 守り: 最大HP × g/(1−g) × 2 HP (物理・呪文・ブレスのすべて)
  regen: 3,      // 再生: 最大HP × 率 × 3 HP (2ターン目から毎ターン)
  revive: 0.2,   // 蘇生: 最大HP × (0.2 + 率) HP (倒れても1度立つ)
  barrier: 0.2,  // 障壁: 1回ごとに最大HP × 0.2 HP
  immune: 50,    // 状態異常無効: 50点 (状態異常耐性 全6種100% = 60点に即死も加わる物差し)
  thrift: 120,   // 節約: (1/倍率 − 1) × 120 点 × 術を使う度合い
  fortune: 40,   // 金運・魂導: 率 × 40 点 (隊で一番高いものだけ効くので控えめ)
  disarm: 40,    // 罠外し: 率 × 40 点 (罠を外す役の1人にしか要らないので控えめ)
};
const effStrikes = (e) => (e && e.multistrike > 1 ? Math.min(4, e.multistrike) : 1);
export function effScore(doll, delta, W = gearWeights(doll)) {
  const ch = delta && delta.eff;
  if (!ch || (!ch.from && !ch.to)) return { offense: 0, points: 0 };
  const share = Math.max(0.15, weaponShare(W));
  const abs = delta.abs || {};
  const powTo = abs.power || 0, powFrom = powTo - (delta.power || 0);
  const hp = abs.maxhp || 0;
  const off = (e, pw) => (e ? pw * ((effStrikes(e) - 1) * EFF_K.strike + (e.counter || 0) * EFF_K.counter + (e.actFirst ? EFF_K.first : 0)) * share : 0);
  const hpEq = (e, pw) => {
    if (!e) return 0;
    const g = delta.combat?.from && delta.combat?.to ? 0 : Math.min(0.9, e.guard || 0);
    return (e.lifesteal || 0) * pw * EFF_K.steal * share
      + hp * (g / (1 - g)) * EFF_K.guard
      + hp * (e.regen || 0) * EFF_K.regen
      + (e.autoRevive ? hp * (EFF_K.revive + e.autoRevive) : 0)
      + hp * EFF_K.barrier * (e.barrier || 0);
  };
  const flat = (e) => {
    if (!e) return 0;
    const m = e.spellCostMul > 0 && e.spellCostMul < 1 ? e.spellCostMul : 1;
    return (e.ailmentImmune && !delta.combat?.from ? EFF_K.immune : 0)
      + (1 / m - 1) * EFF_K.thrift * Math.max(0.3, 1 - weaponShare(W))
      + ((e.goldUp || 0) + (e.soulUp || 0)) * EFF_K.fortune
      + (e.disarmUp || 0) * EFF_K.disarm;
  };
  const hpW = W.hp || 0.25;
  return {
    offense: off(ch.to, powTo) - off(ch.from, powFrom),
    points: (hpEq(ch.to, powTo) - hpEq(ch.from, powFrom)) * hpW + flat(ch.to) - flat(ch.from),
  };
}
export function gearScore(doll, delta) {
  if (!delta) return 0;
  const W = gearWeights(doll);
  const fx = effScore(doll, delta, W);
  const px = equipmentPercentScore(delta.combat?.from,delta.combat?.to,{weaponShare:weaponShare(W),hpWeight:W.hp || .25,magicWeight:Math.max(W.int || 0,W.pie || 0)});
  // 攻撃に効く戦闘効果は攻撃力の増減に足して、武器の付け替えでも同じ物差しで比べる
  const power = delta.power != null ? delta.power + fx.offense + px.offense : null;
  let s = 0;
  for (const k in W) s += (k === "atk" && power != null ? power : (delta[k] || 0)) * W[k];
  if (power == null) s += (fx.offense+px.offense) * (W.atk || 1);
  s += fx.points + px.points;
  if (delta.weapon) {
    const f = weaponShare(W);
    if (delta.handSwap) s = s * (1 + f * (WEAPON_POWER_W / Math.max(0.35, W.atk || 1) - 1));
    else s += (power || 0) * WEAPON_POWER_W * f;
  }
  if (!delta.combat?.from || !delta.combat?.to) {
    s += ((delta.crit || 0) + (delta.spellCrit || 0)) * 0.5;
    s += ((delta.critDamage || 0) + (delta.spellCritDamage || 0)) * 0.1;
    const lv = (e) => Object.values(elementValues(e, e?.kind)).reduce((n, v) => n + v / (e?.kind === "defense" ? 100 : 50), 0);
    for (const ch of [delta.elemAtk, delta.elemDef]) if (ch) s += (lv(ch.to) - lv(ch.from)) * 4;
    // 状態異常耐性 (合計10%ごとに1点) / 追加効果 (確率10%ごとに1.5点)
    const resSum = (r) => (r ? Object.values(r).reduce((a, v) => a + v, 0) : 0);
    const ohSum = (o) => (o ? o.reduce((a, x) => a + (x.chance || 0), 0) : 0);
    if (delta.ailRes) s += (resSum(delta.ailRes.to) - resSum(delta.ailRes.from)) * 10;
    s += ((delta.physResist || 0) + (delta.magResist || 0)) * 0.1;
    if (delta.onHit) s += (ohSum(delta.onHit.to) - ohSum(delta.onHit.from)) * 15;
    // ブレス耐性 (10%ごとに1点 = 状態異常耐性と同じ)。以前は10%ごとに8点で、ブレス耐性つきの小盾が
    // AGI −4 の付け替えでも「伸び」と見なされ、最適装備が弱い品を選んでいた
    if (delta.breathRes) s += delta.breathRes * 0.1;
  }
  return Math.round(s * 10) / 10;
}

// 部位カテゴリ表記
export const CAT_LABEL = { weapon: "武器", shield: "盾", body: "防具", head: "頭防具", hands: "小手", feet: "足防具", acc: "装飾品", use: "消耗品", misc: "収集品", mat: "貴重品" };
// アイテムの分類表記 (武器はサブカテゴリつき: 「武器（長剣）」)
export function itemCatText(it) {
  if (it.slot === "weapon" && it.cat) return `武器（${WEAPON_CAT_LABEL[it.cat] || "その他"}・${HAND_LABEL[handOf(it)]}）`;
  if (it.slot === "shield") return `盾（${SHIELD_KIND_LABEL[shieldKind(it)] || "盾"}）`;
  return CAT_LABEL[it.slot] || "";
}

// 図鑑・所持品・装備選択で共通の品の詳細。操作と対象選択は呼び出し側が添える。
export function itemDetailEl(it, { target = null, catalog = false, stock = false, meta = null, first = false } = {}) {
  const body = el("div", "item-detail");
  const rk = rarityKey(it);
  const top = el("div", "wpc-is-top");
  const art = el("div", "wpc-is-art" + (rk ? " rar-" + rk : ""));
  art.appendChild(spriteCanvas(it, 7));
  top.appendChild(art);
  const hd = el("div", "wpc-is-hd");
  hd.appendChild(game.itemNameEl ? game.itemNameEl("div", "wpc-is-name", it) : el("div", "wpc-is-name", itemName(it)));
  const grade = el("div", "wpc-is-grade");
  if (first && !it.unidentified) grade.appendChild(el("span", "first-get wpc-is-first", "初ゲット！"));
  if (rk) grade.appendChild(el("span", "wpc-rtag rar-" + rk, RARITIES[rk].label));
  if (it.unidentified) grade.appendChild(el("span", "wpc-is-unid", it.idHardFail ? "未鑑定 ・ 失敗済み" : "未鑑定"));
  else {
    grade.appendChild(el("span", "wpc-is-cat", itemCatText(it)));
    if (it.cursed) grade.appendChild(el("span", "wpc-is-curse", "呪い"));
    if (hasQuality(it)) {
      const q = stock || catalog ? QUALITY_MID : qualityOf(it);
      grade.appendChild(el("span", "rf-q " + qualityTone(q), stock || catalog ? `並品 ・ 品質${q}` : `品質 ${q}`));
    }
  }
  hd.appendChild(grade);
  if (!it.unidentified) {
    const st = statLines(it);
    if (st) hd.appendChild(setText(el("div", "wpc-is-stat"), st));
  }
  if (meta) hd.appendChild(meta);
  top.appendChild(hd);
  body.appendChild(top);
  if (!catalog && !stock && it.formationNames?.length) body.appendChild(el("p", "pt-note", `保存先：${it.formationNames.join("、")}。売却・破棄不可。持ち物袋の枠を使いません。`));
  if (it.unidentified) {
    for (const ln of detailLines(it).slice(1)) body.appendChild(el("div", "wpc-is-note", ln));
    return body;
  }
  const det = [];
  if (isEquippable(it)) det.push(equipClassText(it), equipLvText(it));
  if (it.slot === "weapon") det.push(`射程: ${RANGE_LABEL[weaponRange(it)]}`, handLine(it));
  if (it.align) det.push(`${it.align}属性`);
  if (it.slot === "misc") det.push("王宮の宝物庫に奉納できる。商会では売れる。");
  if (it.use) det.push(...useLines(it));
  if (catalog && hasQuality(it)) det.push(`手に入れるたびに品質0〜100が決まり、性能が±${Math.round(QUALITY_SPREAD * 100)}%変わる。ここの数値は並品（品質50）。`);
  if (det.length) {
    const lines = el("div", "wpc-is-lines");
    for (const ln of det) lines.appendChild(setText(el("div"), ln));
    body.appendChild(lines);
  }
  if (it.desc) body.appendChild(el("div", "wpc-is-lore", it.desc));
  const performance = weaponPerformanceEl(it, target);
  if (performance) body.appendChild(performance);
  const fx = specialLines(it);
  if (fx.length) {
    const box = el("div", "wpc-is-fx");
    box.appendChild(el("div", "wpc-is-fxh", "特殊効果"));
    for (const ln of fx) box.appendChild(setText(el("div", "wpc-is-fxl"), ln));
    body.appendChild(box);
  }
  return body;
}

// ウィザードリィ風の情報テキスト行
export function detailLines(it) {
  if (it && it.unidentified) {
    if (it.idHardFail) {
      return ["？ 未鑑定の品 (鑑定失敗済み)", "鑑定するまで正体も性能もわからない。", "技での鑑定に失敗したため、もう商会 (有料) でしか鑑定できない。"];
    }
    return ["？ 未鑑定の品", "鑑定するまで正体も性能もわからない。", "商会 (有料) か、鑑定の心得がある仲間が必要だ。"];
  }
  const L = [];
  L.push(itemCatText(it));
  if (it.slot === "use") {
    if (it.use) for (const x of useLines(it)) L.push(x);
  } else if (it.slot === "misc") {
    L.push("商会で売って金にする戦利品");
  } else if (it.slot === "mat") {
    L.push("用途は街で見つかるかもしれない");
  } else {
    // 射程は隊列システムで実際に使われるので表示する。旧 Wizardry 風の
    // 命中/ダイス/攻撃回数 は戦闘で使われないため表示しない
    if (it.slot === "weapon") L.push(`射程: ${RANGE_LABEL[weaponRange(it)]}`);
    if (it.slot === "weapon") L.push(handLine(it));
    // 六大ステ (STR/VIT/AGI/INT/PIE/LUK) への補正
    const mod = [];
    const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
    f("STR", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
    if (it.crit) mod.push(`会心+${pct(it.crit)}`);
    if (it.critDamage) mod.push(`会心ダメージ+${pct(it.critDamage)}`);
    if (it.spellCrit) mod.push(`魔法会心+${pct(it.spellCrit)}`);
    if (it.spellCritDamage) mod.push(`魔法会心ダメージ+${pct(it.spellCritDamage)}`);
    if (it.depth) L.push(`無限迷宮 B${it.depth}Fで得た品`);
    if (mod.length) L.push(mod.join(" / "));
    for (const ln of effDetailLines(it)) L.push(ln);
    for (const ln of weaponTraitLines(it)) L.push(ln);
  }
  // 属性攻撃/属性防御 (1行ずつのくわしい表記)
  for (const ln of elemDetailLines("攻撃", it.eAtk)) L.push(ln);
  for (const ln of elemDetailLines("防御", it.eDef)) L.push(ln);
  for (const ln of ailDetailLines(it)) L.push(ln);
  if (isEquippable(it)) { L.push(equipClassText(it)); L.push(equipLvText(it)); }
  if (it.align) L.push(`${it.align}属性。`);
  return L;
}

function clsLabel(k) { return (SOUL_CLASSES[k] || {}).label || k; }

// 武器の持ち方の説明 (片手 = 盾と併せて持てる / 両手 = 盾の欄をふさぐ代わりに能力が高い)
export function handLine(it) {
  return it.twoHanded ? "両手持ち: 盾は持てないが、能力が高い" : "片手持ち: 盾を併せて持てる";
}
// 盾のジャンルを持てる職のおおまかな括り
const SHIELD_KIND_WHO = {
  kite: "重装の盾の職", round: "重装の盾の職", buckler: "軽装の職・盾の職",
  orb: "攻めの術者", tome: "癒し手・祈りの職",
};

// 装備可能条件のバッジ表示 (36職対応)。装備制限は実際の対応職をそのまま表示する
// (未発見職を「？」で伏せる旧仕様は廃止。所持・装備画面で条件が読めないと不便なため)。
export function equipClassText(it) {
  if (it.forJob) {
    const lbl = (SOUL_CLASSES[it.forJob] || {}).label || it.forJob;
    return `〈${lbl}〉専用`;
  }
  if (it.classes) {
    return "装備可: " + it.classes.map((k) => clsLabel(k)).join("・");
  }
  if (it.slot === "weapon") return `武器適性: ${WEAPON_CAT_LABEL[it.cat] || it.cat}`;
  if (it.slot === "shield") {
    const k = shieldKind(it);
    return `適性: ${SHIELD_KIND_LABEL[k] || "盾"}を持てる職 (${SHIELD_KIND_WHO[k] || "盾の職"})`;
  }
  const w = it.weight;
  if (w === "heavy") return "装備: 重装職";
  if (w === "cloth") return "装備: 布装職";
  if (w === "light") return "装備: 軽装以上";
  return "装備可: 全職";
}

// 装備できるLv (メイン魂の Lv がこれに届けば付けられる。src/equiplevel.js)
export function equipLvText(it) {
  return `装備条件：メイン魂Lv${equipLevelOf(it)}以上`;
}

// 隊メンバーの装備可否チップ (○/×)。party を省くと現在の編成 (G.party)
// 頭文字だけだと同名頭文字を判別できないため、キャラアイコン + フルネーム + ○/× で示す。
export function equipPartyChips(it, party = (game.G && game.G.party) || []) {
  const row = el("div", "eq-pchips");
  for (const m of party) {
    const ok = canEquip(m, it);
    const c = el("span", "eq-pchip " + (ok ? "ok" : "ng"));
    const ic = el("span", "eq-pchip-ic");
    ic.appendChild(m.isDoll ? crispCanvas(dollBust(m), 24) : spriteCanvas(HERO, 2));
    c.appendChild(ic);
    c.appendChild(el("span", "eq-pchip-nm", m.name));
    c.appendChild(el("span", "eq-pchip-mk", ok ? "○" : "×"));
    row.appendChild(c);
  }
  return row;
}

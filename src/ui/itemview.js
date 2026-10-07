import { RESIST_LABEL } from "../resistance.js";
// ===== 品・スキルの表示まわり (game.js から移設した純粋な表示ヘルパ) =====
// 状態を変えない。G が要るものは引数で受け取るか、ctx の game.G を読む。
// 呼び出し側 (game.js・各パッケージ) は同じ名前のまま import して使う。

import { game } from "./ctx.js";
import { el, sheet } from "./kit.js";
import { ELEMENTS, elemBeats, RACE_LABEL, unknownLabel, UNK_OPEN, UNK_CLOSE } from "../dungeons/index.js";
import { SPELLS, spellMpLabel, spellCureKinds } from "../combat.js";
import { STAGED, stageOf, stageMul, stageLabel } from "../buffstage.js";
import { ATTR_LABEL, SOUL_CLASSES, dollBust, PASSIVES, passiveName, passiveByName } from "../souls.js";
import { WEAPON_CAT_LABEL, SHIELD_KIND_LABEL, HAND_LABEL, handOf, shieldKind, RANGE_LABEL, weaponRange, slotKeyFor, recalc, canEquip, AIL_LABEL, attackPower, scaleText, useLines } from "../items.js";
import { HERO, spriteCanvas, crispCanvas } from "../sprites.js";

// 魂のステータス寄与を「HP+7 ATK+2.4 …」形式で列挙 (0は省略)
export function soulStatText(st, sep = " ") {
  const keys = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
  const lbl = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  return keys.filter((k) => st[k]).map((k) => `${lbl[k]}+${st[k]}`).join(sep);
}

// ===== 属性攻撃/属性防御の表示ヘルパ =====
// 各属性の [強い相手, 弱い相手] (表示用)。光↔闇は相互有利で弱点なし
export const ELEM_ADV = {
  fire: ["wind", "water"], wind: ["earth", "fire"], earth: ["water", "wind"], water: ["fire", "earth"],
  light: ["dark", null], dark: ["light", null],
};
export function elemName(el) { return (ELEMENTS[el] || ELEMENTS.none).label; }
// "火属性攻撃 +1" のような短い表記 (Lv1=+1, Lv2(◎)=+2)。e = {el, lv}
export function elemStatText(kind, e) {
  if (!e || !e.el) return null;
  return `${elemName(e.el)}属性${kind}+${Math.min(2, e.lv)}`;
}
// 相性のくわしい説明行 (複数行)。
// 防御: 「水属性防御 +1」「火属性から受けるダメージ -50%」(不利属性のダメージ増加は表示・適用しない)
// 攻撃: 「水属性攻撃 +1」「火属性に与えるダメージ +50%」「土属性に与えるダメージ -50%」
export function elemDetailLines(kind, e) {
  if (!e || !e.el || !ELEM_ADV[e.el]) return [];
  const [adv, weak] = ELEM_ADV[e.el];
  const pct = e.lv >= 2 ? 100 : 50;
  const lines = [`${elemName(e.el)}属性${kind}　+${Math.min(2, e.lv)}`];
  if (kind === "攻撃") {
    lines.push(`${elemName(adv)}属性に与えるダメージ　+${pct}%`);
    if (weak) lines.push(`${elemName(weak)}属性に与えるダメージ　-${pct}%`);
  } else {
    lines.push(`${elemName(adv)}属性から受けるダメージ　-${pct / 2}%`); // schema.js elemDmgMult: 防御は Lv1 25% / Lv2 50%
    // 不利属性からのダメージ増加は適用しない (軽減のみ)
  }
  return lines;
}
// ステータス画面用の色付きチップ ("火◯" / "—")
export function elemStatChip(e) {
  if (!e || !e.el) return "<b>—</b>";
  const d = ELEMENTS[e.el] || ELEMENTS.none;
  return `<b style="color:${d.color}">${d.label}${e.lv >= 2 ? "◎" : "◯"}</b>`;
}
// 属性攻撃/防御 (装備由来の {el, lv}) が等価か
export function elemStatEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.el === b.el && a.lv === b.lv;
}
export function elemStatShort(e) { return e && e.el ? `${elemName(e.el)}${e.lv >= 2 ? "◎" : "◯"}` : "—"; }

// ===== スキル詳細 =====
export const SPELL_KIND_LABEL = { atk: "攻撃呪文", heal: "回復呪文", phys: "物理技", buff: "支援", debuff: "弱体", sleep: "状態異常", cure: "治療", mana: "魔力譲渡", escape: "逃走", field: "迷宮の術" };
// 能力の倍率キーの呼び名 (ATK/VIT… 以外の効果)
export const BUFF_NAME = { hit: "命中率", int: "INT", pie: "PIE", omen: "大技の予兆", taunt: "挑発", shield: "仁王立ち", ctr: "反撃の構え", charge: "溜め", regen: "リジェネ", seal: "特技封じ", wardB: "ブレス避け", wardS: "呪文避け",
  r_fire: "火耐性", r_water: "水耐性", r_wind: "風耐性", r_earth: "土耐性", r_light: "光耐性", r_dark: "闇耐性", r_all: "全属性耐性" };
export const SPELL_TARGET_LABEL = { enemy: "敵単体", "all-enemy": "敵全体", ally: "味方単体", "all-ally": "味方全体", self: "自分" };
export const SPELL_KIND_COLOR = { atk: "#e0743f", heal: "#46c08f", phys: "#d8b04a", buff: "#5fa8e0", debuff: "#a06fd6", sleep: "#a06fd6", cure: "#46c08f", mana: "#5fa8e0", escape: "#8f96a3", field: "#8fd0c8" };

// ===== 種別・属性アイコン (敵の特徴・味方のスキルに添える小さな札) =====
// 物 = 物理 / 魔 = 魔法 (ブレス含む) / 回復 / その他 (強化・弱体・招来など)。属性は「火」「水」…の札を並べる
const TAG_KIND = {
  phys:  { t: "物", c: "#d8b04a" },
  mag:   { t: "魔", c: "#b48ae8" },
  heal:  { t: "回復", c: "#46c08f" },
  other: { t: "その他", c: "#8f96a3" },
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
  const out = [SPELL_TAG_KIND[sp.kind] || "other"];
  let elk = sp.element;
  if (!hasElem(elk) && sp.kind === "phys" && actor && actor.elemAtk) elk = actor.elemAtk.el;
  if (hasElem(elk)) out.push("el:" + elk);
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
export function elemAffinity(element) {
  const weak = [], resist = [];
  if (!hasElem(element)) return { weak, resist };
  for (const k of Object.keys(ELEMENTS)) {
    if (k === "none") continue;
    if (elemBeats(k, element)) weak.push(k);
    else if (elemBeats(element, k)) resist.push(k);
  }
  return { weak, resist };
}
// 「弱点 [土]　耐性 [火]」の行 (無属性なら null)
export function affinityRow(element, cls = "") {
  const { weak, resist } = elemAffinity(element);
  if (!weak.length && !resist.length) return null;
  const r = el("div", "ui-affinity" + (cls ? " " + cls : ""));
  const part = (label, list, tone) => {
    if (!list.length) return;
    const g = el("span", "ui-aff " + tone);
    g.appendChild(el("span", "ui-aff-l", label));
    g.appendChild(tagRow(list.map((k) => "el:" + k)));
    r.appendChild(g);
  };
  part("弱点", weak, "weak");
  part("耐性", resist, "resist");
  return r;
}

// ===== 敵の情報の段階開示 (討伐数しだい) =====
// 姿は最初から見える。1体 = 名前 / 5体 = 属性とHP / 10体 = 特徴・スキルと説明文。
// 迷宮の主・強敵は1体討てば全てを明かす。主・名のある強敵は名前を最初から明かす。
// 戦闘画面 (名札・HPの小瓶)・「敵の姿」・図鑑の一枚で共通
export const MON_REVEAL = { name: 1, stats: 5, lore: 10 };
export const BOSS_REVEAL = { name: 0, stats: 1, lore: 1 };
// その魔物 (図鑑の定義) の開示段階
// 名のある強敵 (dungeons/named.js) は名だけ最初から明かす (噂で知れ渡っている)。能力・伝承は倒して知る
export const NAMED_REVEAL = { name: 0, stats: 1, lore: 1 };
export const ELITE_REVEAL = { name: 1, stats: 1, lore: 1 };
export function revealSteps(m) { return m && m.boss ? BOSS_REVEAL : m && m.named ? NAMED_REVEAL : m && m.elite ? ELITE_REVEAL : MON_REVEAL; }
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
const pct = (v) => `${Math.round(v * 100)}%`;
const raceList = (rs) => [...new Set((rs || []).map((r) => RACE_LABEL[r] || r))].join("・");
const ELEM_NAME = (k) => (k === "all" ? "全属性" : (ELEMENTS[k] ? ELEMENTS[k].label : k));
export function skillDetailLines(sp) {
  const lines = [];
  lines.push(`種別: ${SPELL_KIND_LABEL[sp.kind] || sp.kind}　対象: ${SPELL_TARGET_LABEL[sp.target] || sp.target}`);
  if (sp.element && sp.element !== "none" && ELEMENTS[sp.element]) lines.push(`属性: ${ELEMENTS[sp.element].label}`);
  if (sp.kind === "atk" && sp.gravity) lines.push(`敵の今のHPの${pct(sp.gravity)}を削る（主には3割しか効かない・魔法耐性は受ける）`);
  else if (sp.kind === "atk") lines.push(`威力 ${sp.power}（術者の${sp.faith || sp.element === "light" ? "INT と PIE の高い方" : "INT"}で伸びる）`);
  if (sp.kind === "heal" && sp.power) lines.push(`回復量 ${sp.power}（術者のPIEで伸びる）`);
  if (sp.kind === "mana") lines.push(`味方のMPを ${sp.power} 回復（術者のINTで少し伸びる）`);
  if (sp.kind === "escape") lines.push("必ず戦闘から逃げられる（迷宮の異変で退路が閉ざされている時を除く）");
  if (sp.kind === "sleep") lines.push("敵全体を基本60%で眠らせる（抵抗値で成功率が下がる）");
  if (sp.revive) lines.push(sp.revivePct ? `戦闘不能をHP${pct(sp.revivePct)}で蘇生する` : "戦闘不能も蘇生できる");
  if (sp.kind === "phys") {
    lines.push(sp.scatter ? `威力 攻撃力の${sp.power}倍 × ランダムな敵へ${sp.scatter}回` : `威力 攻撃力の${sp.power}倍${sp.hits ? ` × ${sp.hits}回` : ""}`);
    if (sp.intScale) lines.push("使い手のINTでも威力が伸びる");
    if (sp.agiScale) lines.push("使い手のAGIでも威力が伸びる");
    if (sp.vitScale) lines.push("使い手のVITでも威力が伸びる");
    if (sp.pieScale) lines.push("使い手のPIEでも威力が伸びる");
    if (sp.acc) lines.push(sp.acc >= 1 ? "必中（相手の素早さに関係なく当たる）" : `命中UP（外れる確率を${pct(sp.acc)}減らす）`);
    if (sp.pierce) lines.push(sp.pierce >= 1 ? "相手の防御（VIT）と物理抵抗値を無視する（物理無効は貫けない）" : `相手の防御（VIT）と物理抵抗値による軽減を${pct(sp.pierce)}無視する（物理無効は貫けない）`);
    if (sp.critBonus) lines.push(sp.critBonus >= 1 ? "必ず会心になる" : `会心率 +${pct(sp.critBonus)}`);
    if (sp.desperate) lines.push("自分のHPが減っているほど威力が上がる（最大2倍）");
    if (sp.steal) lines.push(`当てた敵から、所持金の${pct(sp.steal)}を盗む（1体につき1度・逃げても持ち帰る）`);
  }
  if (sp.execute) lines.push(`HP30%以下の敵には ×${sp.execute}（とどめ）`);
  if (sp.prey) lines.push(`${raceList(sp.prey.races)}に ×${sp.prey.mul}`);
  if (sp.kind === "atk" && sp.critBonus) lines.push(`呪文会心率 +${pct(sp.critBonus)}（会心は×1.5）`);
  // ATK・VIT・AGI・INT・PIE は段 (buffstage.js) で示す: 「ATK +2段 (×1.5)」
  const fx = (obj) => Object.entries(obj).map(([k, v]) => {
    const nm = ATTR_LABEL[k] || BUFF_NAME[k] || k.toUpperCase();
    if (!STAGED.has(k)) return `${nm} ×${v}`;
    const n = stageOf(v);
    return `${nm} ${stageLabel(n)}（×${stageMul(n)}）`;
  }).join("・");
  if (sp.buff) lines.push(`強化: ${fx(sp.buff)}`);
  if (sp.debuff) lines.push(`弱体: ${fx(sp.debuff)}`);
  if (sp.vuln) { const nm = Object.keys(sp.vuln).map(ELEM_NAME).join("・"); lines.push(`${nm}耐性を下げる（${nm}の攻撃から受けるダメージ ×${(1 / Object.values(sp.vuln)[0]).toFixed(2)}）`); }
  if (sp.taunt) lines.push("挑発: 敵の単体攻撃が自分に向かいやすくなる");
  if (sp.shield) lines.push("仁王立ち: 味方への単体の物理攻撃を代わりに受ける");
  if (sp.stance === "counter") lines.push("反撃の構え: 物理攻撃を受けると必ず反撃する");
  if (sp.charge) lines.push(`溜め: 次の物理攻撃・物理技の威力 ×${sp.charge}`);
  if (sp.regen) lines.push(`リジェネ: 毎ターン最大HPの${pct(sp.regen.pct)}を回復（${sp.regen.turns}ターン）`);
  if (sp.ward && sp.ward.breath) lines.push(`ブレス避け: 敵のブレスから受けるダメージ −${pct(sp.ward.breath)}（${sp.dur || 3}ターン）`);
  if (sp.ward && sp.ward.spell) lines.push(`呪文避け: 敵の全体呪文から受けるダメージ −${pct(sp.ward.spell)}（${sp.dur || 3}ターン）`);
  if (sp.float) lines.push(`迷宮で唱える: ${sp.float}階のあいだ隊が宙に浮き、落とし穴に落ちず毒の床のダメージも受けない（戦闘では使わない）`);
  if (sp.sense === "stairs") lines.push("迷宮で唱える: この階の下り階段の在りかを示し、その周囲8マスの墓石をめくる（戦闘では使わない）");
  else if (sp.sense) lines.push(`迷宮で唱える: この階のあいだ、まだめくっていない墓石の${{ enemy: "魔物の居場所を赤い光で（種類は分からない）", chest: "宝箱の在りかを青い光で" }[sp.sense]}示す（戦闘では使わない）`);
  // ---- 固有の追加効果 ----
  if (sp.hpCost) lines.push(`代償: 自分の最大HPの${pct(sp.hpCost)}を失う（HP1で踏みとどまる）`);
  if (sp.drain) lines.push(`与えたダメージの${pct(sp.drain)}だけ自分のHPを回復`);
  if (sp.mpDrain) lines.push(`与えたダメージの${pct(sp.mpDrain)}だけ自分のMPを回復`);
  if (sp.poison) lines.push(`${pct(sp.poison.chance)}で${sp.poison.pct > 0.05 ? "猛毒" : "毒"}にする（毎ターン最大HPの${pct(sp.poison.pct)}${sp.poison.pct > 0.05 ? `・主には${pct(Math.max(0.05, sp.poison.pct * 0.5))}` : ""}）`);
  if (sp.para) lines.push(`${pct(sp.para)}で麻痺させる（手番を失いやすくなる・抵抗値で成功率が下がる）`);
  if (sp.seal) lines.push(`${pct(sp.seal.chance)}で特技を${sp.seal.turns}ターン封じる（ブレス・状態異常攻撃・回復・呼び出し・大技の溜めを使えなくなる・抵抗値で成功率が下がる）`);
  if (sp.strip) lines.push("敵にかかった強化を打ち消す");
  if (sp.instakill) lines.push(`${pct(sp.instakill.chance)}で即死させる${sp.instakill.races ? `（${raceList(sp.instakill.races)}のみ）` : ""}（主には効かない・抵抗値で成功率が下がる）`);
  if (sp.sleepChance) lines.push(`命中後 ${pct(sp.sleepChance)}で対象を眠らせる（抵抗値で成功率が下がる）`);
  if (sp.charm) lines.push(`${pct(sp.charm)}で魅了する（その敵が仲間に襲いかかる・傷を受けると解けやすい・主には効きにくい）`);
  if (sp.confuse) lines.push(`${pct(sp.confuse)}で混乱させる（敵味方を問わず殴る・ふらつく・抵抗値で成功率が下がる）`);
  if (sp.flinchChance) lines.push(`${pct(sp.flinchChance)}で怯ませる（主には効かない）`);
  if (sp.poison || sp.para || sp.seal || sp.instakill || sp.sleepChance || sp.charm || sp.confuse || sp.kind === "sleep") lines.push("※ 表示は抵抗値0・同じLvでの基本確率。Lv差で5〜95%に調整した後、成功率×（1−抵抗値/100）で判定。抵抗値100は無効");
  if (sp.plunder) lines.push("この技で倒した敵は、落とすゴールドが2倍になる");
  if (sp.partyHeal) lines.push(`攻撃の後、味方全体のHPを ${sp.partyHeal} 回復（術者のPIEで伸びる）`);
  if (sp.cure || sp.kind === "cure") lines.push(`状態異常（${spellCureKinds(sp).map(k => k === "poison" ? "毒・猛毒" : AIL_LABEL[k]).join("・")}）を治す`);
  if (sp.purge) lines.push("かかっている弱体を解く");
  if (sp.grantEndure) lines.push("対象に「致死ダメージをHP1で耐える」を付与（1戦闘1回）");
  if (sp.grantBarrier) lines.push(`魔障壁${sp.grantBarrier}回分（ブレス・呪文の被ダメ半減）を付与`);
  if (sp.debuffAll) lines.push(`さらに敵全体を弱体: ${fx(sp.debuffAll)}`);
  // 効果の持続ターン数。ATK〜PIE の段は強化と弱体で打ち消し合い、±3段で止まる (主・精鋭への弱体は −2段まで・持続 −1)
  if (sp.dur && (sp.buff || sp.debuff || sp.debuffAll || sp.vuln || sp.taunt || sp.shield || sp.stance || sp.charge)) lines.push(`効果は ${sp.dur} ターン持続`);
  if ([sp.buff, sp.debuff, sp.debuffAll].some((o) => o && Object.keys(o).some((k) => STAGED.has(k)))) lines.push("能力の段は強化と弱体で打ち消し合い、±3段で止まる（主・精鋭への弱体は −2段まで・持続 −1）");
  if (sp.strip) lines.push("敵の大技の予兆（溜め）も打ち消せる");
  return lines;
}

// スキル名タップで開く詳細 (キットのシート)
export function showSkillPopup(key) {
  const sp = SPELLS[key];
  if (!sp) return null;
  const accent = SPELL_KIND_COLOR[sp.kind] || "#c9a227";
  const body = el("div", "ui-skill");
  const mpRow = el("div", "sk-mp", sp.mpPct ? `消費 ${spellMpLabel(sp)}` : `消費MP ${sp.mp}`);
  const tg = tagRow(spellTagKinds(sp));
  if (tg) mpRow.appendChild(tg);
  body.appendChild(mpRow);
  if (sp.desc) body.appendChild(el("div", "ig-desc", sp.desc));
  const box = el("div", "sk-lines");
  for (const ln of skillDetailLines(sp)) box.appendChild(el("div", "sk-line", ln));
  body.appendChild(box);
  return sheet.open({
    kind: "info", banner: "スキル", accent, title: sp.name, titleColor: accent, body,
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
  body.appendChild(el("div", "sk-mp", def.scope === "party" ? "常に働く力 ― パーティ全体に効く" : "常に働く力 ― 自分にだけ効く"));
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
export function ailResShort(r) { return r ? Object.entries(r).map(([k, v]) => `${AIL_SHORT[k] || k}${Math.round(v * 100)}`).join("・") : "—"; }
export function onHitShort(o) { return o && o.length ? o.map((x) => `${AIL_SHORT[x.k] || x.k}${Math.round(x.chance * 100)}%`).join("・") : "—"; }
// 一覧の一行用 (statLines に添える)
function ailStatParts(it) {
  const out = [];
  if (it.onHit && it.onHit.k) out.push(`${AIL_LABEL[it.onHit.k]}付与 ${Math.round(it.onHit.chance * 100)}%`);
  if (it.resists) out.push(Object.entries(it.resists).map(([k, v]) => `${RESIST_LABEL[k] || k}抵抗${v}`).join("・"));
  if (it.aRes) out.push(`抵抗値 ${Object.entries(it.aRes).map(([k, v]) => `${RESIST_LABEL[k] || k}${Math.round(v * 100)}`).join("・")}`);
  if (it.bRes) out.push(`ブレス耐性 ${Math.round(it.bRes * 100)}%`);
  return out;
}
// くわしい行 (品の細目)
export function ailDetailLines(it) {
  const L = [];
  if (!it) return L;
  if (it.onHit && it.onHit.k) {
    const o = it.onHit;
    const tail = o.k === "poison" ? `（毎ターン最大HPの${Math.round((o.pct || 0.05) * 100)}%）` : o.k === "charm" ? "（敵が仲間を襲う）" : o.k === "confuse" ? "（敵が見境なく殴る）" : "";
    L.push(`追加効果: 攻撃が当たると ${Math.round(o.chance * 100)}% で敵を${AIL_LABEL[o.k]}にする${tail}（物理技も同じ・主には効きにくい）`);
  }
  if (it.resists) L.push(Object.entries(it.resists).map(([k, v]) => `${RESIST_LABEL[k] || k}抵抗値 +${v}`).join("・"));
  if (it.aRes) L.push(`状態異常抵抗値: ${Object.entries(it.aRes).map(([k, v]) => `${RESIST_LABEL[k] || k} +${Math.round(v * 100)}`).join("・")}（かかる確率を下げる）`);
  if (it.bRes) L.push(`ブレス耐性: 敵のブレスから受けるダメージ −${Math.round(it.bRes * 100)}%（装備どうしで足し合い、上限50%）`);
  return L;
}

// ===== 特殊効果 (eff = 戦闘効果 / mult = % 補正) =====
// items.js recalc が装備ごとに集め、combat.js (戦闘) と game.js (金貨・✦Soul) が読む。
// 表記は「何が・どれだけ・いつ」を数字で言い切る (combat.js の式と合わせる。式を変えたらここも)
const MULT_LABEL = { hp: "最大HP", mp: "最大MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
const MULT_ORDER = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
// 効果の名 (短い表記) と くわしい説明
const EFF_INFO = {
  actFirst: { short: () => "先手", line: () => "先手: どのラウンドも、敵味方の誰よりも先に行動する" },
  multistrike: { short: (v) => `${Math.min(4, v)}連撃`, line: (v) => `連撃: 通常攻撃が一手で${Math.min(4, v)}回の攻撃になる（標的が倒れたら次の敵へ。技は1回のまま。連撃の装備は回数を足し合い、最大4回）` },
  lifesteal: { short: (v) => `吸血${pct(v)}`, line: (v) => `吸血: 物理攻撃（通常攻撃・物理技）で与えたダメージの${pct(v)}だけ、自分のHPを回復する` },
  guard: { short: (v) => `被ダメ−${pct(v)}`, line: (v) => `守り: 受けるダメージを常に${pct(v)}減らす（物理・呪文・ブレスのすべて）` },
  autoRevive: { short: (v) => `自動蘇生${pct(v)}`, line: (v) => `蘇生: 戦闘不能になった時、1戦闘に1回だけ最大HPの${pct(v)}で立ち上がる` },
  regen: { short: (v) => `再生${pct(v)}`, line: (v) => `再生: 2ラウンド目から毎ラウンド、最大HPの${pct(v)}だけHPを回復する` },
  counter: { short: (v) => `報復${pct(v)}`, line: (v) => `報復: 敵の物理攻撃を受けると、攻撃力の${pct(v)}のダメージですぐにやり返す` },
  spellCostMul: { short: (v) => `消費MP−${pct(1 - v)}`, line: (v) => `節約: 技・呪文の消費MPが${pct(1 - v)}減る` },
  ailmentImmune: { short: () => "状態異常無効", line: () => "状態異常無効: 毒・麻痺・眠り・魅了・混乱・石化・即死を受けつけない（罠の状態異常も）" },
  goldUp: { short: (v) => `金貨+${pct(v)}`, line: (v) => `金運: 迷宮で得る金貨が${pct(v)}増える（隊の中で一番高いものだけ効く）` },
  soulUp: { short: (v) => `✦Soul+${pct(v)}`, line: (v) => `魂導: 迷宮で得る✦Soulが${pct(v)}増える（隊の中で一番高いものだけ効く）` },
  barrier: { short: (v) => `障壁${v}回`, line: (v) => `障壁: 戦闘のはじめに、受けるダメージを半分にする障壁を${v}回ぶん張る` },
};
// % 補正 (mult) を「最大HP・ATK +20%」の形にまとめる (同じ率は一つに束ねる)
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
  if (!it || it.unidentified) return "";
  const parts = [...effStatParts(it)];
  if (it.scale) parts.push(`補正 ${scaleText(it.scale)}`);
  if (it.magic) parts.push("魔法属性");
  const ea = elemStatText("攻撃", it.eAtk), ed = elemStatText("防御", it.eDef);
  if (ea) parts.push(ea);
  if (ed) parts.push(ed);
  for (const x of ailStatParts(it)) parts.push(x);
  return parts.join("　");
}
// 特殊効果のくわしい行をまとめて (戦闘効果・武器の補正/魔法属性・属性・状態異常)。説明の文とは別に、数字で効果を言い切る
export function specialLines(it) {
  if (!it || it.unidentified) return [];
  return [...effDetailLines(it), ...weaponTraitLines(it), ...elemDetailLines("攻撃", it.eAtk), ...elemDetailLines("防御", it.eDef), ...ailDetailLines(it)];
}

// 武器の能力補正 (scale) と魔法属性 (magic) のくわしい表記
export function weaponTraitLines(it) {
  const L = [];
  if (!it || it.slot !== "weapon") return L;
  if (it.scale) L.push(`能力補正: ${scaleText(it.scale)}（攻撃力 = ATK + ${scaleText(it.scale).replace(/ /g, " + ")}。物理技もこの攻撃力で伸びる）`);
  if (it.magic) L.push("攻撃属性: 魔法（通常攻撃の威力は攻撃力のまま、物理耐性ではなく魔法耐性で判定され、魔法弱点を突く。物理技は物理のまま）");
  return L;
}

// ===== 品の表示 =====
export function statLines(it) {
  if (it && it.unidentified) return "未鑑定 — 鑑定が必要";
  const parts = [];
  const f = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`); };
  f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
  f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
  f("HP", it.hp); f("MP", it.mp);
  if (it.crit) parts.push(`会心 +${Math.round(it.crit * 100)}%`);
  if (it.scale) parts.push(`補正 ${scaleText(it.scale)}`);
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

// 装備品か (装備可能職業を表示する対象か)。use/misc/mat は対象外。
export const EQUIPPABLE_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
export function isEquippable(it) { return EQUIPPABLE_SLOTS.has(it.slot); }

// 候補 cand を p に装備した場合の最終ステータス増減を返す。
// items.js の recalc を仮の装備マップに流用するので、両手武器⇄盾の付け替え分も反映される。
// 数値ステ (atk…mp) のほか、会心率 (crit, %) と属性攻撃/防御 (elemAtk/elemDef) の変化も返す。
export function equipPreviewDelta(p, cand) {
  const key = slotKeyFor(cand, p);
  if (!key) return null;
  const eq = { ...p.equip };
  // equip() と同じ付け替え規則: 両手武器は盾を、盾は両手武器を外す
  if (cand.slot === "weapon" && cand.twoHanded) eq.shield = null;
  if (cand.slot === "shield" && eq.weapon && eq.weapon.twoHanded) eq.weapon = null;
  eq[key] = cand;
  const fake = { base: p.base, equip: eq, hp: p.hp, mp: p.mp };
  recalc(fake);
  return {
    power: attackPower(fake) - attackPower(p), // 攻撃力 (ATK + 武器の能力補正)
    weapon: (eq.weapon || null) !== (p.equip.weapon || null),
    // 持ち方の付け替え (両手武器に持ち替えて盾が外れる)。武器の良し悪しを攻撃力だけでなく盾の能力とも比べる
    handSwap: (eq.weapon || null) !== (p.equip.weapon || null) && (eq.shield || null) !== (p.equip.shield || null),
    atk: fake.atk - p.atk,
    vit: fake.vit - p.vit,
    agi: fake.agi - p.agi,
    int: fake.int - p.int,
    pie: fake.pie - p.pie,
    luk: fake.luk - p.luk,
    hp: fake.maxhp - p.maxhp,
    mp: fake.maxmp - p.maxmp,
    crit: Math.round(((fake.critBonus || 0) - (p.critBonus || 0)) * 100),
    elemAtk: { from: p.elemAtk, to: fake.elemAtk },
    elemDef: { from: p.elemDef, to: fake.elemDef },
    physResist: (fake.physResist || 0) - (p.physResist || 0),
    magResist: (fake.magResist || 0) - (p.magResist || 0),
    ailRes: { from: p.ailRes || null, to: fake.ailRes || null },
    breathRes: Math.round(((fake.breathRes || 0) - (p.breathRes || 0)) * 100),
    onHit: { from: p.onHit || null, to: fake.onHit || null },
  };
}

// 装備候補の「装備中と比べた増減」行 (増・緑/減・赤)。何かを付け替えるときだけ呼ぶ。
export function equipCompareEl(p, cand) {
  const d = equipPreviewDelta(p, cand);
  const row = el("span", "eq-cd");
  row.appendChild(el("span", "eq-cd-lab", "装備すると"));
  let any = false;
  if (d) {
    // 攻撃力 (基本攻撃力 ATK + 武器の能力補正)。ATK は攻撃力と増減が違う時だけ併記する
    if (d.power) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg " + (d.power > 0 ? "up" : "down"), `攻撃力 ${d.power > 0 ? "▲+" + d.power : "▼" + d.power}`));
    }
    for (const [label, k] of [["ATK", "atk"], ["VIT", "vit"], ["AGI", "agi"], ["INT", "int"], ["PIE", "pie"], ["LUK", "luk"], ["HP", "hp"], ["MP", "mp"]]) {
      const v = d[k];
      if (!v || (k === "atk" && v === d.power)) continue;
      any = true;
      row.appendChild(el("span", "eq-cd-seg " + (v > 0 ? "up" : "down"), `${label} ${v > 0 ? "▲+" + v : "▼" + v}`));
    }
    // 会心率 (%)
    if (d.crit) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg " + (d.crit > 0 ? "up" : "down"), `会心 ${d.crit > 0 ? "▲+" + d.crit : "▼" + d.crit}%`));
    }
    // 属性攻撃/防御の変化 (—→火◯ のように現状→装備後で表示)
    for (const [label, ch] of [["属性攻", d.elemAtk], ["属性防", d.elemDef]]) {
      if (elemStatEq(ch.from, ch.to)) continue;
      any = true;
      row.appendChild(el("span", "eq-cd-seg elem", `${label} ${elemStatShort(ch.from)}→${elemStatShort(ch.to)}`));
    }
    for (const k of ["physResist", "magResist"]) if (d[k]) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg " + (d[k] > 0 ? "up" : "down"), `${RESIST_LABEL[k]}抵抗値 ${d[k] > 0 ? "+" : ""}${d[k]}`));
    }
    // 状態異常耐性 / 追加効果の変化
    if (d.ailRes && ailResShort(d.ailRes.from) !== ailResShort(d.ailRes.to)) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg elem", `異常耐性 ${ailResShort(d.ailRes.from)}→${ailResShort(d.ailRes.to)}`));
    }
    if (d.breathRes) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg " + (d.breathRes > 0 ? "up" : "down"), `ブレス耐性 ${d.breathRes > 0 ? "▲+" + d.breathRes : "▼" + d.breathRes}%`));
    }
    if (d.onHit && onHitShort(d.onHit.from) !== onHitShort(d.onHit.to)) {
      any = true;
      row.appendChild(el("span", "eq-cd-seg elem", `追加効果 ${onHitShort(d.onHit.from)}→${onHitShort(d.onHit.to)}`));
    }
  }
  if (!any) row.appendChild(el("span", "eq-cd-same", "変化なし"));
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
  for (const k of ks) W[k] = Math.round((0.35 + 0.9 * ((st[k] || 0) / mx)) * 100) / 100;
  W.hp = 0.25;
  W.mp = (st.mp || 0) >= 1.5 ? 0.15 : 0.03;
  return (GEAR_W_CACHE[key] = W);
}
// ATK の代わりに攻撃力 (ATK + 武器の能力補正) の増減を数える。武器の付け替えは攻撃力の高い順が最優先
// (攻撃力1 = WEAPON_POWER_W 点。ほかの能力は攻撃力が同じ時の決め手になる)。
// ただし盾が付け外しされる持ち替え (片手+盾 ⇄ 両手武器、handSwap) は、攻撃力と盾の能力を同じ物差しで比べる:
// 全体を「攻撃力1 = WEAPON_POWER_W 点」に引き伸ばす (盾の VIT などはその職の重み ÷ ATK の重み で攻撃力に換算)
// 攻撃力を最優先にするのは、打撃で戦う職だけ (weaponShare)。術者 (INT・PIE が ATK より伸びる職) は
// 技の大半が INT・PIE で伸びるので、武器も能力の重みどおりに比べる (短剣の攻撃力 +12 で INT −22 を勧めない)
const WEAPON_POWER_W = 50;
// 武器の攻撃力を最優先する度合い 0〜1: ATK の重みが INT・PIE の重み以上なら 1、その 85% 以下なら 0、間は比例
// (聖騎士・審問官のような打撃と祈りの両刀は半ばほど)
export function weaponShare(W) {
  const mag = Math.max(W.int || 0, W.pie || 0);
  if (!mag) return 1;
  return Math.max(0, Math.min(1, ((W.atk || 0) / mag - 0.85) / 0.15));
}
export function gearScore(doll, delta) {
  if (!delta) return 0;
  const W = gearWeights(doll);
  let s = 0;
  for (const k in W) s += (k === "atk" && delta.power != null ? delta.power : (delta[k] || 0)) * W[k];
  if (delta.weapon) {
    const f = weaponShare(W);
    if (delta.handSwap) s = s * (1 + f * (WEAPON_POWER_W / Math.max(0.35, W.atk || 1) - 1));
    else s += (delta.power || 0) * WEAPON_POWER_W * f;
  }
  s += (delta.crit || 0) * 0.5;
  const lv = (e) => (e && e.el ? Math.min(2, e.lv || 1) : 0);
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

// ウィザードリィ風の情報テキスト行
export function detailLines(it) {
  if (it && it.unidentified) {
    if (it.idHardFail) {
      return ["？ 未鑑定の品 (鑑定失敗済み)", "鑑定するまで正体も性能もわからない。", "スキル鑑定に失敗したため、もう商店 (有料) でしか鑑定できない。"];
    }
    return ["？ 未鑑定の品", "鑑定するまで正体も性能もわからない。", "商店 (有料) か、鑑定の心得がある仲間が必要だ。"];
  }
  const L = [];
  L.push(itemCatText(it));
  if (it.slot === "use") {
    if (it.use) for (const x of useLines(it)) L.push(x);
  } else if (it.slot === "misc") {
    L.push("商店で売って金にする戦利品");
  } else if (it.slot === "mat") {
    L.push("用途は街で見つかるかもしれない");
  } else {
    // 射程は隊列システムで実際に使われるので表示する。旧 Wizardry 風の
    // 命中/ダイス/攻撃回数 は戦闘で使われないため表示しない
    if (it.slot === "weapon") L.push(`射程: ${RANGE_LABEL[weaponRange(it)]}`);
    if (it.slot === "weapon") L.push(handLine(it));
    // 六大ステ (ATK/VIT/AGI/INT/PIE/LUK) への補正
    const mod = [];
    const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
    f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
    if (it.crit) mod.push(`会心+${Math.round(it.crit * 100)}%`);
    if (mod.length) L.push(mod.join(" / "));
    for (const ln of effDetailLines(it)) L.push(ln);
    for (const ln of weaponTraitLines(it)) L.push(ln);
  }
  // 属性攻撃/属性防御 (1行ずつのくわしい表記)
  for (const ln of elemDetailLines("攻撃", it.eAtk)) L.push(ln);
  for (const ln of elemDetailLines("防御", it.eDef)) L.push(ln);
  for (const ln of ailDetailLines(it)) L.push(ln);
  if (isEquippable(it)) L.push(equipClassText(it));
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

// パーティメンバーの装備可否チップ (○/×)。party を省くと現在の編成 (G.party)
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

// ===== 品・スキルの表示まわり (game.js から移設した純粋な表示ヘルパ) =====
// 状態を変えない。G が要るものは引数で受け取るか、ctx の game.G を読む。
// 呼び出し側 (game.js・各パッケージ) は同じ名前のまま import して使う。

import { game } from "./ctx.js";
import { el, sheet } from "./kit.js";
import { ELEMENTS, elemBeats } from "../dungeons/index.js";
import { SPELLS } from "../combat.js";
import { ATTR_LABEL, SOUL_CLASSES, dollBust, PASSIVES, passiveName, passiveByName } from "../souls.js";
import { WEAPON_CAT_LABEL, RANGE_LABEL, weaponRange, slotKeyFor, recalc, canEquip } from "../items.js";
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
    lines.push(`${elemName(adv)}属性から受けるダメージ　-${pct}%`);
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
export const SPELL_KIND_LABEL = { atk: "攻撃呪文", heal: "回復呪文", phys: "物理技", buff: "支援", debuff: "弱体", sleep: "状態異常", cure: "治療" };
export const SPELL_TARGET_LABEL = { enemy: "敵単体", "all-enemy": "敵全体", ally: "味方単体", "all-ally": "味方全体", self: "自分" };
export const SPELL_KIND_COLOR = { atk: "#e0743f", heal: "#46c08f", phys: "#d8b04a", buff: "#5fa8e0", debuff: "#a06fd6", sleep: "#a06fd6", cure: "#46c08f" };

// ===== 種別・属性アイコン (敵の特徴・味方のスキルに添える小さな札) =====
// 物 = 物理 / 魔 = 魔法 (ブレス含む) / 回復 / その他 (強化・弱体・招来など)。属性は「火」「水」…の札を並べる
const TAG_KIND = {
  phys:  { t: "物", c: "#d8b04a" },
  mag:   { t: "魔", c: "#b48ae8" },
  heal:  { t: "回復", c: "#46c08f" },
  other: { t: "その他", c: "#8f96a3" },
};
const SPELL_TAG_KIND = { phys: "phys", atk: "mag", heal: "heal", cure: "heal" };
// 敵の特徴 → 種別。elem = 攻撃に魔物の固有属性が乗る (物理攻撃・ブレスは固有属性で打つ)
const TRAIT_TAG = {
  swift: ["other"], evasive: ["phys"], physResist: ["phys"], magWeak: ["mag"], magResist: ["mag"],
  regen: ["heal"], pack: ["other"], summon: ["other"], heal: ["heal"], guard: ["other"],
  breath: ["mag", true], poison: ["phys", true], paralyze: ["phys", true], stone: ["other"],
  drain: ["phys", true], soulSteal: ["other"], goldSteal: ["other"], critical: ["phys", true],
  enrage: ["other"], endure: ["other"], lifesteal: ["phys", true], multistrike: ["phys", true],
  barrier: ["other"], warcry: ["other"], weaken: ["phys", true],
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
// 1体 = 姿と名前 / 5体 = 属性とHP / 10体 = 特徴・スキルと説明文。戦闘中の「敵の姿」と図鑑の一枚で共通
export const MON_REVEAL = { look: 1, stats: 5, lore: 10 };
// その魔物を倒した数 (図鑑の記録を読むだけ。記録を作らない)
export function monKills(key) {
  const g = game.G;
  const e = g && g.codex && g.codex.mon ? g.codex.mon[key] : null;
  if (!e) return 0;
  if (e === true) return 1;
  return Math.max(0, Number(e.kills) || 0);
}
// まだ明かされていない項目の札: 「属性・HP　5体討伐で開示」
export function revealLock(need, what, cls = "") {
  const r = el("div", "ui-reveal-lock" + (cls ? " " + cls : ""));
  if (what) r.appendChild(el("span", "ui-reveal-w", what));
  r.appendChild(el("span", "ui-reveal-n", `${need}体討伐で開示`));
  return r;
}
// 名も知らぬ敵の影 (姿を塗りつぶした影絵)
export function silhouetteCanvas(spr, scale = 4) {
  const c = spriteCanvas(spr, scale);
  const x = c.getContext("2d");
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "#2b2631";
  x.fillRect(0, 0, c.width, c.height);
  c.classList.add("ui-silhouette");
  return c;
}

// スキルの効果をくわしい行に展開する
export function skillDetailLines(sp) {
  const lines = [];
  lines.push(`種別: ${SPELL_KIND_LABEL[sp.kind] || sp.kind}　対象: ${SPELL_TARGET_LABEL[sp.target] || sp.target}`);
  if (sp.element && sp.element !== "none" && ELEMENTS[sp.element]) lines.push(`属性: ${ELEMENTS[sp.element].label}`);
  if (sp.kind === "atk") lines.push(`威力 ${sp.power}（術者のINTで伸びる）`);
  if (sp.kind === "heal" && sp.power) lines.push(`回復量 ${sp.power}（術者のPIEで伸びる）`);
  if (sp.revive) lines.push(sp.revivePct ? `戦闘不能をHP${Math.round(sp.revivePct * 100)}%で蘇生する` : "戦闘不能も蘇生できる");
  if (sp.kind === "phys") {
    lines.push(`威力 攻撃力の${sp.power}倍${sp.hits ? ` × ${sp.hits}回` : ""}`);
    if (sp.intScale) lines.push("魔法剣: 使い手のINTでも威力が伸びる");
    if (sp.critBonus) lines.push(`会心率 +${Math.round(sp.critBonus * 100)}%`);
  }
  if (sp.kind === "atk" && sp.critBonus) lines.push(`呪文会心率 +${Math.round(sp.critBonus * 100)}%（会心は×1.5）`);
  const fx = (obj) => Object.entries(obj).map(([k, v]) => `${ATTR_LABEL[k] || k.toUpperCase()} ×${v}`).join("・");
  if (sp.buff) lines.push(`強化: ${fx(sp.buff)}`);
  if (sp.debuff) lines.push(`弱体: ${fx(sp.debuff)}`);
  // ---- 混成職ユニークスキルの固有効果 ----
  if (sp.hpCost) lines.push(`代償: 自分の最大HPの${Math.round(sp.hpCost * 100)}%を失う（HP1で踏みとどまる）`);
  if (sp.drain) lines.push(`与えたダメージの${Math.round(sp.drain * 100)}%だけ自分のHPを回復`);
  if (sp.mpDrain) lines.push(`与えたダメージの${Math.round(sp.mpDrain * 100)}%だけ自分のMPを回復`);
  if (sp.sleepChance) lines.push(`命中後 ${Math.round(sp.sleepChance * 100)}%で対象を眠らせる`);
  if (sp.flinchChance) lines.push(`命中後 ${Math.round(sp.flinchChance * 100)}%で対象を怯ませる（主には効かない）`);
  if (sp.ailment) lines.push(`${Math.round(sp.ailment.chance * 100)}%で対象を${sp.ailment.type === "poison" ? "毒" : "異常"}に侵す`);
  if (sp.plunder) lines.push("この技で倒した敵は、落とすゴールドが2倍になる");
  if (sp.partyHeal) lines.push(`攻撃の後、味方全体のHPを ${sp.partyHeal} 回復（術者のPIEで伸びる）`);
  if (sp.cure) lines.push("同時に状態異常も治す");
  if (sp.grantEndure) lines.push("対象に「致死ダメージをHP1で耐える」を付与（1戦闘1回）");
  if (sp.grantBarrier) lines.push(`味方全体に魔障壁${sp.grantBarrier}回分（ブレス・呪文の被ダメ半減）を付与`);
  if (sp.debuffAll) lines.push(`さらに敵全体を弱体: ${fx(sp.debuffAll)}`);
  // 強化/弱体の持続ターン数 (同方向は最大2段階まで重ねられる)
  if (sp.dur && (sp.buff || sp.debuff || sp.debuffAll)) lines.push(`効果は ${sp.dur} ターン持続（同じ能力は最大2段階）`);
  return lines;
}

// スキル名タップで開く詳細 (キットのシート)
export function showSkillPopup(key) {
  const sp = SPELLS[key];
  if (!sp) return null;
  const accent = SPELL_KIND_COLOR[sp.kind] || "#c9a227";
  const body = el("div", "ui-skill");
  const mpRow = el("div", "sk-mp", `消費MP ${sp.mp}`);
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

// ===== 品の表示 =====
export function statLines(it) {
  if (it && it.unidentified) return "未鑑定 — 鑑定が必要";
  const parts = [];
  const f = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`); };
  f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
  f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
  f("HP", it.hp); f("MP", it.mp);
  if (it.crit) parts.push(`会心 +${Math.round(it.crit * 100)}%`);
  const ea = elemStatText("攻撃", it.eAtk);
  const ed = elemStatText("防御", it.eDef);
  if (ea) parts.push(ea);
  if (ed) parts.push(ed);
  if (it.use && it.use.heal) parts.push(`HP +${it.use.heal}`);
  if (it.use && it.use.mp) parts.push(`MP +${it.use.mp}`);
  if (it.use && it.use.cure) parts.push(`毒を治す`);
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
  };
}

// 装備候補の「装備中と比べた増減」行 (増・緑/減・赤)。何かを付け替えるときだけ呼ぶ。
export function equipCompareEl(p, cand) {
  const d = equipPreviewDelta(p, cand);
  const row = el("span", "eq-cd");
  row.appendChild(el("span", "eq-cd-lab", "装備すると"));
  let any = false;
  if (d) {
    for (const [label, k] of [["ATK", "atk"], ["VIT", "vit"], ["AGI", "agi"], ["INT", "int"], ["PIE", "pie"], ["LUK", "luk"], ["HP", "hp"], ["MP", "mp"]]) {
      const v = d[k];
      if (!v) continue;
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
export function gearScore(doll, delta) {
  if (!delta) return 0;
  const W = gearWeights(doll);
  let s = 0;
  for (const k in W) s += (delta[k] || 0) * W[k];
  s += (delta.crit || 0) * 0.5;
  const lv = (e) => (e && e.el ? Math.min(2, e.lv || 1) : 0);
  for (const ch of [delta.elemAtk, delta.elemDef]) if (ch) s += (lv(ch.to) - lv(ch.from)) * 4;
  return Math.round(s * 10) / 10;
}

// 部位カテゴリ表記
export const CAT_LABEL = { weapon: "武器", shield: "盾", body: "防具", head: "頭防具", hands: "小手", feet: "足防具", acc: "装飾品", use: "消耗品", misc: "収集品", mat: "貴重品" };
// アイテムの分類表記 (武器はサブカテゴリつき: 「武器（長剣）」)
export function itemCatText(it) {
  if (it.slot === "weapon" && it.cat) return `武器（${WEAPON_CAT_LABEL[it.cat] || "その他"}）`;
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
    if (it.use && it.use.heal) L.push(`HPを ${it.use.heal} 回復`);
    if (it.use && it.use.mp) L.push(`MPを ${it.use.mp} 回復`);
    if (it.use && it.use.cure) L.push("毒を治す");
  } else if (it.slot === "misc") {
    L.push("商店で売って金にする戦利品");
  } else if (it.slot === "mat") {
    L.push("用途は街で見つかるかもしれない");
  } else {
    // 射程は隊列システムで実際に使われるので表示する。旧 Wizardry 風の
    // 命中/ダイス/攻撃回数 は戦闘で使われないため表示しない
    if (it.slot === "weapon") L.push(`射程: ${RANGE_LABEL[weaponRange(it)]}`);
    // 六大ステ (ATK/VIT/AGI/INT/PIE/LUK) への補正
    const mod = [];
    const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
    f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
    if (it.crit) mod.push(`会心+${Math.round(it.crit * 100)}%`);
    if (mod.length) L.push(mod.join(" / "));
  }
  // 属性攻撃/属性防御 (1行ずつのくわしい表記)
  for (const ln of elemDetailLines("攻撃", it.eAtk)) L.push(ln);
  for (const ln of elemDetailLines("防御", it.eDef)) L.push(ln);
  if (isEquippable(it)) L.push(equipClassText(it));
  if (it.align) L.push(`${it.align}属性。`);
  return L;
}

function clsLabel(k) { return (SOUL_CLASSES[k] || {}).label || k; }

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
  if (it.slot === "shield") return "適性: 盾持ち職";
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


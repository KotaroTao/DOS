// 職ごとの技・パッシブの集約窓口 (jobkit)。
// 各職のファイル (fighter.js …) が { awaken, table, skills, perks } を持つ:
//   awaken = ランクのパッシブのキー (4段)。魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES。宿し技として貸せる)
//   table  = 習得表。「Lv 技キー」または「Lv パッシブキー/パッシブLv」を空白区切りで並べた文字列 (souls.js の T が展開する)
//   skills = その職だけの固有技。skilldefs.js の SPELLS に合流する (項目の意味は skilldefs.js 冒頭)
//   perks  = その職だけの固有パッシブ。souls.js の PASSIVES に合流し (名前・説明)、効果 fx は combat.js が読む
// 他の職と同じ技は「共通技」(ヒール・キュア・初級呪文・盾打ち…) に限り、各職の技の3割程度に留める。
// 技キー・パッシブキーはセーブ (宿し技の借用・技の並び) に残るので、改名・使い回しはしない。
//
// ===== 固有パッシブの効果 fx (成分の配列。値の配列はパッシブLv 1,2,3… の順) =====
//  { t:"deal",  v:[…], on?, when?, aura? }   与ダメージ +v (0.15 = +15%)
//  { t:"take",  v:[…], on?, when?, aura? }   被ダメージ −v (0.15 = −15%。下限は ×0.2)
//  { t:"crit",  v:[…], on?, when?, aura? }   物理の会心率 +v
//  { t:"evade", v:[…], when?, aura? }        敵の物理をかわす確率 +v
//  { t:"heal",  v:[…] }                      回復呪文・技の回復量 +v
//  { t:"cost",  v:[…], on? }                 技・呪文の消費MP −v (on = 技の種別 phys/atk/heal/buff/debuff/cure…。合計の上限 50%)
//  { t:"stat",  mul:{atk|vit|agi|int:[…]}, when? }  戦闘中の能力 ×(1+v)。when は自分の状態 (ラウンドの初めに判定し直す)
//  { t:"start", chance?, when?, party?, dur?, buff?:{stat:[…]}, foe?:{stat:[…]}, barrier?:[…], regen?:[…], mp?:[…], endure?, taunt?, charge?:[…] }
//               戦闘開始時: 自分 (party なら味方全体) を強化 (buff の値は倍率 1.2 など) / 敵全体を弱体 (foe) /
//               魔障壁の回数 / リジェネ (最大HPの割合) / MP を最大の割合だけ回復 / 不屈を1回 / 挑発 / 溜め
//  { t:"round", chance?, when?, party?, hp?:[…], mp?:[…], buff?:{stat:[…]}, dur? }  2ラウンド目以降の毎ラウンド初め
//  { t:"kill",  chance?, hp?:[…], mp?:[…], buff?:{stat:[…]}, dur? }   自分の手番で敵を倒した時
//  { t:"hurt",  chance?, on?, buff?:{stat:[…]}, dur?, thorns?:[…], mp?:[…], hp?:[…] }  敵の物理 (on:"breath" ならブレス) を受けた時。
//               thorns = 受けたダメージのその割合を相手に返す
//  { t:"hit",   chance:[…], on?, ail, pct?, turns?, mul?, el? }  自分の物理が敵に当たった時、確率で付与:
//               ail = poison(pct=毎ターンの割合) / para / sleep / confuse / charm / seal(turns) / flinch / strip /
//                     atk・vit・agi (mul 倍率の弱体) / vuln (el 属性の耐性を mul に)
//  { t:"cast",  chance?, on?, refund?, hp?:[…], mp?:[…], party? }  技・呪文を使った後 (on = 技の種別): 消費MPを返す /
//               自分 (party なら味方全体) のHPを最大の割合だけ回復 / MPを最大の割合だけ回復
//  { t:"fall",  chance?, buff?:{stat:[…]}, dur?, hp?:[…] }  味方が倒れた時、生きている自分に
//  { t:"win",   hp?:[…], mp?:[…], party? }  戦闘に勝った後、HP/MP を最大の割合だけ回復 (party なら味方全体)
//  on (与/被ダメ・会心・命中時): "phys" = 物理全般 / "basic" = 通常攻撃 / "skill" = 物理技 / "spell" = 攻撃呪文 (受ける側では敵の全体呪文) / "breath" = ブレス
//  aura: true = 持ち主が生きている間、味方全員に効く (deal/take/crit/evade)
//  chance は 0〜1 (配列ならLvごと)。dur は既定3ターン。
//  when (条件。すべて満たす時だけ効く。tgt = 与える時は攻撃先、受ける時は攻撃してきた敵):
//    race:[種族…] / tgtElem:"fire" / tgtAil (状態異常・怯み中) / tgtDebuffed (弱体中) / tgtLow:0.5 (HP割合以下) / tgtHigh:0.8 (以上) /
//    boss / noBoss / selfLow:0.5 / selfHigh:0.8 / selfAil / buffed (自分が強化中) / defending / mpHigh:0.5 /
//    round1 / roundGE:3 / preempt (先制した戦闘) / front / back (自分の隊列) / crowd:3 (敵の数以上) / lastFoe (敵が残り1体) /
//    allyDown (倒れた味方がいる) / alone (生き残りが自分だけ) / elem:"fire" (攻撃の属性) /
//    tgtWeak (攻撃の属性が相手の弱点) / tgtWeakened (相手が状態異常・怯み・弱体のどれか)
import fighter from "./fighter.js";
import knight from "./knight.js";
import priest from "./priest.js";
import mage from "./mage.js";
import thief from "./thief.js";
import bishop from "./bishop.js";
import samurai from "./samurai.js";
import berserker from "./berserker.js";
import hunter from "./hunter.js";
import shadow from "./shadow.js";
import paladin from "./paladin.js";
import guardian from "./guardian.js";
import spellblade from "./spellblade.js";
import monk from "./monk.js";
import hexer from "./hexer.js";
import hermit from "./hermit.js";
import brigand from "./brigand.js";
import arcthief from "./arcthief.js";
import crusader from "./crusader.js";
import battlemage from "./battlemage.js";
import darkknight from "./darkknight.js";
import templar from "./templar.js";
import exorcist from "./exorcist.js";
import warden from "./warden.js";
import arcanist from "./arcanist.js";
import inquisitor from "./inquisitor.js";
import archbishop from "./archbishop.js";
import ascetic from "./ascetic.js";
import hero from "./hero.js";
import asura from "./asura.js";
import dragonknight from "./dragonknight.js";
import necromancer from "./necromancer.js";
import sage from "./sage.js";
import cardinal from "./cardinal.js";
import archmage from "./archmage.js";
import chaplain from "./chaplain.js";

export const JOBKIT = {
  fighter, knight, priest, mage, thief, bishop,
  samurai, berserker, hunter, shadow, paladin, guardian, spellblade, monk, hexer, hermit, brigand, arcthief,
  crusader, battlemage, darkknight, templar, exorcist, warden, arcanist, inquisitor, archbishop, ascetic,
  hero, asura, dragonknight, necromancer, sage, cardinal, archmage, chaplain,
};

// ---- 検証 (読み込み時に壊れた定義を弾く) ----
const SKILL_KEYS = new Set(("name mp kind target desc power hits scatter critBonus element acc pierce intScale agiScale vitScale pieScale " +
  "desperate execute prey debuff vuln seal poison para sleepChance flinchChance strip charm confuse instakill steal plunder drain mpDrain " +
  "hpCost gravity partyHeal buff taunt shield stance charge regen grantBarrier grantEndure cure purge revive revivePct dur debuffAll tech quiet " +
  "ward faith float sense mpPct").split(" "));
const KINDS = new Set(["phys", "atk", "heal", "cure", "buff", "debuff", "mana", "sleep", "escape", "field"]);
const TARGETS = new Set(["enemy", "all-enemy", "ally", "all-ally", "self"]);
const ELS = new Set(["fire", "water", "wind", "earth", "light", "dark"]);
const STATS = new Set(["atk", "vit", "agi", "int", "pie", "hit"]);
const FX_FIELDS = {
  deal: "v on when aura", take: "v on when aura", crit: "v on when aura", evade: "v when aura", heal: "v", cost: "v on",
  stat: "mul when", start: "chance when party dur buff foe barrier regen mp endure taunt charge",
  round: "chance when party hp mp buff dur", kill: "chance hp mp buff dur", hurt: "chance on buff dur thorns mp hp",
  hit: "chance on ail pct turns mul el", cast: "chance on refund hp mp party", fall: "chance buff dur hp", win: "hp mp party",
};
const WHEN = new Set(("race tgtElem tgtAil tgtDebuffed tgtLow tgtHigh boss noBoss selfLow selfHigh selfAil buffed defending mpHigh " +
  "round1 roundGE preempt front back crowd lastFoe allyDown alone elem tgtWeak tgtWeakened").split(" "));
const AILS = new Set(["poison", "para", "sleep", "confuse", "charm", "seal", "flinch", "strip", "atk", "vit", "agi", "vuln"]);
function fail(job, what, msg) { throw new Error(`jobkit/${job}: ${what}: ${msg}`); }
function checkSkill(job, key, sp) {
  if (!/^[A-Z][A-Z0-9_]+$/.test(key)) fail(job, key, "技キーは英大文字");
  for (const k in sp) if (!SKILL_KEYS.has(k)) fail(job, key, `未知の項目 ${k}`);
  if (!sp.name || !sp.desc || typeof sp.mp !== "number") fail(job, key, "name/desc/mp が必要");
  if (!KINDS.has(sp.kind)) fail(job, key, `kind ${sp.kind}`);
  if (!TARGETS.has(sp.target)) fail(job, key, `target ${sp.target}`);
  if (sp.element && !ELS.has(sp.element)) fail(job, key, `element ${sp.element}`);
  if ((sp.kind === "phys" || sp.kind === "atk") && !sp.gravity && !(sp.power > 0)) fail(job, key, "攻撃技には power が必要");
  if (sp.kind === "phys" && !/enemy/.test(sp.target)) fail(job, key, "物理技の対象は敵");
  for (const o of ["buff", "debuff", "debuffAll"]) if (sp[o]) for (const s in sp[o]) if (!STATS.has(s)) fail(job, key, `${o}.${s}`);
  if (sp.ward) for (const s in sp.ward) if (!["breath", "spell"].includes(s) || !(sp.ward[s] > 0 && sp.ward[s] < 1)) fail(job, key, `ward.${s}`);
  if (sp.faith && sp.kind !== "atk") fail(job, key, "faith は攻撃呪文だけ");
  if (sp.kind === "field" && !sp.float && !["enemy", "chest", "stairs"].includes(sp.sense)) fail(job, key, "迷宮で唱える技には効果 (float / sense) が必要");
}
function checkPerk(job, key, pk) {
  if (!/^[a-z][A-Za-z0-9]+$/.test(key)) fail(job, key, "パッシブキーは英小文字始まり");
  if (!pk.label || !Array.isArray(pk.lv) || !pk.lv.length || !Array.isArray(pk.fx) || !pk.fx.length) fail(job, key, "label/lv/fx が必要");
  for (const c of pk.fx) {
    const allow = FX_FIELDS[c.t];
    if (!allow) fail(job, key, `未知の fx ${c.t}`);
    const ok = new Set(["t", ...allow.split(" ")]);
    for (const k in c) if (!ok.has(k)) fail(job, key, `fx ${c.t} に未知の項目 ${k}`);
    if (c.when) for (const w in c.when) if (!WHEN.has(w)) fail(job, key, `when.${w}`);
    if (c.t === "hit" && !AILS.has(c.ail)) fail(job, key, `hit.ail ${c.ail}`);
    if (["deal", "take", "crit", "evade", "heal", "cost"].includes(c.t) && c.v == null) fail(job, key, `fx ${c.t} に v が必要`);
    for (const o of ["buff", "foe"]) if (c[o]) for (const s in c[o]) if (!STATS.has(s)) fail(job, key, `${o}.${s}`);
    // mul は stat では能力ごとの表、hit では弱体の倍率 (数か Lv ごとの配列)
    if (c.t === "stat") { if (!c.mul) fail(job, key, "stat に mul が必要"); for (const s in c.mul) if (!STATS.has(s)) fail(job, key, `mul.${s}`); }
    else if (c.mul != null && !(typeof c.mul === "number" || Array.isArray(c.mul))) fail(job, key, "hit.mul は数か配列");
  }
}

export const JOBKIT_SKILLS = {};
export const JOBKIT_PERKS = {};
export const JOBKIT_TABLES = {};
export const JOBKIT_AWAKEN = {};
for (const job in JOBKIT) {
  const kit = JOBKIT[job];
  JOBKIT_TABLES[job] = kit.table;
  if (!/^[a-z][A-Za-z0-9]+$/.test(kit.awaken || "")) fail(job, "awaken", "ランクのパッシブのキーが必要");
  JOBKIT_AWAKEN[job] = kit.awaken;
  for (const key in kit.skills || {}) {
    if (JOBKIT_SKILLS[key]) fail(job, key, "技キーが他の職と重複");
    checkSkill(job, key, kit.skills[key]);
    JOBKIT_SKILLS[key] = kit.skills[key];
  }
  for (const key in kit.perks || {}) {
    if (JOBKIT_PERKS[key]) fail(job, key, "パッシブキーが他の職と重複");
    checkPerk(job, key, kit.perks[key]);
    const pk = kit.perks[key];
    // 表示の「パーティ全体に効く/自分にだけ効く」: 味方全体へ及ぶ成分 (aura / party) があれば party
    JOBKIT_PERKS[key] = { ...pk, scope: pk.fx.some((c) => c.aura || c.party) ? "party" : "self" };
  }
}

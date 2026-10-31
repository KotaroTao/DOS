import { applyChallengeEnemies } from "./progression.js";
import { luckCritBonus, procChance, hitChance, elementValues, elementStat, elementAttack, elementMultiplier, elementWeakness, elementDefenseReduction, permanentMultiplier } from "./combatrules.js";
import { canonicalPassiveKey, UNHOLY } from "./jobkit/common.js";
import { random } from "./rng.js";
import { lvPow } from "./levelcurve.js";
import { monsterResists } from "./resistance.js";
// 隊・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";
import { ITEMS, hasQuality, rollQuality, applyQuality, weaponRange, scaleBonus, useTarget, useHelps, useCureKinds, useWhere, offhandOf, DUAL_SKILL_SHARE } from "./items.js";
import { ELEMENTS, elementAffinity, monStats, rankStats, resistRate, resistHpMul, METAL_TIERS } from "./dungeons/schema.js";

import { SPELLS } from "./skilldefs.js";
import { JOBKIT_PERKS, VICTORY_MP_PER, PASSIVE_JOB } from "./jobkit/index.js";
export { VICTORY_MP_PER };
import { STAGED, STAGE_MAX, STRONG_MIN, BATTLE_LONG, isBattleLong, stageMul, stageOf, effectStage, stageLabel, ENEMY_STAT_LABEL } from "./buffstage.js";
export { SPELLS };

// 討伐した本人の✦Soulだけを増やす。主を強敵より先に判定する。
export function enemySoulRewardMul(e) {
  return e.boss || e.mon?.boss ? 3 : e.mon?.elite || e.mon?.named ? 2 : 1;
}

// 敵が使う自己強化 (enemyAct の WARCRY 相当) の既定持続ターン数
export const ENEMY_BUFF_DUR = 3;
// 大技の予兆 (溜め): 主・精鋭が手番に溜めを始める確率と、放つ大技の倍率
const CHARGE_RATE = { boss: 0.30, elite: 0.25 };
const CHARGED = { smash: 2.2, smashAcc: 0.13, wide: 0.85, breath: 1.6 };
const OMEN_TEXT = {
  smash: (n) => `${n}：強打の構え`,
  wide: (n) => `${n}：全体強打の構え`,
  breath: (n) => `${n}：強ブレスの構え`,
  spell: (n) => `${n}：大呪文の構え`,
};
const OMEN_NOTE = "力を溜めている！";
// 払いのけ: 主・精鋭は弱体の厚み (段の合計) がこれ以上になると、手番にこの確率で振り払う
const SHAKE_AT = 3, SHAKE_RATE = 0.5;
// 打ち消し (特技 "dispel"): 隊の強化の厚みがこれ以上の時だけ使う
const DISPEL_AT = 2;

// アイテムは個体ごとに複製して持たせる (装備状態を個別管理するため)
// 装備品は手に入れるたびに品質 0〜100 を引く (items.js applyQuality)。q を渡せばその品質 (商会の棚の品 = 並品 50)
export function cloneItem(id, q) {
  const t = ITEMS[id];
  if (!t) return null;
  const it = { ...t };
  if (hasQuality(it)) { it.q = q == null ? rollQuality() : q; applyQuality(it); }
  return it;
}

let _uid = 0;
export function syncEnemyUids(enemies) {
  for (const e of enemies || []) if (Number.isSafeInteger(e.uid)) _uid = Math.max(_uid, e.uid);
}
// 敵の表示Lv の札「（Lv29）」(enemylevel.js — combat.js の組み立てを借りるので、game.js が渡す)
let _enemyLvTag = () => "";
export function setEnemyLvTag(fn) { _enemyLvTag = typeof fn === "function" ? fn : () => ""; }
// 敵の群れは最大6体 (前衛3+後衛3)
export const MAX_ENEMIES = 6;
// 会心倍率の装備補正は物理・魔法を別々に合算し、合計の上限は設けない。
export function gearCritMul(actor, spell = false) {
  return 1 + Math.max(0, actor[spell ? "spellCritDamageBonus" : "critDamageBonus"] || 0);
}

// 必殺 (暗殺者のランク): 物理会心の倍率を20/30/40/50%増やす。装備の補正とも重なる。
export function physicalCritMul(actor, bonus = 0) {
  const lv = actor?.side === "party" ? pv(actor, "shadowHissatsu") : 0;
  return (gearCritMul(actor) + bonus) * (1 + (lv ? [0.20, 0.30, 0.40, 0.50][Math.min(4, lv) - 1] : 0));
}

// 待ち伏せは先制率への固定加算。奇襲率が高くても、増えた先制の枠を削らない。
export function openingRates(preempt, ambush, hunterLv = 0) {
  const bonus = [0, 0.05, 0.10, 0.15, 0.20][Math.min(4, Math.max(0, hunterLv))];
  const pre = Math.min(1, Math.max(0, preempt + bonus));
  const amb = Math.min(Math.max(0, ambush), hunterLv ? 1 - pre : 1);
  return { pre, amb };
}

// カードでめくったモンスター: 階層が深いほど群れが膨らむ (最大6体)。scale で迷宮ごとの強さ調整。
// 「もう1体」を確率 p で繰り返す幾何分布 — 1階 p≈0.26 (平均1.4体) → 5階以深 p≈0.6 (平均2.4体、まれに6体)。
// opts.min は最低数の強制 (大警報の群れなど)。opts.pool はこの階の雑魚の候補 (通常の魔物の札だけ)。
export function spawnCardEnemies(key, floor, scale = 1, opts = {}) {
  const p = Math.min(0.62, 0.18 + floor * 0.08);
  let count = 1;
  while (count < MAX_ENEMIES && random() < p) count++;
  if (opts && opts.min) count = Math.max(count, Math.min(MAX_ENEMIES, opts.min));
  const m = MONSTERS[key];
  // 群棲: 群れで現れる敵は最低3体で湧く
  if (m && m.pack) count = Math.max(count, Math.min(MAX_ENEMIES, 3));
  let list;
  // 役割持ち (role) の群れ: 本体1体 + 取り巻き (escort)。回復役・呼び手は後衛
  // (index 3+) に立つので、長射程の武器か呪文がないと直接は狙えない。
  // 護り手 (guard) は前衛に立ち、取り巻きへの攻撃を肩代わりする。
  if (m && m.role && m.escort && MONSTERS[m.escort]) {
    const back = m.role !== "guard";
    count = Math.max(count, back ? 4 : 3); // 後衛役は前衛3体が必要なので最低4体
    const escorts = Array.from({ length: count - 1 }, () => makeEnemy(m.escort, scale));
    list = back ? [...escorts, makeEnemy(key, scale)] : [makeEnemy(key, scale), ...escorts];
  } else {
    const keys = Array(count).fill(key);
    // 複数体の75%は別種と混ざる。札の魔物は必ず残し、数・強さの倍率は変えない。
    // 主・強敵・金属・出来事専用・役割持ちは取り混ぜず、専用の編成を守る。
    const pool = [...new Set(opts?.pool || [])].filter((k) => {
      const foe = MONSTERS[k];
      return k !== key && foe && !foe.boss && !foe.elite && !foe.metal && !foe.evOnly && !foe.role;
    });
    if (count > 1 && pool.length && m && !m.boss && !m.elite && !m.metal && !m.evOnly && !m.role && random() < 0.75) {
      const kinds = [key, pool.splice(Math.floor(random() * pool.length), 1)[0]];
      // 4体以上なら半数は3種類。少数の群れには同種が並ぶ形も残す。
      if (count >= 4 && pool.length && random() < 0.5) kinds.push(pool[Math.floor(random() * pool.length)]);
      for (let i = 1; i < count; i++) keys[i] = i < kinds.length ? kinds[i] : kinds[Math.floor(random() * kinds.length)];
      // 札の魔物を先頭に残し、残りを混ぜて前衛・後衛の顔ぶれにも変化を付ける。
      for (let i = count - 1; i > 1; i--) {
        const j = 1 + Math.floor(random() * i);
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
    }
    list = keys.map((k) => makeEnemy(k, scale));
  }
  // 同種の群れは A/B/C… で呼び分ける (ログ・対象選択の判別用)
  const byKey = {};
  for (const e of list) (byKey[e.key] = byKey[e.key] || []).push(e);
  for (const k in byKey) if (byKey[k].length > 1) byKey[k].forEach((e, i) => { e.name += String.fromCharCode(65 + i); });
  return list;
}

// bossRank: 層基準ランク (1-10)。指定すると、ボスの def の rank ではなく
// この層相応のランクで HP/STR 等を組み直す (暫定ボスや低ランクボスが弱すぎる問題への対処)。
export function spawnBossEnemies(key = "dragon", scale = 1, bossRank = 0) {
  return [makeEnemy(key, scale, true, bossRank)];
}

// 強敵階の強敵: 必ず単体で出現する規格外の個体。
// boss フラグは立てない (迷宮踏破の判定・主討伐演出と混同しないため)
export function spawnEliteEnemies(key, scale = 1) {
  return [makeEnemy(key, scale)];
}

// 宝箱から出るミミック。強さは「その階に出る敵の最上位ランク」を基準に組む:
// 通常のミミックは +1 ランク、マスターミミックは +2 ランクの個体として
// ステータス曲線 (rankStats: rank10 を超えても同じ曲線で伸びる) から直接作る。
// floorRank: その階の雑魚の最上位ランク / scale: その階の雑魚と同じ強さ補正 (game.js の mimicRef)。
// 見た目は固定のミミック絵。固有ドロップは無く、上質な宝箱を残す。
export function mimicRank(floorRank, master = false) {
  return Math.max(1, floorRank) + (master ? 2 : 1);
}
export function spawnMimic(floorRank, scale = 1, master = false) {
  const rank = mimicRank(floorRank, master);
  const e = makeEnemy(master ? "master_mimic" : "mimic", scale);
  const st = rankStats(rank);
  e.mimicRank = rank;
  e.element = "none";
  e.name = master ? "マスターミミック" : "ミミック";
  e.isMimic = true; // 撃破時は宝箱が確定出現し、中身が上質になる (game.js の endBattle)
  if (master) e.isMasterMimic = true; // 宝箱の中身がさらに上質 (アイテムLv+30)
  // 単体で隊を相手にする化け物。上位ランクの体を、群れ数体分の HP と連撃で補う
  // (通常 = 上位ランク2体分強 / マスター = 外殻の物理抵抗値50と合わせて上位ランク3体分以上の耐久と手数)。
  e.maxhp = Math.max(1, Math.round(st.hp * scale * (master ? 2.6 : 2.4) * resistHpMul({ physResist: master ? 50 : 0 })));
  e.hp = e.maxhp;
  e.atk = Math.max(1, Math.round(st.atk * scale * (master ? 1.1 : 1.0)));
  e.vit = Math.round(st.def * scale * (master ? 1.6 : 1.3));
  e.agi = st.spd + (master ? 8 : 4);             // ミミック: 不意を突いて先に動きやすい
  e.multistrike = master ? 3 : 2;                // 牙で噛みつき連撃 (一手で複数回)
  e.resists = monsterResists({ ...e.mon, rank, elite: true, resists: e.mon.resistOverrides || {} });
  e.physResist = master ? 50 : 0;
  e.resists.physResist = e.physResist;                 // マスターは硬い外殻 (物理抵抗値50 = 50%軽減)
  if (master) { e.ability = "soulSteal"; e.lifesteal = 0.3; }
  e.gold = Math.round(st.gold * scale * (master ? 3 : 2));
  e.soul = Math.round(st.soul * scale * (master ? 2 : 1.5));
  e._scale = scale;
  return [e];
}

// 出来事の魔物 (events.js の看守など): 「その階の雑魚の最上位ランク + plus」の体で組み直す。
// ミミックと同じく rankStats の曲線から直接作り、どの層の出来事でも「その階より一段上」を保つ。
// 単体で隊を相手にするので HP は群れ数体分 (hpMul)。特性・能力 (ability/endure など) は def のまま。
export function spawnRanked(key, floorRank, plus = 1, scale = 1, hpMul = 2.2) {
  const rank = Math.max(1, floorRank) + plus;
  const st = rankStats(rank);
  const e = makeEnemy(key, scale);
  e.evRank = rank;
  e.maxhp = e.hp = Math.max(1, Math.round(st.hp * scale * hpMul * resistHpMul(e.mon)));
  e.atk = Math.max(1, Math.round(st.atk * scale));
  e.vit = Math.round(st.def * scale * 1.2);
  e.agi = (e.mon && e.mon.swift ? st.spd + 4 : st.spd) + 2;
  e.resists = monsterResists({ ...e.mon, rank, elite: true, resists: e.mon.resistOverrides || {} });
  e.gold = Math.round(st.gold * scale * 1.5);
  e.soul = Math.round(st.soul * scale * 1.5);
  return [e];
}

// 金属の魔物 (メタル系): 稀に紛れ込む、倒せば莫大な✦Soul を残す逃げ足の魔物。強さは段 (METAL_TIERS) と
// 出現した階の雑魚の最上位ランクで決まる。ref = { rank, scale, count, agi, soul, gold } (game.js metalRef)
//   HP は段ごとの小さな固定値 (1ダメージずつ削れる量)。STR は弱め、VIT は硬め (会心の一撃の通りに効く)。
//   AGI は味方と同じ規模 (基準AGI × agiMul) で渡され、ほとんどの人業より先に動く。soul/gold は1体あたり
export function spawnMetal(key, ref = {}) {
  const m = MONSTERS[key];
  const T = m && METAL_TIERS[m.metal];
  if (!T) return [makeEnemy(key, ref.scale || 1)];
  const st = rankStats(Math.max(1, ref.rank || m.rank || 1));
  const sc = ref.scale || 1;
  const n = Math.max(1, Math.min(T.max, MAX_ENEMIES, ref.count || 1));
  const list = Array.from({ length: n }, () => {
    const e = makeEnemy(key, 1);
    e.maxhp = e.hp = T.hp + Math.round(st.hp * sc * (T.hpRank || 0));
    e.atk = Math.max(1, Math.round(st.atk * sc * 0.6));
    e.vit = Math.round(st.def * sc * 1.5);
    e.agi = Math.max(1, Math.round(ref.agi || st.spd * 4));
    e.element = "none";
    e.soul = Math.max(1, Math.round(ref.soul || st.soul * T.soulMul));
    e.gold = Math.max(1, Math.round(ref.gold || st.gold * T.goldMul));
    e._tuneK = 1; // 迷宮の手直し (DUNGEON_TUNE) で戦果を割り戻さない
    return e;
  });
  if (list.length > 1) list.forEach((e, i) => { e.name += String.fromCharCode(65 + i); });
  return list;
}

function makeEnemy(key, scale = 1, boss = false, bossRank = 0) {
  const m = MONSTERS[key];
  // 層ボスは bossRank が指定されていれば、その層相応のランクでステータスを組み直す
  // (def の rank が低い暫定ボスでも、層に見合った強さの主として立ちはだかる)。
  const b = (boss && bossRank) ? monStats(bossRank, true) : null;
  const baseHp = b ? b.hp : m.maxhp, baseAtk = b ? b.atk : m.atk;
  const baseDef = b ? b.def : m.def, baseSpd = b ? b.spd : m.spd;
  const baseSoul = b ? b.soul : m.soul, baseGold = b ? b.gold : m.gold;
  const hp = Math.max(1, Math.round(baseHp * scale * resistHpMul(m, boss)));
  return {
    uid: ++_uid, key, mon: m, name: (boss ? m.name : m.name),
    element: m.element || "none",
    affinity: m.affinity || { weak: [], resist: [] },
    resists: monsterResists({ ...m, boss: boss || m.boss, rank: bossRank || m.rank, resists: m.resistOverrides || {} }),
    hp, maxhp: hp,
    // モンスター定義の atk/def/spd を六大ステへ写像 (def→VIT, spd→AGI)
    atk: Math.max(1, Math.round(baseAtk * scale)),
    vit: Math.round(baseDef * scale),
    // 俊敏: AGI を底上げして先に動きやすくする / 神速: さらに大きく底上げし、1ターンに2度動く (_startRound)
    agi: baseSpd + (m.swift ? 4 : 0) + (m.haste ? 8 : 0),
    haste: !!m.haste,
    abRate: m.abRate || 0, // 特殊能力を使う確率 (0 = 既定の 25%・ブレス 30%)。第5層からの魔物は特色を強く押し出すため高い
    soul: Math.round(baseSoul * scale), gold: Math.round(baseGold * scale),
    boss: boss || !!m.boss,
    ability: m.ability || null, // 特殊能力 (毒/麻痺/石化/即死/窃盗/ドレイン/ブレス)
    // 個体特性: 物理被ダメ軽減 / 魔法被ダメ増 / 自己再生 / 回避
    elemAtk: m.elemAtk || m.eAtk || null, elemDef: m.elemDef || m.eDef || null, accuracyPower: m.accuracyPower ?? 1, hitBonus: m.hitBonus || 0,
    physResist: m.physResist || 0, magWeak: m.magWeak || 1, regen: m.regen || 0, evasive: !!m.evasive,
    // 追加特性: 魔法耐性 / 激昂(手負いで強化) / 不屈(致死を1度耐える) / 吸血 / 連撃 / 障壁(被ダメ半減の回数)
    magResist: m.magResist || 0, enrage: !!m.enrage, endure: !!m.endure,
    lifesteal: m.lifesteal || 0, multistrike: m.multistrike || 0, _barrierLeft: m.barrier || 0,
    // 役割 (healer=回復役 / guard=護り手 / summoner=呼び手)。_scale は召喚の強さ引き継ぎ用
    role: m.role || null, summonKey: m.summonKey || null, _scale: scale,
    // 金属の体 (METAL_TIERS の段): 呪文・状態異常・弱体が効かず、会心でない物理は1ダメージ。手番に逃げ出す
    metal: m.metal || 0,
    _guardLeft: m.role === "guard" ? 3 : 0, // 護り手が肩代わりできる残り回数
    alive: true, asleep: false, side: "enemy",
  };
}

const rand = (n) => Math.floor(random() * n);
// 奇襲の1ターン目に各敵が動く確率 (最低1体は動く — Battle._ambushers)
const AMBUSH_ACT_RATE = 0.5;
// 写し身 (鏡の影) が攻撃の技を使う手番の割合 (MPが足りる時。回復は仲間が深手の時に別枠)
const MIMIC_SKILL_RATE = 0.6;
// 揺らぎ。基準値は先に四捨五入する (34.5 → 35)。回復量・ダメージに小数を出さない
const variance = (base) => { const b = Math.round(base); return Math.max(1, b + rand(Math.ceil(b * 0.4)) - rand(Math.ceil(b * 0.2))); };
// 揺らぎは上側が広く、平均は基準値より約10%高い。オートも同じ平均を読む。
const varianceMean = (base) => { const b = Math.max(1, Math.round(base)); return b + (Math.ceil(b * 0.4) - Math.ceil(b * 0.2)) * 0.5; };
// LUKの成長を会心確定へ直結させない。低い値では従来に近く、加算は最大25%。
export { luckCritBonus };
// 上位呪文ほどINT/PIEの伸びを受ける。全体呪文は単体より係数を抑える。
// 呪文の伸び (2026-10-16、ユーザーの指摘「物理に比べて魔法が弱過ぎる」): 物理技は 攻撃力 (武器で STR の約1.5〜2.5倍。
// 武器の Lv とともに育つ) × 技の倍率で伸びるのに、呪文は INT × 係数だけで、Lv40 から同じレア度の物理職の 1/4〜1/6 しか出なかった。
// 武器の倍率に当たるものとして、使い手の Lv (メイン魂の Lv。写し身はその階の Lv) で育つ倍率 spellGrowth を INT の係数に掛ける。
// Lv10 まで ×1、Lv50 で ×4、その先は 80Lv ごとに +1 (Lv130 ×5・Lv210 ×6)。単体の呪文どうし・全体の呪文どうしは同じ倍率なので
// MP 効率の比は変わらない。敵全体の呪文は伸びた分の6割 (allShare) — 物理の全体技は単体の1/3ほどなので、群れを一手で払う力が
// 強くなりすぎないように (全体技が単体技より得になりすぎない向きにだけ動く。tools/balance/attack-skills.mjs)
export const SPELL_GROWTH = { from: 10, to: 50, mid: 3, lateLv: 80, allShare: 0.6 };
export function spellGrowth(lv, all = false) {
  const g = SPELL_GROWTH, L = Math.max(1, lv || 1);
  const up = g.mid * Math.min(1, Math.max(0, (L - g.from) / (g.to - g.from))) + Math.max(0, L - g.to) / g.lateLv;
  return 1 + up * (all ? g.allShare : 1);
}
// 装備比較用の魔攻。技固有の威力・属性・会心・敵の耐性を掛ける前の基準値。
export function magicAttackPower(member, stat = "int") {
  return Math.round(Math.max(0, member?.[stat] || 0) * spellGrowth(member?.jobLv || member?.level || 1));
}
// lv = 使い手の Lv (Battle.lvOf)。省くと伸びなし (×1)
export function attackSpellPower(sp, stat, lv = 1) {
  const power = Math.max(0, sp.power || 0), all = sp.target === "all-enemy";
  return power + Math.max(0, stat || 0) * (0.25 + Math.min(140, power) / (all ? 60 : 40)) * spellGrowth(lv, all);
}
// 重力の基本ダメージ。上限を持つ技だけ有効INTで制限し、強化・耐性は後から適用する。
function gravityDamage(sp, intv, t) {
  const ratio = t.hp * sp.gravity * (t.boss ? 0.3 : 1);
  const cap = sp.gravityIntCap != null ? Math.max(0, intv) * sp.gravityIntCap : Infinity;
  return Math.max(1, Math.round(Math.min(ratio, cap)));
}
// 回復も上位の術に成長の余地を持たせる。初期ヒール(power14)の係数は従来の0.5。
export function healingPower(power, pie) {
  return (power || 0) + Math.max(0, pie || 0) * (0.5 + Math.max(0, Math.min(120, power || 0) - 14) / 160);
}
// 回復の技の量 (2026-10 作り直し、ユーザーの指示)。技の項目で決まる:
//  healPct  = 対象の最大HPの割合 (フルヒール系。揺らぎも魂の格の威力も乗らない)
//  bodyHeal = 使い手の最大HPの割合 (物理職の「体の手当て」。魔法職が借りても最大HPが小さいので弱い)
//  healMul  = ヒール (power 14 の式) の何倍か (ハイヒール 2.5)。無ければ旧来の power の式
//  healCap  = 1回の回復を対象の最大HPの割合で頭打ちにする (ヒール 50%・手当て 35% など)
// 魂の格の威力の倍率 (soulPowerMul) は healPct 以外に乗る
export const HEAL_BASE_POWER = 14;
export function healsHp(sp) { return !!sp && sp.kind === "heal" && (sp.healPct > 0 || sp.bodyHeal > 0 || sp.healMul > 0 || (sp.power || 0) > 0); }
// 揺らぎ・頭打ちの前の回復量 (pie = 強化込みの PIE)
export function spellHealRaw(actor, sp, pie) {
  if (!sp || sp.healPct) return 0;
  const soul = soulPowerMul(actor, sp);
  if (sp.bodyHeal) return ((actor && actor.maxhp) || 0) * sp.bodyHeal * soul;
  return (sp.healMul ? healingPower(HEAL_BASE_POWER, pie) * sp.healMul : healingPower(sp.power, pie)) * soul;
}
// 対象 t への実際の回復量 (amount = 揺らぎ後の量)
export function healOnTarget(sp, t, amount) {
  const mhp = (t && t.maxhp) || 0;
  if (sp.healPct) return Math.max(1, Math.round(mhp * sp.healPct));
  const v = Math.max(1, Math.round(amount));
  return sp.healCap ? Math.min(v, Math.max(1, Math.round(mhp * sp.healCap))) : v;
}
// 刃の癒し (物理技の bladeHeal): 与えたダメージ × 割合を味方全員へ。1人あたり最大HPの healCap (無ければ BLADE_HEAL_CAP) まで。
// 量が与ダメで決まるので、魔法職が借りても弱い。物理職が借りても低位の技は上限 (10%) で止まる
export const BLADE_HEAL_CAP = 0.25;

// 職業ランクパッシブのLvを引く (souls.js の recalcDoll が passiveMap を埋める)
const pv = (a, key) => (a && a.passiveMap && a.passiveMap[key]) || 0;
// 装備の極 (無限迷宮の追加の特性 X01〜X35) の印。items.js recalc が member.gearMisc に集める。味方だけ
const NOMISC = Object.freeze({});
const gm = (a) => (a && a.side === "party" && a.gearMisc) || NOMISC;
// 旧付呪の固定機能と武魂の可変値を共存させる。抽選は行動時だけ行う。
const bkValue=(a,key,fallback=0)=>Math.max(gm(a)[key]===true?fallback:Number(gm(a)[key]||0),Number(gm(a)[`bk_${key}`]||0));
const bkProc=(a,key)=>!!gm(a)[key]||((gm(a)[`bk_${key}`]||0)>0&&random()<gm(a)[`bk_${key}`]);
const bkInsight=a=>!!gm(a).insight||!!a?._bkInsight;

// 極「記憶の」: 前の手番に使った技と同じ技を続けて使うか (回復・蘇生の技は除く)
const memoryHalf = (a, sp, key) => !!(key && (gm(a).memory || gm(a).bk_memory) && a._lastSkill === key && sp && sp.kind !== "heal" && !sp.revive && !healsHp(sp));
// 動体視力の命中率加算 (DYNAMIC_VISION。味方 → 敵の物理だけ、金属の魔物は除く)
const visionHitBonus = (actor, tgt) => actor && actor.side === "party" && tgt && tgt.side === "enemy" && !isMetal(tgt)
  ? DYNAMIC_VISION[Math.min(3, pv(actor, "dynamicVision"))] || 0 : 0;
// 職ごとの固有パッシブ (jobkit の perks)。passiveMap のうち fx を持つものを {c: 成分, lv, label} の列で返す。
// passiveMap は recalcDoll が作り直すたびに別の器になるので、器ごとに覚えておく
const _perkCache = new WeakMap(), _gearCache = new WeakMap();
const NO_PERKS = [];
// 無限迷宮の追加の特性 (装備の fx。items.js recalc が a.gearPerks に集める) も固有パッシブと同じ形で足す
function perksOf(a) {
  const own = perksOfPassives(a);
  const gp = a && a.gearPerks;
  if (!gp || !gp.length) return own;
  let c = _gearCache.get(gp);
  if (!c || c.own !== own) { c = { own, list: [...own, ...gp] }; _gearCache.set(gp, c); }
  return c.list;
}
function perksOfPassives(a) {
  const pm = a && a.passiveMap;
  if (!pm || typeof pm !== "object") return NO_PERKS;
  let list = _perkCache.get(pm);
  if (list) return list;
  list = [];
  const levels = {};
  for (const k in pm) {
    const key = canonicalPassiveKey(k);
    levels[key] = Math.max(levels[key] || 0, pm[k]);
  }
  for (const key in levels) {
    const pk = JOBKIT_PERKS[key];
    if (!pk || !levels[key]) continue;
    for (const c of pk.fx) list.push({ c, lv: levels[key], label: pk.label, key });
  }
  _perkCache.set(pm, list);
  return list;
}
// Lv ごとの値 (配列なら Lv 番目。足りなければ最後) / 単なる数ならそのまま
const lvv = (v, lv) => (Array.isArray(v) ? v[Math.min(Math.max(1, lv), v.length) - 1] : v);
// hurt の on: "phys" (既定) / "breath" / "spell" / "magic" (ブレスと敵の呪文の両方)
const hurtOn = (on, kind) => (on || "phys") === kind || (on === "magic" && (kind === "breath" || kind === "spell"));
// やり返しの能力: atk = 攻撃力 (武器の参照式) / vit・int・pie = その能力 / mag = INT と PIE の高い方 (強化・弱体込み)
export const RET_STATS = ["atk", "vit", "int", "pie", "mag"];
// やり返しのパッシブは受けるたびに必ず返す。攻撃力と能力依存で係数を分ける。
// 攻撃力の係数は0.2〜1.0。2026-10-29: 報復の楯はVIT×5/10/15、魔力反射はINT×8。呪文返しの打ち消しだけは確率のまま (返すのは毎回)
export const KAESHI_RATE = [0.10, 0.15, 0.20, 0.30], KAESHI_K = [2, 3, 4, 5]; // 呪文返し (魔盗賊のランク2〜5)
export const REFLECT_K = 8; // 魔力反射 (魔闘士 Lv125)
// 反撃の構え (技・stance "counter") は技ごとの ctrMul (1.0〜3.0、習得Lv・消費MP・対象・付く効果で決める)。効果 ctr の倍率 = 1 + ctrMul
export const COUNTER_K = [0, 0.5, 0.75, 1.0], DIVINE_COUNTER_K = 3, STANCE_CTR_DEFAULT = 1.2, STANCE_CTR_MAX = 3;
export const PASSIVE_RET_MIN = 0.2, PASSIVE_RET_MAX = 1.0, STAT_RET_MAX = 15;
// 反射の陣 (技の reflect): 効果 rfl の倍率 = 1 + 係数、効果に唱えた者の魔力 (INT と PIE の高い方) を pow として持つ
export const REFLECT_MAX = 7.5;
// 掛かっている反射の一撃の強さ (係数 × 唱えた者の魔力。重ねがけは一番強いものだけ)。無ければ 0
export function reflectPow(t) {
  let best = 0;
  for (const ef of (t && t.effects) || []) if (ef.stat === "rfl" && ef.mult > 1) best = Math.max(best, Math.min(REFLECT_MAX, ef.mult - 1) * (ef.pow || 0));
  return best;
}
export const stanceMulOf = (sp) => Math.min(STANCE_CTR_MAX, (sp && sp.ctrMul) || STANCE_CTR_DEFAULT);
// 掛かっている反撃の構えの係数 (重ねがけは一番強いものだけ)。構えが無ければ 0
export function stanceCtrK(t) {
  let m = 1;
  for (const ef of (t && t.effects) || []) if (ef.stat === "ctr" && ef.mult > m) m = ef.mult;
  return Math.min(STANCE_CTR_MAX, m - 1);
}
// 固有パッシブ・目玉パッシブの発動を記録欄に書く時に添える「何が起きたか」(2026-10 ユーザーの指示:
// 「開戦の号令！」「闇の障壁！」だけでは何の効果か分からない)。定義の値から作る (段は buffstage.js の表で、実際に掛かる倍率)
const MOD_NAME = { allStats: "全能力", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", hit: "命中" };
function modText(stat, mult, enemy) {
  const nm = (enemy && ENEMY_STAT_LABEL[stat]) || MOD_NAME[stat] || stat.toUpperCase();
  if (STAGED.has(stat)) { const st = stageOf(mult); return `${nm}${stageLabel(st)}`; }
  return `${nm}×${Math.round(mult * 100) / 100}`;
}
function buffText(buff, lv, enemy) {
  return Object.keys(buff).map((k) => modText(k, lvv(buff[k], lv), enemy)).filter(Boolean).join("・");
}
// 成分 c (jobkit の fx) の説明。defDur = その発動の既定の持続 (start/kill/fall 3・round/hurt 2)
function perkNote(c, lv, defDur = 3) {
  const all = c.party ? "味方全員の" : "", to = c.party ? "味方全員に" : "";
  const dur = lvv(c.dur, lv) || defDur;
  const parts = [];
  if (c.buff) parts.push(`${all}${buffText(c.buff, lv)}、${dur}ターン`);
  if (c.foe) parts.push(`敵全体の${buffText(c.foe, lv, true)}、${dur}ターン`);
  if (c.barrier) parts.push(`${to}魔障壁${lvv(c.barrier, lv)}回（ブレス・呪文半減）`);
  if (c.wall) parts.push(`${to}魔法壁${lvv(c.wall, lv)}回（全ダメージ半減）`);
  if (c.regen) parts.push(`${to}リジェネ（毎ターン最大HP${Math.round((lvv(c.regen, lv) || 0) * 100)}%回復）、${c.dur || 3}ターン`);
  if (c.endure) parts.push(`${to}不屈（HP1で1回耐える）`);
  if (c.charge) parts.push(`${to}次の物理×${lvv(c.charge, lv)}`);
  if (c.taunt) parts.push(`敵を引き付ける、${c.dur || 2}ターン`);
  return parts.join("・");
}
// 回復した量を「HP+12 MP+3」の形で
const gainText = (h, m) => [h ? `HP+${h}` : "", m ? `MP+${m}` : ""].filter(Boolean).join(" ");
// 敵を引き付けている間に軽くなる被ダメの割合 (盾役の固有パッシブ take + when.taunting)。オートが挑発の値打ちを見込むのに使う
export function tauntGuard(a) {
  let g = 0;
  for (const { c, lv } of perksOf(a)) if (c.t === "take" && c.when && c.when.taunting && !c.aura) g += lvv(c.v, lv) || 0;
  return Math.min(0.8, g);
}
// 技・呪文の消費MPを削る固有パッシブ (cost) の合計 (上限70%)
function perkCostCut(actor, sp) {
  let cut = 0;
  for (const { c, lv } of perksOf(actor)) if (c.t === "cost" && (!c.on || c.on === sp.kind)) cut += lvv(c.v, lv) || 0;
  return Math.min(0.7, cut);
}
// 戦闘に勝った後の固有パッシブ (win): その人が受ける HP/MP 回復の割合 (自分の分 + 味方の party 付きの分)。
// MP は魂1つ (持ち主の人業 × パッシブを覚える職 PASSIVE_JOB) ごとに VICTORY_MP_PER まで、別の魂どうしは足す。
// ownMp = 共通パッシブ (魔力回路) のその人自身の分 {パッシブのキー: 割合} — 同じ魂の固有パッシブと合わせて頭打ちにする
export function perkVictory(p, party, ownMp = {}) {
  let hp = 0;
  const bySoul = new Map(); // 人業 → {職: 割合}
  const addMp = (q, key, v) => {
    if (!(v > 0)) return;
    const job = PASSIVE_JOB[key] || key;
    let m = bySoul.get(q);
    if (!m) bySoul.set(q, (m = {}));
    m[job] = (m[job] || 0) + v;
  };
  for (const k in ownMp) addMp(p, k, ownMp[k]);
  for (const q of party || [p]) {
    if (!q || !q.alive) continue;
    for (const { c, lv, key } of perksOf(q)) {
      if (c.t !== "win" || (q !== p && !c.party)) continue;
      hp += lvv(c.hp, lv) || 0;
      addMp(q, key, lvv(c.mp, lv) || 0);
    }
  }
  let mp = 0;
  for (const m of bySoul.values()) for (const j in m) mp += Math.min(VICTORY_MP_PER, m[j]);
  return { hp, mp };
}
// 逃走率の式の定数 (Battle.fleeChance)。主のいる戦いは追跡AGI を ×1.3 して逃げにくくする
const FLEE_BASE = 0.55, FLEE_SLOPE = 0.35, FLEE_MIN = 0.05, FLEE_MAX = 0.95, FLEE_BOSS_MUL = 1.3;
// 敵の物理を味方がかわす率 (AGI の相対値): 20% + 20% × log2(味方の実効AGI ÷ (敵の実効AGI × fleeK)) → 0〜40%。
// AGIの相対値から0〜20%の回避力。敵のAGIは逃走判定と同じ尺度へそろえる。
const EVADE_EVEN = 0.10, EVADE_SLOPE = 0.10, EVADE_MAX = 0.20;
// 動体視力 (dynamicVision、戦士・狩人・暗殺者・武僧・聖戦士・修羅・勇者・竜騎士): 味方の物理が敵に向かう時、
// 命中力を Lv1/2/3 = 10/15/20ポイント上げる (最終命中率上限95%)。
// 重ねがけはしない (メイン魂・サブ魂のうち一番高い Lv だけ — passiveMap が最大を取る)。金属の魔物の回避は消さない
const DYNAMIC_VISION = [0, 0.10, 0.15, 0.20];
// 手番の並び (_startRound): 敵の AGI も fleeK で味方の規模に直し、TURN_K を掛けて「基準の隊より遅め」に寄せる。
// 揺らぎは AGI × (1 ± TURN_JITTER) の割合で、どの Lv でも同じくらい入れ替わる。Lv40 の6人 (AGI 25〜110) の試算で
// 味方が先の組は約64% (0.85 だと39%): 速い者 (盗賊・暗殺者) はいつも敵より先、重装の騎士はいつも後、中ほどは入れ替わる。2026-10: 旧式は素の AGI + 0〜3 を
// 比べていたため、Lv10 を越えると敵 (AGI 9 前後) が味方 (20〜70) より先に動くことがなくなっていた (テスト記録の味方先手100%)。
// 金属の魔物はもともと味方の規模の AGI (基準 × agiMul) なので直さない
export const TURN_K = 0.65;
const TURN_JITTER = 0.20;
// 敵の AGI は Battle を作る時に一度だけ「定義の素の値 × fleeK × TURN_K」へ直す (2026-10 ユーザーの指示: 図鑑・敵の姿の素早さを
// 味方の AGI と見比べられるように)。直した値がそのまま手番の速さで、回避・逃走ではこれを ÷TURN_K して基準の隊の規模に戻す
// (= 以前の「素の値 × fleeK」。戦闘の釣り合いは変えない)。金属の魔物はもともと味方の規模なので直さない (_agiScaled の印で二重に直さない)
export function scaleFoeAgi(e, fleeK, agiWall = 1) {
  if (!e) return e;
  if (!e._agiScaled && !isMetal(e)) {
    e.agi = Math.max(1, (e.agi || 1) * (fleeK || 1) * TURN_K); // 丸めず、表示で丸める
    e._agiScaled = true;
  }
  // 金属も含め、章の素早さの壁を一度だけ掛ける。戦闘の保存・復元でも重ねない。
  if (e._agiWall == null) {
    e.agi *= agiWall;
    e._agiWall = agiWall;
  }
  return e;
}
// 能力ごとの段 (world.js statWallOf = {atk, hp}): 強さの素は HP・攻撃・防御に同じ倍率なので、攻撃と HP だけを直す
// (攻撃は軽く、HP は重く — 味方の VIT・HP が効くように)。一度だけ掛け (_statWall の印)、戦闘の保存・復元でも重ねない
export function scaleFoeStats(e, wall) {
  if (!e || !wall || e._statWall != null) return e; // 段を持たない戦闘 (検証の道具など) では印も付けない
  const atk = wall.atk || 1, hp = wall.hp || 1;
  if (atk !== 1) e.atk = Math.max(1, Math.round(e.atk * atk));
  // 金属の魔物の HP は会心で削る小さな固定値 (段ごとの数) なので直さない
  if (hp !== 1 && !isMetal(e)) { e.maxhp = Math.max(1, Math.round(e.maxhp * hp)); e.hp = Math.max(1, Math.round(e.hp * hp)); }
  e._statWall = { atk, hp };
  delete e._dlv; // 能力を変えた個体の表示Lvを計算し直す
  return e;
}
// 主・強敵のHPの段 (world.js strongHpWallOf = {boss, elite}。旧い保存の戦闘は数1つ)。二重に掛けない。
export function scaleStrongFoeHp(e, hpWall = 1) {
  if (!e || !(e.boss || e.mon?.elite) || e._strongHpWall != null) return e;
  const k = typeof hpWall === "number" ? hpWall : ((e.boss ? hpWall?.boss : hpWall?.elite) || 1);
  e.maxhp = Math.max(1, Math.round(e.maxhp * k));
  e.hp = Math.max(1, Math.round(e.hp * k));
  e._strongHpWall = k;
  delete e._dlv; // HPを変えた個体の表示Lvを計算し直す
  return e;
}
// 心の状態異常 (actor.mind = "charm" 魅了 | "confuse" 混乱)。戦闘の中だけの状態で、戦いが終われば解ける。
//  魅了: 手番ごとに味方へ襲いかかる (仲間がいなければ立ち尽くす)。傷を受けると MIND_CHARM_BREAK で正気に戻る
//  混乱: 手番ごとに敵味方を問わず誰かを殴る / ふらついて何もできない / たまに正気で動ける
//        (仲間がいない独りの時は、相手側の誰かか自分自身を殴る — 自分を殴る分は CONFUSE_SELF_MUL の威力で守りを通さない)
//  どちらも手番の初めに MIND_RECOVER で自然に正気に戻る (主はさらに +MIND_BOSS_RECOVER)。自然に戻った手番も、
//  手番までに殴られて解けた (_wake)・術で治った (cureAil) 時も、その手番から普通に動ける (眠り・麻痺も同じ)
const MIND_RECOVER = { charm: 0.30, confuse: 0.35 }, MIND_BOSS_RECOVER = 0.2;
// たぎる血潮 (修羅の目玉パッシブ): 1段あたりの物理ダメージの上乗せ (Lv1-3) と上限 +200%。
// 段は上限に届いたところで止める (表示が際限なく伸びないように)
const CHISHIO_STEP = [0, 0.10, 0.15, 0.20];
const CHISHIO_CAP = 2;
const chishioBonus = (n, step) => Math.min(CHISHIO_CAP, n * step);
const chishioMax = (step) => (step > 0 ? Math.ceil(CHISHIO_CAP / step - 1e-9) : 0);
// 戦闘の札「血▲3」用: いまの段と上乗せ。標的が倒れていれば次は数え直しなので出さない
export function chishioState(a) {
  const ch = a ? pv(a, "asuraChishio") : 0;
  const n = (a && a._bloodStack) || 0;
  if (!ch || n <= 0 || !a._bloodTgt || !a._bloodTgt.alive) return null;
  const step = CHISHIO_STEP[Math.min(3, ch)] || 0;
  return { stacks: n, bonus: chishioBonus(n, step), max: n >= chishioMax(step), target: a._bloodTgt };
}
const MIND_CHARM_BREAK = 0.5, CONFUSE_FREE = 0.25, CONFUSE_DAZE = 0.3, CONFUSE_SELF_MUL = 0.5;
// 自然回復 (魅了・混乱・眠り・麻痺は手番ごと、毒はターンごと) の救済: 治らなかった判定ごとに回復率が
// AIL_RAMP ずつ上がり、AIL_SURE 回目の判定で必ず治る (= かかったままの手番は最長 AIL_SURE-1 回)。
// かかった直後の最初の判定は必ず外れる (_holdAil: 殴られて覚める・術や道具で治る以外は、最低1手番は続く)
const AIL_RAMP = 0.15, AIL_SURE = 4;
// ブレスの威力の残りHP補正: 吐き手の HP ÷ 最大HP (0〜1)。autotactics の脅威の見積もりも同じ値を使う
export function breathHpK(e) {
  const mx = e && e.maxhp > 0 ? e.maxhp : 0;
  return mx ? Math.max(0, Math.min(1, (e.hp || 0) / mx)) : 1;
}
// 敵の全体呪文 (ability "spell") の名乗り (属性ごと) と、装備のブレス耐性 (breathRes) の上限
const ELEM_SPELL = { fire: "業火", water: "濁流", wind: "嵐", earth: "岩雨", light: "裁きの光", dark: "闇の波動" };
export const BREATH_RES_CAP = 0.5;
// 祈りの呪文 (INT と PIE の高い方で伸びる): 光の攻撃呪文と faith: true の呪文
export function isFaithSpell(sp) { return !!sp && sp.kind === "atk" && (!!sp.faith || sp.element === "light"); }
// 保存・外部の検証用に名前を残す。Lv差は成功率へ影響しない。
export const LV_HALF = 12;
export const LV_RATE_MIN = 0, LV_RATE_MAX = .95;
export function lvRate(base, atkLv, defLv) { return procChance(base); }

// 状態異常の付与を示す札 (結果の hit.status に載せ、game.js が浮かび文字で見せる)
const STATUS_TEXT = { poison: "毒", para: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", seal: "封印", stone: "石化" };
export function statusText(tags) {
  const t = [...new Set((tags || []).map((k) => STATUS_TEXT[k]).filter(Boolean))];
  return t.length ? t.join("・") + "!" : "";
}
// 技の状態異常の判定を、オートと成功率表示でも共用する。
export function spellAilments(sp) {
  if (!sp) return [];
  return [
    ["poison", "毒", sp.poison?.chance], ["paralyze", "麻痺", sp.para],
    ["sleep", "眠り", sp.kind === "sleep" ? 0.6 : sp.sleepChance],
    ["charm", "魅了", sp.charm], ["confuse", "混乱", sp.confuse],
    ["seal", "封印", sp.seal?.chance], ["flinch", "怯み", sp.flinchChance],
    ["death", "即死", sp.instakill?.chance],
  ].filter(([, , base]) => base > 0).map(([kind, label, base]) => ({ kind, label, base }));
}

// 状態異常の種類 (装備の耐性 ailRes のキー): 毒・麻痺・眠り・魅了・混乱・石化
export const AIL_KINDS = ["poison", "paralyze", "sleep", "charm", "confuse", "stone"];
// pi/ei = 当たったが無効にされた物理 (抵抗値100・加護の祈り・金剛の守り)。命中には数え、別に数える
// 破邪・聖刃の対象種族
const HOLY_PREY = ["undead", "specter", "demon"];
const VULN_LABEL = { fire: "火", water: "水", wind: "風", earth: "土", light: "光", dark: "闇", all: "全属性" };
const enemyRace = (e) => (e && e.mon && e.mon.race) || null;
// 金属の体を持つ敵か (METAL_TIERS)。呪文・状態異常・弱体を受けず、会心でない物理は1ダメージ
export const isMetal = (t) => !!(t && t.side === "enemy" && t.metal);
const METAL_TAG = { phys: "金属", mag: "金属：魔法無効" };
// 記録欄には攻撃の属性・ダメージの増減・適用された相性倍率を添える
const fmtMul = (m) => String(Math.round(m * 100) / 100);
const logTurns = (n) => isBattleLong(n) ? "戦闘中" : `${n || 3}ターン`;
function hitNote(...parts) {
  const text = parts.filter(Boolean).join("・");
  return text ? `（${text}）` : "";
}
function elemNote(em, element, weak = false) {
  const out = [];
  const label = ELEMENTS[element] && element !== "none" ? ELEMENTS[element].label : "属性";
  if (em !== 1) out.push(`${label}属性×${fmtMul(em)}`);
  if (weak) out.push(`魔法弱点×${fmtMul(weak)}`);
  return out.join("・");
}
// 金属の体の回避率 (AGI 由来の回避の代わり)
const metalEvade = (t) => (METAL_TIERS[t.metal] || METAL_TIERS[1]).evade;
// 迷宮のイベント (events.js) の加護: 与ダメ倍率 (_evDmg) と種族特効 (_evPrey)。game.js が戦闘開始時に人業へ付ける
function evDealMul(actor, tgt) {
  let m = actor._evDmg || 1;
  for (const pr of [].concat(actor._evPrey || [])) if (pr && pr.races && pr.races.includes(enemyRace(tgt))) m *= pr.mul || 1;
  return m;
}
// 属性耐性力: 出来事の加護も同属性へ加算する。
// 旧台帳の100は固有無効。部分耐性は上限を適用してから、くさびで下げる。
function modeResistance(t, key) {
  const raw = Math.max(0, t?.[key] || 0);
  if (raw >= 100 && t?.side !== "party") return 100;
  return Math.max(0, Math.min(80, raw) - (key === "physResist" ? Math.max(t?._wedge||0,t?._bkPhysDown||0) : (t?._bkMagDown||0)));
}
function edefOf(t) {
  const values = elementValues(t?.elemDef, "defense");
  for (const [k, v] of Object.entries(elementValues(t?._evEDef, "defense"))) values[k] = (values[k] || 0) + v;
  return {...(elementStat(values, "defense")||{}),reductions:t?.elemDef?.reductions};
}
function eaffOf(t) {
  return t && (t.affinity || (t.mon && t.mon.affinity)) || null;
}
// オートの見積もりが敵の属性を知っているか (game.js が図鑑の開示段階で判定する関数を渡す)。
// 知らない敵は「属性なし」とみなし、相性を手の選び方に入れない (実際のダメージ計算には関わらない)
let _elemKnown = null;
export function setElemKnown(fn) { _elemKnown = typeof fn === "function" ? fn : null; }
// 隊の全員に足す回避率 (手がかりの恵み「根に抱かれた胴」+1%。game.js syncClueBoons が渡す)。敵の物理をかわす確率に足す
let _partyEvadeBonus = 0;
export function setPartyEvadeBonus(v) { _partyEvadeBonus = Math.max(0, +v || 0); }
// 手がかりの恵み (雷よけの書きつけ): 隊の全員のブレス耐性に足す割合。装備のブレス耐性と合わせて BREATH_RES_CAP まで
let _partyBreathBonus = 0;
// 手がかりの恵み (暗がりの目): 隊の全員の物理が外れる率から引く割合 (game.js syncClueBoons が渡す)
let _partyHitBonus = 0;
export function setPartyHitBonus(v) { _partyHitBonus = Math.max(0, +v || 0); }
// 手がかりの恵み (ほぐし薬の書きつけ): 隊の全員の状態異常の抵抗に種類ごとに足す割合 (抵抗値 5 = 0.05)。game.js syncClueBoons が渡す
let _partyAilBonus = {};
export function setPartyAilBonus(m) { _partyAilBonus = { ...(m || {}) }; }
export function setPartyBreathBonus(v) { _partyBreathBonus = Math.max(0, +v || 0); }
export function partyBreathRes(t) { return Math.min(BREATH_RES_CAP, (t.breathRes || 0) + (t.side === "party" ? _partyBreathBonus : 0)); }
// 極「慧眼の」の持ち主 (a) は、図鑑で明かしていない敵の属性も見積もりに使う
const elemSeen = (t, a) => !(t && t.side === "enemy" && _elemKnown && !_elemKnown(t)) || bkInsight(a);
// 属性を知らない敵の見かけ (固有属性だけ「なし」に見せ、ほかは本体を読む)。固有パッシブの「弱点を突いた時」の判定用
const elemMask = (t, a) => (elemSeen(t, a) ? t : Object.create(t, { element: { value: "none" }, affinity: {value:{weak:[],resist:[]}}, elemDef:{value:null}, _evEDef:{value:null} }));

// 状態異常を抱えているか (戦闘中の眠り・魅了・混乱も含む)。治療の対象選び・オートの判断に使う
export function ailing(t) { return !!(t && (t.ailment || t.asleep || t.mind)); }
// 状態異常を治す (毒・麻痺・石化 + 眠り・魅了・混乱)。何か治れば true
export function cureAil(t) {
  const had = ailing(t);
  t.ailment = null; t.asleep = false; t.mind = null; t._ailN = null; t._poisonPct = null;
  return had;
}
// 指定の種類だけを治す。治さない異常の自然回復の数えは保つ。
export function cureKinds(t, kinds) {
  let had = false;
  const reset = (key) => { if (t._ailN) delete t._ailN[key]; };
  if (t.ailment && kinds.includes(t.ailment)) {
    reset(t.ailment === "paralyze" ? "para" : t.ailment);
    if (t.ailment === "poison") t._poisonPct = null;
    t.ailment = null; had = true;
  }
  if (t.asleep && kinds.includes("sleep")) { t.asleep = false; reset("sleep"); had = true; }
  if (t.mind && kinds.includes(t.mind)) { t.mind = null; reset("mind"); had = true; }
  return had;
}
// cure は true (全異常) または治療する異常の配列。旧来の cure 技は指定なしなら全異常。
export function spellCureKinds(sp) {
  return Array.isArray(sp.cure) ? sp.cure : (sp.cure || sp.kind === "cure") ? AIL_KINDS : [];
}
export function canSpellCure(sp, t) {
  const kinds = spellCureKinds(sp);
  return !!(t && ((t.ailment && kinds.includes(t.ailment)) || (t.asleep && kinds.includes("sleep")) || (t.mind && kinds.includes(t.mind))));
}
export function cureBySpell(sp, t) { return cureKinds(t, spellCureKinds(sp)); }
// 武器の追加効果 {k, chance, pct?} を _inflict が読む技の形へ (quiet = 外れても「効かなかった」を記録しない。毎撃のログが埋まるため)
function onHitSpell(oh) {
  const c = oh.chance || 0;
  if (oh.k === "poison") return { poison: { chance: c, pct: oh.pct || 0.05 } };
  if (oh.k === "paralyze") return { para: c };
  if (oh.k === "sleep") return { sleepChance: c };
  if (oh.k === "charm") return { charm: c, quiet: true };
  if (oh.k === "confuse") return { confuse: c, quiet: true };
  return {};
}
// 同じ行動の各出所を合算する。判定はこの後に種類ごと一回だけ。
function mergeStatusSpecs(sources, target) {
  const merged = { quiet: true };
  for (const sp of sources) {
    for (const k of ["para", "sleepChance", "charm", "confuse", "flinchChance"]) if (sp[k]) merged[k] = (merged[k] || 0) + sp[k];
    if (sp.kind === "sleep") merged.sleepChance = (merged.sleepChance || 0) + .6;
    if (sp.poison) merged.poison = { chance: (merged.poison?.chance || 0) + sp.poison.chance, pct: Math.max(merged.poison?.pct || 0, sp.poison.pct) };
    if (sp.seal) merged.seal = { chance: (merged.seal?.chance || 0) + sp.seal.chance, turns: Math.max(merged.seal?.turns || 0, sp.seal.turns || 3) };
    if (sp.instakill && (!sp.instakill.races || sp.instakill.races.includes(enemyRace(target)))) merged.instakill = { chance: (merged.instakill?.chance || 0) + sp.instakill.chance };
    if (sp.vuln) merged.vuln = { ...merged.vuln, ...sp.vuln };
    if (sp.strip) merged.strip = true;
    merged.dur = Math.max(merged.dur || 0, sp.dur || 3);
  }
  return merged;
}
function perkAilmentSpell(c, lv, label, key) {
  const power = c.chance == null ? 1 : lvv(c.chance, lv);
  const sp = { name: label, _source: key || label, quiet: true };
  if (c.ail === "poison") sp.poison = { chance: power, pct: lvv(c.pct, lv) || .05 };
  else if (c.ail === "para") sp.para = power;
  else if (c.ail === "sleep") sp.sleepChance = power;
  else if (c.ail === "confuse") sp.confuse = power;
  else if (c.ail === "charm") sp.charm = power;
  else if (c.ail === "seal") sp.seal = { chance: power, turns: c.turns || 2 };
  else if (c.ail === "flinch") sp.flinchChance = power;
  return sp;
}
// 技の命中後効果の札を、その対象への最後の一撃に載せる (浮かび文字の表示用)
function markStatus(res, t, tags) {
  const st = statusText(tags);
  if (!st) return;
  for (let i = res.hits.length - 1; i >= 0; i--) {
    const h = res.hits[i];
    if (h && h.target === t && !h.miss) { h.status = h.status ? h.status : st; return; }
  }
}

// 省詠唱 (chant) 込みの実効MPコスト
// 技の消費MPの表示 (「MP6」/ 最大MPの割合で払う探りの術は「MP 最大の30%」)
// 魂の格 (2026-10): 威力を持つ技 (物理技・攻撃呪文・回復・MP譲渡) は、消費MPに
// 「メイン魂そのもののMP (souls.js recalcDoll の doll.soulMp。装備・サブ魂・結社で足した分は含まない) × 格の割合」が乗り、
// 足した分だけ威力も上がる: 威力 × (1 + 0.8 × (1 − 基本の消費 ÷ 魂の格込みの消費))。×1.8 へなだらかに近づき、届かない。
// 割合は技に書いた消費MPで決まる (〜6 = 2% / 〜13 = 4% / 〜24 = 6% / 25〜 = 8%)。
// 割合ダメージの重力・最大MPの割合で払う探りの術・消費MP0の技は対象外。省詠唱などの軽減は魂の格込みの消費に掛かる
export const SOUL_TIER_RATES = [[6, 0.02], [13, 0.04], [24, 0.06], [Infinity, 0.08]];
export const SOUL_POWER_K = 0.8;
const SOUL_TIER_KINDS = new Set(["phys", "atk", "heal", "mana"]);
// 攻撃の技 (物理技・攻撃呪文) は最低の格も 4% (2026-10): 2% のままだと、Lv1 の強撃や Lv20 のファイアストームのような
// 安い低位の技が Lv100〜200 でも MP の得な技として残った (Lv200 で12職)。4% で 2職まで減り、上位の技を選ぶ理由が戻る。
// 回復・MP譲渡は 2% のまま (ヒールは最大HPの50%で頭打ちなので、消費だけが増えてしまう)
export const SOUL_TIER_ATK_MIN = 0.04;
// 敵全体への攻撃の技は最低 6% (2026-10): 安い全体技 (ファイアストームなど) は Lv20 前後の隊の柱なので技の MP は据え置き、
// 魂が育つほど単体の技より重くして、Lv100〜200 で「全体技を撃つのが一番得」にならないようにする
export const SOUL_TIER_ALL_MIN = 0.06;
// MP吸収 (技の mpDrain) の上限 = その技の消費MPの何倍か (技ごとの mpDrainCap で上書きできる)
export const MP_DRAIN_CAP = 1.1;
// 魔力の譲渡 (kind "mana") で渡せる MP は、唱えた者が払った MP の8割まで (2026-10。INT・魂の格で払った以上に増え、
// Lv120 で払った MP の4倍ほどを渡せたので、MP がいつまでも尽きなかった。1:1 でも司教が隊の MP の貯め池になったので2割を散らす)
// 命の肩代わり (護教官の固有パッシブ): 倒れかけた仲間へ分け与える、護教官の最大HPの割合
export const KATAGAWARI_COST = 0.2;
export const MANA_GIFT_RATE = 0.8;
export function manaGiftAmount(actor, sp, raw) { return Math.min(raw, Math.round(spellCost(actor, sp) * MANA_GIFT_RATE)); }
export function soulTierRate(sp) {
  if (!sp || sp.mpPct || sp.gravity || !(sp.mp > 0) || !SOUL_TIER_KINDS.has(sp.kind)) return 0;
  const r = SOUL_TIER_RATES.find(([m]) => sp.mp <= m)[1];
  if (sp.kind !== "phys" && sp.kind !== "atk") return r;
  return Math.max(r, sp.target === "all-enemy" ? SOUL_TIER_ALL_MIN : SOUL_TIER_ATK_MIN);
}
// 魂の格で足される消費MP (軽減の前)
export function soulCostAdd(actor, sp) {
  const r = soulTierRate(sp);
  return r ? Math.round(((actor && actor.soulMp) || 0) * r) : 0;
}
// 魂の格による威力の倍率 (1 以上)
export function soulPowerMul(actor, sp) {
  const add = soulCostAdd(actor, sp);
  return add > 0 ? 1 + SOUL_POWER_K * (1 - sp.mp / (sp.mp + add)) : 1;
}
// 技の消費MPの表記 (図鑑・技の詳細): 「MP 13＋魂のMP×4%」。戦闘の一覧は spellCost の実際の値を出す
export function spellMpLabel(sp) {
  if (!sp) return "MP 0";
  if (sp.mpPct) return `MP 最大の${Math.round(sp.mpPct * 100)}%${sp.mpMin ? ` (最低${sp.mpMin})` : ""}`;
  const r = soulTierRate(sp);
  return r ? `MP ${sp.mp}＋魂のMP×${Math.round(r * 100)}%` : `MP ${sp.mp || 0}`;
}
export function spellCost(actor, sp) {
  // 迷宮の術 (mpPct): 唱える者の最大MPの割合を払う (軽減は効かない)
  if (sp.mpPct) return Math.max(sp.mpMin || 1, Math.ceil(((actor && actor.maxmp) || 0) * sp.mpPct));
  let mp = sp.mp + soulCostAdd(actor, sp); // 魂の格
  const c = pv(actor, "chant");
  if (c) mp = Math.ceil(mp * (c >= 2 ? 0.7 : 0.85));
  if (actor && actor.spellCostMul) mp = Math.ceil(mp * actor.spellCostMul); // 賢者の冠: MP消費を割合カット
  const pc = perkCostCut(actor, sp); // 固有パッシブ (cost)
  if (pc) mp = Math.ceil(mp * (10000-Math.round(pc*10000))/10000);
  // 叡智の奔流 (賢者): 攻撃呪文・回復の消費MPが +10/20/30% (効果も同じだけ上がる ― jobkit/sage.js)
  const sz = pv(actor, "sageZoufuku");
  if (sz && (sp.kind === "atk" || sp.kind === "heal")) mp = Math.ceil(mp * (1 + ([0, 0.10, 0.20, 0.30][Math.min(3, sz)] || 0)));
  const hasBukonCut=actor?.gearPerks?.some(x=>x.c.bukon&&x.c.t==="cost"&&(!x.c.on||x.c.on===sp.kind));
  return Math.max(1,mp,hasBukonCut?Math.ceil((sp.mp+soulCostAdd(actor,sp))*.3):0);
}

// 戦闘の状態機械: AGI順に1人ずつ手番が回る。
// 1手ずつ進め、各行動は結果オブジェクトを返す (演出は game.js 側で行う)。
// opts.opening: "preempt" (先制) | "ambush" (奇襲) | null — 最初のターンで片側のみ行動
// 敵を倒したその瞬間に呼ぶ合図 (game.js が図鑑の討伐数を記録する)。
// Battle はセーブから復元されるため、関数はインスタンスでなくモジュールに持たせる
let _onEnemyKilled = null;
export function setOnEnemyKilled(fn) { _onEnemyKilled = typeof fn === "function" ? fn : null; }
// 戦闘中の武器・盾の持ち替え (2026-10 ユーザーの指示): 装備の付け替えは街と同じ処理 (game.js equipAt) を通す。
// fn(actor, item) → { ok, msg, displaced }。両手武器なら盾が外れる・呪い/ロックの品は外れない、も街と同じ
let _equipSwap = null;
export function setEquipSwap(fn) { _equipSwap = typeof fn === "function" ? fn : null; }

// 強化・弱体が掛かった記録の受け口 (game.js の演出用 — 掛かった瞬間にその効果と札を見せる)。
// 判定・乱数・状態には触れない。ev = { t, stat, d (段なら動いた段数・それ以外は ±1), src, before, after }
let _modSink = null;
export function setModSink(fn) { _modSink = typeof fn === "function" ? fn : null; }
const snapEffects = (t) => (t.effects || []).map((e) => ({ ...e }));

export class Battle {
  constructor(party, enemies, log, opts = {}) {
    this.party = party;
    this.enemies = enemies;
    this.challengeRule = opts.challengeRule || null;
    this.log = log;
    this.queue = [];          // このターンの行動順 (AGI順)
    this.current = null;      // 手番のキャラ
    this.phase = "input";     // input | target | resolve | enemy | done
    this.pending = null;      // 対象選択待ちの行動
    this.result = null;       // "win" | "lose" | "flee"
    this.opening = opts.opening || null;
    this.noRun = !!opts.noRun; // 警報の罠: 通常の逃走だけを封じる
    this.noFlee = !!opts.noFlee; // 迷宮の異変「閉ざされた退路」: 逃走不可
    this.orderFleet = opts.orderFleet || 0; // 隊の誰かが持つ逃げ足のLv (0-3): 隊の全員の逃走率に上乗せ
    // 追跡の物差し: 敵の AGI をこの倍率で味方の AGI と同じ規模に直してから逃走率を出す
    // (game.js の fleeScale = その迷宮・階の基準AGI ÷ その迷宮の雑魚の標準AGI)
    this.fleeK = opts.fleeK || 1;
    this.statWall = opts.statWall || null;
    for (const e of enemies) scaleFoeStats(e, this.statWall);
    this.strongHpWall = opts.strongHpWall || 1;
    for (const e of enemies) scaleStrongFoeHp(e, this.strongHpWall);
    this.agiWall = opts.agiWall || 1;
    for (const e of enemies) scaleFoeAgi(e, this.fleeK, this.agiWall); // 敵の AGI を味方の規模 (手番の速さ) に直す
    this.baseAgi = opts.baseAgi || 0; // この階の基準の素早さ (強敵の回避の上限。0 = 上限なし)
    this.foeLv = opts.foeLv || 1; // 敵のLv の既定 (個体の e.lv が無い時。戦闘中に呼ばれた手下など)
    this._roundNo = 0;
    this._bigBarrierUsed = 0;
    this._rallyStopUsed = 0; this._enemyStopRound = -1; this._mindPardonUsed = 0;
    this._dispelLockUsed = 0; this._dispelLockSeq = -1; this._procHits = [];
    this.bonusGold = 0; // 「盗む」で手に入れた金 (勝っても逃げても持ち帰る)
    this.performance = this._newPerformance();
    this.fervor = !!opts.fervor; // 迷宮の掟「高まる戦意」: 2ターン目から毎ターン、敵味方とも攻撃 +1段 (+3段まで)
    this.foeRise = +opts.foeRise || 0;     // 迷宮の掟「起き上がる濁り魂」: 倒れた敵 (主・金属を除く) は一度だけ最大HPのこの割合で起き上がる
    this.soulFeast = +opts.soulFeast || 0; // 迷宮の掟「魂喰らいの闇」: 人業を倒した敵は攻撃がこの段数だけ上がる (3ターン)
    this.focus = !!opts.focus;             // 迷宮の掟「槍ぶすま」: 敵は狙った人業が倒れるまで同じ者を狙い続ける。挑発の技の効果で外れる (_pickPartyTarget)
    this._focusT = null;
    this.show = { sp: 0, cr: 0, dd: 0, at: 0 }; // 観客の注文 (闘技場跡の迷宮の掟) と無限迷宮の称号の判定: 隊が使った技・会心・倒れた数・通常攻撃。乱数には触れない
    for (const a of [...party, ...enemies]) { a.buffs = { atk: 1, vit: 1, agi: 1 }; a.effects = []; a._endureUsed = 0; a._grantEndure = false; a._fgUsed = 0; a._sgUsed = 0; a._ijiUsed = 0; a._kgUsed = 0; a._hpPre = a.hp; a._nailed = false; a._bloodTgt = null; a._bloodStack = 0; a._kyouhon = 0; a._giDone = false; a._againRound = 0; a._actedRound = -1;
      a._splitQ = null; a._quickUsed = false; a._flipUsed = false; a._coverUsed = false; a._afterImg = false; a._parryHold = false; a._lastSkill = null; a._chainRound = 0; a._wedge = 0; a._bkPhysDown=0; a._bkMagDown=0; a._bkInsight=false; a._overflowSeq = -1; a._noReviveUsed = 0; a._noRevive = false; a._curseLockUsed = {}; a._healJudgeRound = -1; }
    for (const p of party) {
      p._coverLeft = pv(p, "cover");
      p._barrierLeft = pv(p, "barrier");
      p._wallLeft = 0; // 魔法壁 (魔泉の目覚め) は _perkStart で張り直す
      p._scriptureUsed = false;
      p._martyrUsed = false;
      p._kenma = false;
      p._ambushCritLeft = this.opening === "preempt" && pv(p, "ambushCrit") ? 1 : 0;
      const ef = p.eff || null;
      if (ef && ef.barrier) p._barrierLeft = (p._barrierLeft || 0) + ef.barrier; // 障壁は戦闘の始めに一度だけ
      p._autoReviveUsed = false;
      this._gearFields(p);
      // 眠り・魅了・混乱は戦闘の中だけの状態 (前の戦いから持ち越さない)
      p.asleep = false; p.mind = null;
    }
    for (const e of enemies) if (e.mind === undefined) e.mind = null;
    for (const a of [...party, ...enemies]) a._ailN = null; // 自然回復の救済の数え (戦いごとに数え直す)
    for (const p of party) this._recalcBuffs(p); // 固有パッシブの常時の能力倍率 (stat)
    this._perkStart();
    this._lv15Start();
    this._checkEnd();
    this._openingStrikes();
    this.advance();
  }

  // 演出ではなくHPを決める箇所で実際の増減だけを記録する。乱数・戦闘式は変えない。
  _newPerformance(partial = false) {
    return { members: this.party.map((p) => ({ uid: p.uid, name: p.name, jobKey: p.clsKey || p.jobKey, damage: 0, taken: 0, healing: 0 })), sources: {}, lastLoss: {}, partial };
  }
  _performance() { return this.performance || (this.performance = this._newPerformance(true)); }
  _reportHp(source, target, next) {
    const data = this._performance();
    const cap = (hp) => Math.max(0, Math.min(target.maxhp, hp));
    const delta = cap(next) - cap(target.hp);
    const targetIndex = this.party.indexOf(target), sourceIndex = this.party.indexOf(source);
    if (delta < 0) {
      data.lastLoss[this._performanceKey(target, "hp")] = { source: sourceIndex, amount: -delta };
      if (targetIndex >= 0) data.members[targetIndex].taken -= delta;
      if (sourceIndex >= 0 && target.side === "enemy") data.members[sourceIndex].damage -= delta;
    } else if (delta > 0 && targetIndex >= 0 && sourceIndex >= 0) data.members[sourceIndex].healing += delta;
    return next;
  }
  _reportSurvive(target) {
    const data = this._performance(), key = this._performanceKey(target, "hp"), loss = data.lastLoss[key];
    if (loss) {
      const correction = Math.min(1, loss.amount), index = this.party.indexOf(target);
      if (index >= 0) data.members[index].taken -= correction;
      if (target.side === "enemy" && loss.source >= 0) data.members[loss.source].damage -= correction;
      delete data.lastLoss[key];
    }
    return 1; // HP1で耐えた分はダメージでも回復でもない
  }
  _performanceKey(target, kind) {
    const partyIndex = this.party.indexOf(target);
    return kind + (partyIndex >= 0 ? ":p:" + partyIndex : ":e:" + this.enemies.indexOf(target));
  }
  _setPerformanceSource(target, kind, source) {
    this._performance().sources[this._performanceKey(target, kind)] = this.party.indexOf(source);
  }
  _performanceSource(target, kind) {
    return this.party[this._performance().sources[this._performanceKey(target, kind)]] || null;
  }
  _applyRegen(actor, target, spell) {
    this._applyMod(target, "regen", 1 + spell.regen.pct, spell.regen.turns, spell.name);
    const effect = target.effects[target.effects.length - 1];
    if (effect?.stat === "regen") effect.reportSource = this.party.indexOf(actor);
  }
  _reportRegen(target, next) {
    const gain = Math.max(0, next - Math.max(0, target.hp));
    const effects = (target.effects || []).filter((e) => e.stat === "regen" && e.mult > 1);
    const weight = effects.reduce((sum, e) => sum + e.mult - 1, 0);
    let left = gain;
    // 重なった再生は寄与率で分配。丸めの余りは最後へ渡し、実際の回復総量と一致させる。
    effects.forEach((e, i) => {
      const amount = i === effects.length - 1 ? left : Math.min(left, Math.round(gain * (e.mult - 1) / weight));
      left -= amount;
      const source = e.reportSource == null ? this.party.indexOf(target) : e.reportSource;
      if (source >= 0) this._performance().members[source].healing += amount;
    });
    return next;
  }
  performanceReport() {
    const data = this._performance();
    return { outcome: this.result, rounds: this._roundNo, partial: data.partial,
      members: data.members.map((m, i) => ({ ...m, name: this.party[i]?.name || m.name })) };
  }

  // 装備の戦闘効果を actor に展開 (member.eff = recalc が集約済み)。戦闘の始めと、武器を持ち替えた時に呼ぶ
  // (外した装備の効果を持ち越さない。障壁・自動蘇生の使用済みの印は戦闘の始めにだけ付け直す)
  _gearFields(p) {
    const ef = p.eff || null;
    p.actFirst = !!(ef && ef.actFirst);
    p.multistrike = (ef && ef.multistrike) || 0;
    p.lifesteal = (ef && ef.lifesteal) || 0;
    p.guard = (ef && ef.guard) || 0;
    p.spellCostMul = (ef && ef.spellCostMul) || 0;
    p.autoRevive = (ef && ef.autoRevive) || 0;
    p.regen = (ef && ef.regen) || 0;             // 再生の宝珠
    p.counter = (ef && ef.counter) || 0;          // 報復の籠手
    p.ailmentImmune = !!(ef && ef.ailmentImmune); // 解呪の宝珠
  }

  // 職の Lv15 の目玉パッシブのうち、戦闘の始まりに隊として一度だけ効くもの (重複不可 = 隊で一番高いLv)
  _lv15Start() {
    const best = (k) => Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, k)));
    // 仙薬: 生存する持ち主の最高Lvを一度だけ適用。段に丸めず指定の割合を保つ。
    const senyaku = Math.min(4, best("hermitSenyaku"));
    if (senyaku) {
      const rate = [0, .05, .10, .15, .20][senyaku], turns = senyaku >= 3 ? 3 : 2;
      for (const p of this.livingParty()) this._applyMod(p, "allStats", 1 + rate, turns, "仙薬");
      this.log(`仙薬！ 味方全員の全能力+${Math.round(rate * 100)}%、${turns}ターン`, "heal");
      this._proc(this._bestHolder("hermitSenyaku"), "仙薬");
    }
    const ct = best("crusaderToki"); // 聖戦の雄たけび: 味方全員の STR ×1.2/1.5/1.8 (3ターン)
    if (ct) {
      const m = [1, 1.2, 1.5, 1.8][Math.min(3, ct)];
      for (const p of this.livingParty()) this._applyMod(p, "atk", m, 3, "聖戦の雄たけび");
      this.log(`聖戦の雄たけび！ 隊の${modText("atk", m)}、3ターン`, "heal");
      this._proc(this._bestHolder("crusaderToki"), "聖戦の雄たけび");
    }
    const ib = best("inqBrand"); // 罪の刻印: 敵全体に弱点の属性を 1/2/3 つ刻む (その属性の被ダメ ×1.5、3ターン)
    if (ib) {
      const els = Object.keys(ELEMENTS).filter((k) => k !== "none");
      for (let i = els.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }
      const pick = els.slice(0, Math.min(3, ib));
      for (const e of this.livingEnemies()) for (const el of pick) this._applyMod(e, "r_" + el, 1 / 1.5, 3, "罪の刻印");
      this.log(`罪の刻印！ 敵全体：${pick.map((k) => (ELEMENTS[k] && ELEMENTS[k].label) || k).join("・")}弱点×1.5、3ターン`, "hit");
      this._proc(this._bestHolder("inqBrand"), "罪の刻印");
    }
    // 死の宣告 (ランク): 主・金属の魔物以外の敵が、それぞれ 3/5/8/15% で即死
    // 倒した敵は開幕の演出 (openingResults の先頭) で見せる — game.js playOpeningStrikes が大鎌の演出で刈り取る
    this._senkoku = null;
    const ns = this._rkParty("necroSenkoku", [0.03, 0.05, 0.08, 0.15]);
    if (ns) for (const e of this.livingEnemies()) {
      if (e.boss || isMetal(e) || random() >= ns) continue;
      this.log(`死の宣告！ ${e.name}は即死`, "hit");
      e.hp = this._reportHp(this._bestHolder("necroSenkoku"), e, 0);
      const died = this._die(e);
      if (!this._senkoku) {
        const actor = this.livingParty().reduce((a, p) => (pv(p, "necroSenkoku") > pv(a, "necroSenkoku") ? p : a));
        this._senkoku = { side: "party", actor, action: "spell", spellKind: "debuff", opening: "senkoku", hits: [] };
        this._proc(actor, "死の宣告");
      }
      this._senkoku.hits.push({ target: e, dmg: 0, died, fatal: true });
    }
    const gs = best("hexerGosun"); // 五寸釘: 敵 1/2/3 体の最初の手番を奪う (金属の魔物には打てない)
    if (gs) {
      const foes = this.livingEnemies().filter((e) => !isMetal(e));
      for (let i = foes.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [foes[i], foes[j]] = [foes[j], foes[i]]; }
      const nailed = foes.slice(0, Math.min(3, gs));
      for (const e of nailed) e._nailed = true;
      if (nailed.length) { this.log(`五寸釘！ ${nailed.map((e) => e.name).join("・")}：初回の行動不可`, "hit"); this._proc(this._bestHolder("hexerGosun"), "五寸釘"); }
    }
  }

  // ターンの初め: 竜の息吹 (ランク) = 15/20/25/40% で、竜騎士が敵全体へ火のブレス (攻撃力×0.5/0.6/0.8/1.2)
  _roundStartRank() {
    for (const p of this.livingParty()) {
      const lv = pv(p, "dragonknightIbuki");
      if (!lv || p.asleep || p.ailment === "stone" || random() >= [0.15, 0.20, 0.25, 0.40][Math.min(4, lv) - 1]) continue;
      const k = [0.5, 0.6, 0.8, 1.2][Math.min(4, lv) - 1];
      this.log(`${p.name}の竜の息吹！`, "hit");
      this._proc(p, "竜の息吹");
      for (const e of this.livingEnemies()) {
        const em = this._elementMul(p, e, "fire");
        const special = this._elementSpecial(p, e, "fire", this._eatk(p) * k);
        if (special) continue;
        const mr = this._resistCut(e, Math.max(1, Math.round((this._eatk(p) * k - this._evit(e, p) * .2) * em)), "magResist");
        if (!mr.immune) mr.dmg = Math.max(1, Math.round(mr.dmg * (1 - (e.guard || 0)) * this._passiveCorrection(e, p, "fire", "magic")));
        if (mr.immune) { this.log(`${e.name}：魔法無効`, "sys"); continue; }
        e.hp = this._reportHp(p, e, e.hp - (mr.dmg));
        const eff = [elemNote(em, "fire"), mr.tag].filter(Boolean).join("・");
        this.log(`${e.name}に${mr.dmg}ダメージ${hitNote(eff)}`, "dmg");
        this._wake(e); this._die(e, p);
      }
      this._checkEnd();
      if (this.result) return;
    }
  }

  // 戦闘開始時の自動攻撃 (居合/開幕呪撃)。奇襲されている時は発動しない。
  // 与ダメはここで適用しつつ、結果を openingResults に記録し、game.js が斬撃エフェクトで見せる。
  _openingStrikes() {
    this.openingResults = this._senkoku ? [this._senkoku] : []; // 死の宣告は奇襲でも見せる
    if (this.opening === "ambush") { this._markOpenDeaths(); return; }
    for (const p of this.party) {
      if (!p.alive) continue;
      if (pv(p, "iai")) {
        const t = this._randAlive(this.attackableEnemies(p)); // 居合も武器の射程に従う
        if (t) {
          this.log(`${p.name}の居合！`, "hit");
          this._proc(p, "居合");
          const hit = this._physical(p, t, { power: 0.8, name: "居合" });
          this.openingResults.push({ side: "party", actor: p, action: "attack", opening: "iai", hits: [hit, ...(hit.overflowHit ? [hit.overflowHit] : [])] });
        }
      }
      const openSpellCost = Math.max(1, Math.ceil((p.maxmp || 0) * 0.05));
      if (pv(p, "openSpell") && p.mp >= openSpellCost) {
        const t = this._randAlive(this.enemies);
        if (t) {
          p.mp -= openSpellCost; // 最大MPの5%（切り上げ）。軽減・返還の対象外
          this._proc(p, "開幕呪撃");
          const mr = this._resistCut(t, Math.max(1, Math.round(variance((p.int || 1) * 12) - this._evit(t, p) * 0.2)), "magResist");
          if (mr.immune) {
            this.log(`${p.name}の開幕呪撃！ ${t.name}：魔法無効`, "hit");
            this.openingResults.push({ side: "party", actor: p, action: "spell", spellKind: "atk", spellElement: "none", opening: "openSpell", hits: [{ target: t, dmg: 0, immune: true, died: false }] });
            continue;
          }
          const dmg = mr.dmg;
          t.hp = this._reportHp(p, t, t.hp - (dmg));
          this.log(`${p.name}の開幕呪撃！ ${t.name}に${dmg}ダメージ${hitNote(mr.tag)}`, "hit");
          this._wake(t);
          const died = this._die(t, p);
          this.openingResults.push({ side: "party", actor: p, action: "spell", spellKind: "atk", spellElement: "none", opening: "openSpell", hits: [{ target: t, dmg, died }] });
        }
      }
    }
    this._markOpenDeaths();
    this._checkEnd();
  }
  // 開幕 (死の宣告・居合・開幕呪撃) で倒れた敵: 演出で倒れるまで戦場に姿を残す印 (game.js の敵の描画が読む)
  _markOpenDeaths() {
    for (const r of this.openingResults) for (const h of r.hits || []) if (h.died && h.target) h.target._openDeath = true;
  }

  livingParty() { return this.party.filter((p) => p.alive); }
  livingEnemies() { return this.enemies.filter((e) => e.alive); }

  // ---- 隊列 (前衛/後衛) ----
  // 並びの先頭3人/3体が前衛、4人目以降が後衛。前衛が全滅した側は
  // 後衛が繰り上がり、前衛として扱われる (狙われ方・物理半減・射程すべて)
  isBackRow(a) {
    const arr = a.side === "party" ? this.party : this.enemies;
    if (arr.indexOf(a) < 3) return false;
    return arr.slice(0, 3).some((x) => x.alive);
  }

  // 後衛から物理を「与える」ときの威力補正。通常は半減だが、射程のある武器
  // (槍=中 / 弓=長) は後列からでも減衰しない (後衛運用が本来の用途のため)。
  _outRowMul(actor) {
    if (!this.isBackRow(actor)) return 1;
    const rng = this.attackRange(actor);
    if (rng === "mid" || rng === "long") return 1; // 槍・弓は後列でも減衰なし
    if (gm(actor).stepIn) return 1;
    if(gm(actor).bk_stepIn)return Math.min(1,.5+gm(actor).bk_stepIn); // 極「踏み込みの」: 後列からでも近い射程の武器の与ダメが半分にならない
    return 0.5;
  }
  // 物理の隊列補正: 後衛は与ダメ(射程武器を除く)・被ダメが半減。魔法・ブレスには掛からない
  _rowMul(actor, tgt) {
    return this._outRowMul(actor) * (this.isBackRow(tgt) ? 0.5 : 1);
  }

  // 武器の射程 (近/中/長)。敵側は射程の概念を持たない (狙いは _pickPartyTarget が決める)
  attackRange(actor) {
    return actor.side === "party" ? weaponRange(actor.equip && actor.equip.weapon) : "near";
  }

  // actor の武器が届く敵: 長距離=全体 / 中距離=前衛からなら全体、後衛からは敵前衛のみ / 近距離=敵前衛のみ
  // offhand = 左手の武器 (二刀流) の射程で数える
  attackableEnemies(actor, offhand = false) {
    const all = this.livingEnemies();
    const rng = offhand ? weaponRange(offhandOf(actor)) : this.attackRange(actor);
    if (rng === "long" || (rng === "mid" && !this.isBackRow(actor))) return all;
    const front = all.filter((e) => !this.isBackRow(e));
    return front.length ? front : all;
  }

  // ---- 強化/弱体 (atk/vit/agi 倍率) の段階・持続管理 ----
  // ターゲットの effects から能力ごとの実効倍率を再計算して buffs に反映する。
  _recalcBuffs(t) {
    const b = { atk: 1, vit: 1, agi: 1 };
    for (const ef of (t.effects || [])) b[ef.stat] = (b[ef.stat] || 1) * ef.mult;
    // 固有パッシブの能力倍率 (stat)。条件付きのものはターンの初めに判定し直す
    if (t.side === "party") {
      for (const { c, lv } of perksOf(t)) {
        if (c.t !== "stat" || (c.when && !this._perkWhen(t, c.when, {}))) continue;
        for (const k in c.mul) b[k] = (b[k] || 1) * (1 + (lvv(c.mul[k], lv) || 0));
      }
    }
    if (t.side === "party" && this.party) {
      // 伝説の勇者: 勇者が生きている間、味方全員の STR・VIT・AGI・INT・PIE +3/6/9/12% (一番高いLv)
      const hd = this._rkParty("heroDensetsu", [0.03, 0.06, 0.09, 0.12]);
      if (hd) for (const k of ["atk", "vit", "agi", "int", "pie"]) b[k] = (b[k] || 1) * (1 + hd);
      // 狂奔: 敵か仲間が倒れるたび STR +5% (3/5/7/10段まで)
      const ky = Math.min(t._kyouhon || 0, this._rk(t, "berserkerKyouhon", [3, 5, 7, 10]));
      if (ky) b.atk = (b.atk || 1) * (1 + 0.05 * ky);
    }
    // 仙薬は段の強化と別枠。LUKも含む6能力にだけ掛け、HP・MPは変えない。
    if (b.allStats) for (const k of ["atk", "vit", "agi", "int", "pie", "luk"]) b[k] = (b[k] || 1) * b.allStats;
    // 旧来の上下限 (×3 / ×0.3) を安全側で維持
    for (const k in b) b[k] = Math.max(0.3, Math.min(3, b[k]));
    t.buffs = b;
  }
  // 1つの能力強化/弱体を付与する。
  //  STR・VIT・AGI・INT・PIE は「段」(buffstage.js): 能力ごとに1本の効果を持ち、強化と弱体は段の足し算で打ち消し合う。
  //   ±3段で止まり、主・精鋭には弱体が −2段までしか入らず持続も1ターン短い。戻り値 = 実際に動いた段数 (符号つき)
  //  それ以外 (命中・封印・挑発・属性耐性…) は従来どおり、同じ向きの効果は2つまで (古いものから入れ替え)
  _applyMod(t, stat, mult, dur, srcName) {
    if (!t || mult === 1) return 0;
    if (mult < 1 && isMetal(t)) return 0; // 金属の体: 弱体は効かない
    if (stat === "seal" && mult < 1 && gm(t).steadMind) { this.log(`${t.name}の不動心：封印を防いだ`, "sys"); return 0; } // 極「不動心の」
    // 極「時告げの」: 自分が掛ける強化・弱体の持続 +1ターン (手番の者 = this._actor)
    if (this._actor && gm(this._actor).timeKeeper && dur && !isBattleLong(dur)) dur += 1;
    t.effects = t.effects || [];
    if (STAGED.has(stat)) return this._applyStage(t, stat, stageOf(mult), dur, srcName);
    const up = mult > 1;
    const before = _modSink ? snapEffects(t) : null;
    const same = t.effects.filter((e) => e.stat === stat && (e.mult > 1) === up);
    if (same.length >= 2) {
      // 同方向2段階が上限: 最古を取り除いてから新規を積む
      const oldest = same[0];
      t.effects.splice(t.effects.indexOf(oldest), 1);
    }
    t.effects.push({ stat, mult, turns: Math.max(1, dur || 3), src: srcName || "" });
    this._recalcBuffs(t);
    if (_modSink) _modSink({ t, stat, d: up ? 1 : -1, src: srcName || "", before, after: snapEffects(t) });
    return up ? 1 : -1;
  }
  // 段の加算 (d = 符号つきの段数)
  _applyStage(t, stat, d, dur, srcName) {
    if (!d) return 0;
    // 極「地踏みの」: STR・VIT・AGI・INT・PIE を下げる弱体を受けない (迷宮の掟の冷気も)
    if (d < 0 && bkProc(t,"steady")) { if (!this._quietMod) this.log(`${t.name}の地踏み：弱体を防いだ`, "sys"); return 0; }
    const strong = this._strongFoe(t);
    let turns = Math.max(1, dur || 3);
    if (d < 0 && strong) turns = Math.max(2, turns - 1); // 主・精鋭: 弱体の持続 −1
    // 旧来の記録 (同じ能力に複数) もここで1本にまとめる
    const olds = t.effects.filter((e) => e.stat === stat);
    const s0 = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, olds.reduce((a, e) => a + effectStage(e), 0)));
    const t0 = olds.reduce((a, e) => Math.max(a, e.turns || 0), 0);
    const lo = strong ? STRONG_MIN : -STAGE_MAX;
    const before = _modSink ? snapEffects(t) : null;
    // 底・天井を越えて入れない (すでに越えている分は削らない)
    let s1 = d > 0 ? Math.min(s0 + d, Math.max(STAGE_MAX, s0)) : Math.max(s0 + d, Math.min(lo, s0));
    // 極「裏返しの」: 1つの能力が底 (−3段) まで下がると、1戦闘に1度 +3段の強化に裏返す
    let flipped = false;
    if (s1 <= -STAGE_MAX && s1 < s0 && gm(t).flip && !t._flipUsed) { t._flipUsed = true; s1 = STAGE_MAX; flipped = true; }
    t.effects = t.effects.filter((e) => e.stat !== stat);
    if (s1 !== 0) {
      // 同じ向きへ掛け直せば長い方に延び、押し戻しただけなら元の持続のまま。向きが裏返ったら新しい持続
      const nt = flipped ? Math.max(t0, turns) : Math.sign(s1) !== Math.sign(d) ? t0 : Math.sign(s0) === Math.sign(d) ? Math.max(t0, turns) : turns;
      const source = this._actor;
      const curseOwner = s1 < 0 ? (d < 0 && source && source.side === "party" && this._perkValue(source, "curseLock") ? source.uid : s0 < 0 ? olds.find(e => e.curseOwner != null)?.curseOwner : undefined) : undefined;
      t.effects.push({ stat, stage: s1, mult: stageMul(s1), turns: Math.max(1, nt), src: srcName || "", ...(curseOwner != null ? { curseOwner } : {}) });
    }
    this._recalcBuffs(t);
    if (flipped) { this.log(`${t.name}の裏返し：底まで下がった弱体を +${STAGE_MAX}段の強化に裏返した`, "heal"); this._proc(t, "裏返し"); }
    if (_modSink && s1 !== s0) _modSink({ t, stat, d: s1 - s0, src: srcName || "", before, after: snapEffects(t) });
    if (s1 !== s0 && t.side === "enemy" && ENEMY_STAT_LABEL[stat] && !this._quietMod) {
      this.log(`${t.name}の${ENEMY_STAT_LABEL[stat]}${stageLabel(s1 - s0)}`, s1 > s0 ? "dmg" : "hit");
    }
    return s1 - s0;
  }
  // 弱体に強い相手 (主・精鋭)
  _strongFoe(t) { return !!(t && t.side === "enemy" && (t.boss || (t.mon && t.mon.elite))); }
  // 単体で隊を相手にする強い敵 (主・強敵・ミミック・出来事の強敵)。金属の魔物は含めない
  _soloFoe(t) { return !!(t && t.side === "enemy" && !isMetal(t) && (this._strongFoe(t) || t.isMimic || t.evRank)); }
  // 能力の今の段
  stageOf(t, stat) {
    let n = 0;
    for (const e of (t && t.effects) || []) if (e.stat === stat) n += effectStage(e);
    return n;
  }
  // 強化・弱体の厚み: 上げている段の合計 (+ 段を持たない強化の数) / 下げている段の合計 (+ 段を持たない弱体の数)
  _upWeight(t) {
    let w = 0;
    for (const e of (t && t.effects) || []) { const s = effectStage(e); w += STAGED.has(e.stat) ? Math.max(0, s) : e.mult > 1 && e.stat !== "omen" ? 1 : 0; }
    return w;
  }
  _downWeight(t) {
    let w = 0;
    for (const e of (t && t.effects) || []) { const s = effectStage(e); w += STAGED.has(e.stat) ? Math.max(0, -s) : e.mult < 1 ? 1 : 0; }
    return w;
  }
  // ターン開始時に全員の効果ターンを1減らし、切れたものを除く。
  _tickEffects() {
    for (const a of [...this.party, ...this.enemies]) {
      if (!a.effects || !a.effects.length) continue;
      let changed = false;
      for (const ef of a.effects) { ef.turns--; if (ef.turns <= 0) changed = true; }
      if (changed) { a.effects = a.effects.filter((e) => e.turns > 0); this._recalcBuffs(a); }
    }
  }

  // 能力倍率 (atk/vit/agi 以外の効果: seal/taunt/shield/ctr/charge/regen/hit/int/r_<属性>) を読む
  _bm(t, k, opponent = null) {
    const mult = (t && t.buffs && t.buffs[k]) || 1;
    // 無心の境地: 対峙する本人にだけ強化の段を差し引く。敵の効果や他の倍率は書き換えない。
    if (t?.side !== "enemy" || opponent?.side !== "party" || !STAGED.has(k)) return mult;
    const ignore = this._perkValue(opponent, "ignoreStage");
    const stage = ignore ? this.stageOf(t, k) : 0;
    return stage > 0 ? mult * stageMul(Math.max(0, stage - ignore)) / stageMul(stage) : mult;
  }

  // ---- 職ごとの固有パッシブ (jobkit の perks。成分の意味は jobkit/index.js 冒頭) ----
  // 条件 when を満たすか。a = 持ち主、ctx.tgt = 与える時は攻撃先・受ける時は攻撃してきた敵、ctx.el = 攻撃の属性
  _perkWhen(a, w, ctx) {
    const t = ctx.tgt || null;
    const frac = (x) => (x && x.maxhp ? x.hp / x.maxhp : 1);
    if (w.race && !(t && w.race.includes(enemyRace(t)))) return false;
    if (w.tgtUnacted && !(t && t.side === "enemy" && t._actedRound !== this._roundNo)) return false;
    if (w.tgtElem && !(t && t.element === w.tgtElem)) return false;
    if (w.tgtAil && !(t && (t.ailment || t.asleep || t.mind || t._flinch))) return false;
    if (w.tgtDebuffed && !(t && (t.effects || []).some((e) => e.mult < 1))) return false;
    if (w.tgtLow != null && !(t && frac(t) <= w.tgtLow)) return false;
    if (w.tgtHigh != null && !(t && frac(t) >= w.tgtHigh)) return false;
    if (w.boss && !(t && t.boss)) return false;
    if (w.noBoss && t && t.boss) return false;
    if (w.strong && !this._strongFoe(t)) return false;
    if (w.selfLow != null && frac(a) > w.selfLow) return false;
    if (w.selfHigh != null && frac(a) < w.selfHigh) return false;
    if (w.selfAil && !ailing(a)) return false;
    if (w.buffed && !(a.effects || []).some((e) => e.mult > 1 && ["atk", "vit", "agi", "int", "allStats"].includes(e.stat))) return false;
    if (w.defending && !a._defending) return false;
    if (w.mpHigh != null && !(a.maxmp && a.mp >= a.maxmp * w.mpHigh)) return false;
    if (w.round1 && (this._roundNo || 0) > 1) return false;
    if (w.roundGE && (this._roundNo || 0) < w.roundGE) return false;
    if (w.preempt && this.opening !== "preempt") return false;
    if (w.front && this.isBackRow(a)) return false;
    if (w.back && !this.isBackRow(a)) return false;
    if (w.crowd && this.livingEnemies().length < w.crowd) return false;
    if (w.lastFoe && this.livingEnemies().length !== 1) return false;
    if (w.allyDown && !this.party.some((p) => !p.alive)) return false;
    if (w.alone && this.livingParty().length !== 1) return false;
    if (w.elem && ctx.el !== w.elem) return false;
    if (w.tgtWeak && !(t && ctx.el && ctx.el !== "none" && elementWeakness(ctx.el, eaffOf(t)) > 1)) return false;
    if (w.tgtWeakened && !(t && (t.ailment || t.asleep || t.mind || t._flinch || (t.effects || []).some((e) => e.mult < 1)))) return false;
    // 自分が敵を引き付けている (矢面の構え・挑発の効果中) — 盾役の「引き付けると硬くなる」「引き付けた打撃を返す」
    if (w.taunting && !(pv(a, "taunt") || this._bm(a, "taunt") > 1)) return false;
    // 連携の (極): このターンに直前に動いた味方 (自分以外) と同じ敵を打つ
    if (w.combo && !(t && this._comboTgt === t && this._comboActor && this._comboActor !== a)) return false;
    return true;
  }
  // 与ダメ・被ダメ・会心・回避などの値の合計 (自分の分 + 生きている味方の aura 付きの分)。ctx.on = その攻撃の種類の札の配列
  _perkSum(a, type, ctx = {}) {
    if (!a || a.side !== "party") return 0;
    let sum = 0, best = 0, bukonSum=0, bukonUncapped=0;
    for (const p of this.party) {
      if (p !== a && !p.alive) continue;
      for (const { c, lv } of perksOf(p)) {
        if (c.t !== type || (p !== a && !c.aura)) continue;
        if (c.on && !(ctx.on || []).includes(c.on)) continue;
        if (c.when && !this._perkWhen(a, c.when, ctx)) continue;
        if (c.holder && !this._perkWhen(p, c.holder, ctx)) continue; // 持ち主の側の条件 (盾役が引き付けている間だけ、など)
        // best = 隊で重ならない守り (盾役の「全体攻撃を受け止める」など): 持ち主が何人いても一番強いものだけ
        if(c.bukon){if(c.uncapped)bukonUncapped+=lvv(c.v,lv)||0;else bukonSum+=lvv(c.v,lv)||0;continue;}
        if (c.best) best = Math.max(best, lvv(c.v, lv) || 0);
        else sum += lvv(c.v, lv) || 0;
      }
    }
    sum += best + bukonUncapped + Math.min(({deal:1,take:.8,crit:.8,heal:1})[type]??Infinity,bukonSum);
    // 破魔の祝詞: 生存者の最高ランクだけ。灯守の「闇を照らす灯」などとは加算する。
    if (type === "deal" && ctx.tgt && ctx.tgt.side === "enemy" && UNHOLY.includes(enemyRace(ctx.tgt))) {
      sum += this._rkParty("exorcistJouka", [0.10, 0.15, 0.20, 0.25]);
    }
    return sum;
  }
  // 個人の固有発動値。隊への効果は呼び出し側で最高Lvの持ち主を選ぶ。
  _perkValue(a, type) {
    return Math.max(0, ...perksOf(a).filter(({ c }) => c.t === type).map(({ c, lv }) => lvv(c.v, lv) || 0));
  }
  _bestPerk(type) {
    return this.livingParty().reduce((best, p) => this._perkValue(p, type) > this._perkValue(best, type) ? p : best, null);
  }
  // 全体解除は同じ行動番号で1回。解除できる強化がある時だけ回数を使う。
  _blockDispel() {
    if (this._dispelLockSeq === this._actSeq) return true;
    const p = this._bestPerk("dispelLock"), cap = this._perkValue(p, "dispelLock");
    if (!cap || (this._dispelLockUsed || 0) >= cap) return false;
    this._dispelLockUsed = (this._dispelLockUsed || 0) + 1; this._dispelLockSeq = this._actSeq;
    this.log(`${p.name}の法陣の留め金！ 強化解除を防いだ（残り${cap - this._dispelLockUsed}回）`, "heal");
    this._proc(p, "法陣の留め金");
    return true;
  }
  // 回復が実際にHPを増やした敵だけを裁く。複数の持ち主でも敵1体につき1ターン1回。
  _enemyHealed(t, before) {
    if (!t || t.side !== "enemy" || !t.alive || t.hp <= before || t._healJudgeRound === this._roundNo) return;
    const p = this._bestPerk("healJudge"), k = this._perkValue(p, "healJudge");
    if (!k) return;
    t._healJudgeRound = this._roundNo;
    const r = this._resistCut(t, Math.max(1, Math.round((p.pie || 0) * this._bm(p, "pie") * k)), "magResist");
    this._proc(p, "祝福への異議");
    if (r.immune) { this.log(`${p.name}の祝福への異議！ ${t.name}：${r.tag}`, "hit"); return; }
    const dmg = this._wallCut(t, r.dmg);
    t.hp = this._reportHp(p, t, t.hp - (dmg));
    this.log(`${p.name}の祝福への異議！ ${t.name}に${dmg}ダメージ${hitNote(r.tag)}`, "hit");
    this._wake(t);
    const hit = { target: t, dmg, died: this._die(t, p), proc: "祝福への異議" };
    if (this._actor) this._procHits.push(hit);
  }
  // 余剰は元の敵へ実際に与えた物理ダメージから算出。再帰せず、別の敵の物理耐性・魔法壁で軽減する。
  _overflow(actor, excess) {
    const k = this._perkValue(actor, "overflow");
    if (!k || !actor.alive || actor._overflowSeq === (this._actSeq || 0) || excess <= 0) return;
    const t = this._randAlive(this.attackableEnemies(actor));
    if (!t) return;
    actor._overflowSeq = this._actSeq || 0;
    const r = this._resistCut(t, Math.max(1, Math.round(excess * k)), "physResist", this._physPierce(actor));
    this._proc(actor, "暴力の余波");
    if (r.immune) { this.log(`${actor.name}の暴力の余波！ ${t.name}：${r.tag}`, "hit"); return; }
    const dmg = this._wallCut(t, r.dmg);
    t.hp = this._reportHp(actor, t, t.hp - (dmg));
    this.log(`${actor.name}の暴力の余波！ ${t.name}に${dmg}ダメージ${hitNote(r.tag)}`, "hit");
    this._wake(t);
    const hit = { target: t, dmg, died: this._die(t, actor), proc: "暴力の余波" };
    if (this._actor) this._procHits.push(hit);
    return hit;
  }
  // 発動の判定 (chance が無ければ必ず)
  _perkRoll(c, lv) { return c.chance == null || random() < (lvv(c.chance, lv) || 0); }
  // 強化をまとめて掛ける ({atk: 1.2} の倍率。Lv ごとの配列可)
  _perkBuff(t, buff, lv, dur, label) {
    for (const k in buff) this._applyMod(t, k, lvv(buff[k], lv), lvv(dur, lv) || 3, label);
  }
  _perkHeal(t, pct, source = t) {
    if (!pct || !t.alive || t.hp >= t.maxhp) return 0;
    const h = Math.max(1, Math.round(t.maxhp * pct));
    t.hp = this._reportHp(source, t, Math.min(t.maxhp, t.hp + h));
    return h;
  }
  _perkMp(t, pct) {
    if (!pct || !t.alive || !t.maxmp || t.mp >= t.maxmp) return 0;
    const g = Math.max(1, Math.round(t.maxmp * pct));
    t.mp = Math.min(t.maxmp, t.mp + g);
    return g;
  }
  // 魔法壁 (魔泉の目覚め): 受けるダメージを残り回数だけ半減する (物理・ブレス・呪文を問わない)
  _wallCut(t, dmg) {
    if (!(t._wallLeft > 0) || !(dmg > 0)) return dmg;
    t._wallLeft--;
    this.log(`${t.name}の魔法壁：半減（残り${t._wallLeft}回）`, "heal");
    this._proc(t, "魔法壁");
    return Math.max(1, Math.ceil(dmg * 0.5));
  }
  // 戦闘開始時 (start)
  _perkStart() {
    for (const p of this.party) {
      if (!p.alive) continue;
      for (const { c, lv, label } of perksOf(p)) {
        if (c.t !== "start" || !this._perkRoll(c, lv) || (c.when && !this._perkWhen(p, c.when, {}))) continue;
        // once: 持ち主が何人いても隊で1度だけ (極「号令の」)
        if (c.once) { const used = this._startOnce || (this._startOnce = new Set()); if (used.has(c.once)) continue; used.add(c.once); }
        const tg = c.party ? this.livingParty() : [p];
        let mp = 0;
        for (const t of tg) {
          if (c.buff) this._perkBuff(t, c.buff, lv, c.dur, label);
          if (c.barrier) t._barrierLeft = (t._barrierLeft || 0) + (lvv(c.barrier, lv) || 0);
          if (c.wall) t._wallLeft = (t._wallLeft || 0) + (lvv(c.wall, lv) || 0);
          if (c.regen) this._applyMod(t, "regen", 1 + (lvv(c.regen, lv) || 0), c.dur || 3, label);
          if (c.mp) mp += this._perkMp(t, lvv(c.mp, lv));
          if (c.endure) t._grantEndure = true;
          if (c.charge) this._applyMod(t, "charge", lvv(c.charge, lv), c.dur || 3, label);
        }
        if (c.taunt) this._applyMod(p, "taunt", 3, c.dur || 2, label);
        // 敵全体への弱体は1行にまとめる (敵ごとの「〜が下がった」は出さない)
        this._quietMod = true;
        try { if (c.foe) for (const e of this.livingEnemies()) this._perkBuff(e, c.foe, lv, c.dur, label); }
        finally { this._quietMod = false; }
        const note = [perkNote(c, lv), mp ? `MP+${mp}` : ""].filter(Boolean).join("・");
        this.log(`${p.name}の${label}！${note ? ` ${note}` : ""}`, "heal");
        this._proc(p, label);
      }
    }
  }
  // 2ターン目以降の毎ターン初め (round)
  _perkRound() {
    // 希望の陽だまり: 旧キー・サブ魂を含め、生存者の最高Lvの持ち主だけが一度発動する。
    let hopeHolder = null, hopeLv = 0;
    for (const p of this.livingParty()) for (const pr of perksOf(p)) {
      if (pr.key === "heroKibouHidamari" && pr.lv > hopeLv) { hopeHolder = p; hopeLv = pr.lv; }
    }
    for (const p of this.party) {
      if (!p.alive) continue;
      for (const { c, lv, label, key } of perksOf(p)) {
        if (key === "heroKibouHidamari" && p !== hopeHolder) continue;
        if (c.t !== "round" || (c.when && !this._perkWhen(p, c.when, {})) || !this._perkRoll(c, lv)) continue;
        let hp = 0, mp = 0;
        for (const t of (c.party ? this.livingParty() : [p])) {
          hp += this._perkHeal(t, lvv(c.hp, lv), p); mp += this._perkMp(t, lvv(c.mp, lv));
          if (c.buff) this._perkBuff(t, c.buff, lv, c.dur || 2, label);
        }
        if (hp || mp || c.buff) {
          const note = [c.buff ? perkNote({ buff: c.buff, dur: c.dur, party: c.party }, lv, 2) : "", gainText(hp, mp) && `${c.party ? "隊合計：" : ""}${gainText(hp, mp)}`].filter(Boolean).join("・");
          this.log(`${p.name}の${label}！ ${note}`, "heal"); this._proc(p, label);
        }
      }
    }
  }
  // 敵を倒した時 (kill)。倒したのは今の手番の味方
  _perkKill(killer) {
    if (!killer || killer.side !== "party" || !killer.alive) return;
    for (const { c, lv, label } of perksOf(killer)) {
      if (c.t !== "kill" || !this._perkRoll(c, lv)) continue;
      const h = this._perkHeal(killer, lvv(c.hp, lv)), m = this._perkMp(killer, lvv(c.mp, lv));
      if (c.buff) this._perkBuff(killer, c.buff, lv, c.dur, label);
      if (h || m || c.buff) {
        const note = [c.buff ? perkNote({ buff: c.buff, dur: c.dur }, lv, 3) : "", gainText(h, m)].filter(Boolean).join("・");
        this.log(`${killer.name}の${label}！ ${note}`, "heal"); this._proc(killer, label);
      }
    }
  }
  // 敵の攻撃を受けた時 (hurt)。kind = "phys" | "breath"
  _perkHurt(t, attacker, dmg, kind) {
    if (!t || t.side !== "party" || !t.alive || !(dmg > 0)) return;
    for (const { c, lv, label } of perksOf(t)) {
      if (c.t !== "hurt" || !hurtOn(c.on, kind) || (c.when && !this._perkWhen(t, c.when, { tgt: attacker })) || !this._perkRoll(c, lv)) continue;
      if (c.buff) this._perkBuff(t, c.buff, lv, c.dur || 2, label);
      const h = this._perkHeal(t, lvv(c.hp, lv)), m = this._perkMp(t, lvv(c.mp, lv));
      if (c.buff || h || m) {
        const note = [c.buff ? perkNote({ buff: c.buff, dur: c.dur }, lv, 2) : "", gainText(h, m)].filter(Boolean).join("・");
        this.log(`${t.name}の${label}！ ${note}`, "heal"); this._proc(t, label);
      }
      if (c.ret) this._retaliate(t, attacker, c.ret.stat, lvv(c.ret.k, lv), label, !!c.ret.magic);
    }
  }
  // 自分の物理が敵に当たった時 (hit): 確率で状態異常・弱体を付ける。付いた札を返す
  _perkHit(actor, tgt, tags, on) {
    if (actor.side !== "party" || !tgt || tgt.side !== "enemy" || !tgt.alive || isMetal(tgt)) return;
    for (const { c, lv, label, key } of perksOf(actor)) {
      if (c.t !== "hit" || (c.on && !on.includes(c.on))) continue;
      const statusAil = ["poison", "para", "sleep", "charm", "confuse", "seal", "flinch"].includes(c.ail);
      if (!statusAil && !this._perkRoll(c, lv)) continue;
      const a = c.ail;
      if (a === "atk" || a === "vit" || a === "agi") {
        this._quietMod = true;
        let d = 0;
        try { d = this._applyMod(tgt, a, lvv(c.mul, lv) || 0.85, 3, label); } finally { this._quietMod = false; }
        this.log(`${actor.name}の${label}！ ${tgt.name}の${ENEMY_STAT_LABEL[a]}${d ? `${stageLabel(d)}、3ターン` : "低下限界"}`, "hit");
        this._proc(actor, label); continue;
      }
      const sp = { ...perkAilmentSpell(c, lv, label, key), dur: 3 };
      if (a === "strip") sp.strip = true;
      else if (a === "vuln") sp.vuln = { [c.el || "all"]: lvv(c.mul, lv) || 0.85 };
      // 付いた時だけ「〜の毒の牙！」を先に書き、その後に「〜に毒」を続ける
      const n0 = tags.length, buf = [], log0 = this.log;
      this.log = (m, k) => buf.push([m, k]);
      try { this._inflict(actor, tgt, sp, tags); } finally { this.log = log0; }
      // 付いたかどうか: 札が増えた、または「〜に怯み」のような命中の行が出た (外れの行は sys)
      if (tags.length > n0 || buf.some(([, k]) => k === "hit")) { this.log(`${actor.name}の${label}！`, "hit"); this._proc(actor, label); }
      for (const [m, k] of buf) this.log(m, k);
      // 属性耐性ダウンは _inflict が記録しないので、ここで何が起きたかを書く
      if (sp.vuln && tags.slice(n0).includes("vuln")) {
        const el = c.el || "all", mul = lvv(c.mul, lv) || 0.85;
        this.log(`${tgt.name}の${el === "all" ? "全属性" : `${(ELEMENTS[el] && ELEMENTS[el].label) || el}属性`}弱体×${fmtMul(1 / mul)}、3ターン`, "hit");
      }
    }
  }
  // 技・呪文を使った後 (cast)
  _perkCast(actor, sp, cost) {
    if (!actor || actor.side !== "party" || !actor.alive) return;
    for (const { c, lv, label } of perksOf(actor)) {
      if (c.t !== "cast" || (c.on && c.on !== sp.kind) || !this._perkRoll(c, lv)) continue;
      let note = "";
      if (c.refund && cost > 0) { actor.mp = Math.min(actor.maxmp || 0, actor.mp + cost); note += ` MP${cost}が戻った`; }
      let hp = 0, mp = 0;
      for (const t of (c.party ? this.livingParty() : [actor])) { hp += this._perkHeal(t, lvv(c.hp, lv), actor); mp += this._perkMp(t, lvv(c.mp, lv)); }
      if (hp || mp) note += ` ${c.party ? "隊合計：" : ""}${gainText(hp, mp)}`;
      if (note) { this.log(`${actor.name}の${label}！${note}`, "heal"); this._proc(actor, label); }
    }
  }
  // 味方が倒れた時 (fall): 生きている持ち主に
  _perkFall(fallen) {
    for (const p of this.party) {
      if (p === fallen || !p.alive) continue;
      for (const { c, lv, label } of perksOf(p)) {
        if (c.t !== "fall" || !this._perkRoll(c, lv)) continue;
        if (c.buff) this._perkBuff(p, c.buff, lv, c.dur, label);
        const h = this._perkHeal(p, lvv(c.hp, lv));
        const note = [c.buff ? perkNote({ buff: c.buff, dur: c.dur }, lv, 3) : "", gainText(h, 0)].filter(Boolean).join("・");
        this.log(`${p.name}の${label}！${note ? ` ${note}` : ""}`, "heal");
        this._proc(p, label);
      }
    }
  }
  // 属性耐性ダウンは耐性力に適用する。r_allは全属性に効く。
  _elementMul(actor, t, el) {
    return elementMultiplier(el, elementAttack(actor, el), edefOf(t), eaffOf(t), this._bm(t, "r_" + el) * this._bm(t, "r_all"));
  }
  _elementSpecial(actor, t, el, raw) {
    if (!el || el === "none") return null;
    const aff = eaffOf(t);
    if (aff?.immune?.includes(el)) {
      this.log(`${t.name}：${ELEMENTS[el]?.label || el}属性無効`, "sys");
      return { target: t, dmg: 0, immune: true, died: false };
    }
    if (aff?.absorb?.includes(el)) {
      const hp = Math.min(t.maxhp, t.hp + Math.max(1, Math.round(raw * elementAttack(actor, el) / 100))) - t.hp;
      t.hp = this._reportHp(actor, t, t.hp + hp);
      this.log(`${t.name}は${ELEMENTS[el]?.label || el}属性を吸収：HP+${hp}`, "heal");
      return { target: t, dmg: 0, heal: hp, absorbed: true, immune: true, died: false };
    }
    return null;
  }
  // 恒常軽減の積が10%を割る分だけ戻す。防御・回数制の壁・かばうはこの上限の外。
  _passiveCorrection(t, actor, el, kind, ignore = 0, elementFloor = false) {
    const r = modeResistance(t, kind === "phys" ? "physResist" : "magResist");
    const mode = r >= 100 && t.side !== "party" ? 0 : 1 - Math.min(.8, Math.max(0, r) / 100) * (1 - ignore);
    if (!mode) return 1; // 固有の完全無効は別
    const scale = this._bm(t, "r_" + el) * this._bm(t, "r_all");
    let elem = !el || el === "none" ? 1 : 1-elementDefenseReduction(el,edefOf(t),eaffOf(t),scale);
    if (elementFloor && el && el !== "none") elem = Math.max(elem, Math.min(1, 100 / elementAttack(actor, el) / elementWeakness(el, eaffOf(t))));
    const factors = [elem, mode, 1 - (t.guard || 0)];
    if (actor?.side === "enemy" && t.side === "party") {
      factors.push(Math.max(.2, 1 - this._perkSum(t, "take", { tgt: actor, el: el || "none", on: [kind === "magic" ? "spell" : kind] })));
      if (kind !== "phys" || el && el !== "none") factors.push(1 - this._shintou(t));
      if (kind !== "phys") factors.push(1 - this._rkParty("wardenKekkai", [.05, .08, .12, .20]));
      if (kind === "breath") factors.push(1 - partyBreathRes(t));
      if ((gm(t).adversity||gm(t).bk_adversity) && t.maxhp) factors.push(1-(t.hp/t.maxhp<=.25?Math.max(gm(t).adversity ? .4 : 0,(gm(t).bk_adversity||0)*2):t.hp/t.maxhp<=.5?Math.max(gm(t).adversity ? .2 : 0,gm(t).bk_adversity||0):0));
    }
    const product = factors.reduce((n, x) => n * x, 1);
    const ruleMul = t.side === "enemy" && ((this.challengeRule === "magic" && kind === "magic") || (this.challengeRule === "physical" && kind === "phys")) ? 2 : this.challengeRule === "doubleDamage" ? 2 : 1;
    return ruleMul * (product > 0 ? permanentMultiplier(factors) / product : 1);
  }
  // 強化 (倍率>1) を打ち消す
  _stripUp(t) {
    if (!t.effects || !t.effects.some((e) => e.mult > 1)) return false;
    if (t.side === "party" && this._actor?.side === "enemy" && this._blockDispel()) return false;
    if (this._omenOf(t)) { t._chargeCd = 1; this.log(`${t.name}の溜め解除`, "hit"); }
    t.effects = t.effects.filter((e) => !(e.mult > 1));
    this._recalcBuffs(t);
    return true;
  }
  // 弱体 (倍率<1) を解く
  _purgeDown(t) {
    if (!t.effects || !t.effects.some((e) => e.mult < 1)) return false;
    const restored = new Set();
    const keep = [];
    for (const e of t.effects) {
      if (e.mult >= 1) { keep.push(e); continue; }
      const owner = STAGED.has(e.stat) && e.curseOwner != null && this.party.find(p => p.uid === e.curseOwner && p.alive);
      if (t.side !== "enemy" || this._actor?.side !== "enemy" || !owner) continue;
      const cap = this._perkValue(owner, "curseLock");
      const used = (t._curseLockUsed || {})[owner.uid] || 0;
      if (cap && (restored.has(owner.uid) || used < cap)) { keep.push(e); restored.add(owner.uid); }
    }
    t.effects = keep;
    for (const uid of restored) {
      t._curseLockUsed ||= {}; t._curseLockUsed[uid] = (t._curseLockUsed[uid] || 0) + 1;
      const p = this.party.find(p => p.uid === uid);
      this.log(`${p.name}の返らぬ呪い！ ${t.name}の弱体が戻った`, "hit"); this._proc(p, "返らぬ呪い");
    }
    this._recalcBuffs(t);
    return true;
  }
  // 溜め: 乗っていれば倍率を返して消費する
  _takeCharge(a) {
    const ef = a.effects && a.effects.find((e) => e.stat === "charge");
    if (!ef) return 1;
    a.effects.splice(a.effects.indexOf(ef), 1);
    this._recalcBuffs(a);
    return ef.mult;
  }
  // 仁王立ち: 味方への単体攻撃を肩代わりする者 (本人以外・行動できる者)
  _shieldFor(tgt) {
    if (tgt.side !== "party") return null;
    for (const p of this.party) {
      if (p === tgt || !p.alive || this._bm(p, "shield") <= 1) continue;
      if (this._incap(p)) continue;
      return p;
    }
    return null;
  }
  // 行動者のLv (状態異常・即死の成功率に使う)
  lvOf(a) {
    if (!a) return this.foeLv;
    if (a.side === "enemy") return a.lv || this.foeLv;
    return a.jobLv || a.level || 1;
  }
  // 付与力×（1−耐性）。Lv差補正なし・最終上限95%
  _rate(actor, t, base, kind, known = true) {
    if (!(base > 0)) return 0;
    if (["paralyze", "sleep", "charm", "confuse", "flinch"].includes(kind) && t?._ccRecovery) return 0;
    if (kind === "death" && t?.boss) return 0;
    if (actor?.side === "party") base += this._rk(actor, "hexerSae", [0.05, 0.10, 0.15, 0.25]);
    if (kind !== "death" && gm(actor).binder) base *= 1.5;
    const resistance = kind && known ? (["stone", "death"].includes(kind) ? this._hardRes(t, kind) : this._ailRes(t, kind)) : 0;
    return procChance(base, resistance);
  }
  // 命中した敵へ付く効果 (物理技・攻撃呪文・弱体の共通): 毒/麻痺/封印/属性耐性ダウン/打ち消し/眠り/怯み/即死。
  // 毒・麻痺・封印・眠り・魅了・混乱・即死の付与力に耐性を掛けた後、最大95%に収める
  // 種類ごとの抵抗値を掛ける。抵抗値100は無効
  _inflict(actor, t, sp, out) {
    if (this._ailQueue && !this._flushingAilments && t?.alive) {
      let entry = this._ailQueue.get(t);
      if (!entry) { entry = { actor, sources: new Map() }; this._ailQueue.set(t, entry); }
      // 同じ出所が多段命中しても一回分。別装備の同効果はrecalcで加算済み。
      entry.sources.set(JSON.stringify(sp), sp);
      return false;
    }
    const tags = out || [];
    const n0 = tags.length;
    const r = this._inflictOne(actor, t, sp, tags);
    // 極「伝染の」: 新しく掛けた状態異常を、並びの隣の敵 (生きている敵の並びで前後) にも同じ確率で移す
    if (!this._spreading && (gm(actor).contagion || gm(actor).bk_contagion) && tags.length > n0) this._contagion(actor, t, sp, tags.slice(n0));
    return r;
  }
  _flushAilments(res) {
    this._flushingAilments = true;
    try {
      for (const [t, { actor, sources }] of this._ailQueue || []) {
        if (!t.alive) continue;
        const merged = mergeStatusSpecs(sources.values(), t);
        const tags = []; this._inflict(actor, t, merged, tags); markStatus(res, t, tags);
      }
    } finally { this._flushingAilments = false; }
  }
  _contagion(actor, t, sp, got) {
    const map = { poison: sp.poison && { poison: sp.poison }, para: sp.para && { para: sp.para }, sleep: sp.sleepChance && { sleepChance: sp.sleepChance },
      charm: sp.charm && { charm: sp.charm }, confuse: sp.confuse && { confuse: sp.confuse }, seal: sp.seal && { seal: sp.seal } };
    const spec = {};
    for (const k of got) if (map[k]) Object.assign(spec, map[k]);
    if (!Object.keys(spec).length) return;
    const foes = this.livingEnemies(), i = foes.indexOf(t);
    const near = [foes[i - 1], foes[i + 1]].filter((e) => e && e.alive && !isMetal(e));
    if (!near.length) return;
    const ratio=gm(actor).contagion?1:(gm(actor).bk_contagion||0);
    for(const k of ["para","sleepChance","charm","confuse"])if(spec[k])spec[k]*=ratio;
    for(const k of ["poison","seal"])if(spec[k])spec[k]={...spec[k],chance:spec[k].chance*ratio};
    this._spreading = true;
    try {
      for (const e of near) {
        const tg = [];
        this._inflictOne(actor, e, { ...spec, name: sp.name, quiet: true }, tg);
        if (tg.length) { this.log(`伝染！ ${e.name}にも${tg.map((k) => STATUS_TEXT[k] || k).join("・")}`, "hit"); this._proc(actor, "伝染"); }
      }
    } finally { this._spreading = false; }
  }
  _inflictOne(actor, t, sp, out) {
    if (!t || !t.alive || t.side !== "enemy") return;
    if (isMetal(t)) return; // 金属の体: 毒・麻痺・眠り・魅了・混乱・封印・即死・耐性ダウン・打ち消しのどれも効かない
    const tags = out || [];
    if (sp.strip && this._stripUp(t)) { this.log(`${t.name}の強化解除`, "hit"); tags.push("strip"); }
    if (sp.vuln) {
      for (const el in sp.vuln) this._applyMod(t, "r_" + el, sp.vuln[el], sp.dur, sp.name);
      tags.push("vuln");
    }
    if (sp.poison && random() < this._rate(actor, t, sp.poison.chance, "poison")) {
      if (!t.ailment || (t.ailment === "poison" && (t._poisonPct || 0.05) < sp.poison.pct)) {
        const up = t.ailment === "poison";
        t.ailment = "poison"; t._poisonPct = sp.poison.pct; this._setPerformanceSource(t, "poison", actor);
        if (!up) this._holdAil(t, "poison");
        this.log(up ? `${t.name}の毒強化` : `${t.name}に毒`, "hit");
        tags.push("poison");
      }
    }
    if (sp.para && !t.ailment && random() < this._rate(actor, t, sp.para, "paralyze")) {
      t.ailment = "paralyze"; this._holdAil(t, "para");
      this.log(`${t.name}に麻痺`, "hit");
      tags.push("para");
    }
    if (sp.seal) {
      if (random() < this._rate(actor, t, sp.seal.chance, "seal")) {
        this._applyMod(t, "seal", 0.5, sp.seal.turns || 3, sp.name);
        this.log(`${t.name}に封印`, "hit");
        tags.push("seal");
      } else this.log(`${t.name}は封印を防いだ`, "sys");
    }
    if (sp.sleepChance && !t.asleep && random() < this._rate(actor, t, sp.sleepChance, "sleep")) {
      t.asleep = true; this._holdAil(t, "sleep");
      this.log(`${t.name}に眠り`, "sys");
      tags.push("sleep");
    }
    // 魅了・混乱 (心の状態異常は1つだけ。先にかかった方が残る)
    if (sp.charm && !t.mind) {
      if (random() < this._rate(actor, t, sp.charm, "charm")) {
        t.mind = "charm"; this._holdAil(t, "mind");
        this.log(`${t.name}に魅了（仲間を攻撃）`, "hit");
        tags.push("charm");
      } else if (!sp.confuse && !sp.quiet) this.log(`${t.name}は魅了を防いだ`, "sys");
    }
    if (sp.confuse && !t.mind) {
      if (random() < this._rate(actor, t, sp.confuse, "confuse")) {
        t.mind = "confuse"; this._holdAil(t, "mind");
        this.log(`${t.name}に混乱`, "hit");
        tags.push("confuse");
      } else if (!sp.quiet) this.log(`${t.name}は混乱を防いだ`, "sys");
    }
    if (sp.flinchChance && !t.boss && !t._flinch && random() < this._rate(actor, t, sp.flinchChance, "flinch")) {
      t._flinch = true;
      this.log(`${t.name}に怯み`, "hit");
    }
    if (this._omenOf(t) && this._omenBroken(t)) this._breakOmen(t); // 封じ・眠り・麻痺・心の乱れ・怯みで溜めが潰れる
    if (sp.instakill) {
      const ik = sp.instakill;
      const race = enemyRace(t);
      if (t.boss) this.log(`${t.name}：即死無効`, "sys");
      else if (ik.races && !ik.races.includes(race)) this.log(`${t.name}：効果なし`, "sys");
      else if (random() < this._rate(actor, t, ik.chance, "death")) {
        t.hp = this._reportHp(actor, t, 0);
        this.log(`${t.name}は即死`, "hit");
        tags.push("instakill");
        return this._die(t);
      } else this.log(`${t.name}は即死を防いだ`, "sys");
    }
    return false;
  }

  // AGI(+乱数)で行動順を組み直す。ターン開始時に毒のダメージが入る。
  // 第1ターンは先制/奇襲なら片側のみが行動する
  _startRound() {
    this._roundNo++;
    this._mindPardonUsed = 0; // 赦しの勅令: 隊で共有する回数を毎ターン戻す
    for (const a of [...this.party, ...this.enemies]) a._actedRound = -1; // 先の太刀: 毎ターン、未行動に戻す
    this._comboTgt = null; this._comboActor = null; // 連携の (極): ターンごとに数え直す
    if (this._roundNo > 1) this._tickEffects(); // 2ターン目以降、強化/弱体の持続を消化
    // 極「痛み分けの」: 後に回したダメージを、ターンの初めに受ける (倒れることもある。不屈などの踏みとどまりは普段どおり)
    for (const p of this.party) {
      if (!p.alive || !p._splitQ || !p._splitQ.length) continue;
      const d = p._splitQ.shift() || 0;
      if (d <= 0) continue;
      p.hp = this._reportHp(null, p, p.hp - (d));
      this.log(`${p.name}の痛み分け：残りの${d}ダメージ`, "dmg");
      this._die(p);
    }
    for (const p of this.party) this._recalcBuffs(p); // 固有パッシブの条件付きの能力倍率を判定し直す
    for (const a of [...this.party, ...this.enemies]) {
      if (!a.alive || a.ailment !== "poison") continue;
      // 毒も長引くほど治りやすくなる。治ったターンは毒のダメージを受けない
      if (this._naturalRecover(a, "poison", 0.20)) {
        a.ailment = null; a._poisonPct = null;
        this.log(`${a.name}の毒解除`, "heal");
        continue;
      }
      // 通常毒は5%、猛毒は10%。旧セーブの強い毒も10%に統一し、主には5%。
      const pct = a._poisonPct > 0.05 && !a.boss ? 0.1 : 0.05;
      const d = Math.max(1, Math.round(a.maxhp * pct));
      a.hp = this._reportHp(this._performanceSource(a, "poison"), a, a.hp - (d));
      this.log(`${a.name}に毒${d}ダメージ`, "dmg");
      this._die(a);
    }
    // 再生: 2ターン目以降、傷ついた再生持ちの敵が少しずつ回復する
    if (this._roundNo > 1) {
      for (const e of this.livingEnemies()) {
        if (!e.regen || e.hp >= e.maxhp) continue;
        const h = Math.max(1, Math.round(e.maxhp * e.regen));
        const before = e.hp;
        e.hp = this._reportHp(e, e, Math.min(e.maxhp, e.hp + h));
        this.log(`${e.name}の再生：HP+${h}`, "sys");
        this._enemyHealed(e, before);
      }
    }
    // 再生の宝珠 (party regen): 2ターン目以降、傷ついた味方が最大HPの割合だけ回復する (LR装飾品)
    if (this._roundNo > 1) {
      for (const p of this.livingParty()) {
        if (!p.regen || p.hp >= p.maxhp) continue;
        const h = Math.max(1, Math.round(p.maxhp * p.regen));
        p.hp = this._reportHp(p, p, Math.min(p.maxhp, p.hp + h));
        this.log(`${p.name}の再生：HP+${h}`, "heal");
      }
    }
    // リジェネ (技の効果): 2ターン目以降、最大HPの割合だけ回復する
    if (this._roundNo > 1) {
      for (const p of this.livingParty()) {
        const rg = this._bm(p, "regen");
        if (rg <= 1 || p.hp >= p.maxhp) continue;
        const h = Math.max(1, Math.round(p.maxhp * (rg - 1)));
        p.hp = this._reportRegen(p, Math.min(p.maxhp, p.hp + h));
        this.log(`${p.name}のリジェネ：HP+${h}`, "heal");
      }
    }
    if (this._roundNo > 1) this._perkRound(); // 固有パッシブ (round)
    // 高まる戦意 (迷宮の掟): 2ターン目から毎ターンの頭に、生きている者すべての攻撃が1段上がる (+3段まで。金属の魔物は除く)
    if (this.fervor && this._roundNo > 1) {
      let up = 0;
      this._quietMod = true;
      for (const a of [...this.party, ...this.enemies]) if (a.alive && !isMetal(a) && this.stageOf(a, "atk") < STAGE_MAX) up += this._applyStage(a, "atk", 1, 2, "高まる戦意") > 0 ? 1 : 0;
      this._quietMod = false;
      if (up) this.log("観客の歓声：敵味方の攻撃+1段", "sys");
    }
    if (!(this._roundNo === 1 && this.opening === "ambush")) this._roundStartRank(); // 竜の息吹 (奇襲された初めのターンは出せない)
    // 激昂: HPが3割を切った敵が一度だけ荒れ狂い、STR/AGI が跳ね上がる
    for (const e of this.livingEnemies()) {
      if (!e.enrage || e._enraged || !e.maxhp || e.hp > e.maxhp * 0.3) continue;
      e._enraged = true;
      this._applyMod(e, "atk", 1.5, BATTLE_LONG, "激昂");
      this._applyMod(e, "agi", 1.3, BATTLE_LONG, "激昂");
      this.log(`${e.name}は激昂（攻撃・素早さ上昇）`, "dmg");
    }
    this._checkEnd();
    for(const p of this.livingParty())p._bkInsight=bkProc(p,"insight");
    let pool = [...this.party, ...this.enemies];
    if (this._roundNo === 1 && this.opening === "preempt") pool = [...this.party];
    else if (this._roundNo === 1 && this.opening === "ambush") {
      pool = this._ambushers();
      // 極「警鐘の」: 奇襲を受けても、1ターン目に自分だけは動ける
      for (const p of this.party) if (p.alive && bkProc(p,"alarm")) { pool.push(p); this.log(`${p.name}の警鐘：奇襲に気づいた`, "heal"); this._proc(p, "警鐘"); }
    }
    if (this._enemyStopRound === this._roundNo) pool = pool.filter(a => a.side !== "enemy");
    const eagi = (a) => (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1);
    // 一番に動く者: 加速装置 (actFirst、毎ターン) と、極「一番手の」(戦闘の1ターン目だけ)
    const firstSet=new Set(pool.filter(a=>a.actFirst||(this._roundNo===1&&bkProc(a,"firstTurn"))));
    const first=a=>firstSet.has(a);
    // 手番の速さ: 敵の AGI は Battle を作った時に味方の規模 (TURN_K 込み) へ直してある (scaleFoeAgi)。揺らぎは割合で、並べる前に1回だけ振る
    const turnAgi = (a) => eagi(a);
    const speed = new Map();
    for (const a of pool) if (a.alive) speed.set(a, turnAgi(a) * (1 - TURN_JITTER + random() * 2 * TURN_JITTER));
    this.queue = pool
      .filter((a) => a.alive)
      // 加速装置 (actFirst) は必ず手番の最初に行動する。同士の中では AGI 順
      .sort((a, b) => ((first(b) ? 1 : 0) - (first(a) ? 1 : 0)) || ((b.haste ? 1 : 0) - (a.haste ? 1 : 0)) || (speed.get(b) - speed.get(a)));
    // 神速 (haste): 目にも止まらぬ速さの敵は、ターンの頭 (加速装置の次) に動き、後半にもう一度動く
    for (const e of this.queue.filter((a) => a.haste && a.side === "enemy")) {
      const from = Math.max(this.queue.indexOf(e) + 1, Math.ceil(this.queue.length / 2));
      this.queue.splice(from + rand(this.queue.length - from + 1), 0, e);
    }
    // 極「二度駆けの」: 15% (AGI が敵の最速の2倍以上なら30%) でこのターン後半にもう一度動く。
    // 1ターンに増える行動は1回まで (時間跳躍とは重ならない — _againRound)
    const fastFoe = Math.max(0, ...this.enemies.filter((e) => e.alive).map(eagi));
    for (const p of this.queue.filter((a) => a.side === "party" && (gm(a).dash || gm(a).bk_dash) && a._againRound !== this._roundNo)) {
      if (random() >= (fastFoe > 0 && eagi(p) >= fastFoe * 2 ? bkValue(p,"dash",.15)*2 : bkValue(p,"dash",.15))) continue;
      p._againRound = this._roundNo;
      const from = Math.max(this.queue.indexOf(p) + 1, Math.ceil(this.queue.length / 2));
      this.queue.splice(from + rand(this.queue.length - from + 1), 0, p);
      this.log(`${p.name}の二度駆け：このターン2回動く`, "hit");
      this._proc(p, "二度駆け");
    }
  }

  // 奇襲の1ターン目に動く敵: 生きている敵それぞれが AMBUSH_ACT_RATE (50%) で動く。誰も当たらなければ1体を選んで動かす
  _ambushers() {
    const foes = this.enemies.filter((e) => e.alive);
    const acts = foes.filter(() => random() < AMBUSH_ACT_RATE);
    if (!acts.length && foes.length) acts.push(foes[rand(foes.length)]);
    return acts;
  }

  // 敵の実効AGI を、回避・逃走の物差し (基準の隊の規模) に戻す: 直した敵は ÷TURN_K、金属の魔物は従来どおり × fleeK
  _foeAgiBase(e, agi) {
    if (e._partyScale) return agi; // 写し身 (鏡の影): 写した人業の AGI そのまま
    if (isMetal(e)) return agi * (this.fleeK || 1);
    return e._agiScaled ? agi / TURN_K : agi * (this.fleeK || 1);
  }

  // 逃走率 (5%〜95%)。逃走を選んだ者の実効AGI と、生存する敵の「追跡AGI」の平均の比で決まる:
  //   55% + 35% × log2(本人のAGI ÷ 追跡AGI) + 逃げ足 → 5%〜95% に収める
  //   追跡AGI = 敵の実効AGI (基準の隊の規模 — _foeAgiBase) の平均 (主がいれば ×FLEE_BOSS_MUL)。互角で55%、本人が2倍速ければ90%、半分なら20%
  //   実効AGI はバフ/デバフ込み (水技の鈍足・影縫い・激昂・先駆けの号令が効く)
  fleeChance(actor) {
    if (this.noFlee || this.noRun) return 0;
    const foes = this.livingEnemies();
    if (!foes.length) return FLEE_MAX;
    const agiOf = (a) => Math.max(1, (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1));
    let chase = foes.reduce((s, e) => s + this._foeAgiBase(e, agiOf(e)), 0) / foes.length;
    if (foes.some((e) => e.boss)) chase *= FLEE_BOSS_MUL;
    // 逃げ足 (fleetFoot): 個人の習得は+30%、隊の誰かの Lv に応じ +30/45/60%。高い方を採用
    const fleetSelf = this.party.some((p) => p.alive && pv(p, "fleetFoot")) ? 0.30 : 0;
    const fleetOrder = this.orderFleet >= 3 ? 0.60 : this.orderFleet >= 2 ? 0.45 : this.orderFleet >= 1 ? 0.30 : 0;
    const p = FLEE_BASE + FLEE_SLOPE * Math.log2(agiOf(actor) / chase) + Math.max(fleetSelf, fleetOrder);
    return Math.min(FLEE_MAX, Math.max(FLEE_MIN, p));
  }

  // AGI による回避の素の率。双方の速度を同じ尺度にそろえた相対値 (EVADE_*)。
  // 攻撃側と対象の実効AGIの比で回避を決める (上限20%)。バフ/デバフ込み
  _evadeBase(tgt, actor) {
    const agiOf = (a) => Math.max(1, (a.agi || 1) * this._bm(a, "agi", a === actor ? tgt : actor));
    if (!actor) return 0;
    // 敵のAGIは味方と規模が違うので、双方向とも逃走の物差しでそろえる。
    const scaledAgi = (a) => (a.side === "enemy" ? this._foeAgiBase(a, agiOf(a)) : agiOf(a));
    let tAgi = scaledAgi(tgt);

    const p = EVADE_EVEN + EVADE_SLOPE * Math.log2(tAgi / scaledAgi(actor));
    return Math.min(EVADE_MAX, Math.max(0, p));
  }

  // 物理が外れる確率 (見切り・必中は別): 素の命中漏れ + 対象の敏捷(AGI)による回避 + 回避持ちの追加回避。
  // 技の命中補正 (acc) は命中率に直接加算する (0.1 = +10%、1 = 必中)。目つぶしは外れる確率を足す
  _missP(tgt, actor, opt = {}) {
    if (this.challengeRule === "sureHit") return 0;
    const evade = (isMetal(tgt) ? metalEvade(tgt) : this._evadeBase(tgt, actor)) + (tgt.evasive ? .15 : 0) + (tgt.evadeBonus || 0) + this._parryP(tgt)
      + (tgt.side === "party" && actor.side === "enemy" ? this._perkSum(tgt, "evade", { tgt: actor }) + _partyEvadeBonus : 0);
    const accuracy = (actor.accuracyPower ?? 1) + (opt.acc || 0) + (actor.hitBonus || 0) + visionHitBonus(actor, tgt)
      + (actor.side === "party" ? _partyHitBonus : 0);
    return Math.round((1 - hitChance(accuracy * this._bm(actor, "hit"), evade, !!opt.sureHit)) * 1e12) / 1e12;
  }
  // 見切り (parry) で物理を丸ごとかわす確率
  _parryP(t) { const lv = pv(t, "parry"); return lv >= 2 ? 0.15 : lv ? 0.10 : 0; }

  // 戦闘中の人業の様子 (隊の札の長押し — ui/dungeonhud.js peekDoll)。実際の式から、いまの数字を読むだけ (乱数・状態は触らない)
  //   stats = 強化・弱体込みの能力値 / power = 攻撃力 / hit = 通常攻撃が届く敵への命中率の平均 /
  //   crit = 通常の会心率 (固有パッシブの条件つきの分は除く) / evade = 生きている敵の打撃をかわす率の平均 /
  //   flee = 逃走率 / order = 手番 ("now" | この巡りであと何人の後か | null = 次の巡り) / back = 後衛 / reach = 届く敵の数
  peekStats(a) {
    if (!a || a.side !== "party") return null;
    const stats = {};
    for (const k of ["atk", "vit", "agi", "int", "pie"]) stats[k] = Math.round((a[k] || 0) * this._bm(a, k));
    stats.luk = Math.round((a.luk || 0) * this._bm(a, "luk"));
    const foes = this.livingEnemies();
    const reach = a.alive ? this.attackableEnemies(a) : [];
    const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
    const hit = avg(reach, (e) => (e.asleep || e.ailment === "paralyze") ? 1 : Math.max(0, 1 - Math.min(1, this._missP(e, a, { basic: true }))));
    const evade = avg(foes, (e) => this._missP(a, e, {}));
    const crit = Math.min(.8, Math.max(0, 0.06 + (a.critBonus || 0) + luckCritBonus((a.luk || 0) * this._bm(a, "luk")) + (a._evCrit || 0)));
    const qi = this.queue.indexOf(a);
    const order = this.current === a ? "now" : qi >= 0 ? this.queue.slice(0, qi).filter((x) => x.alive).length : null;
    return { stats, power: this._eatk(a), hit, crit, spellCrit: this._spellCritChance(a, {}),
      critMul: 1.85 * this._physicalCritMul(a) * [1, 1.25, 1.45][Math.min(pv(a, "vitalEye"), 2)],
      spellCritMul: this._spellCritMul(a), evade, flee: this.fleeChance(a), order, back: this.isBackRow(a), reach: reach.length, foes: foes.length, range: this.attackRange(a) };
  }


  // 次の手番へ。味方なら input (行動不能なら stunned)、敵なら enemy フェーズで止まる
  advance() {
    if (this.result) { this.phase = "done"; return; }
    while (true) {
      if (this.queue.length === 0) this._startRound();
      if (this.result) { this.phase = "done"; return; }
      const actor = this.queue.shift();
      if (!actor || !actor.alive) continue;
      if (actor.side === "enemy" && this._enemyStopRound === this._roundNo) continue;
      this.current = actor;
      for (const p of this.party) p._hpPre = p.hp; // 勇者の意地: この手番の初めの HP を覚える
      if (actor.side === "party") {
        // 眠り・麻痺: 手番の初めに回復判定。自然に治ったら、この手番からいつも通り動ける
        if (actor.ailment === "paralyze" && this._naturalRecover(actor, "para", 0.35)) { actor.ailment = null; this.log(`${actor.name}の麻痺解除`, "heal"); }
        if (actor.asleep && actor.ailment !== "paralyze" && actor.ailment !== "stone" && this._naturalRecover(actor, "sleep", 0.45)) { actor.asleep = false; this.log(`${actor.name}の眠り解除`, "sys"); }
        if (actor.asleep || actor.ailment === "paralyze" || actor.ailment === "stone") { this.phase = "stunned"; return; }
        actor._defending = false; actor._parryHold = false; // 防御は次の自分の手番まで
        // 魅了・混乱: 正気に戻れなければ勝手に動く (stunnedAct → _mindAct)。自然に戻ったらこの手番から動ける
        if (actor.mind && this._mindCheck(actor) === "auto") { this.phase = "stunned"; return; }
        this.phase = "input";
      } else {
        this.phase = "enemy";
      }
      return;
    }
  }

  // 行動不能の味方の手番 (睡眠/麻痺/石化)。麻痺・睡眠の回復判定は advance で済んでいる (治れば input へ進む)
  stunnedAct() {
    const a = this.current;
    a._actedRound = this._roundNo;
    // 魅了・混乱で勝手に動く手番 (眠り・麻痺・石化が先に効く)
    if (a.mind && !a.asleep && a.ailment !== "paralyze" && a.ailment !== "stone") return this._mindAct(a);
    const res = { actor: a, action: "stunned", side: a.side, hits: [] };
    if (a.ailment === "stone") this.log(`${a.name}は石化で行動不可`, "sys");
    else if (a.ailment === "paralyze") this.log(`${a.name}は麻痺で行動不可`, "sys");
    else if (a.asleep) this.log(`${a.name}は眠りで行動不可`, "sys");
    this._checkEnd();
    return res;
  }

  // 自然回復の判定 (key = mind/sleep/para/poison)。治らなかった判定ごとに AIL_RAMP ずつ治りやすくなり、
  // AIL_SURE 回目で必ず治る。治ったら数えを戻す
  _naturalRecover(actor, key, base) {
    const n = (actor._ailN || (actor._ailN = {}))[key] || 0;
    if (n < 0) { actor._ailN[key] = 1; return false; } // かかったばかり: この手番は必ず続く (救済の数えは1回目とする)
    if (n + 1 >= AIL_SURE || random() < base + AIL_RAMP * n) { actor._ailN[key] = 0; return true; }
    actor._ailN[key] = n + 1;
    return false;
  }
  // 状態異常にかけた瞬間の印: 次の自然回復の判定は必ず外れる (key = mind/sleep/para/poison)
  _holdAil(t, key) { (t._ailN || (t._ailN = {}))[key] = -1; if (t.boss && ["para", "sleep", "mind"].includes(key)) t._ccHeld = true; }
  // 魅了・混乱の手番の初め: 正気に戻れたか / 混乱していても動けるか。
  // "free" = いつも通り動ける (自然に正気に戻った手番も含む) / "auto" = 勝手に動く
  _mindCheck(actor) {
    const kind = actor.mind;
    if (!kind) return "free";
    const rec = (MIND_RECOVER[kind] || 0.3) + (actor.boss ? MIND_BOSS_RECOVER : 0);
    if (this._naturalRecover(actor, "mind", rec)) {
      actor.mind = null;
      this.log(`${actor.name}は正気に戻った`, actor.side === "party" ? "heal" : "sys");
      return "free";
    }
    if (kind === "confuse" && random() < CONFUSE_FREE) {
      this.log(`${actor.name}は混乱中も行動`, "sys");
      return "free";
    }
    // 赦しの勅令: 自然回復や、混乱中も動ける判定で手番を救えた時は回数を使わない。
    if (actor.side === "party") {
      const p = this._bestPerk("mindPardon"), cap = this._perkValue(p, "mindPardon");
      if (cap && (this._mindPardonUsed || 0) < cap) {
        this._mindPardonUsed = (this._mindPardonUsed || 0) + 1;
        actor.mind = null;
        if (actor._ailN) actor._ailN.mind = 0;
        this.log(`${p.name}の赦しの勅令！ ${actor.name}は正気に戻り、行動できる`, "heal");
        this._proc(p, "赦しの勅令");
        return "free";
      }
    }
    return "auto";
  }
  // 魅了・混乱で勝手に動く手番。魅了 = 仲間 (同じ側) の誰かを殴る / 混乱 = 敵味方を問わず誰かを殴るか、ふらつく
  _mindAct(actor) {
    const res = { actor, action: "stunned", side: actor.side, hits: [] };
    const own = actor.side === "party" ? this.party : this.enemies;
    let tgt = null;
    if (actor.mind === "charm") {
      const allies = own.filter((x) => x.alive && x !== actor);
      tgt = allies[rand(allies.length)] || null;
      // 襲う仲間がいない: 魅了されたまま立ち尽くし、手番を失う
      if (!tgt) { this.log(`${actor.name}は魅了で行動不可`, "sys"); this._checkEnd(); return res; }
      this.log(`${actor.name}は魅了で${tgt.name}を攻撃`, actor.side === "party" ? "dmg" : "hit");
    } else {
      if (random() < CONFUSE_DAZE) { this.log(`${actor.name}は混乱で行動不可`, "sys"); this._checkEnd(); return res; }
      const all = [...this.party, ...this.enemies].filter((x) => x.alive && x !== actor);
      // 仲間のいない独りの時は、自分自身も殴る相手の候補に入る
      if (!own.some((x) => x.alive && x !== actor)) all.push(actor);
      tgt = all[rand(all.length)] || null;
      if (!tgt) { this._checkEnd(); return res; }
      if (tgt === actor) {
        res.action = "attack";
        res.hits.push(this._selfHit(actor));
        this._checkEnd();
        return res;
      }
      this.log(`${actor.name}は混乱で${tgt.name}を攻撃`, "sys");
    }
    res.action = "attack";
    res.hits.push(this._physical(actor, tgt, { name: "攻撃" }));
    this._checkEnd();
    return res;
  }
  // 混乱して自分を殴る (見切り・回避・守りは効かない)
  _selfHit(actor) {
    const dmg = Math.max(1, Math.round(variance(this._eatk(actor)) * CONFUSE_SELF_MUL));
    actor.hp = this._reportHp(actor, actor, actor.hp - (dmg));
    this.log(`${actor.name}は混乱で自傷：${dmg}ダメージ`, actor.side === "party" ? "dmg" : "hit");
    const died = this._die(actor);
    return { target: actor, dmg, died };
  }
  // 行動できない (眠り・麻痺・石化) か、心を奪われている (魅了・混乱) — かばう・仁王立ち・反撃ができない
  _incap(p) { return !!(p.asleep || p.ailment === "paralyze" || p.ailment === "stone" || p.mind); }
  // 傷を受けた者の目覚め: 眠りは必ず覚め、魅了は MIND_CHARM_BREAK で正気に戻る (混乱は殴られても解けない)
  _wake(t) {
    if (!t || !t.alive) return;
    if (t.asleep) { if (t.boss) { t._ccRecovery = true; t._ccHeld = false; } t.asleep = false; if (t._ailN) t._ailN.sleep = 0; }
    if (t.mind === "charm" && random() < MIND_CHARM_BREAK) {
      if (t.boss) { t._ccRecovery = true; t._ccHeld = false; }
      t.mind = null;
      if (t._ailN) t._ailN.mind = 0;
      this.log(`${t.name}の魅了解除（被ダメージ）`, t.side === "party" ? "heal" : "sys");
    }
  }

  // 手番の味方の行動を選択。{ needTarget } を返す
  chooseAction(action, spellKey = null, extra = null) {
    const actor = this.current;
    if (action === "item") {
      // 道具: extra = { item, owner } (owner = その品を袋に入れている人業。手番の者でなくてもよい)
      const it = extra && extra.item;
      if (!it || !it.use || useWhere(it) === "field") return { invalid: true }; // 浮遊の羽などは迷宮を歩く時だけ
      const tk = useTarget(it);
      this.pending = { actor, action: "item", item: it, owner: extra.owner || actor };
      if ((tk === "ally" || tk === "dead") && this._itemTargets(it).length === 0) {
        this.log("対象なし", "sys"); this.pending = null; return { invalid: true };
      }
      if (tk === "ally" || tk === "dead" || tk === "enemy") { this.phase = "target"; return { needTarget: true }; }
      this.phase = "resolve";
      return { needTarget: false };
    }
    if (action === "attack") {
      this.pending = { actor, action: "attack" };
      this.phase = "target";
      return { needTarget: true };
    }
    if (action === "spell") {
      const sp = SPELLS[spellKey];
      if (actor.mp < this.costOf(actor, sp, spellKey)) { this.log("MP不足", "sys"); return { invalid: true }; }
      this.pending = { actor, action: "spell", spellKey };
      // 単体味方呪文で効果のある対象がいない場合は唱えさせない (満タンへの回復など)
      if (sp.target === "ally" && this._allyTargets(sp).length === 0) {
        this.log("対象なし", "sys"); this.pending = null; return { invalid: true };
      }
      if (sp.target === "all-enemy" || sp.target === "all-ally" || sp.target === "self") { this.phase = "resolve"; return { needTarget: false }; }
      this.phase = "target";
      return { needTarget: true };
    }
    if (action === "swap") {
      // 武器・盾の持ち替え: extra = { item } (手番の者の袋にある武器・盾だけ。ほかの人業の品は選べない)。1手番を使う
      const it = extra && extra.item;
      if (!it || (it.slot !== "weapon" && it.slot !== "shield") || it.unidentified || !_equipSwap || !(actor.items || []).includes(it)) return { invalid: true };
      this.pending = { actor, action: "swap", item: it };
      this.phase = "resolve";
      return { needTarget: false };
    }
    if (action === "defend" || action === "run") {
      this.pending = { actor, action };
      this.phase = "resolve";
      return { needTarget: false };
    }
    return { invalid: true };
  }

  // この戦闘での実際の消費MP。極「記憶の」: 前の手番と同じ技 (回復・蘇生を除く) は半分 (切り上げ)
  costOf(actor, sp, key) {
    const c = spellCost(actor, sp);
    if(!memoryHalf(actor,sp,key))return c;
    const cut=Math.max(gm(actor).memory ? .5 : 0,gm(actor).bk_memory||0);
    return Math.max(Math.ceil(c*(10000-Math.round(cut*10000))/10000),gm(actor).bk_memory?Math.ceil((sp.mp+soulCostAdd(actor,sp))*.3):0);
  }

  targetOptions() {
    const p = this.pending;
    if (!p) return [];
    if (p.action === "attack") return this.attackableEnemies(p.actor); // 武器の射程内のみ
    if (p.action === "item") return useTarget(p.item) === "enemy" ? this.livingEnemies() : this._itemTargets(p.item); // 投げ物は射程に依らず届く
    const sp = SPELLS[p.spellKey];
    if (sp.target === "enemy") return sp.kind === "phys" ? this.attackableEnemies(p.actor) : this.livingEnemies(); // 物理技は射程に従う。呪文は全体に届く
    if (sp.target === "ally") return this._allyTargets(sp);
    return [];
  }

  // 単体味方呪文で「効果のある対象」だけを返す。
  //  - HP回復(power) は HP満タンには無効 / 状態治療は状態異常がなければ無効 /
  //    蘇生は戦闘不能者のみ。バフ/不屈/障壁などの副次効果がある呪文は満タンでも有効。
  _allyTargets(sp) {
    const heals = healsHp(sp);
    const revives = !!sp.revive;
    const cures = sp.kind === "cure" || !!sp.cure;
    const otherBenefit = !!(sp.buff || sp.grantEndure || sp.grantBarrier || sp.regen); // 満タンでも有効な効果
    if (sp.kind === "mana") return this.party.filter((t) => t.alive && (t.maxmp || 0) > 0 && t.mp < t.maxmp);
    if (sp.kind === "cure" && sp.purge) return this.party.filter((t) => t.alive && (canSpellCure(sp, t) || (t.effects || []).some((e) => e.mult < 1)));
    return this.party.filter((t) => {
      if (!t.alive) return revives;            // 死者は蘇生呪文のみ
      if (otherBenefit) return true;
      if (heals && t.hp < t.maxhp) return true;
      if (cures && canSpellCure(sp, t)) return true;
      if (!heals && !cures && !revives) return true; // 回復/治療/蘇生以外の補助は満タンでも可
      return false;
    });
  }

  // 道具を使って効果のある味方 (満タンへの回復・かかっていない状態異常の治療は除く。蘇生は倒れた者だけ)
  _itemTargets(it) { return this.party.filter((t) => useHelps(it, t)); }

  chooseTarget(target) {
    this.pending = { ...this.pending, target };
    this.phase = "resolve";
  }

  cancelTarget() {
    this.pending = null;
    this.phase = "input";
  }

  // 味方の予約済み行動を実行し結果を返す (advance はしない)
  commit() {
    const res = this._exec(this.pending);
    this.pending = null;
    this._checkEnd();
    if (!this.result && res && res.actor && res.actor.side === "party") this._necroLegion(res.actor, res);
    const a = res && res.actor;
    // 極「早業の」: 道具を使っても手番を使わない (1戦闘に1回)。時間跳躍より先に見る
    if (!this.result && a && a.side === "party" && a.alive && res.item && !a._quickUsed && bkProc(a,"quick")) {
      a._quickUsed = true;
      this.queue.unshift(a);
      this.log(`${a.name}の早業：もう一度動ける`, "hit");
      this._proc(a, "早業");
      return res;
    }
    // 時間跳躍 (賢者のランク): 手番の後 10/15/20/30% でもう一度行動 (1ターン1回)
    if (!this.result && a && a.side === "party" && a.alive && a._againRound !== this._roundNo
      && random() < this._rk(a, "sageJikan", [0.10, 0.15, 0.20, 0.30])) {
      a._againRound = this._roundNo;
      this.queue.unshift(a);
      this.log(`時間跳躍！ ${a.name}が再行動`, "hit");
      this._proc(a, "時間跳躍");
    }
    return res;
  }
  // 死者の軍勢 (死霊術師): 自分の手番の終わりに、ランダムな敵へ INT×5 の固定ダメージを 1/2/3 回 (金属の魔物には効かない)
  _necroLegion(a, res) {
    const lv = a.alive ? pv(a, "necroLegion") : 0;
    if (!lv) return;
    let any = false;
    for (let i = 0; i < Math.min(3, lv); i++) {
      const t = this._randAlive(this.livingEnemies().filter((e) => !isMetal(e)));
      if (!t) break;
      const dmg = Math.max(1, Math.round((a.int || 0) * 5));
      if (!any) { this.log(`${a.name}の死者の軍勢！`, "hit"); this._proc(a, "死者の軍勢"); any = true; }
      t.hp = this._reportHp(a, t, t.hp - (dmg));
      this.log(`${t.name}に${dmg}ダメージ`, "dmg");
      this._wake(t);
      res.hits.push({ target: t, dmg, died: this._die(t) });
    }
    this._checkEnd();
  }

  // 敵の手番を実行し結果を返す。特殊能力 (ability) 持ちは一定確率で使う
  enemyAct() {
    const a = this.current;
    const recovering = !!a._ccRecovery;
    try { return this._enemyAct(); }
    finally {
      if (a.boss) {
        const held = a.asleep || a.ailment === "paralyze" || a.mind || a._ccHeld;
        if (held) {
          a.asleep = false; a.mind = null; a._flinch = false;
          if (a.ailment === "paralyze") a.ailment = null;
          a._ccHeld = false; a._ccRecovery = true;
          this.log(`${a.name}は行動を妨げる異常から回復、次の手番終了まで再付与無効`, "sys");
        } else if (recovering) a._ccRecovery = false;
      }
    }
  }
  _enemyAct() {
    const actor = this.current;
    actor._actedRound = this._roundNo; // 行動不能で手番を失う時も、このターンは行動済み
    let cmd;
    if (this._enemyStopRound === this._roundNo) {
      this.log(`${actor.name}は立て直しの旗で行動不可`, "sys");
      this._checkEnd();
      return { actor, action: "stunned", side: actor.side, hits: [] };
    }
    // 大技の予兆: 眠り・麻痺・石化・心の乱れ・怯み・特技封じを受けていれば、溜めた力は霧散する
    if (this._omenOf(actor) && this._omenBroken(actor)) this._breakOmen(actor);
    if (actor._chargeCd > 0) actor._chargeCd--;
    if (actor._nailed) {
      // 五寸釘 (呪術師): 最初の手番を失う
      actor._nailed = false;
      this.log(`${actor.name}は五寸釘で行動不可`, "sys");
      const res = { actor, action: "stunned", side: actor.side, hits: [] };
      this._checkEnd();
      return res;
    }
    if (actor._flinch) {
      // 怯み: この手番を失う
      actor._flinch = false;
      this.log(`${actor.name}は怯みで行動不可`, "sys");
      const res = { actor, action: "stunned", side: actor.side, hits: [] };
      this._checkEnd();
      return res;
    }
    // 眠り: 手番の初めに回復判定。目を覚ましたら、この手番からいつも通り動く
    if (actor.asleep && this._naturalRecover(actor, "sleep", 0.45)) { actor.asleep = false; this.log(`${actor.name}の眠り解除`, "sys"); }
    // 麻痺: 35%で解ける (解けたらそのまま動く)。解けなければ 60%で手番を失う
    if (actor.ailment === "paralyze") {
      if (this._naturalRecover(actor, "para", 0.35)) { actor.ailment = null; this.log(`${actor.name}の麻痺解除`, "sys"); }
      else if (random() < 0.6) {
        this.log(`${actor.name}は麻痺で行動不可`, "sys");
        const res = { actor, action: "stunned", side: actor.side, hits: [] };
        this._checkEnd();
        return res;
      }
    }
    // 魅了・混乱: 正気に戻れなければ、仲間を襲う・誰かれ構わず殴る・ふらつく。自然に戻ったらこの手番からいつも通り動く
    if (actor.mind && !actor.asleep && this._mindCheck(actor) === "auto") return this._mindAct(actor);
    // 金属の体: 自分の手番に、段ごとの確率で逃げ出す (倒されずに去った個体は戦果を残さない)
    // 極「追い足の」: 持ち主が隊にいる (生きている) と、金属の魔物の逃げる率が半分
    if (actor.metal && !actor.asleep && random() < (METAL_TIERS[actor.metal] || METAL_TIERS[1]).flee * (1-Math.max(0,...this.party.filter(p=>p.alive).map(p=>bkValue(p,"chaser",.5))))) return this._enemyFlee(actor);
    // 特技封じ: 役割 (回復・呼び出し) と特殊能力 (ブレス・状態異常など) を使えず、通常攻撃だけになる
    const sealed = this._bm(actor, "seal") < 1;
    if (actor.asleep) {
      cmd = { actor, action: "sleep" };
    } else if (sealed) {
      cmd = { actor, action: "attack", target: this._pickPartyTarget() };
    } else {
      const omen = this._omenOf(actor);
      if (omen) {
        // 溜めた力を放つ。溜めたのと同じターン (神速の2手目) はまだ放たず、溜めたまま普通に殴る
        cmd = omen.round < this._roundNo ? { actor, action: "charged", omen } : { actor, action: "attack", target: this._pickPartyTarget() };
      } else if (this._strongFoe(actor) && this._downWeight(actor) >= SHAKE_AT && random() < SHAKE_RATE) {
        // 払いのけ: 主・精鋭は弱体が深くなると身を震わせて振り払う (特技封じ中は使えない)
        cmd = { actor, action: "shake" };
      }
      // 役割持ちの行動 (通常攻撃より優先): 回復役は傷ついた仲間を癒し (いなければ弱体を浄め)、呼び手は仲間を呼ぶ
      if (!cmd && actor.role === "healer") {
        const t = this._woundedAlly(actor);
        if (t && random() < 0.70) cmd = { actor, action: "eheal", target: t };
        else {
          const d = this._debuffedAlly();
          if (d && random() < 0.60) cmd = { actor, action: "ecleanse", target: d };
        }
      } else if (!cmd && actor.role === "summoner") {
        if (this.livingEnemies().length < MAX_ENEMIES && random() < 0.50) cmd = { actor, action: "summon" };
      }
      // 写し身 (鏡の影): 写した人業の技を、残りMPの許す限り使う
      if (!cmd && actor.mimic) cmd = this._mimicPick(actor);
      // 主・精鋭の溜め (特技とは別枠)
      if (!cmd && !(actor._chargeCd > 0) && random() < this._chargeRate(actor)) cmd = { actor, action: "windup" };
      if (!cmd) {
        const ab = actor.ability;
        // ブレス・全体呪文はどちらも隊の全員への攻撃 (action "breath"。kind で吐息か呪文かを分ける)
        const wide = ab === "breath" || ab === "spell";
        const ikou = 1 - this._rkParty("templarIkou", [0.10, 0.15, 0.20, 0.30]); // 封魔の威光 (神殿騎士のランク)
        let rate = (actor.abRate || (wide ? 0.30 : 0.25)) * ikou;
        // 状況を見る特技: 打ち消しは隊の加護が厚い時だけ (厚いほど狙う)、雄叫びは仲間がもう奮い立っていれば控える、溜めは冷めるまで待つ
        if (ab === "dispel") rate = this._partyUpWeight() >= DISPEL_AT ? Math.max(rate, 0.5 * ikou) : 0;
        else if (ab === "warcry" && this.livingEnemies().every((e) => this.stageOf(e, "atk") >= 2)) rate = 0;
        else if (ab === "charge" && actor._chargeCd > 0) rate = 0;
        if (ab && random() < rate) {
          cmd = ab === "charge" ? { actor, action: "windup" }
            : { actor, action: wide ? "breath" : "special", kind: ab, target: ab === "weaken" ? this._weakenTarget() : this._pickPartyTarget() };
        } else {
          cmd = { actor, action: "attack", target: this._pickPartyTarget() };
        }
      }
    }
    const res = this._exec(cmd);
    this._checkEnd();
    return res;
  }

  // 敵が戦場から逃げ去る (金属の魔物)。倒れたのではないので討伐・戦果には数えない (_fled)
  _enemyFlee(actor) {
    actor.alive = false;
    actor._fled = true;
    actor.asleep = false; actor.mind = null;
    this.log(`${actor.name}は逃走`, "sys");
    const res = { actor, action: "eflee", side: actor.side, hits: [] };
    this._checkEnd();
    return res;
  }

  _randAlive(list) {
    const a = list.filter((x) => x.alive);
    return a[rand(a.length)] || null;
  }

  // 回復役の標的: 最もHP割合の低い負傷した仲間 (HP65%未満)
  // 写し身の技選び: 仲間の影が深手 (HP5割未満) なら回復を、それ以外は MIMIC_SKILL_RATE で一番重い攻撃の技を (届かなければ通常攻撃)
  _mimicPick(actor) {
    const usable = actor.mimic.map((k) => [k, SPELLS[k]]).filter(([, sp]) => sp && spellCost(actor, sp) <= (actor.mp || 0));
    if (!usable.length) return null;
    const hurt = this.livingEnemies().filter((e) => e.hp < e.maxhp * 0.5);
    const heals = usable.filter(([, sp]) => healsHp(sp));
    if (hurt.length && heals.length && random() < 0.7) {
      const pie = (actor.pie || 0) * this._bm(actor, "pie");
      const score = ([, sp]) => (sp.healPct ? 999 : spellHealRaw(actor, sp, pie)) * (sp.target === "all-ally" ? Math.min(2, hurt.length) : 1);
      const [k] = heals.reduce((a, b) => (score(b) > score(a) ? b : a));
      return { actor, action: "mimic", spellKey: k };
    }
    if (random() >= MIMIC_SKILL_RATE) return null;
    const n = this.livingParty().length;
    const score = ([, sp]) => (sp.kind === "phys" ? (sp.power || 1) * (sp.scatter || sp.hits || 1) * this._eatk(actor)
      : attackSpellPower(sp, Math.max(actor.int || 0, isFaithSpell(sp) ? actor.pie || 0 : 0), this.lvOf(actor))) * (sp.target === "all-enemy" ? n * 0.7 : 1);
    const atks = usable.filter(([, sp]) => (sp.kind === "phys" && (sp.power || 0) > 0) || (sp.kind === "atk" && !sp.gravity && (sp.power || 0) > 0));
    if (!atks.length) return null;
    const [k] = atks.reduce((a, b) => (score(b) > score(a) ? b : a));
    return { actor, action: "mimic", spellKey: k, target: this._pickPartyTarget() };
  }
  // 写し身が技を使う: 物理技は隊への物理 (通常攻撃と同じ計算・技の倍率と段数)、攻撃呪文は隊への呪文、回復は仲間の影へ。
  //  技に付く状態異常・弱体などの効果は写さない (威力だけを写す)
  _mimicCast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    actor.mp = Math.max(0, (actor.mp || 0) - spellCost(actor, sp));
    const isPhys = sp.kind === "phys";
    this.log(`${actor.name}の${sp.name}！`, "dmg");
    res.spellName = sp.name;
    const all = sp.target === "all-enemy";
    if (healsHp(sp)) {
      res.action = "spell"; res.spellKind = "heal";
      const pie = (actor.pie || 0) * this._bm(actor, "pie");
      const raw = spellHealRaw(actor, sp, pie);
      const tgts = sp.target === "all-ally" ? this.livingEnemies() : [this._woundedAlly(actor) || actor].filter((t) => t.alive);
      for (const t of tgts) {
        const heal = Math.min(t.maxhp - t.hp, healOnTarget(sp, t, sp.healPct ? 0 : variance(raw)));
        const before = t.hp;
        t.hp = this._reportHp(actor, t, t.hp + (Math.max(0, heal)));
        this.log(`${t.name}のHP+${Math.max(0, heal)}`, "dmg");
        res.hits.push({ target: t, heal: Math.max(0, heal) });
        this._enemyHealed(t, before);
      }
      return;
    }
    if (isPhys) {
      res.action = "attack";
      const popt = {
        power: (sp.power || 1) * soulPowerMul(actor, sp), critBonus: sp.critBonus, element: sp.element,
        intScale: sp.intScale, agiScale: sp.agiScale, vitScale: sp.vitScale, pieScale: sp.pieScale,
        acc: sp.acc, sureHit: sp.sureHit, pierce: sp.pierce, name: sp.name, skill: true, area: all,
      };
      const plan = [];
      if (sp.scatter) for (let i = 0; i < sp.scatter; i++) plan.push(null);
      else for (const t of (all ? this.livingParty() : [(cmd.target && cmd.target.alive) ? cmd.target : this._pickPartyTarget()].filter(Boolean))) plan.push(t);
      for (const t0 of plan) {
        const t = t0 || this._randAlive(this.party);
        if (!t) break;
        for (let h = 0; h < (sp.scatter ? 1 : (sp.hits || 1)); h++) {
          if (!t.alive) break;
          res.hits.push(this._physical(actor, t, popt));
        }
      }
      return;
    }
    // 攻撃呪文: 味方の呪文と同じ威力 (INT、光・祈りの呪文は INT と PIE の高い方)。守りは隊が受ける呪文と同じ (魔法抵抗値・呪文避け・魔障壁・封の結界)
    res.action = "breath"; res.breath = true; res.espell = true; res.fxEl = sp.element || "none";
    const tgts = all ? this.livingParty() : [(cmd.target && cmd.target.alive) ? cmd.target : this._pickPartyTarget()].filter(Boolean);
    for (const t of tgts) {
      if ((t.magResist || 0) >= 100) {
        this.log(`${t.name}：魔法無効`, "sys");
        res.hits.push({ target: t, dmg: 0, immune: true, died: false });
        continue;
      }
      if (this._onceGuard(t, "spellGuard", "_sgUsed", "封の結界")) { res.hits.push({ target: t, dmg: 0, immune: true, died: false }); continue; }
      const intv = Math.max((actor.int || 0) * this._bm(actor, "int", t), isFaithSpell(sp) ? (actor.pie || 0) * this._bm(actor, "pie", t) : 0);
      const power = attackSpellPower(sp, intv, this.lvOf(actor)) * soulPowerMul(actor, sp);
      const em = this._elementMul(actor, t, sp.element || "none");
      let dmg = Math.max(1, Math.round(variance(power)) - Math.floor(this._evit(t, actor) * 0.2));
      const special = this._elementSpecial(actor, t, sp.element, dmg);
      if (special) { res.hits.push(special); continue; }
      if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
      if (t._defending) dmg = Math.ceil(dmg * 0.5);
      { const pt = this._perkSum(t, "take", { tgt: actor, el: sp.element || "none", on: ["spell"] }); if (pt) dmg = Math.max(1, Math.floor(dmg * Math.max(0.2, 1 - pt))); }
      const ward = this._bm(t, "wardS");
      if (ward > 1) dmg = Math.max(1, Math.round(dmg / ward));
      if (t._barrierLeft > 0) {
        t._barrierLeft--;
        dmg = Math.ceil(dmg * 0.5);
        this.log(`${t.name}の魔障壁：呪文半減（残り${t._barrierLeft}回）`, "heal");
        this._proc(t, "魔障壁");
      }
      dmg = Math.max(1, Math.floor(dmg * (1 - this._shintou(t))));
      const mr = this._resistCut(t, dmg, "magResist");
      dmg = mr.dmg;
      if (t.guard) dmg = Math.ceil(dmg * (1 - t.guard));
      dmg *= 1 - this._rkParty("wardenKekkai", [.05, .08, .12, .20]);
      dmg = Math.max(1, Math.round(dmg * this._passiveCorrection(t, actor, sp.element, "magic")));
      dmg = this._gearGuard(t, dmg, "magic"); // 逆境の (極)
      dmg = this._wallCut(t, dmg);
      dmg = this._gearSplit(t, dmg); // 痛み分けの (極)
      t.hp = this._reportHp(actor, t, t.hp - (dmg));
      this.log(`${t.name}に${dmg}ダメージ${hitNote(elemNote(em, sp.element), mr.tag)}`, "dmg");
      this._wake(t);
      const rp = reflectPow(t);
      const died = this._die(t);
      if (!died) { this._postDamage(t); this._perkHurt(t, actor, dmg, "spell"); }
      if (rp > 0) this._retaliate(t, actor, rp, 1, "反射の陣", true);
      res.hits.push({ target: t, dmg, died });
    }
  }
  _woundedAlly(actor) {
    let best = null;
    for (const e of this.livingEnemies()) {
      if (e.hp >= e.maxhp * 0.65) continue;
      if (!best || e.hp / e.maxhp < best.hp / best.maxhp) best = e;
    }
    return best;
  }

  // 浄めの標的: 弱体が一番深い仲間 (段の合計で2以上)
  _debuffedAlly() {
    let best = null, bw = 1;
    for (const e of this.livingEnemies()) { const w = this._downWeight(e); if (w > bw) { best = e; bw = w; } }
    return best;
  }
  // 隊にかかっている強化の厚み (打ち消しの判断)
  _partyUpWeight() { return this.livingParty().reduce((a, p) => a + this._upWeight(p), 0); }
  // 力を削ぐ呪いの標的: 一番攻撃力の高い者 (もう −3段まで下がっている者は除く)。挑発には乗らない
  _weakenTarget() {
    const list = this.livingParty().filter((p) => this.stageOf(p, "atk") > -STAGE_MAX);
    if (!list.length) return this._pickPartyTarget();
    return list.reduce((a, p) => (this._eatk(p) > this._eatk(a) ? p : a), list[0]);
  }

  // ---- 大技の予兆 (溜め) ----
  // 主・精鋭 (手番ごとに CHARGE_RATE の確率) と特技 "charge" の魔物は、力を溜めて予兆を見せ (効果 omen・札「溜」)、
  // 次のターン以降の手番で大技を放つ。隊は 防御・仁王立ち・挑発・守りの陣で受けるか、
  // 打ち消し (strip)・特技封じ・眠り・麻痺・魅了・混乱・怯みで溜めを潰すかを選ぶ
  _omenOf(e) { return e && e.effects ? e.effects.find((x) => x.stat === "omen") : null; }
  _omenBroken(e) {
    return !!(e.asleep || e._flinch || e.mind || e.ailment === "paralyze" || e.ailment === "stone" || this._bm(e, "seal") < 1);
  }
  _breakOmen(e) {
    const om = this._omenOf(e);
    if (!om) return false;
    e.effects.splice(e.effects.indexOf(om), 1);
    this._recalcBuffs(e);
    e._chargeCd = 1;
    this.log(`${e.name}の溜め解除`, "hit");
    return true;
  }
  // 手番ごとに溜めを始める確率 (特技 "charge" の魔物は特技の抽選で溜める)
  _chargeRate(e) {
    if (e.metal || e.ability === "charge") return 0;
    if (e.boss) return CHARGE_RATE.boss;
    if (e.mon && e.mon.elite) return CHARGE_RATE.elite;
    return 0;
  }
  // 放つ大技の種類: ブレス・全体呪文の使い手はそれを強めて、主はそれ以外なら 単体の痛打 → 全体の猛威 を交互に
  _chargeKind(e) {
    if (e.ability === "breath") return "breath";
    if (e.ability === "spell") return "spell";
    if (e.boss) return (e._chargeN || 0) % 2 ? "wide" : "smash";
    return "smash";
  }

  // 護り手 (guard): 仲間への物理攻撃を一定確率で肩代わりする (回数制)。
  // 護り手を先に倒すか、呪文 (肩代わり不可) で本命を狙うのが対策になる
  _enemyGuardFor(tgt) {
    if (tgt.role === "guard") return null;
    for (const e of this.livingEnemies()) {
      if (e === tgt || e.role !== "guard" || !(e._guardLeft > 0)) continue;
      if (e.asleep || e._flinch || e.mind) continue;
      if (random() < 0.60) return e;
      return null;
    }
    return null;
  }

  // 敵の単体行動の標的選び。前衛は狙われやすく (重み3)、後衛は狙われにくい (重み1)。
  // 挑発 (taunt) 持ちはさらに3倍狙われやすい
  // 敵を引き付けている (挑発・矢面の構えの効果中) 生きた味方のうち、一番強く引き付けている者
  _tauntHolder() {
    let best = null, bw = 1;
    for (const p of this.livingParty()) {
      const w = (pv(p, "taunt") ? 3 : 1) * this._bm(p, "taunt");
      if (w > bw) { best = p; bw = w; }
    }
    return best;
  }
  // 気配断ち: 本人の標的選択の重みだけを20/35/50%減らす。隊列・挑発の補正に乗算。
  _targetWeight(p) {
    const base = (this.isBackRow(p) ? 1 : 3) * (pv(p, "taunt") ? 3 : 1) * Math.round(this._bm(p, "taunt"));
    const conceal = [1, 0.80, 0.65, 0.50][Math.min(3, pv(p, "stealthStep"))];
    return base * conceal;
  }
  _pickPartyTarget() {
    const list = this.livingParty();
    if (!list.length) return null;
    // 迷宮の掟「槍ぶすま」(focus): 狙った人業が倒れるまで同じ者を狙い続ける。挑発の技 (効果の taunt) が掛かっている間だけは
    // 引き剥がされていつもどおりに狙い、切れたら次に狙った者に定める (常に効くパッシブの挑発は、最初の狙いの重みにだけ効く)
    const taunting = this.focus && list.some((p) => this._bm(p, "taunt") > 1);
    if (this.focus && !taunting && this._focusT && list.includes(this._focusT)) return this._focusT;
    // 気配断ちの端数を保つ重み付き抽選。整数の人数分だけ並べる方式では20/35%を表せない。
    const weights = list.map((p) => this._targetWeight(p));
    let pick = random() * weights.reduce((sum, w) => sum + w, 0);
    let t = list[list.length - 1];
    for (let i = 0; i < list.length; i++) {
      pick -= weights[i];
      if (pick < 0) { t = list[i]; break; }
    }
    if (this.focus) this._focusT = taunting ? null : t;
    return t;
  }

  // 行動を実行し、演出用の結果 { actor, action, side, hits:[{target,dmg,crit,miss,heal,sleep,died}] } を返す
  _exec(cmd) {
    this._actSeq = (this._actSeq || 0) + 1; // たぎる血潮: 1手ごとに数える
    this._ailQueue = new Map();
    this._actor = cmd.actor; // 固有パッシブ (kill) が「誰が倒したか」を知るための印
    const a = cmd.actor;
    if (a) a._actedRound = this._roundNo;
    if (a && a.side === "party") { cmd._memo = memoryHalf(a, SPELLS[cmd.spellKey], cmd.action === "spell" ? cmd.spellKey : null); a._lastSkill = cmd.action === "spell" ? cmd.spellKey : null; }
    this._procHits = [];
    try {
      const res = this._execInner(cmd);
      this._flushAilments(res);
      this._checkEnd();
      res.hits.push(...this._procHits);
      return res;
    } finally {
      this._procHits = [];
      this._ailQueue = null;
      this._actor = null;
      // 連携の (極): このターンに直前に動いた味方と、その狙った敵
      if (a && a.side === "party" && cmd.target && cmd.target.side === "enemy") { this._comboTgt = cmd.target; this._comboActor = a; }
    }
  }
  _execInner(cmd) {
    const { actor, action } = cmd;
    const res = { actor, action, side: actor.side, hits: [] };
    if (action === "spell" && actor.side === "party" && this.show) this.show.sp++; // 観客の注文 (技を使わずに勝て)
    if (action === "attack" && actor.side === "party" && this.show) this.show.at = (this.show.at || 0) + 1; // 無限迷宮の称号「祈りのみ」
    if (action === "sleep") {
      // 回復判定は enemyAct の初めで済んでいる (目を覚ましたらここへは来ない)
      this.log(`${actor.name}は眠りで行動不可`, "sys"); res.asleep = true;
      return res;
    }
    if (action === "swap") {
      const it = cmd.item, prev = actor.equip ? actor.equip[it && it.slot === "shield" ? "shield" : "weapon"] : null;
      const r = _equipSwap && it && (actor.items || []).includes(it) ? _equipSwap(actor, it) : null;
      if (!r || !r.ok) {
        this.log(`${actor.name}は持ち替えられなかった${r && r.msg ? `（${r.msg}）` : ""}`, "sys");
        res.swapFail = true;
        return res;
      }
      this._gearFields(actor); // 新しい武器の戦闘効果 (連撃・吸血…) に入れ替える
      this._recalcBuffs(actor);
      const off = (r.displaced || []).filter((x) => x && x !== prev); // 両手武器で外れた盾 / 盾で外れた両手武器
      this.log(`${actor.name}：${prev ? `${prev.name}→` : ""}${it.name}に持ち替え${off.length ? `（${off.map((x) => x.name).join("・")}は袋へ）` : ""}`, "hit");
      res.swap = it;
      return res;
    }
    if (action === "defend") {
      actor._defending = true;
      if (bkProc(actor,"parryHold")) actor._parryHold = true; // 受け流しの (極): 次の自分の手番まで敵の物理を1回かわす
      this.log(`${actor.name}は防御（被ダメージ半減${actor._parryHold ? "・物理を1回受け流す" : ""}）`, "sys");
      return res;
    }
    if (action === "run") {
      if (this.noRun) {
        this.log("警報で集まった敵に囲まれている！ 通常の逃走はできない", "dmg");
        res.fledFail = true;
        return res;
      }
      // 迷宮の異変「閉ざされた退路」: 逃走そのものが封じられている
      if (this.noFlee) {
        this.log("逃走不可（退路封鎖）", "dmg");
        res.fledFail = true;
        return res;
      }
      const chance = this.fleeChance(actor);
      if (random() < chance) { this.result = "flee"; this.log("逃走成功", "sys"); res.fled = true; }
      else { this.log(`${actor.name}は逃走失敗`, "dmg"); res.fledFail = true; }
      return res;
    }
    if (action === "attack") {
      // 標的が倒れていたら選び直す (味方は射程内から、敵は隊列の重み付きで)
      const tgt = (cmd.target && cmd.target.alive) ? cmd.target
        : actor.side === "party" ? this._randAlive(this.attackableEnemies(actor)) : this._pickPartyTarget();
      if (tgt) {
        // 連撃 (multistrike): 一手で続けざまに打つ (倒れたら次の標的へ)。敵の能力・味方のLR装飾品の双方で発動
        const strikes = (actor.multistrike > 1) ? Math.min(4, actor.multistrike) : 1;
        if (strikes > 1) this.log(`${actor.name}の${strikes}連撃！`, "dmg");
        const chargeMul = actor.side === "party" ? this._takeCharge(actor) : 1; // 溜め: 次の一手が重くなる
        for (let s = 0; s < strikes; s++) {
          const t2 = tgt.alive ? tgt : (actor.side === "party" ? this._randAlive(this.attackableEnemies(actor)) : this._pickPartyTarget());
          if (!t2) break;
          const h = this._physical(actor, t2, { basic: true, chargeMul });
          res.hits.push(h);
          if (actor.side === "party") this._afterBasic(actor, t2, h, res);
        }
        // 二刀流: 右手の後に左手の武器で一撃 (左手の射程で届く敵へ。連撃とは別に1回)
        if (actor.side === "party" && actor.dualRate > 0 && actor.alive && !this.result) {
          const reach = this.attackableEnemies(actor, true);
          const t3 = tgt.alive && reach.includes(tgt) ? tgt : this._randAlive(reach);
          if (t3) {
            const h = this._physical(actor, t3, { basic: true, offhand: true });
            res.hits.push(h);
            this._afterBasic(actor, t3, h, res);
          }
        }
      }
      return res;
    }
    if (action === "spell") {
      this._cast(actor, cmd, res);
      return res;
    }
    if (action === "item") {
      this._useItem(actor, cmd, res);
      return res;
    }
    if (action === "mimic") {
      this._mimicCast(actor, cmd, res);
      return res;
    }
    if (action === "windup") {
      // 予兆: 力を溜める (この手番は攻撃しない)
      const kind = this._chargeKind(actor);
      actor._chargeN = (actor._chargeN || 0) + 1;
      actor.effects = actor.effects || [];
      actor.effects.push({ stat: "omen", mult: 2, turns: 3, src: "予兆", kind, round: this._roundNo });
      this._recalcBuffs(actor);
      this.log(OMEN_TEXT[kind](actor.name), "dmg");
      res.action = "special"; res.windup = kind;
      res.hits.push({ target: actor, buff: true, mods: {}, note: OMEN_NOTE });
      return res;
    }
    if (action === "charged") {
      // 溜めた大技を放つ
      const om = cmd.omen;
      const i = (actor.effects || []).indexOf(om);
      if (i >= 0) actor.effects.splice(i, 1);
      this._recalcBuffs(actor);
      actor._chargeCd = 2;
      res.charged = om.kind;
      if (om.kind === "breath" || om.kind === "spell") {
        const r = this._execInner({ actor, action: "breath", kind: om.kind, mul: CHARGED.breath });
        r.charged = om.kind;
        return r;
      }
      res.action = "attack";
      if (om.kind === "wide") {
        this.log(`${actor.name}の全体強打！`, "dmg");
        for (const p of this.livingParty()) res.hits.push(this._physical(actor, p, { power: CHARGED.wide, name: "猛威", area: true }));
      } else {
        // 受け止め (2026-10): 敵を引き付けている味方がいれば、渾身の一撃はその者が必ず受ける (主・強敵との戦いでの盾役の役目)
        const guard = this._tauntHolder();
        const t = guard || this._pickPartyTarget();
        if (guard) { this.log(`${guard.name}が渾身の一撃を受け止める`, "sys"); this._proc(guard, "受け止め"); }
        if (t) res.hits.push(this._physical(actor, t, { power: CHARGED.smash, acc: CHARGED.smashAcc, name: "渾身の一撃" }));
      }
      return res;
    }
    if (action === "shake") {
      // 払いのけ: 主・精鋭がまとわりつく弱体をすべて振り払う
      this.log(`${actor.name}は弱体を払いのけようとした`, "dmg");
      this._purgeDown(actor);
      res.action = "special"; res.shake = true;
      res.hits.push({ target: actor, buff: true, mods: {}, note: "払いのけ" });
      return res;
    }
    if (action === "ecleanse") {
      // 敵の回復役: 仲間にかかった弱体を浄める
      res.action = "spell"; res.spellKind = "cure"; res.spellName = "浄めの詠唱";
      const t = (cmd.target && cmd.target.alive) ? cmd.target : this._debuffedAlly();
      if (t && this._purgeDown(t)) {
        this.log(`${actor.name}の浄めの詠唱！ ${t.name}の${this._downWeight(t) ? "弱体は一部または全て残った" : "弱体解除"}`, "dmg");
        res.hits.push({ target: t, buff: true, mods: {}, note: "浄め" });
      } else this.log(`${actor.name}：解除対象なし`, "sys");
      return res;
    }
    if (action === "eheal") {
      // 敵の回復役: 傷ついた仲間を癒す (演出は味方の回復呪文と同系統で流用)
      res.action = "spell"; res.spellKind = "heal"; res.spellName = "癒しの詠唱";
      const t = (cmd.target && cmd.target.alive) ? cmd.target : this._woundedAlly(actor);
      if (t) {
        const heal = Math.max(1, variance(Math.round(t.maxhp * 0.22)));
        const before = t.hp;
        t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + heal));
        this.log(`${actor.name}の妖しい詠唱！ ${t.name}のHP+${heal}`, "dmg");
        res.hits.push({ target: t, heal });
        this._enemyHealed(t, before);
      }
      return res;
    }
    if (action === "summon") {
      // 敵の呼び手: 仲間を1体呼び寄せる (最大6体)
      res.action = "spell"; res.spellKind = "summon"; res.spellName = "召喚";
      const key = actor.summonKey;
      if (!actor._challengeGiant && key && MONSTERS[key] && this.livingEnemies().length < MAX_ENEMIES) {
        const e = makeEnemy(key, actor._scale || 1);
        applyChallengeEnemies([e], { challengeRule: this.challengeRule });
        // 戦果の写し (game.js startBattle が推奨Lv の基準に合わせた比) を引き継ぐ
        if (actor._rk) { e._rk = actor._rk; e.soul = Math.max(1, Math.round(e.soul * actor._rk[0])); e.gold = Math.max(1, Math.round(e.gold * actor._rk[1])); }
        if (actor._agiMul) { e._agiMul = actor._agiMul; e.agi = Math.max(1, Math.round(e.agi * actor._agiMul)); }
        scaleFoeStats(e, this.statWall);
        scaleStrongFoeHp(e, this.strongHpWall || 1);
        scaleFoeAgi(e, this.fleeK, this.agiWall || 1); // 呼ばれた手下の AGI も味方の規模へ
        // 属性の暴走 (異変): 呼ばれた仲間の属性もでたらめに
        if (actor._elemRandom) { const els = Object.keys(ELEMENTS).filter((k) => k !== "none"); e._elemRandom = true; e.element = els[Math.floor(random() * els.length)]; e.affinity = elementAffinity(e.element); }
        // ロード復元後の uid 重複を防ぐ (uid カウンタはリロードでリセットされる)
        e.uid = [...this.party, ...this.enemies].reduce((mx, x) => Math.max(mx, x.uid || 0), 0) + 1;
        e.buffs = { atk: 1, vit: 1, agi: 1 }; e.effects = [];
        // 同種が既にいるなら A/B/C… の続きで呼び分ける
        const same = this.enemies.filter((x) => x.key === key).length;
        if (same) e.name += String.fromCharCode(65 + same);
        this.enemies.push(e);
        this.log(`${actor.name}は${e.mon.name}${_enemyLvTag(e)}を召喚`, "dmg");
        res.summoned = e;
      } else {
        this.log(`${actor.name}：召喚失敗`, "sys");
      }
      return res;
    }
    if (action === "breath") {
      // ブレス / 全体呪文 (kind "spell"): 味方全員への属性ダメージ (回避不可)。
      //  ブレスは VIT で微減し、装備のブレス耐性 (breathRes) と守りの技 (wardB) で軽減する。
      //  全体呪文は INT・PIE (精神) で微減し、呪文避けの技 (wardS) で軽減する。どちらも大結界・魔障壁で半減できる
      const spell = cmd.kind === "spell";
      const what = spell ? "呪文" : "ブレス";
      this.log(`${actor.name}の${spell ? (ELEM_SPELL[actor.element] || "全体呪文") : "ブレス"}！${cmd.mul > 1 ? "（溜め）" : ""}`, "dmg");
      res.breath = true;
      res.espell = spell;
      // ブレスは吐き手の残りHPの割合で弱まる (HP100% = そのまま / 30% = 30%。ユーザーの指示、2026-10: 弱っても全力のままだと強すぎた)。
      // 全体呪文は対象外
      const hpK = spell ? 1 : breathHpK(actor);
      // 大結界: 自動で隊の全員の被ダメージを半減する (Lv1=1戦闘1回 / Lv2=2回)
      let bigB = false;
      const bigBMax = Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, "bigBarrier")));
      if ((this._bigBarrierUsed || 0) < bigBMax) {
        this._bigBarrierUsed = (this._bigBarrierUsed || 0) + 1;
        bigB = true;
        this.log("大結界！ 隊の被ダメージ半減", "heal");
        this._proc(this._bestHolder("bigBarrier"), "大結界");
      }
      for (const t of this.livingParty()) {
        if (spell && (t.magResist || 0) >= 100) {
          this.log(`${t.name}：魔法無効`, "sys");
          res.hits.push({ target: t, dmg: 0, immune: true, died: false });
          continue;
        }
        const em = this._elementMul(actor, t, actor.element || "none");
        const guard = spell ? ((t.int || 0) + (t.pie || 0)) * 0.12 : this._evit(t, actor) * 0.25;
        let dmg = Math.max(1, Math.round((variance(this._eatk(actor, t) * (spell ? 0.75 : 0.85) * (cmd.mul || 1)) - guard) * hpK));
        const special = this._elementSpecial(actor, t, actor.element, dmg);
        if (special) { res.hits.push(special); continue; }
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        if (t._defending) dmg = Math.ceil(dmg * 0.5);
        { const pt = this._perkSum(t, "take", { tgt: actor, el: actor.element || "none", on: [spell ? "spell" : "breath"] }); if (pt) dmg = Math.max(1, Math.floor(dmg * Math.max(0.2, 1 - pt))); } // 固有パッシブ (take)
        // 守りの技 (風避け・呪文避け): 効果の倍率で割る (重ねても 1/3 まで)
        const ward = this._bm(t, spell ? "wardS" : "wardB");
        if (ward > 1) dmg = Math.max(1, Math.round(dmg / ward));
        // 装備のブレス耐性 (竜鱗の盾など。合計の上限 50%)
        { const br = spell ? 0 : partyBreathRes(t); if (br) dmg = Math.max(1, Math.round(dmg * (1 - br))); }
        if (bigB) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        else if (t._barrierLeft > 0) {
          // 魔障壁: 個人のブレス・呪文被ダメ半減 (残回数制)。魔力反射は防いだ分を返す
          t._barrierLeft--;
          const cut = dmg - Math.ceil(dmg * 0.5);
          dmg = Math.ceil(dmg * 0.5);
          this.log(`${t.name}の魔障壁：${what}半減（残り${t._barrierLeft}回）`, "heal");
          this._proc(t, "魔障壁");
          // 魔力反射 (魔闘士): 魔障壁で防いだ時、INT × 8 の魔法の一撃で返す
          if (cut > 0 && pv(t, "reflect")) this._retaliate(t, actor, "int", REFLECT_K, "魔力反射", true);
        }
        if (this._onceGuard(t, "spellGuard", "_sgUsed", "封の結界")) { res.hits.push({ target: t, dmg: 0, immune: true, died: false }); continue; }
        // 呪文返し (魔盗賊のランク): 敵の呪文を受けるたび必ず INT × 0.4/0.6/0.8/1.0 の魔法の一撃で返し、10/15/20/30% で打ち消す
        if (spell && actor.alive && this._rk(t, "arcthiefKaeshi", KAESHI_K)) {
          this._retaliate(t, actor, "int", this._rk(t, "arcthiefKaeshi", KAESHI_K), "呪文返し", true);
          if (random() < this._rk(t, "arcthiefKaeshi", KAESHI_RATE)) {
            this.log(`${t.name}は呪文を打ち消した`, "heal");
            res.hits.push({ target: t, dmg: 0, immune: true, died: false });
            continue;
          }
        }
        // 護法の結界 (護法師のランク): 隊の全員が受ける呪文・ブレスのダメージ -5/8/12/20% (一番高いLv)
        { const wk = this._rkParty("wardenKekkai", [0.05, 0.08, 0.12, 0.20]); if (wk) dmg = Math.max(1, Math.floor(dmg * (1 - wk))); }
        dmg = Math.max(1, Math.floor(dmg * (1 - this._shintou(t)))); // 心頭滅却: ブレス・呪文
        const mr = this._resistCut(t, dmg, "magResist");
        if (t.guard) dmg = Math.ceil(mr.dmg * (1 - t.guard)); else dmg = mr.dmg;
        dmg = Math.max(1, Math.round(dmg * this._passiveCorrection(t, actor, actor.element, spell ? "magic" : "breath")));
        dmg = this._gearGuard(t, dmg, "magic"); // 逆境の (極)
        dmg = this._wallCut(t, dmg);
        dmg = this._gearSplit(t, dmg); // 痛み分けの (極)
        { // 肩代わりの (極): 倒れるほどの一撃を持ち主が代わりに受ける
          const cv = this._gearCover(t, dmg);
          if (cv) {
            cv.hp = this._reportHp(actor, cv, cv.hp - (dmg));
            this.log(`${cv.name}に${dmg}ダメージ${hitNote(elemNote(em, actor.element), mr.tag)}`, "dmg");
            this._wake(cv);
            const cd = this._die(cv);
            if (!cd) this._postDamage(cv);
            res.hits.push({ target: cv, dmg, died: cd });
            continue;
          }
        }
        t.hp = this._reportHp(actor, t, t.hp - (dmg));
        this.log(`${t.name}に${dmg}ダメージ${hitNote(elemNote(em, actor.element), mr.tag)}`, "dmg");
        this._wake(t);
        const rp = reflectPow(t); // 反射の陣: 倒れても受けた呪文・ブレスは返す
        const died = this._die(t);
        if (!died) { this._postDamage(t); this._perkHurt(t, actor, dmg, spell ? "spell" : "breath"); }
        if (rp > 0) this._retaliate(t, actor, rp, 1, "反射の陣", true);
        res.hits.push({ target: t, dmg, died });
      }
      return res;
    }
    if (action === "special") {
      // 敵の特殊行動。状態異常の付与や窃盗。控除系 (steal/drain) の実処理は game.js 側
      const t = (cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.party);
      if (!t) return res;
      const k = cmd.kind;
      if (k === "poison" || k === "paralyze") {
        const h = this._physical(actor, t, { power: 0.9, name: k === "poison" ? "毒の牙" : "麻痺の爪" });
        res.hits.push(h);
        const tt = h.target; // かばうで対象が替わることがある
        if (!h.miss && !h.immune && tt.alive && !tt.ailment && random() < this._rate(actor, tt, 0.4, k)) {
          tt.ailment = k;
          if (k === "paralyze") this._holdAil(tt, "para");
          h.ailment = k;
          this.log(`${tt.name}に${k === "poison" ? "毒" : "麻痺"}`, "dmg");
        }
      } else if (k === "stone") {
        this.log(`${actor.name}の石化の凝視！`, "dmg");
        if (t.ailment || random() >= this._rate(actor, t, 0.32, "stone")) { this.log(`${t.name}は石化を防いだ`, "sys"); res.hits.push({ target: t, miss: true }); }
        else { t.ailment = "stone"; this.log(`${t.name}に石化`, "dmg"); res.hits.push({ target: t, stoned: true }); }
      } else if (k === "sleep") {
        // 眠りの息 (鱗粉・子守唄など): 隊の全員を眠りに誘う。眠った者は手番を失い、傷を受けるまで覚めにくい
        this.log(`${actor.name}の眠りの息！`, "dmg");
        for (const p of this.livingParty()) {
          if (p.asleep || p.ailment === "stone") continue;
          if (random() < this._rate(actor, p, 0.25, "sleep")) {
            p.asleep = true; this._holdAil(p, "sleep");
            this.log(`${p.name}に眠り`, "dmg");
            res.hits.push({ target: p, status: "眠り!" });
          } else res.hits.push({ target: p, miss: true, resisted: true });
        }
      } else if (k === "charm" || k === "confuse") {
        // 魅惑の眼差し / 惑わしの声: 1人の心を奪う。魅了 = 仲間を襲う / 混乱 = 誰かれ構わず殴る
        const charm = k === "charm";
        this.log(charm ? `${actor.name}の魅惑の眼差し！` : `${actor.name}の惑わしの声！`, "dmg");
        if (t.mind || t.ailment === "stone" || random() >= this._rate(actor, t, charm ? 0.4 : 0.45, k)) {
          this.log(`${t.name}は${charm ? "魅了を防いだ" : "混乱を防いだ"}`, "sys");
          res.hits.push({ target: t, miss: true, resisted: true });
        } else {
          t.mind = k; this._holdAil(t, "mind");
          this.log(charm ? `${t.name}に魅了（仲間を攻撃）` : `${t.name}に混乱`, "dmg");
          res.hits.push({ target: t, status: charm ? "魅了!" : "混乱!" });
        }
      } else if (k === "critical") {
        const h = this._physical(actor, t, { power: 1.1, name: "死神の一撃" });
        res.hits.push(h);
        if (!h.miss && t.alive && random() < this._rate(actor, t, 0.15, "death")) {
          this.log(`${actor.name}の即死攻撃！ ${t.name}は即死`, "dmg");
          t.hp = this._reportHp(actor, t, 0);
          h.fatal = true;
          h.died = this._die(t) || h.died; // 不屈持ちはHP1で耐える
        }
      } else if (k === "goldSteal" || k === "soulSteal") {
        if (random() < 0.35) { this.log(`${actor.name}の盗みを${t.name}が回避`, "sys"); res.hits.push({ target: t, miss: true }); }
        else {
          const amt = k === "goldSteal" ? 5 + Math.round((actor.gold || 10) * 0.5) : 3 + Math.round((actor.soul || 5) * 0.6);
          res.hits.push({ target: t, steal: k, stealAmt: amt });
        }
      } else if (k === "drain") {
        const h = this._physical(actor, t, { power: 0.8, name: "魂喰らい" });
        res.hits.push(h);
        if (!h.miss && t.alive && random() < 0.35) h.drain = true; // 魂レベルの控除は game.js 側
      } else if (k === "warcry") {
        // 鼓舞: 自分を含む味方 (敵側) 全体の STR を数ターン上げる
        this.log(`${actor.name}の雄叫び！`, "dmg");
        for (const e of this.livingEnemies()) this._applyMod(e, "atk", stageMul(1), ENEMY_BUFF_DUR, "雄叫び");
        res.warcry = true;
      } else if (k === "weaken") {
        // 弱体: 近接 (×0.9) + 命中したプレイヤーの STR を数ターン下げる
        const h = this._physical(actor, t, { power: 0.9, name: "呪いの一撃" });
        res.hits.push(h);
        const tt = h.target; // かばうで対象が替わることがある
        if (!h.miss && !h.immune && tt.alive) {
          if (this._applyMod(tt, "atk", stageMul(-1), ENEMY_BUFF_DUR, "弱体") && tt.side !== "enemy") this.log(`${tt.name}のSTR-1段`, "dmg");
          else this.log(`${tt.name}の攻撃低下限界`, "sys");
        }
      } else if (k === "sunder") {
        // 守り崩し: 打撃 (×0.9) + 命中した相手の VIT を1段下げる
        const h = this._physical(actor, t, { power: 0.9, name: "鎧砕き" });
        res.hits.push(h);
        const tt = h.target;
        if (!h.miss && !h.immune && tt.alive && this._applyMod(tt, "vit", stageMul(-1), ENEMY_BUFF_DUR, "鎧砕き") && tt.side !== "enemy") this.log(`${tt.name}のVIT-1段`, "dmg");
      } else if (k === "dispel") {
        // 打ち消し: 隊にかかった強化・構えをすべて剥ぎ取る
        this.log(`${actor.name}の禍言！`, "dmg");
        let any = false;
        for (const p of this.livingParty()) {
          if (bkProc(p,"steadMind")) { if ((p.effects || []).some((e) => e.mult > 1)) this.log(`${p.name}の不動心：強化は剥がれない`, "heal"); continue; } // 極「不動心の」
          if (!this._stripUp(p)) continue;
          any = true;
          res.hits.push({ target: p, debuff: true, mods: {}, note: "加護が剥がれた" });
        }
        if (this._dispelLockSeq !== this._actSeq) this.log(any ? "隊の強化解除" : "解除する強化なし", any ? "dmg" : "sys");
      }
      return res;
    }
    return res;
  }

  // バフ込みの実効STR・VIT
  // 攻撃力: 武器が参照する能力だけを、強化・弱体込みで係数に掛ける。素手・敵はSTR。
  _eatk(a, opponent = null) {
    const atk = a.atk * this._bm(a, "atk", opponent);
    const power = a.wScale ? scaleBonus(a.wScale, (k) => (a[k] || 0) * this._bm(a, k, opponent)) : atk;
    return Math.max(1, Math.round(power));
  }
  // 二刀流の左手の攻撃力 (左手の武器の参照能力 × 係数 × 二刀流の割合。強化・弱体込み)。二刀流でなければ 0
  _offAtk(a) {
    if (!(a.dualRate > 0)) return 0;
    const raw = a.oScale ? scaleBonus(a.oScale, (k) => (a[k] || 0) * this._bm(a, k)) : a.atk * this._bm(a, "atk");
    return Math.max(1, Math.round(raw * a.dualRate));
  }
  // 物理の攻撃力: 左手の一撃は左手の攻撃力、物理技は右手 + 左手の DUAL_SKILL_SHARE (半分)、それ以外は右手
  _physAtk(a, opt = {}, opponent = null) {
    if (a.side !== "party" || !(a.dualRate > 0)) return this._eatk(a, opponent);
    if (opt.offhand) return this._offAtk(a);
    if (opt.skill) return this._eatk(a, opponent) + Math.round(this._offAtk(a) * DUAL_SKILL_SHARE);
    return this._eatk(a, opponent);
  }
  _evit(t, opponent = null) { return Math.round((t.vit || 0) * this._bm(t, "vit", opponent)); }

  // 低HP系パッシブ (闘魂/荒行の果て) の与ダメージ倍率
  _lowHpMul(a) {
    if (!a.maxhp || a.hp > a.maxhp * 0.3) return 1;
    let m = 1;
    const fs = pv(a, "fightSpirit");
    if (fs) m *= [1, 1.25, 1.40, 1.55, 1.70][Math.min(fs, 4)];
    if (pv(a, "asceticism")) m *= 1.3;
    return m;
  }

  // かばう: 瀕死の味方への攻撃を肩代わりする味方を探す
  _coverFor(tgt) {
    if (tgt.side !== "party" || !tgt.maxhp || tgt.hp > tgt.maxhp * 0.25) return null;
    let best = null;
    for (const p of this.party) {
      if (!p.alive || p === tgt || !(p._coverLeft > 0)) continue;
      if (this._incap(p)) continue;
      if (!best || pv(p, "cover") > pv(best, "cover")) best = p;
    }
    return best;
  }

  // 異常耐性 (resistAilment / 聖域) + 装備の耐性 (ailRes[kind]): 毒・麻痺・眠り・魅了・混乱の付与率カット (味方の上限95%)
  _ailRes(t, kind) {
    if (t.side !== "party") return Math.min(.95, ((t.resists || t.mon?.resists || {})[kind] || 0) / 100) + (((t.resists || t.mon?.resists || {})[kind] || 0) >= 100 ? .05 : 0);
    if (t.ailmentImmune) return t.side === "party" ? .95 : 1; // 解呪の宝珠: 味方の最終上限95%
    let lv = pv(t, "resistAilment");
    if (lv < 1 && this.party.some((p) => p.alive && pv(p, "sanctuary"))) lv = 1;
    const pas = lv >= 2 ? 0.60 : lv === 1 ? 0.30 : 0;
    const eq = kind && t.resists ? (t.resists[kind] || 0) / 100 : (kind && t.ailRes && t.ailRes[kind]) || 0;
    return Math.min(.95, pas + eq + this._zokusei(t) + ((kind && _partyAilBonus[kind]) || 0));
  }
  // 俗世拒絶 (隠修士): 敵から受ける状態異常 (石化・即死も) を -10/20/30%
  _zokusei(t) { return [0, 0.10, 0.20, 0.30][Math.min(3, pv(t, "hermitZokusei"))] || 0; }
  // 石化・即死への耐性 (異常耐性Lv2 + 装備の石化耐性)
  _hardRes(t, kind = "death") {
    if (t.ailmentImmune) return t.side === "party" ? .95 : 1; // 解呪の宝珠: 石化・即死も味方の最終上限95%
    if (t.side !== "party") return Math.min(.95, ((t.resists || t.mon?.resists || {})[kind] || 0) / 100) + (((t.resists || t.mon?.resists || {})[kind] || 0) >= 100 ? .05 : 0);
    const pas = pv(t, "resistAilment") >= 2 ? 0.30 : 0;
    const eq = kind && t.resists ? (t.resists[kind] || 0) / 100 : (kind && t.ailRes && t.ailRes[kind]) || 0;
    return Math.min(.95, pas + eq + this._zokusei(t));
  }

  // 被ダメージ後の自動処理: 聖典の加護 (HP30%以下で1戦闘1回の自己回復)
  _postDamage(t) {
    // 義の報い (義賊のランク): HP50%以下になった味方を、1戦闘1回、最大HPの 20/40/60/80% 回復 (一番高いLv)
    if (t.side === "party" && t.alive && !this._giUsed && t.maxhp && t.hp <= t.maxhp * 0.5) {
      const gi = this._rkParty("brigandGi", [0.20, 0.40, 0.60, 0.80]);
      if (gi) {
        this._giUsed = true;
        const h = Math.max(1, Math.round(t.maxhp * gi));
        t.hp = this._reportHp(this._bestHolder("brigandGi"), t, Math.min(t.maxhp, t.hp + h));
        this.log(`義の報い！ ${t.name}のHP+${h}`, "heal");
        this._proc(t, "義の報い");
      }
    }
    if (t.side !== "party" || !t.alive || t._scriptureUsed) return;
    if (!pv(t, "scripture") || t.hp > t.maxhp * 0.3) return;
    t._scriptureUsed = true;
    const heal = Math.max(1, Math.round((t.pie || 1) * 1.2));
    t.hp = this._reportHp(t, t, Math.min(t.maxhp, t.hp + heal));
    this.log(`聖典の加護！ ${t.name}のHP+${heal}`, "heal");
    this._proc(t, "聖典の加護");
  }

  // やり返し (2026-10 ユーザーの指示「自分の攻撃力でやり返すに統一」): 受けたダメージの大きさに依らず、
  // 持ち主の能力 × 係数のダメージを相手へ返す。物理は物理の抵抗値・魔法 (magic) は魔法の抵抗値で減り、
  // 守りの差し引き・隊列の補正は無い。金属の魔物には物理1・魔法無効 (_resistCut)。
  _retStat(t, stat) {
    if (typeof stat === "number") return stat; // 反射の陣: 唱えた者の魔力 × 係数を直に
    if (stat === "atk") return this._eatk(t);
    if (stat === "vit") return this._evit(t);
    const v = (k) => (t[k] || 0) * this._bm(t, k);
    return stat === "mag" ? Math.max(v("int"), v("pie")) : v(stat);
  }
  _retaliate(t, attacker, stat, k, label, magic) {
    if (!t || !attacker || !attacker.alive || attacker.side !== "enemy" || !(k > 0)) return 0;
    const raw = variance(Math.max(1, this._retStat(t, stat) * k));
    const r = this._resistCut(attacker, raw, magic ? "magResist" : "physResist");
    this._proc(t, label);
    if (r.immune) { this.log(`${t.name}の${label}！ ${attacker.name}：${r.tag}`, "hit"); return 0; }
    const dmg = this._wallCut(attacker, r.dmg);
    const before = attacker.hp;
    attacker.hp = this._reportHp(t, attacker, attacker.hp - (dmg));
    this.log(`${t.name}の${label}！ ${attacker.name}に${dmg}ダメージ${hitNote(r.tag)}`, "hit");
    const died = this._die(attacker, t);
    if (died && !magic && before > 0 && dmg > before) this._overflow(t, dmg - before);
    return dmg;
  }

  // 反撃 (counter/神罰の鉄槌): 物理を受けた味方が生きていれば反撃判定
  _tryCounter(defender, attacker) {
    if (defender.side !== "party" || !defender.alive || !attacker || !attacker.alive) return;
    if (this._incap(defender)) return;
    let cLv = pv(defender, "counter");
    // 反撃の構え (技): 必ず 攻撃力 × 技ごとの係数 (ctrMul) で反撃。戦士の反撃 (パッシブ) は確率で低めの係数
    const stanceK = stanceCtrK(defender);
    const stance = stanceK > 0;
    if (stance || cLv) {
      this._proc(defender, "反撃");
      const mul = Math.max(stance ? stanceK : 0, COUNTER_K[cLv] || 0);
      // 反撃も物理なので隊列補正を受ける
      let dmg = Math.max(1, Math.round((variance(Math.round(this._eatk(defender) * mul)) - Math.floor(this._evit(attacker, defender) * 0.5)) * this._rowMul(defender, attacker)));
      let crit = false;
      if (cLv >= 3 && random() < Math.min(.8, Math.max(0, 0.06 + (defender.critBonus || 0)))) { crit = true; dmg = Math.floor(dmg * 1.85 * this._physicalCritMul(defender, { tgt: attacker, on: ["phys"] })); }
      // 反撃の会心も通常の物理と同じ耐性軽減を使う。
      const pr = this._resistCut(attacker, dmg, "physResist", this._physPierce(defender));
      if (pr.immune) this.log(`${defender.name}の反撃！ ${attacker.name}：物理無効`, "hit");
      else {
        dmg = this._wallCut(attacker, pr.dmg);
        const before = attacker.hp;
        attacker.hp = this._reportHp(defender, attacker, attacker.hp - (dmg));
        this.log(`${defender.name}の反撃！ ${attacker.name}に${dmg}ダメージ${hitNote(crit ? "会心" : "", pr.tag)}`, "hit");
        if (this._die(attacker, defender)) {
          if (before > 0 && dmg > before) this._overflow(defender, dmg - before);
          return;
        }
      }
    }
    // 神罰の鉄槌 (聖騎士): 物理を受けるたび必ず、PIE × 3 の聖なる一撃 (反撃とは別に)
    if (attacker.alive && pv(defender, "divineCounter")) {
      this._proc(defender, "神罰の鉄槌");
      // 神罰は聖なる術の一撃: 魔法耐性を受ける
      const mr = this._resistCut(attacker, Math.max(1, variance(Math.round((defender.pie || 1) * DIVINE_COUNTER_K))), "magResist");
      if (mr.immune) { this.log(`${defender.name}の神罰の鉄槌！ ${attacker.name}：魔法無効`, "hit"); return; }
      const dmg = this._wallCut(attacker, mr.dmg);
      attacker.hp = this._reportHp(defender, attacker, attacker.hp - (dmg));
      this.log(`${defender.name}の神罰の鉄槌！ ${attacker.name}に${dmg}ダメージ${hitNote(mr.tag)}`, "hit");
      this._die(attacker, defender);
    }
  }

  // 通常攻撃後の追撃 (味方のみ): 残心 / 連撃 / 二刀の理
  _afterBasic(actor, tgt, h, res) {
    const xm = gm(actor);
    // 極「剥がしの」: 当たった通常攻撃が、敵の強化を1つ消す (溜め・予兆は消さない)
    if (h && !h.miss && !h.immune && tgt.alive && tgt.side === "enemy" && bkProc(actor,"peel")) {
      const ups = (tgt.effects || []).filter((e) => e.mult > 1 && e.stat !== "omen" && e.stat !== "charge");
      const ef = ups[ups.length - 1];
      if (ef) {
        tgt.effects.splice(tgt.effects.indexOf(ef), 1);
        this._recalcBuffs(tgt);
        this.log(`${actor.name}の剥がし：${tgt.name}の${ENEMY_STAT_LABEL[ef.stat] || ef.src || "強化"}の強化を消した`, "hit");
        this._proc(actor, "剥がし");
      }
    }
    // 極「連なる刃の」: 通常攻撃で敵を倒すと、別の敵へもう一撃 (1ターンに1度)
    if (h && h.died && actor.alive && actor._chainRound !== this._roundNo && bkProc(actor,"chain")) {
      const t2 = this._randAlive(this.attackableEnemies(actor).filter((e) => e !== tgt));
      if (t2) {
        actor._chainRound = this._roundNo;
        this.log(`${actor.name}の連なる刃！`, "hit");
        this._proc(actor, "連なる刃");
        res.hits.push(this._physical(actor, t2, { name: "連なる刃" }));
      }
    }
    // 崩拳 (魔闘士のレベル習得): 通常攻撃が 10/15/20/30% で敵を怯ませる (主・金属の魔物には効かない)
    if (h && !h.miss && !h.immune && tgt.alive) this._inflict(actor, tgt, { name: "崩拳", flinchChance: this._rk(actor, "bmHouken", [.10, .15, .20, .30]) });
    // 魔力付与 (魔騎士): 当たった通常攻撃に INT×8/12/16 の固定ダメージを上乗せ (金属の魔物には効かない)
    const dk = pv(actor, "dkEnchant");
    let extra = 0;
    if (dk && h && !h.miss && !h.immune && tgt.alive && !isMetal(tgt)) {
      extra = Math.max(1, Math.round((actor.int || 0) * ([0, 8, 12, 16][Math.min(3, dk)] || 0)));
      tgt.hp = this._reportHp(actor, tgt, tgt.hp - (extra));
      this.log(`魔力付与！ ${tgt.name}に${extra}ダメージ`, "hit");
      this._proc(actor, "魔力付与");
      this._wake(tgt);
      const died = this._die(tgt);
      res.hits.push({ target: tgt, dmg: extra, died });
      if (died) h = { ...h, died: true };
    }
    // 魔力循環 (魔闘士): 通常攻撃で与えたダメージの 1/2/3/4% だけ MP を回復 (1回で最大MPの 1/2/3/4% まで)
    const mc = pv(actor, "bmManaCycle");
    const dealt = ((h && !h.miss && h.dmg) || 0) + extra;
    if (mc && dealt > 0 && actor.maxmp && actor.mp < actor.maxmp) {
      const lv = Math.min(4, mc);
      const gain = Math.max(1, Math.min(Math.ceil(actor.maxmp * [0, 0.01, 0.02, 0.03, 0.04][lv]), Math.round(dealt * ([0, 0.01, 0.02, 0.03, 0.04][lv] || 0))));
      actor.mp = Math.min(actor.maxmp, actor.mp + gain);
      this.log(`${actor.name}の魔力循環：MP+${gain}`, "heal");
      this._proc(actor, "魔力循環");
    }
    // 残心: 敵を倒した時25%で追加攻撃 (1ターン1回)
    if (h.died && pv(actor, "zanshin") && this._zanshinRound !== this._roundNo && random() < 0.25) {
      const t2 = this._randAlive(this.attackableEnemies(actor)); // 残心の追撃も射程内のみ
      if (t2) {
        this._zanshinRound = this._roundNo;
        this.log(`${actor.name}の残心！`, "hit");
        this._proc(actor, "残心");
        res.hits.push(this._physical(actor, t2, { name: "残心" }));
      }
      return;
    }
    if (h.miss || !tgt.alive) return;
    // 連撃: 10/20%で2撃目 (威力60%)
    const ex = pv(actor, "extraHit");
    if (ex && random() < [0, 0.10, 0.20, 0.30, 0.40][Math.min(ex, 4)]) {
      this.log(`${actor.name}の連撃！`, "hit");
      this._proc(actor, "連撃");
      res.hits.push(this._physical(actor, tgt, { power: 0.6, name: "連撃" }));
      if (!tgt.alive) return;
    }
    // 二刀の理: 30%でINT×6の追撃呪文
    if (pv(actor, "twinArts") && random() < 0.30) {
      this._proc(actor, "二刀の理");
      const mr = this._resistCut(tgt, Math.max(1, Math.round(variance((actor.int || 1) * 6) - this._evit(tgt, actor) * 0.2)), "magResist");
      if (mr.immune) {
        this.log(`二刀の理！ ${tgt.name}：魔法無効`, "hit");
        res.hits.push({ target: tgt, dmg: 0, immune: true, died: false });
        return;
      }
      const dmg = mr.dmg;
      tgt.hp = this._reportHp(actor, tgt, tgt.hp - (dmg));
      this.log(`二刀の理！ ${tgt.name}に${dmg}ダメージ${hitNote(mr.tag)}`, "hit");
      res.hits.push({ target: tgt, dmg, died: this._die(tgt) });
    }
  }

  // 技と斬鉄の物理貫通は、残った軽減をそれぞれの割合だけ抜く (50% + 50% = 75%)。
  _physPierce(actor, opt = {}) {
    const skill = Math.min(1, Math.max(0, opt.pierce || 0));
    const rank = actor.side === "party" ? this._rk(actor, "samuraiZantetsu", [0.10, 0.20, 0.30, 0.40]) : 0;
    return 1 - (1 - skill) * (1 - rank);
  }

  // 物理・魔法抵抗値 (0〜100、値と同じ割合を軽減)。key = "physResist" | "magResist"
  // 敵味方が持つ。抵抗値100 (無効) なら dmg は 0 になり immune が立つ
  _resistCut(tgt, dmg, key, ignore = 0) {
    // 金属の体: 物理 (反撃など) は1ダメージ、魔法 (呪文・神罰・二刀の理など) は無効
    if (isMetal(tgt)) return key === "magResist" ? { dmg: 0, tag: METAL_TAG.mag, immune: true } : { dmg: Math.min(dmg, 1), tag: METAL_TAG.phys, immune: false };
    const r = modeResistance(tgt, key);
    const label = key === "physResist" ? "物理" : "魔法";
    if (!r) return { dmg, tag: "", immune: false };
    const rate = resistRate(r);
    if (rate >= 1) return { dmg: 0, tag: `${label}無効`, immune: true };
    const cut = rate * (1 - Math.min(1, Math.max(0, ignore)));
    return { dmg: Math.max(1, Math.round(dmg * (1 - cut))), tag: cut > 0 ? `${label}軽減${fmtMul(cut * 100)}%` : "", immune: false };
  }

  // ===== 装備の極 (受ける側) =====
  // 逆境の (HP50%以下 −20% / 25%以下 −40%) と金城の (物理の一撃は最大HPの50%まで)。装備の軽減の上限 (GEAR_FX_CAP) の外
  _gearGuard(t, dmg, kind) {
    const m = gm(t);
    if (m === NOMISC || !(dmg > 0)) return dmg;
    if ((m.adversity || m.bk_adversity) && t.maxhp) {
      const f = t.hp / t.maxhp;
      if (f <= 0.25) dmg = Math.max(1, Math.floor(dmg * (1-Math.max(m.adversity ? .4 : 0,(m.bk_adversity||0)*2)))); else if (f <= 0.5) dmg = Math.max(1, Math.floor(dmg * (1-Math.max(m.adversity ? .2 : 0,m.bk_adversity||0))));
    }
    if ((m.fortress || m.bk_fortress) && kind === "phys" && t.maxhp) {
      const cap = Math.max(1, Math.ceil(t.maxhp * Math.min(m.fortress||1,m.bk_fortress??1)));
      if (dmg > cap) { dmg = cap; this.log(`${t.name}の金城：最大HPの${Math.round(Math.min(m.fortress||1,m.bk_fortress??1) * 100)}%で止めた`, "heal"); this._proc(t, "金城"); }
    }
    return dmg;
  }
  // 痛み分けの: 受けるダメージの割合を、次とその次のターンの初めへ半分ずつ回す。返り値 = いま受ける分
  _gearSplit(t, dmg) {
    const k = bkValue(t,"split");
    if (!k || !(dmg > 1)) return dmg;
    const later = Math.floor(dmg * Math.min(0.9, k));
    if (later <= 0) return dmg;
    const a = Math.ceil(later / 2);
    const q = t._splitQ || (t._splitQ = []);
    q[0] = (q[0] || 0) + a; q[1] = (q[1] || 0) + (later - a);
    this.log(`${t.name}の痛み分け：${later}ダメージを後に回す`, "sys");
    return dmg - later;
  }
  // 肩代わりの: 倒れるほどの一撃を、持ち主 (本人以外・動ける・この戦闘でまだ使っていない) が代わりに受ける。残りHPの多い者から。
  // 受けるダメージは減らない (持ち主が倒れることもある)
  _gearCover(t, dmg) {
    if (!t || t.side !== "party" || dmg < t.hp) return null;
    const c = this.party.filter((p) => p !== t && p.alive && !p._coverUsed && !this._incap(p) && bkProc(p,"cover")).sort((a, b) => b.hp - a.hp)[0];
    if (!c) return null;
    c._coverUsed = true;
    this.log(`${c.name}が${t.name}への一撃を肩代わりした`, "heal");
    this._proc(c, "肩代わり");
    return c;
  }

  _physical(actor, tgt, opt = {}) {
    // かばう: 瀕死の味方への攻撃は護衛役が肩代わりする
    let coverMul = 1, redirected = false;
    // area = 全体への打撃 (溜めた猛威): 仁王立ち・かばうでは肩代わりできない
    if (actor.side === "enemy" && tgt.side === "party" && !opt.area) {
      // 仁王立ち: 単体攻撃は構えた者がすべて受ける (かばうより先)
      const sh = this._shieldFor(tgt);
      if (sh) {
        this.log(`${sh.name}が${tgt.name}をかばう`, "sys");
        this._proc(sh, "仁王立ち");
        tgt = sh; redirected = true;
      }
    }
    if (actor.side === "enemy" && tgt.side === "party" && !opt.area) {
      const g = this._coverFor(tgt);
      if (g) {
        g._coverLeft--;
        this.log(`${g.name}が${tgt.name}をかばう`, "sys");
        this._proc(g, "かばう");
        const cvLv = pv(g, "cover");
        if (cvLv >= 3) coverMul = 0.6; else if (cvLv >= 2) coverMul = 0.7;
        tgt = g; redirected = true;
      }
    }
    // 敵側の護り手 (guard): 仲間への物理攻撃を肩代わりする (呪文・ブレスは防げない)
    if (actor.side === "party" && tgt.side === "enemy") {
      const g = this._enemyGuardFor(tgt);
      if (g) {
        g._guardLeft--;
        this.log(`${g.name}が${tgt.name}をかばう`, "dmg");
        tgt = g;
      }
    }
    // 必中技と麻痺・眠り中の敵への物理は、見切り・回避・目つぶしを無視
    const sureHit = opt.sureHit || (tgt.side === "enemy" && (tgt.asleep || tgt.ailment === "paralyze"));
    // 極「受け流しの」: 防御した手番から次の自分の手番まで、敵の物理を1回かわす
    const enemyHit = actor.side === "enemy" && tgt.side === "party";
    if (enemyHit && tgt._parryHold && tgt._defending) {
      tgt._parryHold = false;
      this.log(`${tgt.name}は受け流した`, "heal");
      this._proc(tgt, "受け流し");
      if (bkValue(tgt,"afterImage")) tgt._afterImg = true;
      return { target: tgt, miss: true, evaded: true };
    }
    // 命中判定: 素の命中漏れ + 対象の敏捷(AGI)による回避 + 回避持ちの追加回避。
    // 技の命中補正 (acc) は命中率に直接加算する (0.1 = +10%、1 = 必中)。目つぶしは外れる確率を足す
    const missP = this._missP(tgt, actor, opt);
    if (!sureHit && random() < missP) {

      this.log(`${tgt.name}は回避`, "sys");
      if (enemyHit && bkValue(tgt,"afterImage")) tgt._afterImg = true; // 残影の (極): 次の自分の物理が強まる
      return { target: tgt, miss: true, evaded: true };
    }
    const power = opt.power || 1;       // 技の倍率 (通常攻撃は1)
    // 魔法属性の武器: 通常攻撃 (と残心・連撃などの追撃) は威力の計算はそのまま、物理耐性の代わりに魔法耐性を受け、魔法弱点が効く。物理技は物理のまま
    const magHit = actor.side === "party" && !opt.skill && (opt.offhand ? !!actor.oMagic : !!actor.wMagic);
    // 魔力撃 (spellBlade): 通常攻撃にINTを上乗せ
    const sb = pv(actor, "spellBlade");
    const sbAdd = sb ? Math.round((actor.int || 0) * (sb >= 2 ? 1.0 : 0.5) * power) : 0;
    // 魔法剣 (intScale): 技そのものが INT×倍率×係数 を上乗せする (STRとINTの両方で伸びる)
    // 同様に AGI (疾風の技) / VIT (盾の技) / PIE (聖なる技) で伸びる技もある
    const ibAdd = opt.intScale ? Math.round((actor.int || 0) * opt.intScale * power) : 0;
    const stAdd = Math.round(((opt.agiScale || 0) * (actor.agi || 0) + (opt.vitScale || 0) * (actor.vit || 0) + (opt.pieScale || 0) * (actor.pie || 0)) * power);
    // 背水 (desperate): 自分のHPが減るほど威力が上がる (最大2倍)
    const despMul = opt.desperate && actor.maxhp ? 1 + Math.max(0, 1 - actor.hp / actor.maxhp) : 1;
    // VITによる防御は、会心・物理貫通でも通常どおり受ける。
    const defCut = Math.floor(this._evit(tgt, actor) * 0.5);
    // 魔刃一体 (魔法剣士のランク): 物理技に INT の 10/20/30/50% を上乗せ
    const mjAdd = opt.skill && actor.side === "party" ? Math.round((actor.int || 0) * this._bm(actor, "int") * this._rk(actor, "spellbladeMajin", [0.10, 0.20, 0.30, 0.50])) : 0;
    // ダメージ = STR×倍率×低HP補正 − VIT/2 (VITが被ダメージ軽減を担う)
    let dmg = Math.round((variance(Math.round(this._physAtk(actor, opt, tgt) * power * this._lowHpMul(actor))) + sbAdd + ibAdd + stAdd + mjAdd) * despMul * (opt.chargeMul || 1)) - defCut;
    const hitElement = opt.element || (opt.offhand ? actor.offAttackElement : actor.attackElement) || actor.element || "none";
    const elementalSpecial = this._elementSpecial(actor, tgt, hitElement, Math.max(1, dmg));
    if (elementalSpecial) return elementalSpecial;
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    // 城壁の構え: 防御中の持ち主がいれば隊の全員の被ダメ-10%
    if (tgt.side === "party") {
      const bastLv = Math.max(0, ...this.party.filter((p) => p.alive && p._defending).map((p) => pv(p, "bastion")));
      if (bastLv >= 2) dmg = Math.floor(dmg * 0.82); else if (bastLv >= 1) dmg = Math.floor(dmg * 0.9);
      if (actor.side === "enemy") { // 固有パッシブ (take)
        const pt = this._perkSum(tgt, "take", { tgt: actor, el: hitElement, on: ["phys"] });
        if (pt) dmg = Math.floor(dmg * Math.max(0.2, 1 - pt));
      }
    }
    if (coverMul !== 1) dmg = Math.floor(dmg * coverMul);
    // 属性相性: 攻撃属性 (技 > 装備の属性攻撃 > 固有属性) × 対象の固有属性/属性防御
    const aE = opt.element || (opt.offhand ? actor.offAttackElement : actor.attackElement) || actor.element || "none";
    const em = this._elementMul(actor, tgt, aE);
    if (em !== 1) dmg = Math.round(dmg * em);
    // 心頭滅却 (修験者): 属性を帯びた攻撃のダメージ -10/15/20%
    if (tgt.side === "party" && actor.side === "enemy" && aE !== "none") dmg = Math.floor(dmg * (1 - this._shintou(tgt)));
    // とどめ (execute): HP30%以下の敵に倍率 / 種族特効 (prey)
    if (opt.execute && tgt.maxhp && tgt.hp <= tgt.maxhp * 0.3) dmg = Math.round(dmg * opt.execute);
    if (opt.prey && opt.prey.races.includes(enemyRace(tgt))) dmg = Math.round(dmg * opt.prey.mul);
    // 種族特効 (破邪) / 毒の獲物 (毒責め)
    if (pv(actor, "smite") && HOLY_PREY.includes(enemyRace(tgt))) dmg = Math.round(dmg * 1.3);
    if (pv(actor, "gokudoku") && tgt.ailment === "poison") dmg = Math.round(dmg * 1.3);
    // 固有パッシブ (deal/crit) の札: 物理全般 + 通常攻撃 / 物理技
    const pOn = opt.basic ? ["phys", "basic"] : opt.skill ? ["phys", "skill"] : ["phys"];
    const perkFoe = actor.side === "party" && tgt.side === "enemy";
    if (perkFoe) { const pd = this._perkSum(actor, "deal", { tgt, el: aE, on: pOn }); if (pd) dmg = Math.round(dmg * (1 + pd)); }
    // たぎる血潮 (修羅): 同じ敵へ続けて手を下すたび1段 +10/15/20% (最大 +200%)。数えるのは1手に1度 (多段の技も1段)。
    // 別の敵に当たった時点で (同じ手の中でも) 0段に戻る。かわされた撃は数えない (この手前で返っている)
    if (perkFoe) {
      const ch = pv(actor, "asuraChishio");
      if (ch) {
        const step = CHISHIO_STEP[Math.min(3, ch)] || 0;
        const prev = actor._bloodStack || 0;
        if (actor._bloodTgt !== tgt) {
          actor._bloodStack = 0;
          actor._bloodTgt = tgt; actor._bloodAct = this._actSeq;
          if (prev > 0) this.log(`${actor.name}の血潮：0段（標的変更）`, "sys");
        } else if (actor._bloodAct !== this._actSeq) {
          actor._bloodStack = Math.min(chishioMax(step), prev + 1);
          actor._bloodAct = this._actSeq;
          if (actor._bloodStack > prev) this._proc(actor, `血潮${actor._bloodStack}段`);
          if (actor._bloodStack > prev) this.log(`${actor.name}の血潮：${actor._bloodStack}段（物理+${Math.round(chishioBonus(actor._bloodStack, step) * 100)}%${actor._bloodStack >= chishioMax(step) ? "・最大" : ""}）`, "sys");
        }
        const bonus = chishioBonus(actor._bloodStack || 0, step);
        if (bonus > 0) dmg = Math.round(dmg * (1 + bonus));
      }
    }
    if (actor.side === "party") { const evm = evDealMul(actor, tgt); if (evm !== 1) dmg = Math.round(dmg * evm); }
    // 極「残影の」: 敵の物理をかわした後の、次の自分の物理 +30%
    let afterImg = false;
    if (perkFoe && actor._afterImg) { actor._afterImg = false; afterImg = true; dmg = Math.round(dmg * (1 + bkValue(actor,"afterImage"))); }
    // 会心: 基礎 + 会心パッシブ + 幸運(LUK) + 技の会心補正。確定会心系が先に立つ
    const luckCrit = luckCritBonus((actor.luk || 0) * this._bm(actor, "luk"));
    let critChance = 0.06 + (actor.critBonus || 0) + luckCrit + (opt.critBonus || 0) + (actor._evCrit || 0);
    if (perkFoe) critChance += this._perkSum(actor, "crit", { tgt, el: aE, on: pOn }); // 固有パッシブ (crit)
    if (pv(actor, "holyEdge") && HOLY_PREY.includes(enemyRace(tgt))) critChance += 0.15;
    const fs = pv(actor, "fightSpirit");
    if (fs >= 2 && actor.maxhp && actor.hp <= actor.maxhp * 0.3) critChance += [0, 0, 0.15, 0.20, 0.25][Math.min(fs, 4)];
    let sureCrit = false;
    if (opt.basic && actor._kenma) { actor._kenma = false; sureCrit = true; }       // 剣魔合一
    if (opt.basic && actor._ambushCritLeft > 0) { actor._ambushCritLeft--; sureCrit = true; } // 先制の一撃
    if (tgt.asleep && actor.side === "party") sureCrit = true; // 眠っている敵への物理は必ず会心 (眠った味方を敵が殴っても会心は確定しない)
    if (pv(actor, "sleepKill") && tgt.side === "enemy" && (tgt.ailment === "paralyze" || tgt.mind)) sureCrit = true; // 寝込み襲い: 麻痺・魅了・混乱にも確定会心
    // 確定会心の技・条件は保ち、味方の最終会心率は80%を上限にする。
    critChance = (opt.critBonus || 0) >= 1 ? 1 : Math.min(.8, Math.max(0, critChance));
    const crit = sureCrit || random() < critChance;
    if (crit && actor.side === "party" && tgt.side === "enemy" && this.show) this.show.cr++; // 観客の注文 (会心を見せろ)
    if (crit) dmg = Math.floor(dmg * 1.85 * this._physicalCritMul(actor, { tgt, el: aE, on: pOn }) * [1, 1.25, 1.45][Math.min(pv(actor, "vitalEye"), 2)]); // 急所読み: 会心強化
    // 隊列補正: 後衛は物理の与ダメ・被ダメが半減
    const rm = this._rowMul(actor, tgt);
    if (rm !== 1) dmg = Math.round(dmg * rm);
    // 金属の体: 会心でなければ何で打っても1ダメージ (物理貫通も魔法属性の武器も同じ)。会心の一撃は素通しで普段どおり通る
    const metalHit = isMetal(tgt);
    if (metalHit && !crit) dmg = 1;
    // 魔法弱点 (魔法属性の武器の一撃だけ): 攻撃呪文と同じく被ダメが増える
    let magWeak = false;
    if (magHit && !metalHit && tgt.magWeak && tgt.magWeak > 1) { dmg = Math.round(dmg * tgt.magWeak); magWeak = true; }
    // 物理抵抗値: 値と同じ割合を軽減、100は無効。魔法属性の武器は魔法耐性を受ける
    // 物理貫通だけが耐性の軽減を無視する。会心は耐性を受け、物理無効は貫けない。
    // 極「双魂の」: 物理の一撃を、敵の物理と魔法の抵抗値のうち低い方で受けさせる (抵抗値100でも。物理貫通は物理の時だけ)
    let rKey = magHit ? "magResist" : "physResist";
    if (!magHit && perkFoe && bkProc(actor,"twinSoul")) {
      const pR = modeResistance(tgt, "physResist");
      if (modeResistance(tgt, "magResist") < pR) rKey = "magResist";
    }
    const resistIgnore = rKey === "magResist" ? 0 : this._physPierce(actor, opt);
    const pr = metalHit ? { dmg, tag: crit ? "" : METAL_TAG.phys, immune: false }
      : this._resistCut(tgt, dmg, rKey, resistIgnore);
    if (pr.immune) {
      // 無効: 傷ひとつ付かない (障壁も削れず、毒刃・怯ませ等の命中時効果も乗らない)
      this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}：${rKey === "magResist" ? "魔法" : "物理"}無効`, tgt.side === "party" ? "dmg" : "hit");
      return { target: tgt, dmg: 0, crit: false, died: false, immune: true, magic: magHit, offhand: !!opt.offhand };
    }
    dmg = Math.max(1, Math.round(pr.dmg * this._passiveCorrection(tgt, actor, aE, rKey === "physResist" ? "phys" : "magic", resistIgnore)));
    // 障壁: 数回だけ被ダメを半減する敵 (回数制)
    let barriered = false;
    if (tgt.side === "enemy" && tgt._barrierLeft > 0) { tgt._barrierLeft--; dmg = Math.ceil(dmg * 0.5); barriered = true; }
    // 金剛の護符 (guard): 被ダメを常に割合カット (LR装飾品)
    if (tgt.guard) dmg = Math.ceil(dmg * (1 - tgt.guard));
    dmg = Math.max(1, dmg);
    if (actor.side === "enemy" && this._onceGuard(tgt, "firstGuard", "_fgUsed", "加護の祈り")) { return { target: tgt, dmg: 0, crit: false, died: false, immune: true, magic: magHit, offhand: !!opt.offhand }; }
    // 金剛の守り (守護騎士のランク): 敵の物理を 5/8/12/20% で完全に受け止める
    if (actor.side === "enemy" && tgt.side === "party" && random() < this._rk(tgt, "guardianKongou", [0.05, 0.08, 0.12, 0.20])) {
      this.log(`${tgt.name}の金剛の守り：無傷`, "heal");
      this._proc(tgt, "金剛の守り");
      return { target: tgt, dmg: 0, crit: false, died: false, immune: true, magic: magHit, offhand: !!opt.offhand };
    }
    if (enemyHit) dmg = this._gearGuard(tgt, dmg, "phys"); // 逆境の・金城の (極)
    dmg = this._wallCut(tgt, dmg);
    if (enemyHit) {
      dmg = this._gearSplit(tgt, dmg); // 痛み分けの (極)
      const cv = redirected ? null : this._gearCover(tgt, dmg); // 肩代わりの (極): かばう・仁王立ちが先
      if (cv) tgt = cv;
    }
    const hpBefore = tgt.hp;
    tgt.hp = this._reportHp(actor, tgt, tgt.hp - (dmg));
    // 属性・障壁・物理耐性は重なっても全部見えるように併記する
    const eff = [elemNote(metalHit && !crit ? 1 : em, aE), magWeak ? `魔法弱点×${fmtMul(tgt.magWeak)}` : "", afterImg ? "残影" : "", barriered ? `障壁半減・残り${tgt._barrierLeft}回` : "", pr.tag]
      .filter(Boolean).join("・");
    this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}に${dmg}ダメージ${hitNote(crit ? "会心" : "", eff)}`,
      tgt.side === "party" ? "dmg" : "hit");
    // 吸血: 命中とダメージを伝えた後にHPを吸収する。回避・無効時はここに到達しない。
    let stolen = 0; // 満タンで切られた分も含む素の吸収量 (演出で「+N」と見せる)
    if (actor.lifesteal && actor.alive && dmg > 0) {
      stolen = Math.max(1, Math.round(dmg * actor.lifesteal));
      const before = actor.hp;
      actor.hp = this._reportHp(actor, actor, Math.min(actor.maxhp, actor.hp + stolen));
      this.log(`${actor.name}のHP吸収：HP+${stolen}`, "heal");
      this._enemyHealed(actor, before);
    }
    if (perkFoe && !metalHit) {
      const m = gm(actor);
      // 極「くさびの」: 当てるたび敵の物理の抵抗値 −10 (最大 −30、主・強敵は −20。抵抗値100には効かない)
      if (m.wedge && (tgt.physResist || 0) > 0 && (tgt.physResist || 0) < 100) {
        const cap = this._strongFoe(tgt) ? 20 : 30, w0 = tgt._wedge || 0;
        if (w0 < Math.min(cap, tgt.physResist)) { tgt._wedge = Math.min(cap, w0 + 10); this.log(`${tgt.name}にくさび：物理の抵抗値−${tgt._wedge}`, "hit"); this._proc(actor, "くさび"); }
      }
      for(const [key,stat,field] of [["bk_physDown","physResist","_bkPhysDown"],["bk_magDown","magResist","_bkMagDown"]]){
        if(m[key] && (tgt[stat]||0)>0 && tgt[stat]<100){const v=Math.min(50,m[key]*100);if(v>(tgt[field]||0)){tgt[field]=v;this.log(`${tgt.name}の${stat==="physResist"?"物理":"魔法"}耐性−${v}ポイント`,"hit");}}
      }
      // 極「かすめ取りの」: 10% で盗むと同じく敵の金貨を奪う (1体につき1度)
      if (bkValue(actor,"pilfer") && !tgt._stolen && (tgt.gold || 0) > 0 && random() < bkValue(actor,"pilfer")) {
        const amt = Math.max(1, Math.round(tgt.gold * 0.6));
        tgt._stolen = true;
        this.bonusGold = (this.bonusGold || 0) + amt;
        this.log(`${actor.name}は${tgt.name}から💰${amt}をかすめ取った`, "win");
        this._proc(actor, "かすめ取り");
      }
    }
    // 報復の籠手 (counter): 敵の物理攻撃を受けた味方が反撃する (LR装飾品。反撃の反撃は起きない)
    if (tgt.side === "party" && tgt.counter && tgt.alive && actor.side === "enemy" && actor.alive && !opt._counter && dmg > 0) {
      this._retaliate(tgt, actor, "atk", tgt.counter, "報復", false);
    }
    this._wake(tgt);
    if (perkFoe) this._rankOnHit(actor, tgt, dmg, metalHit);
    // 命中時の弱体 (毒刃など)
    if (opt.debuff && tgt.alive) { for (const k in opt.debuff) this._applyMod(tgt, k, opt.debuff[k], opt.debuffDur, opt.name); }
    // 仕込み毒 (venomBlade): 敵を毒に侵す
    const vb = pv(actor, "venomBlade");
    if (vb && tgt.alive && tgt.side === "enemy" && !metalHit) this._inflict(actor, tgt, { name: "仕込み毒", poison: { chance: vb >= 2 ? .3 : .15, pct: .05 } });
    // 武器の追加効果 (onHit): 当てるだけで毒・麻痺・眠り・魅了・混乱を与える (装備の集約は items.js の recalc)
    let status = "";
    if (actor.side === "party" && tgt.side === "enemy" && tgt.alive && actor.onHit && actor.onHit.length) {
      const tags = [];
      for (const oh of actor.onHit) this._inflict(actor, tgt, { ...onHitSpell(oh), _source: "gear:" + oh.k }, tags);
      status = statusText(tags);
    }
    // 固有パッシブ (hit): 当てた敵へ確率で状態異常・弱体
    if (perkFoe && tgt.alive) {
      const tags = [];
      this._perkHit(actor, tgt, tags, pOn);
      const st = statusText(tags);
      if (st) status = status ? status : st;
    }
    // 怯ませ (flinch): 主(ボス)には効かない・既に怯んでいる敵には重ねない
    if (pv(actor, "flinch") && opt.basic && tgt.alive) this._inflict(actor, tgt, { name: "怯ませ", flinchChance: .1 });
    const died = this._die(tgt, actor);
    const overflowHit = died && actor.side === "party" && tgt.side === "enemy" && hpBefore > 0 && dmg > hpBefore ? this._overflow(actor, dmg - hpBefore) : null;
    // 極「見届けの」: 会心が出ると、その敵のこのターンの手番を一番最後に回す
    if (crit && perkFoe && !died && tgt.alive && this.queue && this.queue.includes(tgt) && bkProc(actor,"witness")) {
      const n = this.queue.filter((x) => x === tgt).length;
      this.queue = this.queue.filter((x) => x !== tgt);
      for (let i = 0; i < n; i++) this.queue.push(tgt);
      this.log(`${actor.name}の見届け：${tgt.name}の手番を最後に回した`, "hit");
    }
    // 魂喰い: 敵を倒した時にMPを最大の1.5%回復
    if (died && actor.side === "party" && pv(actor, "soulEater") && actor.maxmp) {
      const mr = Math.max(1, Math.ceil(actor.maxmp * 0.015));
      actor.mp = Math.min(actor.maxmp, actor.mp + mr);
      this.log(`魂喰い！ ${actor.name}のMP+${mr}`, "heal");
      this._proc(actor, "魂喰い");
    }
    if (!died && tgt.side === "party") {
      this._postDamage(tgt);
      if (actor.side === "enemy") { this._perkHurt(tgt, actor, dmg, "phys"); this._tryCounter(tgt, actor); }
    }
    const out = status ? { target: tgt, dmg, crit, died, status } : { target: tgt, dmg, crit, died };
    // 描画用。右手/左手の実際のダメージ種別を渡し、物理技を魔法に見せない。
    out.magic = magHit; out.offhand = !!opt.offhand;
    if (overflowHit) out.overflowHit = overflowHit;
    if (stolen) { out.lifesteal = stolen; out.stealer = actor; }
    return out;
  }

  // ===== オートの見積もり (autotactics.js が読む) =====
  // 実際の _physical / _cast と同じ式で「平均でどれだけ通るか」を返す。乱数を引かず、戦闘の状態も一切変えない
  // (溜めは覗くだけ・揺らぎは平均値)。命中率・会心率・耐性・属性・隊列を織り込んだ期待値
  estPhys(actor, tgt, opt = {}) {
    if (!actor || !tgt || !tgt.alive) return 0;
    const twin=gm(actor).bk_twinSoul||0;
    if(twin&&!gm(actor).twinSoul&&!("_bkTwin" in opt))return twin*this.estPhys(actor,tgt,{...opt,_bkTwin:true})+(1-twin)*this.estPhys(actor,tgt,{...opt,_bkTwin:false});
    const magHit = actor.side === "party" && !opt.skill && (opt.offhand ? !!actor.oMagic : !!actor.wMagic);
    let resistKey = magHit ? "magResist" : "physResist";
    if (!magHit && actor.side === "party" && (gm(actor).twinSoul || opt._bkTwin) && modeResistance(tgt, "magResist") < modeResistance(tgt, "physResist")) resistKey = "magResist";
    let r = modeResistance(tgt, resistKey);
    const resistIgnore = resistKey === "physResist" ? this._physPierce(actor, opt) : 0;
    if (opt.resistKnown === false && r < 100) r = 0; // 図鑑で未開示の部分抵抗は予測へ入れない
    const metal = isMetal(tgt);
    if (r >= 100 && !metal) return 0; // 無効は会心でも通らない
    const missP = this._missP(tgt, actor, opt);
    const sureHit = opt.sureHit || (tgt.side === "enemy" && (tgt.asleep || tgt.ailment === "paralyze"));
    const hitP = sureHit ? 1 : Math.max(0, 1 - Math.min(1, missP));
    const power = opt.power || 1;
    const sb = pv(actor, "spellBlade");
    const sbAdd = sb ? (actor.int || 0) * (sb >= 2 ? 1.0 : 0.5) * power : 0;
    const ibAdd = opt.intScale ? (actor.int || 0) * opt.intScale * power : 0;
    const stAdd = ((opt.agiScale || 0) * (actor.agi || 0) + (opt.vitScale || 0) * (actor.vit || 0) + (opt.pieScale || 0) * (actor.pie || 0)) * power;
    const despMul = opt.desperate && actor.maxhp ? 1 + Math.max(0, 1 - actor.hp / actor.maxhp) : 1;
    const defCut = Math.floor(this._evit(tgt, actor) * 0.5);
    const mjAdd = opt.skill && actor.side === "party" ? (actor.int || 0) * this._bm(actor, "int") * this._rk(actor, "spellbladeMajin", [0.10, 0.20, 0.30, 0.50]) : 0;
    const ch = actor.effects && actor.effects.find((e) => e.stat === "charge"); // 溜めは覗くだけ
    let dmg = (varianceMean(this._physAtk(actor, opt, tgt) * power * this._lowHpMul(actor)) + sbAdd + ibAdd + stAdd + mjAdd) * despMul * (opt.offhand ? 1 : ch ? ch.mult : 1) - defCut;
    if (tgt._defending) dmg *= 0.5;
    const aE = opt.element || (opt.offhand ? actor.offAttackElement : actor.attackElement) || actor.element || "none";
    if ((opt.actual || elemSeen(tgt, actor)) && [eaffOf(tgt)?.immune, eaffOf(tgt)?.absorb].some(a => a?.includes(aE))) return 0;
    // 属性相性は開示済みだけ見込む。actual はオートの無効・低威力確認用。耐性ダウンは常に見える
    dmg *= (opt.actual || elemSeen(tgt, actor) ? this._elementMul(actor, tgt, aE) : 1);
    if (opt.execute && tgt.maxhp && tgt.hp <= tgt.maxhp * 0.3) dmg *= opt.execute;
    if (opt.prey && opt.prey.races.includes(enemyRace(tgt))) dmg *= opt.prey.mul;
    if (pv(actor, "smite") && HOLY_PREY.includes(enemyRace(tgt))) dmg *= 1.3;
    if (pv(actor, "gokudoku") && tgt.ailment === "poison") dmg *= 1.3;
    const pOn = opt.basic ? ["phys", "basic"] : opt.skill ? ["phys", "skill"] : ["phys"];
    const perkFoe = actor.side === "party" && tgt.side === "enemy";
    const tv = opt.actual ? tgt : elemMask(tgt, actor);
    if (perkFoe) dmg *= 1 + this._perkSum(actor, "deal", { tgt: tv, el: aE, on: pOn });
    if (actor.side === "party") dmg *= evDealMul(actor, tgt);
    const luckCrit = luckCritBonus((actor.luk || 0) * this._bm(actor, "luk"));
    let critP = 0.06 + (actor.critBonus || 0) + luckCrit + (opt.critBonus || 0) + (actor._evCrit || 0);
    if (perkFoe) critP += this._perkSum(actor, "crit", { tgt: tv, el: aE, on: pOn });
    if (pv(actor, "holyEdge") && HOLY_PREY.includes(enemyRace(tgt))) critP += 0.15;
    const fs = pv(actor, "fightSpirit");
    if (fs >= 2 && actor.maxhp && actor.hp <= actor.maxhp * 0.3) critP += [0, 0, 0.15, 0.20, 0.25][Math.min(fs, 4)];
    const sureCrit = (opt.critBonus || 0) >= 1 || (opt.basic && (actor._kenma || actor._ambushCritLeft > 0)) || (tgt.asleep && actor.side === "party")
      || (pv(actor, "sleepKill") && tgt.side === "enemy" && (tgt.ailment === "paralyze" || tgt.mind));
    critP = sureCrit ? 1 : Math.min(.8, Math.max(0, critP));
    dmg *= this._rowMul(actor, tgt);
    if (magHit && !metal && tgt.magWeak > 1 && opt.resistKnown !== false) dmg *= tgt.magWeak;
    let crit = dmg * 1.85 * this._physicalCritMul(actor, { tgt: tv, el: aE, on: pOn }) * [1, 1.25, 1.45][Math.min(pv(actor, "vitalEye"), 2)];
    let plain = dmg;
    if (metal) plain = 1;
    else if (r > 0) {
      const resistMul = 1 - Math.min(.8, resistRate(r)) * (1 - resistIgnore);
      plain *= resistMul;
      crit *= resistMul;
    }
    let m = 1;
    if (tgt._barrierLeft > 0) m *= 0.5;
    if (tgt.guard) m *= 1 - tgt.guard;
    return hitP * (critP * Math.max(1, crit * m) + (1 - critP) * Math.max(1, plain * m)) * this._passiveCorrection(Object.create(opt.actual ? tgt : elemMask(tgt, actor), {[resistKey]:{value:r},_wedge:{value:0},_bkPhysDown:{value:0},_bkMagDown:{value:0}}), actor, aE, resistKey === "magResist" ? "magic" : "phys", resistIgnore);
  }
  // 通常攻撃 1 手の期待ダメージ (連撃の回数 + 二刀流の左手の一撃。左手の射程で届かなければ左手は数えない)
  estBasic(actor, tgt, opt = {}) {
    if (!actor || !tgt || !tgt.alive) return 0;
    const strikes = actor.multistrike > 1 ? Math.min(4, actor.multistrike) : 1;
    let v = this.estPhys(actor, tgt, { ...opt, basic: true }) * strikes;
    if (actor.side === "party" && actor.dualRate > 0 && this.attackableEnemies(actor, true).includes(tgt)) v += this.estPhys(actor, tgt, { ...opt, basic: true, offhand: true });
    return v;
  }
  // 職業の会心威力は装備の会心ダメージ補正へ加算。会心率上限とは別に働く。
  _physicalCritMul(actor, ctx = { on: ["phys"] }) {
    return physicalCritMul(actor, this._perkSum(actor, "critDamage", ctx));
  }
  _spellCritMul(actor) {
    const bonus=actor?.side==="party" ? ([0,.1,.2,.3][Math.min(pv(actor,"spellCrit"),3)]||0)+this._rk(actor,"arcanistShinen",[.3,.6,1,1.5]) : 0;
    return 1.5*(gm(actor).sae?1.3:1)*(gearCritMul(actor,true)+bonus);
  }
  // 物理会心とは独立した、技・職業・装備の魔法会心率。
  _spellCritChance(actor, sp) {
    if (sp.gravity) return 0;
    if ((sp.critBonus || 0) >= 1) return 1;
    return Math.min(.8, Math.max(0, ([0, 0.10, 0.18, 0.26][Math.min(pv(actor, "spellCrit"), 3)] || 0)
      + (sp.critBonus || 0) + (actor.spellCritBonus || 0)
      + this._rk(actor, "arcanistShinen", [0.05, 0.10, 0.15, 0.20]) + (gm(actor).sae ? 0.15 : 0)));
  }
  // 攻撃呪文1発の期待ダメージ。魔法無効・金属は0、重力は会心しない。
  estSpell(actor, sp, t, opt = {}) {
    if (!actor || !sp || !t || !t.alive) return 0;
    if (isMetal(t)) return 0;
    if (!sp.gravity && (opt.actual || elemSeen(t, actor)) && [eaffOf(t)?.immune, eaffOf(t)?.absorb].some(a => a?.includes(sp.element))) return 0;
    let dmg;
    if (sp.gravity) dmg = gravityDamage(sp, (actor.int || 0) * this._bm(actor, "int"), t);
    else {
      const intv = Math.max((actor.int || 0) * this._bm(actor, "int"), isFaithSpell(sp) ? (actor.pie || 0) * this._bm(actor, "pie") : 0);
      let em = opt.actual || elemSeen(t, actor) ? this._elementMul(actor, t, sp.element || "none") : 1;
      if (em < 1 && pv(actor, "elemFloor")) em = 1;

      dmg = Math.max(1, varianceMean(attackSpellPower(sp, intv, this.lvOf(actor)) * soulPowerMul(actor, sp)) * this._lowHpMul(actor) - Math.floor(this._evit(t, actor) * 0.2)) * em;
      if (t.magWeak > 1 && opt.resistKnown !== false) dmg *= t.magWeak;
      if (sp.prey && sp.prey.races.includes(enemyRace(t))) dmg *= sp.prey.mul;
    }
    let r = t.magResist || 0;
    if (opt.resistKnown === false && r < 100) r = 0;
    if (r >= 100) return 0;
    if (r > 0) dmg *= 1 - Math.min(.8, resistRate(r)) * (1 - this._rk(actor, "archmageShinen", [0.25, 0.50, 0.75, 1]));
    if (pv(actor, "gokudoku") && t.ailment === "poison") dmg *= 1.3;
    dmg *= evDealMul(actor, t) * (1 + this._perkSum(actor, "deal", { tgt: opt.actual ? t : elemMask(t, actor), el: sp.element || "none", on: ["spell"] }));
    const critP = this._spellCritChance(actor, sp);
    const critMul = this._spellCritMul(actor);
    dmg *= 1 + critP * (critMul - 1);
    if (t.guard) dmg *= 1 - t.guard;
    dmg *= this._passiveCorrection(Object.create(opt.actual ? t : elemMask(t, actor), {magResist:{value:r}}), actor, sp.gravity ? "none" : sp.element, "magic", this._rk(actor, "archmageShinen", [.25, .5, .75, 1]), !!pv(actor, "elemFloor"));
    return Math.max(1, dmg);
  }
  // 回復呪文の1人あたりの期待回復量 (揺らぎの平均込み)
  // 対象 t を渡すと頭打ち (healCap)・割合回復 (healPct) まで含めた量。省略時は頭打ち前の量
  estHeal(actor, sp, t = null) {
    if (t) return this._healAmt(actor, sp, t, true);
    return sp.healPct ? 0 : varianceMean(this._healRaw(actor, sp));
  }
  // 刃の癒しの1人あたりの期待回復量 (与ダメの見積もり dealt から)
  estBladeHeal(actor, sp, dealt, t) {
    return Math.min(dealt * (sp.bladeHeal || 0) * (1 + this._perkSum(actor, "heal")), ((t && t.maxhp) || 0) * (sp.healCap || BLADE_HEAL_CAP));
  }
  // 回復呪文の揺らぎ前の量。荒行の果て (低HP時) は回復も+30%、固有パッシブ (heal) も乗る
  _healRaw(actor, sp) {
    const aMul = pv(actor, "asceticism") && actor.maxhp && actor.hp <= actor.maxhp * 0.3 ? 1.3 : 1;
    return spellHealRaw(actor, sp, (actor.pie || 0) * this._bm(actor, "pie")) * aMul * (1 + this._perkSum(actor, "heal"));
  }
  _healAmt(actor, sp, t, mean = false) {
    if (sp.healPct) return healOnTarget(sp, t, 0);
    const raw = this._healRaw(actor, sp);
    return healOnTarget(sp, t, mean ? varianceMean(raw) : variance(raw));
  }
  // 攻撃後の全体回復は、回復呪文とは別のPIE係数(0.3)を持つ。
  estPartyHeal(actor, power) {
    return varianceMean((power + (actor.pie || 0) * this._bm(actor, "pie") * 0.3) * (1 + this._perkSum(actor, "heal")));
  }
  // 状態異常・即死の成功率 (付与力・耐性・主の回復猶予込み)。_inflict と同じ係数
  estRate(actor, t, base, kind, known = true) { return base > 0 ? this._rate(actor, t, base, kind, known) : 0; }

  // 1回の付与判定の成功率。命中・生存後の判定で、多段技全体の確率ではない。
  // 未判明の抵抗値は known=false で伏せる。乱数・状態は一切変えない。
  spellStatusChances(actor, sp, t, known = true) {
    const sources = [sp];
    if (sp.kind === "phys" && actor?.side === "party") {
      for (const oh of actor.onHit || []) sources.push(onHitSpell(oh));
      const vb = pv(actor, "venomBlade");
      if (vb) sources.push({ poison: { chance: vb >= 2 ? .3 : .15, pct: .05 } });
      for (const {c,lv,label,key} of perksOf(actor)) if (c.t === "hit" && (!c.on || ["phys", "skill"].includes(c.on))) sources.push(perkAilmentSpell(c,lv,label,key));
    }
    const combined = mergeStatusSpecs(sources, t);
    if (sp.instakill && !combined.instakill) combined.instakill = sp.instakill;
    let poisonRate = 0, charmRate = 0;
    return spellAilments(combined).map(({ kind, label, base }) => {
      let blocked = !t || !t.alive || t.side !== "enemy" || isMetal(t)
        || (sp.kind === "phys" && t.physResist >= 100) || (sp.kind === "atk" && t.magResist >= 100);
      if (!blocked) {
        if (kind === "poison") blocked = !!t.ailment && (t.ailment !== "poison" || (t._poisonPct || 0.05) >= combined.poison.pct);
        if (kind === "paralyze") blocked = !!t.ailment;
        if (kind === "sleep") blocked = sp.kind !== "sleep" && !!t.asleep;
        if (kind === "charm" || kind === "confuse") blocked = !!t.mind;
        if (kind === "flinch") blocked = !!(t.boss || t._flinch);
        if (kind === "death") blocked = !!t.boss || !!(combined.instakill.races && !combined.instakill.races.includes(enemyRace(t)));
      }
      let rate = blocked ? 0 : this.estRate(actor, t, base, kind, known);
      // 毒と麻痺、魅了と混乱は同じ枠。先に付く効果が成功した分は後の効果から引く。
      // 抵抗が未判明なら先の効果が防がれる可能性もあるため、後の効果も上限を出す。
      if (kind === "poison") poisonRate = rate;
      if (kind === "paralyze" && known) rate *= 1 - poisonRate;
      if (kind === "charm") charmRate = rate;
      if (kind === "confuse" && known) rate *= 1 - charmRate;
      return { kind, label, rate, known: known || blocked };
    });
  }

  _cast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    const echo = !!cmd._echo; // 重詠の2回目 (MP・代償を払わない)
    const full = spellCost(actor, sp);
    const cost = echo ? 0 : cmd._memo ? Math.ceil(full / 2) : full; // 極「記憶の」: 同じ技の続けざまは半分
    if (cmd._memo && !echo) this.log(`${actor.name}の記憶：消費MP半分（${cost}）`, "sys");
    actor.mp -= cost; // 省詠唱 (chant) 持ちは消費が軽い
    // 捨身 (hpCost): 最大HPの一定割合を代償に払う (HP1で踏みとどまる)。
    // ダメージ計算より先に払うため、自ら瀕死に踏み込んで荒行の果て・背水を起動できる
    // 暗黒の契約 (魔騎士のランク): HP の代償 −20/35/50/100%
    const hpCut = this._rk(actor, "dkKeiyaku", [0.20, 0.35, 0.50, 1]);
    if (sp.hpCost && !echo && hpCut < 1) {
      const cost = Math.max(1, Math.round((actor.maxhp || 1) * sp.hpCost * (1 - hpCut)));
      actor.hp = Math.max(1, actor.hp - cost);
      this.log(`${actor.name}のHP消費：${cost}`, "dmg");
    }
    if (pv(actor, "kenma")) actor._kenma = true; // 剣魔合一: 次の通常攻撃が確定会心
    res.spellName = sp.name;
    res.spellKey = cmd.spellKey; // 演出 (battlefx の技ごとの組み立て) が技の性質を読む
    res.spellKind = sp.kind;
    res.spellElement = sp.element || null;
    const isPhys = sp.kind === "phys";
    if (echo) this._proc(actor, "重詠");
    this.log(`${actor.name}の${sp.name}！${echo ? "（重詠）" : ""}`, "hit");
    let dealt = 0; // この技で与えた総ダメージ (drain / mpDrain の吸収量の基準)
    if (sp.kind === "escape") {
      // 確実な逃走 (煙玉など): 迷宮の異変で退路が閉ざされている時だけ失敗する
      if (this.noFlee) {
        this.log("逃走不可（退路封鎖）", "dmg");
        res.fledFail = true;
      } else {
        this.result = "flee";
        this.log("逃走成功", "sys");
        res.fled = true;
      }
      return;
    }
    if (isPhys) {
      // 物理技は通常攻撃と同じ計算系 (倍率/多段/会心/弱体)。element 持ちは属性が乗る
      const chargeMul = this._takeCharge(actor); // 溜め: この技の全段に乗る
      const popt = {
        power: sp.power * soulPowerMul(actor, sp), critBonus: sp.critBonus, debuff: sp.debuff, debuffDur: sp.dur, element: sp.element, // 魂の格
        intScale: sp.intScale, agiScale: sp.agiScale, vitScale: sp.vitScale, pieScale: sp.pieScale,
        acc: sp.acc, sureHit: sp.sureHit, pierce: sp.pierce, desperate: sp.desperate, execute: sp.execute, prey: sp.prey,
        chargeMul, name: sp.name, skill: true,
      };
      // 矢の雨 (scatter): ランダムな敵へ N 回。それ以外は対象ごとに hits 回
      const plan = [];
      if (sp.scatter) for (let i = 0; i < sp.scatter; i++) plan.push(null);
      else for (const t of (sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean))) plan.push(t);
      const connected = new Set(); // 1発でも命中した敵 (命中後の付与効果の条件)
      for (const t0 of plan) {
        let t = t0 || this._randAlive(this.enemies);
        if (!t) break;
        const hits = sp.scatter ? 1 : (sp.hits || 1);
        const carry = hits > 1 ? this._perkValue(actor, "chainCarry") : 0;
        let inherited = false;
        for (let h = 0; h < hits; h++) {
          if (!t.alive) {
            if (!carry || h === 0) break;
            t = this._randAlive(this.attackableEnemies(actor));
            if (!t) break;
            inherited = true;
            this.log(`${actor.name}の刃の引き継ぎ！ 残り${hits - h}撃を${t.name}へ（威力${Math.round(carry * 100)}%）`, "hit");
            this._proc(actor, "刃の引き継ぎ");
          }
          const hit = this._physical(actor, t, inherited ? { ...popt, power: popt.power * carry } : popt);
          res.hits.push(hit);
          dealt += hit.dmg || 0;
          const tt = hit.target || t; // 敵の護り手に肩代わりされることがある
          if (!hit.miss && !hit.immune) connected.add(tt); // 無効で弾かれた一撃は命中扱いにしない
          // 追い剥ぎ (plunder): この技で倒した敵は落とすゴールドが2倍になる
          if (sp.plunder && hit.died && tt.gold) {
            tt.gold = Math.round(tt.gold * 2);
            this.log(`${actor.name}は${tt.name}から金品を盗んだ`, "win");
          }
        }
      }
      for (const t of connected) {
        // 盗む: 当たった敵の所持金の一部を奪う (1体につき1度)
        if (sp.steal && t.side === "enemy" && !t._stolen && (t.gold || 0) > 0) {
          const amt = Math.max(1, Math.round(t.gold * sp.steal));
          t._stolen = true;
          this.bonusGold = (this.bonusGold || 0) + amt;
          this.log(`${actor.name}は${t.name}から💰${amt}を盗んだ`, "win");
          res.hits.push({ target: t, stole: amt });
        } else if (sp.steal && t._stolen) this.log(`${t.name}：盗める品なし`, "sys");
        if (t.alive) {
          const tags = [];
          this._inflict(actor, t, sp, tags);
          markStatus(res, t, tags);
        }
      }
    } else if (sp.kind === "atk") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      // 精神統一: INT強化。光の呪文と祈りの呪文 (faith) は INT と PIE の高い方で伸びる (聖職の術者は祈りで撃つ)
      const intv = Math.max((actor.int || 0) * this._bm(actor, "int"), isFaithSpell(sp) ? (actor.pie || 0) * this._bm(actor, "pie") : 0);
      for (const t of targets) {
        if (!t.alive) continue;
        let dmg, em = 1, magWeak = false;
        if (sp.gravity) {
          // 重力: 主には3割。属性・会心に依らず、技ごとの有効INT上限を先に適用する
          dmg = gravityDamage(sp, intv, t);
        } else {
          // 呪文の属性は Lv1 扱い。同属性の属性攻撃を装備していれば、そのレベルで増幅される
              em = this._elementMul(actor, t, sp.element || "none");
          if (em < 1 && pv(actor, "elemFloor")) em = 1; // 森羅の理: 属性不利が出ない

          // 攻撃呪文の威力は術者の INT で伸びる。低HP補正 (荒行の果て) も乗る
          const power = attackSpellPower(sp, intv, this.lvOf(actor)) * soulPowerMul(actor, sp); // 魂の格
          dmg = Math.max(1, Math.round(variance(power) * this._lowHpMul(actor)) - Math.floor(this._evit(t, actor) * 0.2));
          const special = this._elementSpecial(actor, t, sp.element, dmg);
          if (special) { res.hits.push(special); continue; }
          if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
          // 魔法弱点: 攻撃呪文の被ダメが増える (「魔法に弱い」)
          if (t.magWeak && t.magWeak > 1) { dmg = Math.round(dmg * t.magWeak); magWeak = true; }
          if (sp.prey && sp.prey.races.includes(enemyRace(t))) dmg = Math.round(dmg * sp.prey.mul);
        }
        // 魔法抵抗値: 値と同じ割合を軽減、100は無効
        const mr = this._resistCut(t, dmg, "magResist");
        // 魔導の深淵 (大魔導のランク): 魔法耐性 1・2 による軽減を 25/50/75/100% 無視する (魔法無効には効かない)
        if (!mr.immune && mr.dmg < dmg && !isMetal(t)) {
          const ig = this._rk(actor, "archmageShinen", [0.25, 0.50, 0.75, 1]);
          if (ig) {
            mr.dmg = Math.round(mr.dmg + (dmg - mr.dmg) * ig);
            mr.tag = ig < 1 ? `魔法軽減${fmtMul(t.magResist * (1 - ig))}%` : "";
          }
        }
        if (mr.immune) {
          this.log(`${t.name}：魔法無効`, "dmg");
          res.hits.push({ target: t, dmg: 0, immune: true, died: false });
          continue;
        }
        dmg = Math.max(1, Math.round(mr.dmg * this._passiveCorrection(t, actor, sp.gravity ? "none" : sp.element, "magic", this._rk(actor, "archmageShinen", [.25, .5, .75, 1]), !!pv(actor, "elemFloor"))));
        if (pv(actor, "gokudoku") && t.ailment === "poison") dmg = Math.round(dmg * 1.3); // 毒責め
        { const evm = evDealMul(actor, t); if (evm !== 1) dmg = Math.max(1, Math.round(dmg * evm)); } // 迷宮のイベントの加護
        { const pd = this._perkSum(actor, "deal", { tgt: t, el: sp.element || "none", on: ["spell"] }); if (pd) dmg = Math.max(1, Math.round(dmg * (1 + pd))); } // 固有パッシブ (deal)
        // 会心: 呪文会心パッシブ + 技固有の会心補正 (禁呪開帳など)。重力は会心しない
        const crit = !sp.gravity && random() < this._spellCritChance(actor, sp);
        if (crit) dmg = Math.floor(dmg * this._spellCritMul(actor));
        if (crit && actor.side === "party" && this.show) this.show.cr++; // 観客の注文 (会心を見せろ)
        if (t.guard) dmg = Math.max(1, Math.ceil(dmg * (1 - t.guard))); // 金剛の護符: 呪文・ブレスの被ダメもカット
        t.hp = this._reportHp(actor, t, t.hp - (dmg));
        dealt += dmg;
        const eff = [elemNote(em, sp.element, magWeak ? t.magWeak : 0), mr.tag]
          .filter(Boolean).join("・");
        this.log(`${t.name}に${dmg}ダメージ${hitNote(crit ? "会心" : "", eff)}`, "dmg");
        this._wake(t);
        const died = this._die(t);
        const hit = { target: t, dmg, crit, eff: em > 1 || magWeak ? "weak" : em < 1 ? "resist" : null, died };
        res.hits.push(hit);
        if (!died && t.alive) {
          // 呪文に付く弱体 (氷の槍の鈍足など) と、命中後の効果 (毒・麻痺・封印・耐性ダウン…)
          if (sp.debuff) for (const k in sp.debuff) this._applyMod(t, k, sp.debuff[k], sp.dur, sp.name);
          const tags = [];
          if (this._inflict(actor, t, sp, tags)) hit.died = true;
          const st = statusText(tags);
          if (st) hit.status = st;
        }
      }
      // 聖魔一如 (partyHeal): 撃ち込んだ後、返す光が隊を癒す (PIEで伸びる)
      if (sp.partyHeal) this._partyHeal(actor, sp.partyHeal, res);
    } else if (sp.kind === "buff") {
      const targets = sp.target === "self" ? [actor] : sp.target === "all-ally" ? this.livingParty() : [cmd.target || actor].filter(Boolean);
      let cured = false, purged = false;
      for (const t of targets) {
        const mods = { ...(sp.buff || {}) };
        for (const k in (sp.buff || {})) this._applyMod(t, k, sp.buff[k], sp.dur, sp.name);
        // 構え: 挑発 / 仁王立ち / 反撃の構え / 溜め / リジェネ (いずれも効果として持続ターンを持つ)
        if (sp.taunt) { this._applyMod(t, "taunt", 3, sp.dur, sp.name); mods.taunt = 3; }
        if (sp.shield) { this._applyMod(t, "shield", 2, sp.dur, sp.name); mods.shield = 2; }
        if (sp.stance === "counter") { const cm = 1 + stanceMulOf(sp); this._applyMod(t, "ctr", cm, sp.dur, sp.name); mods.ctr = cm; }
        // 反射の陣 (reflect): 受けた呪文・ブレスを、唱えた者の魔力 (INT と PIE の高い方) × 係数の魔法の一撃で返す
        if (sp.reflect) {
          const rm = 1 + Math.min(REFLECT_MAX, sp.reflect);
          this._applyMod(t, "rfl", rm, sp.dur, sp.name);
          const ef = (t.effects || []).filter((e) => e.stat === "rfl").pop();
          if (ef) ef.pow = Math.max(ef.pow || 0, Math.round(this._retStat(actor, "mag")));
          mods.rfl = rm;
        }
        if (sp.charge) {
          t.effects = (t.effects || []).filter((e) => e.stat !== "charge"); // 溜めは重ねず掛け直し
          this._applyMod(t, "charge", sp.charge, sp.dur, sp.name); mods.charge = sp.charge;
        }
        if (sp.regen) { this._applyRegen(actor, t, sp); mods.regen = 1 + sp.regen.pct; }
        // 守りの陣 (ward): ブレス (wardB) / 全体呪文 (wardS) の被ダメを割る倍率として持つ (0.5 軽減 = ×2 で割る)
        if (sp.ward) for (const w in sp.ward) {
          const st = w === "breath" ? "wardB" : "wardS", m = 1 / (1 - sp.ward[w]);
          this._applyMod(t, st, m, sp.dur, sp.name); mods[st] = m;
        }
        // 法障壁 (grantBarrier): 魔障壁の残回数を配る (ブレス・呪文の被ダメ半減)
        if (sp.grantBarrier) t._barrierLeft = (t._barrierLeft || 0) + sp.grantBarrier;
        // 聖域の鐘 (cure / purge): 守りと同時に状態異常・弱体を祓う
        if (sp.cure && cureBySpell(sp, t)) cured = true;
        if (sp.purge && this._purgeDown(t)) purged = true;
        res.hits.push({ target: t, buff: true, mods });
      }
      const scope = sp.target === "all-ally" ? "隊" : targets.map((t) => t.name).join("・");
      const notes = [];
      if (sp.buff) notes.push(buffText(sp.buff, 1));
      if (sp.taunt) notes.push("引き付け");
      if (sp.shield) notes.push("かばう構え");
      if (sp.stance === "counter") notes.push(`反撃の構え（攻撃力×${stanceMulOf(sp)}）`);
      if (sp.reflect) notes.push(`反射の陣（呪文・ブレスに${actor.name}の魔力×${Math.min(REFLECT_MAX, sp.reflect)}で返す）`);
      if (sp.charge) notes.push(`次の物理×${fmtMul(sp.charge)}`);
      if (sp.regen) notes.push(`毎ターン最大HP${fmtMul(sp.regen.pct * 100)}%回復・${sp.regen.turns}ターン`);
      if (sp.grantBarrier) notes.push(`魔障壁${sp.grantBarrier}回（ブレス・呪文半減）`);
      if (sp.ward) for (const [k, v] of Object.entries(sp.ward)) notes.push(`${k === "breath" ? "ブレス" : "呪文"}軽減${fmtMul(v * 100)}%`);
      const timed = sp.buff || sp.taunt || sp.shield || sp.stance === "counter" || sp.reflect || sp.charge || sp.ward;
      this.log(`${scope}：${notes.join("・")}${timed ? `、${logTurns(sp.dur)}` : ""}`, "heal");
      if (cured || purged) this.log(`${scope}：${[cured ? "状態異常" : "", purged ? "弱体" : ""].filter(Boolean).join("・")}解除`, "heal");
    } else if (sp.kind === "debuff") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        if (isMetal(t)) { this.log(`${t.name}：効果なし`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); continue; }
        const mods = { ...(sp.debuff || {}) };
        for (const k in (sp.debuff || {})) this._applyMod(t, k, sp.debuff[k], sp.dur, sp.name);
        if (sp.vuln) for (const el in sp.vuln) mods["r_" + el] = sp.vuln[el];
        const tags = [];
        const died = this._inflict(actor, t, sp, tags);
        const st = statusText(tags);
        res.hits.push(died ? { target: t, dmg: 0, died: true, fatal: true } : st ? { target: t, debuff: true, mods, status: st } : { target: t, debuff: true, mods });
      }
      if (sp.debuff && sp.debuff.hit && Object.keys(sp.debuff).length === 1) this.log(`${targets.map((t) => t.name).join("・")}：命中×${fmtMul(sp.debuff.hit)}、${logTurns(sp.dur)}`, "hit");
      else if (sp.debuff && !Object.keys(sp.debuff).some(k => ENEMY_STAT_LABEL[k])) this.log("敵の能力低下", "hit");
      if (sp.vuln) this.log(`${targets.map((t) => t.name).join("・")}：${Object.entries(sp.vuln).map(([k, v]) => `${VULN_LABEL[k] || k}弱体×${fmtMul(1 / v)}`).join("・")}、${logTurns(sp.dur)}`, "hit");
    } else if (sp.kind === "cure") {
      // 治療: 状態異常を治す。purge 付きは弱体 (▼) も解く。全体版は味方全員
      const targets = sp.target === "all-ally" ? this.livingParty() : [(cmd.target && cmd.target.alive) ? cmd.target : actor];
      let any = false;
      for (const t of targets) {
        const had = cureBySpell(sp, t);
        const pg = sp.purge ? this._purgeDown(t) : false;
        if (had || pg) any = true;
        res.hits.push({ target: t, cured: had || pg });
      }
      this.log(`${sp.target === "all-ally" ? "隊" : targets.map((t) => t.name).join("・")}：${any ? `${sp.purge ? "状態異常・弱体" : "状態異常"}解除` : "効果なし"}`, "heal");
    } else if (sp.kind === "mana") {
      // 魔力の譲渡: 味方の MP を回復する (術者の INT で少し伸びる)
      const t = (cmd.target && cmd.target.alive) ? cmd.target : actor;
      const gain = Math.max(1, manaGiftAmount(actor, sp, Math.round(variance((sp.power + (actor.int || 0) * 0.25) * soulPowerMul(actor, sp))))); // 魂の格 (払った MP まで)
      const before = t.mp;
      t.mp = Math.min(t.maxmp || 0, t.mp + gain);
      this.log(`${t.name}のMP+${t.mp - before}`, "heal");
      res.hits.push({ target: t, mpHeal: t.mp - before });
    } else if (sp.kind === "heal") {
      // 回復量は _healAmt (術者の PIE・使い手の最大HP・対象の最大HPの割合。頭打ち healCap 込み)
      const heals = healsHp(sp);
      // 全体回復
      let over = 0;
      if (sp.target === "all-ally") {
        let cured = false;
        for (const t of this.party) {
          // 復活の福音 (revive): 倒れた味方も対象にして蘇生する
          const wasDead = !t.alive;
          if (wasDead) {
            if (!sp.revive) continue;
            t.alive = true; t.ailment = null; t.asleep = false; t.mind = null; t.reviveAt = null; t._dead = false;
            t.hp = this._reportHp(actor, t, sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : Math.min(t.maxhp, this._healAmt(actor, sp, t)));
            t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + Math.round(t.maxhp * this._rk(actor, "priestInochi", [0.10, 0.20, 0.30, 0.50])))); // 生命の灯
            res.hits.push({ target: t, heal: t.hp, revived: true });
            continue;
          }
          const heal = heals ? this._healAmt(actor, sp, t) : 0;
          over += Math.max(0, t.hp + heal - t.maxhp); // 慈しみの (極): 満タンを超えた分
          t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + heal));
          // 大聖祈祷 (cure): 癒しと同時に穢れを祓う / 聖壁の祈り (buff): 守りも固める
          if (sp.cure && cureBySpell(sp, t)) cured = true;
          if (sp.purge && this._purgeDown(t)) cured = true;
          if (sp.buff) for (const k in sp.buff) this._applyMod(t, k, sp.buff[k], sp.dur, sp.name);
          if (sp.regen) { this._applyRegen(actor, t, sp); }
          if (sp.grantBarrier) t._barrierLeft = (t._barrierLeft || 0) + sp.grantBarrier;
          res.hits.push({ target: t, heal });
        }
        for (const h of res.hits) if (h.revived || h.heal) this.log(h.revived ? `${h.target.name}は蘇生（HP${h.target.hp}）` : `${h.target.name}のHP+${h.heal}`, "heal");
        if (cured) this.log("隊の状態異常・弱体解除", "heal");
        if (sp.buff) this.log(`隊：${buffText(sp.buff, 1)}、${logTurns(sp.dur)}`, "heal");
      } else {
        // 蘇生呪文は戦闘不能の味方も対象にできる
        let t = sp.target === "self" ? actor : (cmd.target || actor);
        if (!t.alive && !sp.revive) t = actor;
        const wasDead = !t.alive;
        if (wasDead && sp.revive) { t.alive = true; t.ailment = null; t.asleep = false; t.mind = null; t.reviveAt = null; t._dead = false; }
        // revivePct があれば最大HPの割合で蘇生、それ以外は回復量
        const heal = (wasDead && sp.revive && sp.revivePct) ? Math.round(t.maxhp * sp.revivePct) : heals ? this._healAmt(actor, sp, t) : 0;
        if (!wasDead) over += Math.max(0, t.hp + heal - t.maxhp); // 慈しみの (極): 満タンを超えた分
        t.hp = this._reportHp(actor, t, Math.min(t.maxhp, (t.hp > 0 ? t.hp : 0) + heal));
        if (wasDead && sp.revive) t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + Math.round(t.maxhp * this._rk(actor, "priestInochi", [0.10, 0.20, 0.30, 0.50])))); // 生命の灯 (僧侶のランク)
        if (wasDead && sp.revive) this.log(`${t.name}は蘇生（HP${t.hp}）`, "heal");
        else if (heals) this.log(`${t.name}のHP+${heal}`, "heal");
        if (sp.cure && cureBySpell(sp, t)) this.log(`${t.name}の状態異常解除`, "heal");
        if (sp.purge) this._purgeDown(t);
        if (sp.regen) { this._applyRegen(actor, t, sp); }
        // 聖句の加護 (grantEndure): 致死ダメージをHP1で耐える力を授ける (1戦闘1回)
        if (sp.grantEndure && t.alive && !t._grantEndure) {
          t._grantEndure = true;
          this.log(`${t.name}に聖句の加護（致死をHP1で1回耐える）`, "heal");
        }
        res.hits.push({ target: t, heal, revived: wasDead && sp.revive });
      }
      if (over > 0) this._mercy(actor, over);
    } else if (sp.kind === "sleep") {
      for (const t of this.livingEnemies()) {
        if (isMetal(t)) { this.log(`${t.name}：効果なし`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); continue; }
        if (random() < this._rate(actor, t, 0.6, "sleep")) { t.asleep = true; this._holdAil(t, "sleep"); this.log(`${t.name}に眠り`, "sys"); this._breakOmen(t); res.hits.push({ target: t, sleep: true, status: "眠り!" }); }
        else this.log(`${t.name}：効果なし`, "sys");
      }
    }
    // 刃の癒し (物理技の bladeHeal): 与えたダメージの割合を味方全員へ (祈りの剣・天命の剣など)
    if (isPhys && sp.bladeHeal && dealt > 0) this._bladeHeal(actor, dealt * sp.bladeHeal, sp.healCap || BLADE_HEAL_CAP, res);
    // 与えたダメージに応じた吸収 (聖光斬・冥魂喰らい / 魔喰いの太刀・魔力強奪)
    if (dealt > 0 && sp.drain && actor.alive) {
      const heal = Math.max(1, Math.round(dealt * sp.drain));
      actor.hp = this._reportHp(actor, actor, Math.min(actor.maxhp, actor.hp + heal));
      this.log(`${actor.name}のHP吸収：HP+${heal}`, "heal");
      res.hits.push({ target: actor, heal });
    }
    if (dealt > 0 && sp.mpDrain && actor.maxmp) {
      // 吸収は「その技の消費MP × mpDrainCap (既定 MP_DRAIN_CAP 1.1)」まで (2026-10: 与ダメ比例のままだと撃つほど MP が増えた)。
      // どの吸収技も 1.1倍まで (ユーザーの指示、2026-10。魔力強奪だけだった) — 撃つたびに少しずつ MP が増える。重詠で払わなかった時も同じ上限
      const gain = Math.max(1, Math.min(Math.floor(spellCost(actor, sp) * (sp.mpDrainCap || MP_DRAIN_CAP)), Math.round(dealt * sp.mpDrain)));
      actor.mp = Math.min(actor.maxmp, actor.mp + gain);
      this.log(`${actor.name}のMP吸収：MP+${gain}`, "heal");
    }
    // 本効果に付随する敵全体への弱体 (攻守の法陣・霞の帳)
    if (sp.debuffAll) {
      for (const t of this.livingEnemies()) {
        if (isMetal(t)) continue; // 金属の体: 弱体は効かない
        for (const k in sp.debuffAll) this._applyMod(t, k, sp.debuffAll[k], sp.dur, sp.name);
        res.hits.push({ target: t, debuff: true, mods: sp.debuffAll });
      }
      this.log(`敵全体：${buffText(sp.debuffAll, 1, true)}、${logTurns(sp.dur)}`, "hit");
    }
    // 重詠 (大魔導): 攻撃呪文が 20/40/60% でもう一度放たれる (2回目は MP を使わず、重ねては起きない)
    const ch = sp.kind === "atk" && !echo && actor.alive ? pv(actor, "archmageChoei") : 0;
    if (ch && this.livingEnemies().length && random() < ([0, 0.2, 0.4, 0.6][Math.min(3, ch)] || 0)) {
      const tgt = sp.target === "enemy" ? ((cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.livingEnemies())) : cmd.target;
      this._cast(actor, { ...cmd, target: tgt, _echo: true }, res);
    }
    this._perkCast(actor, sp, cost); // 固有パッシブ (cast)
  }

  // 道具を使う。効き目は品で決まり、使い手の能力では伸びない (付与力にもLv差補正はない)。
  // 結果は呪文と同じ形 (action "spell" + spellKind) で返し、game.js の演出をそのまま使う
  _useItem(actor, cmd, res) {
    const it = cmd.item, u = (it && it.use) || {};
    const owner = cmd.owner || actor;
    const idx = owner && owner.items ? owner.items.indexOf(it) : -1;
    if (idx < 0) { this.log(`${actor.name}：道具なし`, "sys"); return; }
    const save = this._perkValue(actor, "itemSave");
    const saved = save > 0 && random() < save;
    if (!saved) owner.items.splice(idx, 1);
    else { this.log(`${actor.name}の空荷の手口！ ${it.name}を消費しなかった`, "heal"); this._proc(actor, "空荷の手口"); }
    res.action = "spell"; res.item = it; res.spellName = it.name; res.spellElement = null;
    this.log(`${actor.name}は${it.name}を使用${owner !== actor ? `（${owner.name}の袋）` : ""}`, "hit");
    if (u.escape) {
      res.spellKind = "escape";
      if (this.noFlee) { this.log("逃走不可（退路封鎖）", "dmg"); res.fledFail = true; }
      else { this.result = "flee"; this.log("逃走成功", "sys"); res.fled = true; }
      return;
    }
    const tk = useTarget(it);
    if (u.bomb) {
      const b = u.bomb;
      // 極「投げ打ちの」: 威力2倍。さらにその階の推奨Lv (this.foeLv) が品の深さより上なら、敵の強さの伸び (lvPow) の比で伸びる
      const throwMul = (gm(actor).throw || gm(actor).bk_throw) ? (gm(actor).throw?2:1+gm(actor).bk_throw) * Math.max(1, lvPow(this.foeLv || 1) / lvPow(it.lv || 1)) : 1;
      if (throwMul > 1) this.log(`${actor.name}の投げ打ち：威力×${fmtMul(throwMul)}`, "sys");
      res.spellKind = "atk"; res.spellElement = b.el || null;
      const targets = tk === "all-enemy" ? this.livingEnemies() : [(cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.enemies)].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        let em = this._elementMul(actor, t, b.el || "none");

        let dmg = Math.max(1, variance(b.power * throwMul) - Math.floor(this._evit(t, actor) * 0.2));
        const special = this._elementSpecial(actor, t, b.el, dmg);
        if (special) { res.hits.push(special); continue; }
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        const weak = !!(t.magWeak && t.magWeak > 1);
        if (weak) dmg = Math.round(dmg * t.magWeak);
        if (b.prey && HOLY_PREY.includes(enemyRace(t))) dmg = Math.round(dmg * 1.5);
        const mr = this._resistCut(t, dmg, "magResist");
        if (mr.immune) { this.log(`${t.name}：魔法無効`, "dmg"); res.hits.push({ target: t, dmg: 0, immune: true, died: false }); continue; }
        dmg = Math.max(1, Math.round(mr.dmg * this._passiveCorrection(t, actor, b.el, "magic")));
        if (t.guard) dmg = Math.max(1, Math.ceil(dmg * (1 - t.guard)));
        t.hp = this._reportHp(actor, t, t.hp - (dmg));
        const eff = [elemNote(em, b.el, weak ? t.magWeak : 0), mr.tag].filter(Boolean).join("・");
        this.log(`${t.name}に${dmg}ダメージ${hitNote(eff)}`, "dmg");
        this._wake(t);
        const died = this._die(t);
        res.hits.push({ target: t, dmg, eff: em > 1 || weak ? "weak" : em < 1 ? "resist" : null, died });
      }
      return;
    }
    if (u.hex) {
      res.spellKind = "debuff";
      const hx = u.hex;
      const sp = { name: it.name, sleepChance: hx.kind === "sleep" ? hx.chance : 0, para: hx.kind === "paralyze" ? hx.chance : 0, confuse: hx.kind === "confuse" ? hx.chance : 0, quiet: true };
      const targets = tk === "all-enemy" ? this.livingEnemies() : [(cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.enemies)].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        const tags = [];
        this._inflict(actor, t, sp, tags);
        const st = statusText(tags);
        if (st) res.hits.push({ target: t, debuff: true, mods: {}, status: st });
        else { this.log(`${t.name}：効果なし`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); }
      }
      return;
    }
    // 味方へ: 回復・治療・蘇生・強化
    const targets = tk === "all-ally" ? this.livingParty() : [cmd.target || actor].filter(Boolean);
    res.spellKind = u.buff ? "buff" : (u.heal || u.full || u.revive) ? "heal" : (u.mp || u.mpFull) ? "mana" : "cure";
    const kinds = useCureKinds(u);
    let any = false;
    for (const t of targets) {
      if (u.revive) {
        if (t.alive) continue;
        t.alive = true; t.ailment = null; t.asleep = false; t.mind = null; t.reviveAt = null; t._dead = false; t._ailN = null;
        t.hp = this._reportHp(actor, t, Math.max(1, Math.min(t.maxhp, Math.round(t.maxhp * u.revive))));
        this.log(`${t.name}は蘇生（HP${t.hp}）`, "heal");
        res.hits.push({ target: t, heal: t.hp, revived: true });
        any = true;
        continue;
      }
      if (!t.alive) continue;
      if (u.heal || u.full) {
        const heal = u.full ? t.maxhp : Math.round(u.heal);
        const before = t.hp;
        t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + heal));
        if (t.hp > before) { this.log(`${t.name}のHP+${t.hp - before}`, "heal"); any = true; }
        res.hits.push({ target: t, heal: u.full ? t.hp - before : heal });
      }
      if ((u.mp || u.mpFull) && (t.maxmp || 0) > 0) {
        const before = t.mp;
        t.mp = Math.min(t.maxmp, t.mp + (u.mpFull ? t.maxmp : Math.round(u.mp)));
        if (t.mp > before) { this.log(`${t.name}のMP+${t.mp - before}`, "heal"); any = true; }
        res.hits.push({ target: t, mpHeal: t.mp - before });
      }
      if (kinds.length) {
        const had = cureKinds(t, kinds);
        if (had) { this.log(`${t.name}の状態異常解除`, "heal"); any = true; }
        if (!(u.heal || u.full || u.mp || u.mpFull)) res.hits.push({ target: t, cured: had });
      }
      if (u.buff) {
        for (const k in u.buff) this._applyMod(t, k, u.buff[k], u.dur || 3, it.name);
        res.hits.push({ target: t, buff: true, mods: { ...u.buff } });
        any = true;
      }
    }
    if (u.buff) this.log(`${u.all ? "隊" : targets.map((t) => t.name).join("・")}：${buffText(u.buff, 1)}、${logTurns(u.dur)}`, "heal");
    else if (!any) this.log("効果なし", "sys");
  }

  // 攻撃呪文の後に味方全員を癒す (聖剣奮迅・護摩焚き)。PIEで伸びる (物理技は与ダメ基準の _bladeHeal)
  // 極「慈しみの」: 回復で満タンを超えて余った分の半分を、生きている隊の全員に均等に分ける
  _mercy(actor, over) {
    const k = bkValue(actor,"mercy");
    if (!k || !(over > 0)) return;
    const live = this.livingParty();
    const each = Math.floor(over * Math.min(1, k) / Math.max(1, live.length));
    if (each <= 0) return;
    let any = false;
    for (const p of live) { if (p.hp < p.maxhp) { p.hp = this._reportHp(actor, p, Math.min(p.maxhp, p.hp + each)); any = true; } }
    if (any) { this.log(`${actor.name}の慈しみ：余った癒しを隊へ（HP+${each}ずつ）`, "heal"); this._proc(actor, "慈しみ"); }
  }
  _bladeHeal(actor, amount, cap, res) {
    const a = amount * (1 + this._perkSum(actor, "heal"));
    for (const t of this.livingParty()) {
      const heal = Math.max(1, Math.round(Math.min(a, t.maxhp * cap)));
      t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + heal));
      res.hits.push({ target: t, heal });
    }
    for (const h of res.hits.filter((h) => h.heal)) this.log(`${h.target.name}のHP+${h.heal}（刃の光）`, "heal");
  }
  _partyHeal(actor, base, res) {
    const hPow = (base + (actor.pie || 0) * this._bm(actor, "pie") * 0.3) * (1 + this._perkSum(actor, "heal"));
    for (const t of this.livingParty()) {
      const heal = variance(hPow);
      t.hp = this._reportHp(actor, t, Math.min(t.maxhp, t.hp + heal));
      res.hits.push({ target: t, heal });
    }
    for (const h of res.hits.filter((h) => h.heal)) this.log(`${h.target.name}のHP+${h.heal}（聖なる残光）`, "heal");
  }

  // 物理が敵に当たった後のランクのパッシブ: 癒しの剣 / 聖光の追撃
  _rankOnHit(actor, tgt, dmg, metalHit) {
    // 癒しの剣 (聖騎士): 与えたダメージの 3/5/8/12% だけ味方全員を回復
    const iy = this._rk(actor, "paladinIyashi", [0.03, 0.05, 0.08, 0.12]);
    if (iy && dmg > 0) {
      const h = Math.max(1, Math.round(dmg * iy));
      let any = false;
      for (const p of this.livingParty()) if (p.hp < p.maxhp) { p.hp = this._reportHp(actor, p, Math.min(p.maxhp, p.hp + h)); any = true; }
      if (any) { this.log(`癒しの剣！ 味方全員のHP+${h}`, "heal"); this._proc(actor, "癒しの剣"); }
    }
    // 聖光の追撃 (聖戦士): 物理命中ごとに光の追撃 (攻撃力×0.5/1/2/3)
    const follow = this._rk(actor, "crusaderTsuigeki", [0.5, 1, 2, 3]);
    if (tgt.alive && tgt.hp > 0 && follow > 0) {
      const em = this._elementMul(actor, tgt, "light");
      const base = Math.max(1, variance(this._eatk(actor) * follow) - Math.floor(this._evit(tgt, actor) * .25));
      if (this._elementSpecial(actor, tgt, "light", base)) return;
      const raw = Math.max(1, Math.round(base * em));
      const pr = metalHit ? { dmg: 1, immune: false } : this._resistCut(tgt, raw, "physResist");
      if (!pr.immune) {
        if (!metalHit) pr.dmg = Math.max(1, Math.round(pr.dmg * (1 - (tgt.guard || 0)) * this._passiveCorrection(tgt, actor, "light", "phys")));
        tgt.hp = this._reportHp(actor, tgt, tgt.hp - (pr.dmg));
        this.log(`聖光の追撃！ ${tgt.name}に${pr.dmg}ダメージ`, "hit");
        this._proc(actor, "聖光の追撃");
      }
    }
  }
  // ランクのパッシブの Lv (lv: 1-4 = ランク2-5) から、その段の値を引く
  _rk(a, key, table) { const lv = pv(a, key); return lv ? (table[Math.min(table.length, lv) - 1] || 0) : 0; }
  // 隊で一番高い Lv の段の値 (重複不可)。alive=false なら倒れた者も数える
  _rkParty(key, table, alive = true) { let v = 0; for (const p of this.party) if (!alive || p.alive) v = Math.max(v, this._rk(p, key, table)); return v; }
  // 隊で一番高い Lv でそのパッシブを持つ者 (隊として一度だけ効くパッシブの持ち主。発動の印を出す札)
  _bestHolder(key, alive = true) {
    let best = null, bl = 0;
    for (const p of this.party) { if (alive && !p.alive) continue; const l = pv(p, key); if (l > bl) { best = p; bl = l; } }
    return best;
  }
  // 発動した効果の印: 味方の札 (game.js renderParty) に効果の名を出すための記録。演出が読み出して空にする。
  // 戦闘の進み・乱数には関わらない (読み出されない模擬戦でも溜まり続けないよう古いものから捨てる)
  _proc(who, label) {
    if (!who || who.side !== "party" || !label) return;
    const q = this.procs || (this.procs = []);
    q.push({ who, label });
    if (q.length > 24) q.splice(0, q.length - 24);
  }
  // 加護の祈り (firstGuard: 物理) / 封の結界 (spellGuard: 呪文・ブレス): 戦闘中、最初に受けるダメージを Lv 回まで無効にする。無効にしたら true
  _onceGuard(t, key, used, label) {
    if (!t || t.side !== "party") return false;
    const lv = pv(t, key);
    if (!lv || (t[used] || 0) >= lv) return false;
    t[used] = (t[used] || 0) + 1;
    this.log(`${t.name}の${label}：無傷`, "heal");
    this._proc(t, label);
    return true;
  }
  // 心頭滅却 (修験者): 属性を帯びた攻撃・ブレス・呪文のダメージを -10/15/20%
  _shintou(t) { return t && t.side === "party" ? [0, 0.10, 0.15, 0.20][Math.min(3, pv(t, "asceticShintou"))] || 0 : 0; }

  _die(t, killer = this._actor) {
    if (t.hp <= 0 && t.alive) {
      // 不屈: 致死を HP1 で耐える (Lv2 で1戦闘2回 / 味方=聖句の加護付与分も同じ回数を共有 / 敵=def の endure)
      const eLv = t.side === "party" ? Math.max(pv(t, "endure"), (t.endure ? 1 : 0), (t._grantEndure ? 1 : 0)) : (t.endure ? 1 : 0);
      const maxEndure = eLv >= 2 ? 2 : (eLv >= 1 ? 1 : 0);
      if (maxEndure > 0 && (t._endureUsed || 0) < maxEndure) {
        t._endureUsed = (t._endureUsed || 0) + 1; t._grantEndure = false; t.hp = this._reportSurvive(t);
        this.log(`${t.name}の不屈：HP1で耐えた`, t.side === "enemy" ? "dmg" : "heal");
        this._proc(t, "不屈");
        return false;
      }
      // 勇者の意地 (heroIji): 1戦闘 1/2/3 回、致死を HP1 で耐える。この手番の初めに HP1 だった時は効かない
      const iji = t.side === "party" ? pv(t, "heroIji") : 0;
      if (iji && (t._ijiUsed || 0) < iji && !(t._hpPre != null && t._hpPre <= 1)) {
        t._ijiUsed = (t._ijiUsed || 0) + 1; t.hp = this._reportSurvive(t); t._hpPre = 1;
        this.log(`${t.name}の勇者の意地：HP1で耐えた`, "heal");
        this._proc(t, "勇者の意地");
        return false;
      }
      // 名を刻まれぬ墓碑 (迷宮のイベント): この出撃で一度だけ、致死を HP1 で免れる
      if (t.side === "party" && t._evSave) {
        t._evSave = false; t.hp = this._reportSurvive(t);
        this.log(`墓碑に刻んだ名！ ${t.name}はHP1で耐えた`, "heal");
        this._proc(t, "墓碑の名");
        return false;
      }
      // 終わりの聖火: 不屈とは別。復活するはずの敵を倒した時だけ体数を使い、種族を問わず復活を止める。
      if (t.side === "enemy" && !t._noRevive && killer?.side === "party") {
        const cap = this._perkValue(killer, "noRevive");
        const revives = (t.autoRevive && !t._autoReviveUsed) || (this.foeRise > 0 && !t.boss && !isMetal(t) && !t._risen);
        if (cap && revives && (killer._noReviveUsed || 0) < cap) {
          killer._noReviveUsed = (killer._noReviveUsed || 0) + 1; t._noRevive = true;
          this.log(`${killer.name}の終わりの聖火！ ${t.name}の復活を阻止した`, "hit"); this._proc(killer, "終わりの聖火");
        }
      }
      // 武魂の復活は毎回判定し、復活HPは10%。同種の最高Lvだけ、確率上限50%。
      if(t.side==="party"&&!t._noRevive&&(gm(t).bk_reviveChance||0)>0&&random()<Math.min(.5,gm(t).bk_reviveChance)){
        t.hp=this._reportHp(t,t,Math.max(1,Math.round(t.maxhp*.1)));
        this.log(`${t.name}の戦闘不能時復活：HP${t.hp}で復活`,"heal");this._proc(t,"戦闘不能時復活");return false;
      }
      // 不死鳥の心臓 (autoRevive): 1戦闘1回だけ、戦闘不能を割合HPの蘇生で踏みとどまる (LR装飾品)
      if (t.autoRevive && !t._autoReviveUsed && !t._noRevive) {
        t._autoReviveUsed = true;
        t.hp = this._reportHp(t, t, Math.max(1, Math.round(t.maxhp * t.autoRevive)));
        this.log(`${t.name}の不死鳥の加護：蘇生（HP${t.hp}）`, "heal");
        this._proc(t, "不死鳥の加護");
        return false;
      }
      // 命の肩代わり (護教官): 倒れかけた仲間に、護教官が自分の最大HPの KATAGAWARI_COST を削って分け与える
      // (1戦闘 1/2/3 回。護教官自身には効かない。削って倒れるほど HP が無い時は使えない)
      if (t.side === "party") {
        const c = this.party.find((p) => p !== t && p.alive && p.hp > Math.round(p.maxhp * KATAGAWARI_COST) && (p._kgUsed || 0) < pv(p, "chaplainKatagawari"));
        if (c) {
          const gift = Math.max(1, Math.round(c.maxhp * KATAGAWARI_COST));
          c._kgUsed = (c._kgUsed || 0) + 1; c.hp -= gift; t.hp = this._reportHp(c, t, Math.min(t.maxhp, gift));
          this.log(`${c.name}が命を分けた！ ${t.name}はHP${t.hp}で耐えた`, "heal");
          this._proc(c, "命の肩代わり");
          return false;
        }
      }
      // 復活の祈り (巡礼者): 倒れた味方が 1戦闘 1/2/3 回まで HP1 で起き上がる (隊で一番高いLv)
      if (t.side === "party") {
        const ra = Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, "riseAgain")));
        if (ra && (this._riseUsed || 0) < ra) {
          this._riseUsed = (this._riseUsed || 0) + 1; t.hp = this._reportHp(this._bestHolder("riseAgain"), t, 1);
          this.log(`復活の祈り！ ${t.name}は蘇生（HP1）`, "heal");
          this._proc(t, "復活の祈り");
          return false;
        }
      }
      // 聖座の奇跡 (枢機卿のランク): 戦闘中1回、最後の1人が倒れる時、全員を HP10/20/30/50% で蘇らせる
      if (t.side === "party" && !this._miracleUsed && !this.party.some((p) => p.alive && p !== t)) {
        const mk = this._rkParty("cardinalKiseki", [0.10, 0.20, 0.30, 0.50], false);
        if (mk) {
          this._proc(this._bestHolder("cardinalKiseki", false), "聖座の奇跡");
          this._miracleUsed = true;
          for (const p of this.party) {
            p.alive = true; p.ailment = null; p.asleep = false; p.mind = null; p.reviveAt = null; p._dead = false;
            p.hp = this._reportHp(this._bestHolder("cardinalKiseki", false), p, Math.max(1, Math.round(p.maxhp * mk)));
          }
          this.log("聖座の奇跡！ 戦闘不能者全員が蘇生", "heal");
          return false;
        }
      }
      // 起き上がる濁り魂 (迷宮の掟 foeRise): 倒れた敵は戦闘ごとに一度だけ起き上がる (主と金属の魔物は除く)
      if (t.side === "enemy" && this.foeRise > 0 && !t.boss && !t.metal && !t._risen && !t._noRevive) {
        t._risen = true; t.hp = Math.max(1, Math.round(t.maxhp * this.foeRise));
        t.ailment = null; t.asleep = false; t.mind = null; t._ailN = null;
        this.log(`${t.name}は濁った魂で蘇生（HP${t.hp}）`, "dmg");
        return false;
      }
      t.hp = 0; t.alive = false; t.asleep = false; t.mind = null; t._ailN = null;
      // 立て直しの旗: 実際の戦闘不能にだけ反応する。進行中の一撃/技は解決し、以降の敵の手番を全て除く。
      if (t.side === "party") {
        const p = this._bestPerk("rallyStop"), cap = this._perkValue(p, "rallyStop");
        if (cap && this._enemyStopRound !== this._roundNo && (this._rallyStopUsed || 0) < cap) {
          this._rallyStopUsed = (this._rallyStopUsed || 0) + 1; this._enemyStopRound = this._roundNo;
          this.queue = this.queue.filter(a => a.side !== "enemy");
          this.log(`${p.name}の立て直しの旗！ 敵全体のこのターンの残り行動を打ち切った`, "heal");
          this._proc(p, "立て直しの旗");
        }
      }
      if (t.side === "party" && this.show) this.show.dd++; // 観客の注文 (誰も倒れずに勝て)
      // 狂奔 (狂戦士のランク): 敵か仲間が倒れるたび STR +5% (段数の上限は _recalcBuffs)
      for (const p of this.party) if (p.alive && pv(p, "berserkerKyouhon")) { p._kyouhon = (p._kyouhon || 0) + 1; this._recalcBuffs(p); }
      // 討伐数はこの瞬間に数える (名前・HP の開示が戦闘中でもすぐ反映されるように。「〜を倒した！」より先)
      if (t.side === "enemy" && _onEnemyKilled) { try { _onEnemyKilled(t); } catch (er) { /* 記録の失敗で戦闘を止めない */ } }
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
      // 魂喰らいの闇 (迷宮の掟 soulFeast): 人業を倒した敵は、倒れた魂を喰らって攻撃が上がる
      if (t.side === "party" && this.soulFeast > 0) {
        const k = this._actor || this.current;
        if (k && k.side === "enemy" && k.alive && !k.metal) {
          this._quietMod = true;
          const d = this._applyStage(k, "atk", this.soulFeast, 3, "魂喰らいの闇");
          this._quietMod = false;
          if (d > 0) this.log(`${k.name}の魂喰らい！ ${t.name}を倒して攻撃+${d}段`, "dmg");
        }
      }
      if (t.side === "enemy") this._perkKill(killer); // 固有パッシブ (kill)
      else this._perkFall(t); // 固有パッシブ (fall)
      // 殉教の祈り: 自分が倒れた時、味方全員を PIE で癒す (1戦闘1回)
      if (t.side === "party" && pv(t, "martyr") && !t._martyrUsed) {
        t._martyrUsed = true;
        const heal = Math.max(1, Math.round((t.pie || 1) * 1.0));
        for (const p of this.party) {
          if (!p.alive || p === t) continue;
          p.hp = this._reportHp(t, p, Math.min(p.maxhp, p.hp + heal));
        }
        this.log(`殉教の祈り！ ${t.name}：隊のHP+${heal}`, "heal");
        this._proc(t, "殉教の祈り");
      }
      // 極「送り火の」: 本当に倒れた時 (踏みとどまりの後)、味方全員の HP を最大の20%回復し、状態異常を1つずつ治す
      if (t.side === "party" && bkValue(t,"sendoff")) {
        const k = Math.min(1,bkValue(t,"sendoff"));
        let n = 0;
        for (const p of this.party) {
          if (!p.alive || p === t) continue;
          n++;
          p.hp = this._reportHp(t, p, Math.min(p.maxhp, p.hp + Math.max(1, Math.round(p.maxhp * k))));
          if (p.ailment) { p.ailment = null; p._poisonPct = null; } else if (p.mind) p.mind = null; else if (p.asleep) p.asleep = false;
        }
        if (n) { this.log(`送り火！ ${t.name}：隊のHP+最大の${Math.round(k * 100)}%・状態異常を1つずつ解除`, "heal"); this._proc(t, "送り火"); }
      }
      return true;
    }
    return false;
  }

  _checkEnd() {
    if (this.result) return;
    // ボスの発狂: HPが半分を切ると一度だけ怒り、攻撃力が上がる
    for (const e of this.enemies) {
      if (e.boss && e.alive && !e._enraged && e.hp <= e.maxhp / 2) {
        e._enraged = true;
        this._applyMod(e, "atk", 1.3, ENEMY_BUFF_DUR, "怒り");
        this.log(`${e.name}は激昂（攻撃上昇）`, "dmg");
        this._enrageFx = true; // game.js が演出に使う
      }
    }
    // 敵がいなくなった: 1体でも倒していれば勝利。全員に逃げられたら "escaped" (戦果なし)
    if (this.livingEnemies().length === 0) { this.result = this.enemies.some((e) => !e._fled) ? "win" : "escaped"; return; }
    // 全滅 = 生存者ゼロ、または生存者全員が石化
    const living = this.livingParty();
    if (living.length === 0 || living.every((p) => p.ailment === "stone")) this.result = "lose";
  }

  // 戦闘後の報酬計算。Soul が経験値の役割を兼ねる (魂の成長は館の「魂の強化」で行う)。
  // 旧セーブの戦闘中データは soul を持たないため exp を引き継ぐ
  rewards() {
    const soul = this.enemies.reduce((s, e) => s + (e.alive || e._fled ? 0 : ((e.soul != null ? e.soul : e.exp) || 0) * enemySoulRewardMul(e)), 0);
    const gold = this.enemies.reduce((s, e) => s + (e.alive || e._fled ? 0 : e.gold), 0); // 盗んだ金 (bonusGold) は game.js が別に足す
    return { soul, gold };
  }
}

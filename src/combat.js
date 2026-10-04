// パーティ・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";
import { ITEMS, weaponRange, scaleBonus, useTarget, useHelps, useCureKinds, useWhere } from "./items.js";
import { ELEMENTS, elemDmgMult, elemBeats, monStats, rankStats, resistRate, resistHpMul, RESIST_TAG, METAL_TIERS } from "./dungeons/schema.js";

import { SPELLS } from "./skilldefs.js";
import { JOBKIT_PERKS } from "./jobkit/index.js";
export { SPELLS };

// 敵が使う自己強化 (enemyAct の WARCRY 相当) の既定持続ターン数
export const ENEMY_BUFF_DUR = 3;

// アイテムは個体ごとに複製して持たせる (装備状態を個別管理するため)
export function cloneItem(id) {
  const t = ITEMS[id];
  if (!t) return null;
  return { ...t };
}

let _uid = 0;
// 敵の群れは最大6体 (前衛3+後衛3)
export const MAX_ENEMIES = 6;

// カードでめくったモンスター: 階層が深いほど群れが膨らむ (最大6体)。scale で迷宮ごとの強さ調整。
// 「もう1体」を確率 p で繰り返す幾何分布 — 1階 p≈0.26 (平均1.4体) → 5階以深 p≈0.6 (平均2.4体、まれに6体)。
// opts.min は最低数の強制 (大警報の群れなど)
export function spawnCardEnemies(key, floor, scale = 1, opts = {}) {
  const p = Math.min(0.62, 0.18 + floor * 0.08);
  let count = 1;
  while (count < MAX_ENEMIES && Math.random() < p) count++;
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
    list = Array.from({ length: count }, () => makeEnemy(key, scale));
  }
  // 同種の群れは A/B/C… で呼び分ける (ログ・対象選択の判別用)
  const byKey = {};
  for (const e of list) (byKey[e.key] = byKey[e.key] || []).push(e);
  for (const k in byKey) if (byKey[k].length > 1) byKey[k].forEach((e, i) => { e.name += String.fromCharCode(65 + i); });
  return list;
}

// bossRank: 層基準ランク (1-10)。指定すると、ボスの def の rank ではなく
// この層相応のランクで HP/ATK 等を組み直す (暫定ボスや低ランクボスが弱すぎる問題への対処)。
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
  // (通常 = 上位ランク2体分強 / マスター = 外殻の物理耐性1と合わせて上位ランク3体分以上の耐久と手数)。
  e.maxhp = Math.max(1, Math.round(st.hp * scale * (master ? 2.6 : 2.4) * resistHpMul({ physResist: master ? 1 : 0 })));
  e.hp = e.maxhp;
  e.atk = Math.max(1, Math.round(st.atk * scale * (master ? 1.1 : 1.0)));
  e.vit = Math.round(st.def * scale * (master ? 1.6 : 1.3));
  e.agi = st.spd + (master ? 8 : 4);             // 不意打ちで先手を取りやすい
  e.multistrike = master ? 3 : 2;                // 牙で噛みつき連撃 (一手で複数回)
  e.physResist = master ? 1 : 0;                 // マスターは硬い外殻 (物理耐性1 = 50%軽減)
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
  e.gold = Math.round(st.gold * scale * 1.5);
  e.soul = Math.round(st.soul * scale * 1.5);
  return [e];
}

// 金属の魔物 (メタル系): 稀に紛れ込む、倒せば莫大な✦Soul を残す逃げ足の魔物。強さは段 (METAL_TIERS) と
// 出現した階の雑魚の最上位ランクで決まる。ref = { rank, scale, count, agi, soul, gold } (game.js metalRef)
//   HP は段ごとの小さな固定値 (1ダメージずつ削れる量)。ATK は弱め、VIT は硬め (会心の一撃の通りに効く)。
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
    hp, maxhp: hp,
    // モンスター定義の atk/def/spd を六大ステへ写像 (def→VIT, spd→AGI)
    atk: Math.max(1, Math.round(baseAtk * scale)),
    vit: Math.round(baseDef * scale),
    // 俊敏: AGI を底上げして先手を取りやすくする / 神速: さらに大きく底上げし、1ラウンドに2度動く (_startRound)
    agi: baseSpd + (m.swift ? 4 : 0) + (m.haste ? 8 : 0),
    haste: !!m.haste,
    abRate: m.abRate || 0, // 特殊能力を使う確率 (0 = 既定の 25%・ブレス 30%)。第5層からの魔物は特色を強く押し出すため高い
    soul: Math.round(baseSoul * scale), gold: Math.round(baseGold * scale),
    boss: boss || !!m.boss,
    ability: m.ability || null, // 特殊能力 (毒/麻痺/石化/即死/窃盗/ドレイン/ブレス)
    // 個体特性: 物理被ダメ軽減 / 魔法被ダメ増 / 自己再生 / 回避
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

const rand = (n) => Math.floor(Math.random() * n);
// 揺らぎ。基準値は先に四捨五入する (34.5 → 35)。回復量・ダメージに小数を出さない
const variance = (base) => { const b = Math.round(base); return Math.max(1, b + rand(Math.ceil(b * 0.4)) - rand(Math.ceil(b * 0.2))); };

// 職業ランクパッシブのLvを引く (souls.js の recalcDoll が passiveMap を埋める)
const pv = (a, key) => (a && a.passiveMap && a.passiveMap[key]) || 0;
// 職ごとの固有パッシブ (jobkit の perks)。passiveMap のうち fx を持つものを {c: 成分, lv, label} の列で返す。
// passiveMap は recalcDoll が作り直すたびに別の器になるので、器ごとに覚えておく
const _perkCache = new WeakMap();
const NO_PERKS = [];
function perksOf(a) {
  const pm = a && a.passiveMap;
  if (!pm || typeof pm !== "object") return NO_PERKS;
  let list = _perkCache.get(pm);
  if (list) return list;
  list = [];
  for (const k in pm) {
    const pk = JOBKIT_PERKS[k];
    if (!pk || !pm[k]) continue;
    for (const c of pk.fx) list.push({ c, lv: pm[k], label: pk.label });
  }
  _perkCache.set(pm, list);
  return list;
}
// Lv ごとの値 (配列なら Lv 番目。足りなければ最後) / 単なる数ならそのまま
const lvv = (v, lv) => (Array.isArray(v) ? v[Math.min(Math.max(1, lv), v.length) - 1] : v);
// 技・呪文の消費MPを削る固有パッシブ (cost) の合計 (上限50%)
function perkCostCut(actor, sp) {
  let cut = 0;
  for (const { c, lv } of perksOf(actor)) if (c.t === "cost" && (!c.on || c.on === sp.kind)) cut += lvv(c.v, lv) || 0;
  return Math.min(0.5, cut);
}
// 戦闘に勝った後の固有パッシブ (win): その人が受ける HP/MP 回復の割合 (自分の分 + 味方の party 付きの分)
export function perkVictory(p, party) {
  let hp = 0, mp = 0;
  for (const q of party || [p]) {
    if (!q || !q.alive) continue;
    for (const { c, lv } of perksOf(q)) {
      if (c.t !== "win" || (q !== p && !c.party)) continue;
      hp += lvv(c.hp, lv) || 0; mp += lvv(c.mp, lv) || 0;
    }
  }
  return { hp, mp };
}
// テスト記録用の集計の器 (telemetry.js が読む)。pa/pe/pp = 味方の物理 試行/かわされた/見切られた、
// ea/ee/ep = 敵の物理 同、of/op = 手番で味方が先だった組/総組、ft/fo/fs = 逃走 試行/成功/封じられた、
// fp = 逃走を試みた時の成功率の合計 (×1000。実際の成功数と見比べる)
// 逃走率の式の定数 (Battle.fleeChance)。主のいる戦いは追跡AGI を ×1.3 して逃げにくくする
const FLEE_BASE = 0.55, FLEE_SLOPE = 0.35, FLEE_MIN = 0.05, FLEE_MAX = 0.95, FLEE_BOSS_MUL = 1.3;
// 敵の物理を味方がかわす率 (AGI の相対値): 20% + 20% × log2(味方の実効AGI ÷ (敵の実効AGI × fleeK)) → 0〜40%。
// 敵の AGI は味方よりずっと小さい規模なので、逃走判定と同じ物差し fleeK (基準AGI ÷ 雑魚のAGI中央値) で味方の規模に直す。
// 互角で20%、2倍速ければ上限の40%、半分なら0%。2026-10: 旧式 ((AGI−6)×1.2%、上限40%) は AGI 39 で上限に届き、
// 第3層では隊のほぼ全員が40%かわして敵の命中が4〜6割まで落ちていた (テスト記録)。新式では敵の命中が
// どの層でも8割前後にそろう (模擬戦)。敵がかわす側 (味方 → 敵) は旧式のまま
const EVADE_EVEN = 0.20, EVADE_SLOPE = 0.20, EVADE_MAX = 0.40;
// 心の状態異常 (actor.mind = "charm" 魅了 | "confuse" 混乱)。戦闘の中だけの状態で、戦いが終われば解ける。
//  魅了: 手番ごとに味方へ襲いかかる (仲間がいなければ立ち尽くす)。傷を受けると MIND_CHARM_BREAK で正気に戻る
//  混乱: 手番ごとに敵味方を問わず誰かを殴る / ふらついて何もできない / たまに正気で動ける
//        (仲間がいない独りの時は、相手側の誰かか自分自身を殴る — 自分を殴る分は CONFUSE_SELF_MUL の威力で守りを通さない)
//  どちらも手番の初めに MIND_RECOVER で自然に正気に戻る (主はさらに +MIND_BOSS_RECOVER)。自然に戻った手番は
//  我に返るのが精一杯で動けない。手番までに殴られて解けた (_wake)・術で治った (cureAil) 時はその手番から普通に動ける
const MIND_RECOVER = { charm: 0.30, confuse: 0.35 }, MIND_BOSS_RECOVER = 0.2;
const MIND_CHARM_BREAK = 0.5, CONFUSE_FREE = 0.25, CONFUSE_DAZE = 0.3, CONFUSE_SELF_MUL = 0.5;
// 手番ごとの自然回復 (魅了・混乱・眠り・麻痺) が何手番も続かないための救済: 治らなかった手番ごとに回復率が
// AIL_RAMP ずつ上がり、AIL_SURE 回目の判定で必ず治る (= かかったままの手番は最長 AIL_SURE-1 回)
const AIL_RAMP = 0.15, AIL_SURE = 4;
// 敵の全体呪文 (ability "spell") の名乗り (属性ごと) と、装備のブレス耐性 (breathRes) の上限
const ELEM_SPELL = { fire: "業火", water: "濁流", wind: "嵐", earth: "岩雨", light: "裁きの光", dark: "闇の波動" };
export const BREATH_RES_CAP = 0.5;
// 祈りの呪文 (INT と PIE の高い方で伸びる): 光の攻撃呪文と faith: true の呪文
export function isFaithSpell(sp) { return !!sp && sp.kind === "atk" && (!!sp.faith || sp.element === "light"); }
// ===== 状態異常・即死の成功率はLv差で決まる =====
// 率 = 基礎の率 × 2^((仕掛ける側のLv − 受ける側のLv) ÷ LV_HALF) を 5%〜95% に収める。
// 4Lv 上の相手には半分、8Lv 上なら 1/4 … 格上の強敵を眠り・即死で倒してLvを稼ぐ抜け道を塞ぐ (逆に格上の敵の術は隊によく効く)。
// 味方のLv = 宿した魂のLv (jobLv)、敵のLv = その迷宮・階の基準Lv (game.js が e.lv / opts.foeLv で渡す)。
// 隊の耐性 (異常耐性・装備) は、この率に掛けて差し引く (耐性100% なら効かない)
export const LV_HALF = 4;
export const LV_RATE_MIN = 0.05, LV_RATE_MAX = 0.95;
export function lvRate(base, atkLv, defLv) {
  if (!(base > 0)) return 0;
  const d = (Number(atkLv) || 1) - (Number(defLv) || 1);
  const r = base * Math.pow(2, d / LV_HALF);
  return Math.min(LV_RATE_MAX, Math.max(LV_RATE_MIN, r));
}
// 主 (ボス) に付く確率の倍率。魅了された主は仲間がいないと立ち尽くすだけになるので、毒・麻痺 (×0.5) より効きにくい
const BOSS_CHARM_MUL = 0.35;
// 状態異常の付与を示す札 (結果の hit.status に載せ、game.js が浮かび文字で見せる)
const STATUS_TEXT = { poison: "毒", para: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", seal: "封印", stone: "石化" };
export function statusText(tags) {
  const t = [...new Set((tags || []).map((k) => STATUS_TEXT[k]).filter(Boolean))];
  return t.length ? t.join("・") + "!" : "";
}
// 状態異常の種類 (装備の耐性 ailRes のキー): 毒・麻痺・眠り・魅了・混乱・石化
export const AIL_KINDS = ["poison", "paralyze", "sleep", "charm", "confuse", "stone"];
const newTally = () => ({ pa: 0, pe: 0, pp: 0, ea: 0, ee: 0, ep: 0, of: 0, op: 0, ft: 0, fo: 0, fs: 0, fp: 0 });
// 破邪・聖刃の対象種族
const HOLY_PREY = ["undead", "specter", "demon"];
const VULN_LABEL = { fire: "火", water: "水", wind: "風", earth: "土", light: "光", dark: "闇", all: "全属性" };
const enemyRace = (e) => (e && e.mon && e.mon.race) || null;
// 金属の体を持つ敵か (METAL_TIERS)。呪文・状態異常・弱体を受けず、会心でない物理は1ダメージ
export const isMetal = (t) => !!(t && t.side === "enemy" && t.metal);
const METAL_TAG = { phys: "かたい！", mag: "呪文をはじいた！" };
// 金属の体の回避率 (AGI 由来の回避の代わり)
const metalEvade = (t) => (METAL_TIERS[t.metal] || METAL_TIERS[1]).evade;
// 迷宮のイベント (events.js) の加護: 与ダメ倍率 (_evDmg) と種族特効 (_evPrey)。game.js が戦闘開始時に人業へ付ける
function evDealMul(actor, tgt) {
  let m = actor._evDmg || 1;
  const pr = actor._evPrey;
  if (pr && pr.races && pr.races.includes(enemyRace(tgt))) m *= pr.mul || 1;
  return m;
}
// 属性防御: イベントの加護 (_evEDef) は、装備の属性防御より強いときだけ使う
function edefOf(t) {
  const e = t && t._evEDef;
  if (e && !(t.elemDef && (t.elemDef.lv || 0) >= (e.lv || 1))) return e;
  return t ? t.elemDef : null;
}

// 状態異常を抱えているか (戦闘中の眠り・魅了・混乱も含む)。治療の対象選び・オートの判断に使う
export function ailing(t) { return !!(t && (t.ailment || t.asleep || t.mind)); }
// 状態異常を治す (毒・麻痺・石化 + 眠り・魅了・混乱)。何か治れば true
export function cureAil(t) {
  const had = ailing(t);
  t.ailment = null; t.asleep = false; t.mind = null; t._ailN = null;
  return had;
}
// 指定の種類 (USE_AIL のキー) の状態異常だけを治す (道具)。何か治れば true
export function cureKinds(t, kinds) {
  let had = false;
  if (t.ailment && kinds.includes(t.ailment)) { t.ailment = null; had = true; }
  if (t.asleep && kinds.includes("sleep")) { t.asleep = false; had = true; }
  if (t.mind && kinds.includes(t.mind)) { t.mind = null; had = true; }
  if (had) t._ailN = null;
  return had;
}
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
export function spellMpLabel(sp) { return sp && sp.mpPct ? `MP 最大の${Math.round(sp.mpPct * 100)}%` : `MP${sp ? sp.mp : 0}`; }
export function spellCost(actor, sp) {
  // 探りの術 (mpPct): 唱える者の最大MPの割合を払う (軽減は効かない)
  if (sp.mpPct) return Math.max(1, Math.ceil(((actor && actor.maxmp) || 0) * sp.mpPct));
  let mp = sp.mp;
  const c = pv(actor, "chant");
  if (c) mp = Math.ceil(mp * (c >= 2 ? 0.7 : 0.85));
  if (actor && actor.spellCostMul) mp = Math.ceil(mp * actor.spellCostMul); // 賢者の冠: MP消費を割合カット
  const pc = perkCostCut(actor, sp); // 固有パッシブ (cost)
  if (pc) mp = Math.ceil(mp * (1 - pc));
  // 叡智の奔流 (賢者): 攻撃呪文・回復の消費MPが +10/20/30% (効果も同じだけ上がる ― jobkit/sage.js)
  const sz = pv(actor, "sageZoufuku");
  if (sz && (sp.kind === "atk" || sp.kind === "heal")) mp = Math.ceil(mp * (1 + ([0, 0.10, 0.20, 0.30][Math.min(3, sz)] || 0)));
  return Math.max(1, mp);
}

// 戦闘の状態機械: AGI順に1人ずつ手番が回る。
// 1手ずつ進め、各行動は結果オブジェクトを返す (演出は game.js 側で行う)。
// opts.opening: "preempt" (先制) | "ambush" (奇襲) | null — 最初のラウンドで片側のみ行動
// 敵を倒したその瞬間に呼ぶ合図 (game.js が図鑑の討伐数を記録する)。
// Battle はセーブから復元されるため、関数はインスタンスでなくモジュールに持たせる
let _onEnemyKilled = null;
export function setOnEnemyKilled(fn) { _onEnemyKilled = typeof fn === "function" ? fn : null; }

export class Battle {
  constructor(party, enemies, log, opts = {}) {
    this.party = party;
    this.enemies = enemies;
    this.log = log;
    this.queue = [];          // このラウンドの行動順 (AGI順)
    this.current = null;      // 手番のキャラ
    this.phase = "input";     // input | target | resolve | enemy | done
    this.pending = null;      // 対象選択待ちの行動
    this.result = null;       // "win" | "lose" | "flee"
    this.opening = opts.opening || null;
    this.noFlee = !!opts.noFlee; // 迷宮の異変「閉ざされた退路」: 逃走不可
    this.orderFleet = opts.orderFleet || 0; // 隊の誰かが持つ逃げ足のLv (0-3): 隊全体の逃走率に上乗せ
    // 追跡の物差し: 敵の AGI をこの倍率で味方の AGI と同じ規模に直してから逃走率を出す
    // (game.js の fleeScale = その迷宮・階の基準AGI ÷ その迷宮の雑魚の標準AGI)
    this.fleeK = opts.fleeK || 1;
    this.foeLv = opts.foeLv || 1; // 敵のLv の既定 (個体の e.lv が無い時。戦闘中に呼ばれた手下など)
    this._roundNo = 0;
    this._bigBarrierUsed = 0;
    this.bonusGold = 0; // 「盗む」で手に入れた金 (勝っても逃げても持ち帰る)
    this.tally = newTally(); // テスト記録用の集計 (命中・手番・逃走)。判定には使わない
    for (const a of [...party, ...enemies]) { a.buffs = { atk: 1, vit: 1, agi: 1 }; a.effects = []; a._endureUsed = 0; a._grantEndure = false; a._fgUsed = 0; a._sgUsed = 0; a._ijiUsed = 0; a._hpPre = a.hp; a._nailed = false; a._bloodTgt = null; a._bloodStack = 0; }
    for (const p of party) {
      p._coverLeft = pv(p, "cover");
      p._barrierLeft = pv(p, "barrier");
      p._scriptureUsed = false;
      p._martyrUsed = false;
      p._kenma = false;
      p._ambushCritLeft = this.opening === "preempt" && pv(p, "ambushCrit") ? 1 : 0;
      // LR装飾品の戦闘効果を actor に展開 (member.eff = recalc が集約済み)
      const ef = p.eff || null;
      p.actFirst = !!(ef && ef.actFirst);
      if (ef && ef.multistrike) p.multistrike = Math.max(p.multistrike || 0, ef.multistrike);
      if (ef && ef.lifesteal) p.lifesteal = Math.max(p.lifesteal || 0, ef.lifesteal);
      if (ef && ef.barrier) p._barrierLeft = (p._barrierLeft || 0) + ef.barrier;
      p.guard = (ef && ef.guard) || 0;
      p.spellCostMul = (ef && ef.spellCostMul) || 0;
      p.autoRevive = (ef && ef.autoRevive) || 0;
      p._autoReviveUsed = false;
      p.regen = (ef && ef.regen) || 0;             // 再生の宝珠
      p.counter = (ef && ef.counter) || 0;          // 報復の籠手
      p.ailmentImmune = !!(ef && ef.ailmentImmune); // 解呪の宝珠
      // 眠り・魅了・混乱は戦闘の中だけの状態 (前の戦いから持ち越さない)
      p.asleep = false; p.mind = null;
    }
    for (const e of enemies) if (e.mind === undefined) e.mind = null;
    for (const a of [...party, ...enemies]) a._ailN = null; // 自然回復の救済の数え (戦いごとに数え直す)
    for (const p of party) this._recalcBuffs(p); // 固有パッシブの常時の能力倍率 (stat)
    this._perkStart();
    this._lv15Start();
    this._openingStrikes();
    this.advance();
  }

  // 職の Lv15 の目玉パッシブのうち、戦闘の始まりに隊として一度だけ効くもの (重複不可 = 隊で一番高いLv)
  _lv15Start() {
    const best = (k) => Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, k)));
    const ct = best("crusaderToki"); // 聖戦の鬨: 味方全員の ATK ×1.2/1.5/1.8 (3ターン)
    if (ct) {
      const m = [1, 1.2, 1.5, 1.8][Math.min(3, ct)];
      for (const p of this.livingParty()) this._applyMod(p, "atk", m, 3, "聖戦の鬨");
      this.log(`聖戦の鬨！ 隊の士気が燃え上がる (ATK×${m})`, "heal");
    }
    const ib = best("inqBrand"); // 罪の刻印: 敵全体に弱点の属性を 1/2/3 つ刻む (その属性の被ダメ ×1.5、3ターン)
    if (ib) {
      const els = Object.keys(ELEMENTS).filter((k) => k !== "none");
      for (let i = els.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }
      const pick = els.slice(0, Math.min(3, ib));
      for (const e of this.livingEnemies()) for (const el of pick) this._applyMod(e, "r_" + el, 1 / 1.5, 3, "罪の刻印");
      this.log(`罪の刻印！ 敵の身に ${pick.map((k) => (ELEMENTS[k] && ELEMENTS[k].label) || k).join("・")} の弱みが刻まれた`, "hit");
    }
    const gs = best("hexerGosun"); // 五寸釘: 敵 1/2/3 体の最初の手番を奪う (金属の魔物には打てない)
    if (gs) {
      const foes = this.livingEnemies().filter((e) => !isMetal(e));
      for (let i = foes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [foes[i], foes[j]] = [foes[j], foes[i]]; }
      const nailed = foes.slice(0, Math.min(3, gs));
      for (const e of nailed) e._nailed = true;
      if (nailed.length) this.log(`五寸釘！ ${nailed.map((e) => e.name).join("・")}の影が縫い止められた`, "hit");
    }
  }

  // 戦闘開始時の自動攻撃 (居合/開幕呪撃)。奇襲されている時は発動しない。
  // 与ダメはここで適用しつつ、結果を openingResults に記録し、game.js が斬撃エフェクトで見せる。
  _openingStrikes() {
    this.openingResults = [];
    if (this.opening === "ambush") return;
    for (const p of this.party) {
      if (!p.alive) continue;
      if (pv(p, "iai")) {
        const t = this._randAlive(this.attackableEnemies(p)); // 居合も武器の射程に従う
        if (t) {
          this.log(`${p.name}の居合！`, "hit");
          const hit = this._physical(p, t, { power: 0.8, name: "居合" });
          this.openingResults.push({ side: "party", actor: p, action: "attack", opening: "iai", hits: [hit] });
        }
      }
      if (pv(p, "openSpell")) {
        const t = this._randAlive(this.enemies);
        if (t) {
          const mr = this._resistCut(t, Math.max(1, Math.round(variance((p.int || 1) * 1.2) - this._evit(t) * 0.2)), "magResist");
          if (mr.immune) {
            this.log(`${p.name}の開幕呪撃！ ${t.name}には効かない！ (魔法無効)`, "hit");
            this.openingResults.push({ side: "party", actor: p, action: "spell", spellKind: "atk", spellElement: "none", opening: "openSpell", hits: [{ target: t, dmg: 0, immune: true, died: false }] });
            continue;
          }
          const dmg = mr.dmg;
          t.hp -= dmg;
          this.log(`${p.name}の開幕呪撃！ ${t.name}に ${dmg} ダメージ${mr.tag ? " " + mr.tag : ""}`, "hit");
          this._wake(t);
          const died = this._die(t);
          this.openingResults.push({ side: "party", actor: p, action: "spell", spellKind: "atk", spellElement: "none", opening: "openSpell", hits: [{ target: t, dmg, died }] });
        }
      }
    }
    this._checkEnd();
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
  attackableEnemies(actor) {
    const all = this.livingEnemies();
    const rng = this.attackRange(actor);
    if (rng === "long" || (rng === "mid" && !this.isBackRow(actor))) return all;
    const front = all.filter((e) => !this.isBackRow(e));
    return front.length ? front : all;
  }

  // ---- 強化/弱体 (atk/vit/agi 倍率) の段階・持続管理 ----
  // ターゲットの effects から能力ごとの実効倍率を再計算して buffs に反映する。
  _recalcBuffs(t) {
    const b = { atk: 1, vit: 1, agi: 1 };
    for (const ef of (t.effects || [])) b[ef.stat] = (b[ef.stat] || 1) * ef.mult;
    // 固有パッシブの能力倍率 (stat)。条件付きのものはラウンドの初めに判定し直す
    if (t.side === "party") {
      for (const { c, lv } of perksOf(t)) {
        if (c.t !== "stat" || (c.when && !this._perkWhen(t, c.when, {}))) continue;
        for (const k in c.mul) b[k] = (b[k] || 1) * (1 + (lvv(c.mul[k], lv) || 0));
      }
    }
    // 旧来の上下限 (×3 / ×0.3) を安全側で維持
    for (const k in b) b[k] = Math.max(0.3, Math.min(3, b[k]));
    t.buffs = b;
  }
  // 1つの能力強化/弱体を付与する。同じ能力への同方向(強化 or 弱体)の効果は最大2段階まで。
  // すでに2つ乗っていたら最も古いものを置き換える(=掛け直しで持続を更新できる)。
  _applyMod(t, stat, mult, dur, srcName) {
    if (!t || mult === 1) return;
    if (mult < 1 && isMetal(t)) return; // 金属の体: 弱体は効かない
    t.effects = t.effects || [];
    const up = mult > 1;
    const same = t.effects.filter((e) => e.stat === stat && (e.mult > 1) === up);
    if (same.length >= 2) {
      // 同方向2段階が上限: 最古を取り除いてから新規を積む
      const oldest = same[0];
      t.effects.splice(t.effects.indexOf(oldest), 1);
    }
    t.effects.push({ stat, mult, turns: Math.max(1, dur || 3), src: srcName || "" });
    this._recalcBuffs(t);
  }
  // ラウンド開始時に全員の効果ターンを1減らし、切れたものを除く。
  _tickEffects() {
    for (const a of [...this.party, ...this.enemies]) {
      if (!a.effects || !a.effects.length) continue;
      let changed = false;
      for (const ef of a.effects) { ef.turns--; if (ef.turns <= 0) changed = true; }
      if (changed) { a.effects = a.effects.filter((e) => e.turns > 0); this._recalcBuffs(a); }
    }
  }

  // 能力倍率 (atk/vit/agi 以外の効果: seal/taunt/shield/ctr/charge/regen/hit/int/r_<属性>) を読む
  _bm(t, k) { return (t && t.buffs && t.buffs[k]) || 1; }

  // ---- 職ごとの固有パッシブ (jobkit の perks。成分の意味は jobkit/index.js 冒頭) ----
  // 条件 when を満たすか。a = 持ち主、ctx.tgt = 与える時は攻撃先・受ける時は攻撃してきた敵、ctx.el = 攻撃の属性
  _perkWhen(a, w, ctx) {
    const t = ctx.tgt || null;
    const frac = (x) => (x && x.maxhp ? x.hp / x.maxhp : 1);
    if (w.race && !(t && w.race.includes(enemyRace(t)))) return false;
    if (w.tgtElem && !(t && t.element === w.tgtElem)) return false;
    if (w.tgtAil && !(t && (t.ailment || t.asleep || t.mind || t._flinch))) return false;
    if (w.tgtDebuffed && !(t && (t.effects || []).some((e) => e.mult < 1))) return false;
    if (w.tgtLow != null && !(t && frac(t) <= w.tgtLow)) return false;
    if (w.tgtHigh != null && !(t && frac(t) >= w.tgtHigh)) return false;
    if (w.boss && !(t && t.boss)) return false;
    if (w.noBoss && t && t.boss) return false;
    if (w.selfLow != null && frac(a) > w.selfLow) return false;
    if (w.selfHigh != null && frac(a) < w.selfHigh) return false;
    if (w.selfAil && !ailing(a)) return false;
    if (w.buffed && !(a.effects || []).some((e) => e.mult > 1 && ["atk", "vit", "agi", "int"].includes(e.stat))) return false;
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
    if (w.tgtWeak && !(t && ctx.el && ctx.el !== "none" && t.element && elemBeats(ctx.el, t.element))) return false;
    return true;
  }
  // 与ダメ・被ダメ・会心・回避などの値の合計 (自分の分 + 生きている味方の aura 付きの分)。ctx.on = その攻撃の種類の札の配列
  _perkSum(a, type, ctx = {}) {
    if (!a || a.side !== "party") return 0;
    let sum = 0;
    for (const p of this.party) {
      if (p !== a && !p.alive) continue;
      for (const { c, lv } of perksOf(p)) {
        if (c.t !== type || (p !== a && !c.aura)) continue;
        if (c.on && !(ctx.on || []).includes(c.on)) continue;
        if (c.when && !this._perkWhen(a, c.when, ctx)) continue;
        sum += lvv(c.v, lv) || 0;
      }
    }
    return sum;
  }
  // 発動の判定 (chance が無ければ必ず)
  _perkRoll(c, lv) { return c.chance == null || Math.random() < (lvv(c.chance, lv) || 0); }
  // 強化をまとめて掛ける ({atk: 1.2} の倍率。Lv ごとの配列可)
  _perkBuff(t, buff, lv, dur, label) {
    for (const k in buff) this._applyMod(t, k, lvv(buff[k], lv), dur || 3, label);
  }
  _perkHeal(t, pct, label) {
    if (!pct || !t.alive || t.hp >= t.maxhp) return 0;
    const h = Math.max(1, Math.round(t.maxhp * pct));
    t.hp = Math.min(t.maxhp, t.hp + h);
    return h;
  }
  _perkMp(t, pct) {
    if (!pct || !t.alive || !t.maxmp || t.mp >= t.maxmp) return 0;
    const g = Math.max(1, Math.round(t.maxmp * pct));
    t.mp = Math.min(t.maxmp, t.mp + g);
    return g;
  }
  // 戦闘開始時 (start)
  _perkStart() {
    for (const p of this.party) {
      if (!p.alive) continue;
      for (const { c, lv, label } of perksOf(p)) {
        if (c.t !== "start" || !this._perkRoll(c, lv) || (c.when && !this._perkWhen(p, c.when, {}))) continue;
        const tg = c.party ? this.livingParty() : [p];
        for (const t of tg) {
          if (c.buff) this._perkBuff(t, c.buff, lv, c.dur, label);
          if (c.barrier) t._barrierLeft = (t._barrierLeft || 0) + (lvv(c.barrier, lv) || 0);
          if (c.regen) this._applyMod(t, "regen", 1 + (lvv(c.regen, lv) || 0), c.dur || 3, label);
          if (c.mp) this._perkMp(t, lvv(c.mp, lv));
          if (c.endure) t._grantEndure = true;
          if (c.charge) this._applyMod(t, "charge", lvv(c.charge, lv), c.dur || 3, label);
        }
        if (c.taunt) this._applyMod(p, "taunt", 3, c.dur || 2, label);
        if (c.foe) for (const e of this.livingEnemies()) this._perkBuff(e, c.foe, lv, c.dur, label);
        this.log(`${p.name}の${label}！`, "heal");
      }
    }
  }
  // 2ラウンド目以降の毎ラウンド初め (round)
  _perkRound() {
    for (const p of this.party) {
      if (!p.alive) continue;
      for (const { c, lv, label } of perksOf(p)) {
        if (c.t !== "round" || (c.when && !this._perkWhen(p, c.when, {})) || !this._perkRoll(c, lv)) continue;
        let healed = 0;
        for (const t of (c.party ? this.livingParty() : [p])) {
          healed += this._perkHeal(t, lvv(c.hp, lv)) + this._perkMp(t, lvv(c.mp, lv));
          if (c.buff) this._perkBuff(t, c.buff, lv, c.dur || 2, label);
        }
        if (healed || c.buff) this.log(`${p.name}の${label}`, "heal");
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
      if (h || m || c.buff) this.log(`${label}！ ${killer.name}${h ? ` HP+${h}` : ""}${m ? ` MP+${m}` : ""}`, "heal");
    }
  }
  // 敵の攻撃を受けた時 (hurt)。kind = "phys" | "breath"
  _perkHurt(t, attacker, dmg, kind) {
    if (!t || t.side !== "party" || !t.alive || !(dmg > 0)) return;
    for (const { c, lv, label } of perksOf(t)) {
      if (c.t !== "hurt" || (c.on || "phys") !== kind || !this._perkRoll(c, lv)) continue;
      if (c.buff) this._perkBuff(t, c.buff, lv, c.dur || 2, label);
      const h = this._perkHeal(t, lvv(c.hp, lv)), m = this._perkMp(t, lvv(c.mp, lv));
      if (c.buff || h || m) this.log(`${t.name}の${label}${h ? ` HP+${h}` : ""}${m ? ` MP+${m}` : ""}`, "heal");
      if (c.thorns && attacker && attacker.alive && attacker.side === "enemy") {
        const back = isMetal(attacker) ? 1 : Math.max(1, Math.round(dmg * (lvv(c.thorns, lv) || 0)));
        attacker.hp -= back;
        this.log(`${label}！ ${attacker.name}に ${back} ダメージ`, "hit");
        this._die(attacker);
      }
    }
  }
  // 自分の物理が敵に当たった時 (hit): 確率で状態異常・弱体を付ける。付いた札を返す
  _perkHit(actor, tgt, tags, on) {
    if (actor.side !== "party" || !tgt || tgt.side !== "enemy" || !tgt.alive || isMetal(tgt)) return;
    for (const { c, lv, label } of perksOf(actor)) {
      if (c.t !== "hit" || (c.on && !on.includes(c.on)) || !this._perkRoll(c, lv)) continue;
      const a = c.ail;
      if (a === "atk" || a === "vit" || a === "agi") { this._applyMod(tgt, a, lvv(c.mul, lv) || 0.85, 3, label); this.log(`${label}！ ${tgt.name}の力が削がれた`, "hit"); continue; }
      const sp = { name: label, dur: 3, quiet: true };
      if (a === "poison") sp.poison = { chance: 1, pct: lvv(c.pct, lv) || 0.05 };
      else if (a === "para") sp.para = 1;
      else if (a === "sleep") sp.sleepChance = 1;
      else if (a === "confuse") sp.confuse = 1;
      else if (a === "charm") sp.charm = 1;
      else if (a === "seal") sp.seal = { chance: 1, turns: c.turns || 2 };
      else if (a === "flinch") sp.flinchChance = 1;
      else if (a === "strip") sp.strip = true;
      else if (a === "vuln") sp.vuln = { [c.el || "all"]: lvv(c.mul, lv) || 0.85 };
      this._inflict(actor, tgt, sp, tags);
    }
  }
  // 技・呪文を使った後 (cast)
  _perkCast(actor, sp, cost) {
    if (!actor || actor.side !== "party" || !actor.alive) return;
    for (const { c, lv, label } of perksOf(actor)) {
      if (c.t !== "cast" || (c.on && c.on !== sp.kind) || !this._perkRoll(c, lv)) continue;
      let note = "";
      if (c.refund && cost > 0) { actor.mp = Math.min(actor.maxmp || 0, actor.mp + cost); note += ` MP${cost}が戻った`; }
      let healed = 0;
      for (const t of (c.party ? this.livingParty() : [actor])) healed += this._perkHeal(t, lvv(c.hp, lv)) + this._perkMp(t, lvv(c.mp, lv));
      if (note || healed) this.log(`${label}！${note}`, "heal");
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
        this.log(`${p.name}の${label}！${h ? ` HP+${h}` : ""}`, "heal");
      }
    }
  }
  // 属性耐性ダウン: その属性の被ダメ倍率 (r_fire 0.7 → ×1.43)。r_all は全属性に効く
  _vulnMul(t, el) {
    if (!el || el === "none") return 1;
    return 1 / (this._bm(t, "r_" + el) * this._bm(t, "r_all"));
  }
  // 強化 (倍率>1) を打ち消す
  _stripUp(t) {
    if (!t.effects || !t.effects.some((e) => e.mult > 1)) return false;
    t.effects = t.effects.filter((e) => !(e.mult > 1));
    this._recalcBuffs(t);
    return true;
  }
  // 弱体 (倍率<1) を解く
  _purgeDown(t) {
    if (!t.effects || !t.effects.some((e) => e.mult < 1)) return false;
    t.effects = t.effects.filter((e) => !(e.mult < 1));
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
  // Lv差を織り込んだ成功率 (5〜95%)。actor が無い時 (持続効果など) は隊の平均Lvで見る
  _rate(actor, t, base) {
    let al = actor ? this.lvOf(actor) : null;
    if (al == null) { const ps = this.party.filter((p) => p.alive); al = ps.length ? ps.reduce((a, p) => a + this.lvOf(p), 0) / ps.length : 1; }
    return lvRate(base, al, this.lvOf(t));
  }
  // 命中した敵へ付く効果 (物理技・攻撃呪文・弱体の共通): 毒/麻痺/封印/属性耐性ダウン/打ち消し/眠り/怯み/即死。
  // 毒・麻痺・封印・眠り・魅了・混乱・即死の成功率は Lv差で決まる (lvRate)
  // 主 (ボス) には状態異常・封印の確率が半分。即死は主に効かず、強敵には半分
  _inflict(actor, t, sp, out) {
    if (!t || !t.alive || t.side !== "enemy") return;
    if (isMetal(t)) return; // 金属の体: 毒・麻痺・眠り・魅了・混乱・封印・即死・耐性ダウン・打ち消しのどれも効かない
    const bossMul = t.boss ? 0.5 : 1;
    const tags = out || [];
    if (sp.strip && this._stripUp(t)) { this.log(`${t.name}の強化が消え去った！`, "hit"); tags.push("strip"); }
    if (sp.vuln) {
      for (const el in sp.vuln) this._applyMod(t, "r_" + el, sp.vuln[el], sp.dur, sp.name);
      tags.push("vuln");
    }
    if (sp.poison && Math.random() < this._rate(actor, t, sp.poison.chance * bossMul)) {
      if (!t.ailment || (t.ailment === "poison" && (t._poisonPct || 0.05) < sp.poison.pct)) {
        const up = t.ailment === "poison";
        t.ailment = "poison"; t._poisonPct = sp.poison.pct;
        this.log(up ? `${t.name}の毒が強まった！` : `${t.name}は毒に侵された！`, "hit");
        tags.push("poison");
      }
    }
    if (sp.para && !t.ailment && Math.random() < this._rate(actor, t, sp.para * bossMul)) {
      t.ailment = "paralyze";
      this.log(`${t.name}は痺れて動きが鈍った！`, "hit");
      tags.push("para");
    }
    if (sp.seal) {
      if (Math.random() < this._rate(actor, t, sp.seal.chance * bossMul)) {
        this._applyMod(t, "seal", 0.5, sp.seal.turns || 3, sp.name);
        this.log(`${t.name}の特技を封じた！`, "hit");
        tags.push("seal");
      } else this.log(`${t.name}は封印を振り払った`, "sys");
    }
    if (sp.sleepChance && !t.asleep && Math.random() < this._rate(actor, t, sp.sleepChance * bossMul)) {
      t.asleep = true;
      this.log(`${t.name}は深い眠りに落ちた`, "sys");
      tags.push("sleep");
    }
    // 魅了・混乱 (心の状態異常は1つだけ。先にかかった方が残る)
    if (sp.charm && !t.mind) {
      if (Math.random() < this._rate(actor, t, sp.charm * (t.boss ? BOSS_CHARM_MUL : 1))) {
        t.mind = "charm";
        this.log(`${t.name}は魅了された！ 仲間に襲いかかる…`, "hit");
        tags.push("charm");
      } else if (!sp.confuse && !sp.quiet) this.log(`${t.name}は誘いに乗らなかった`, "sys");
    }
    if (sp.confuse && !t.mind) {
      if (Math.random() < this._rate(actor, t, sp.confuse * bossMul)) {
        t.mind = "confuse";
        this.log(`${t.name}は混乱した！`, "hit");
        tags.push("confuse");
      } else if (!sp.quiet) this.log(`${t.name}は惑わされなかった`, "sys");
    }
    if (sp.flinchChance && !t.boss && !t._flinch && Math.random() < sp.flinchChance) {
      t._flinch = true;
      this.log(`${t.name}は怯んだ！`, "hit");
    }
    if (sp.instakill) {
      const ik = sp.instakill;
      const race = enemyRace(t);
      if (t.boss) this.log(`${t.name}に死の力は届かない`, "sys");
      else if (ik.races && !ik.races.includes(race)) this.log(`${t.name}には効かない`, "sys");
      else if (Math.random() < this._rate(actor, t, ik.chance * (t.mon && t.mon.elite ? 0.5 : 1))) {
        t.hp = 0;
        this.log(`${t.name}の命の灯が消えた！`, "hit");
        tags.push("instakill");
        return this._die(t);
      } else this.log(`${t.name}は死を免れた`, "sys");
    }
    return false;
  }

  // AGI(+乱数)で行動順を組み直す。ラウンド開始時に毒のダメージが入る。
  // 第1ラウンドは先制/奇襲なら片側のみが行動する
  _startRound() {
    this._roundNo++;
    if (this._roundNo > 1) this._tickEffects(); // 2ラウンド目以降、強化/弱体の持続を消化
    for (const p of this.party) this._recalcBuffs(p); // 固有パッシブの条件付きの能力倍率を判定し直す
    for (const a of [...this.party, ...this.enemies]) {
      if (!a.alive || a.ailment !== "poison") continue;
      // 毒の強さは付けた技しだい (既定5%)。主には半分 (5%以下はそのまま)
      let pct = a._poisonPct || 0.05;
      if (a.boss && pct > 0.05) pct = Math.max(0.05, pct * 0.5);
      const d = Math.max(1, Math.round(a.maxhp * pct));
      a.hp -= d;
      this.log(`${a.name}は毒に蝕まれた (${d})`, "dmg");
      this._die(a);
    }
    // 再生: 2ラウンド目以降、傷ついた再生持ちの敵が少しずつ回復する
    if (this._roundNo > 1) {
      for (const e of this.livingEnemies()) {
        if (!e.regen || e.hp >= e.maxhp) continue;
        const h = Math.max(1, Math.round(e.maxhp * e.regen));
        e.hp = Math.min(e.maxhp, e.hp + h);
        this.log(`${e.name}の傷がふさがっていく (${h})`, "sys");
      }
    }
    // 再生の宝珠 (party regen): 2ラウンド目以降、傷ついた味方が最大HPの割合だけ回復する (LR装飾品)
    if (this._roundNo > 1) {
      for (const p of this.livingParty()) {
        if (!p.regen || p.hp >= p.maxhp) continue;
        const h = Math.max(1, Math.round(p.maxhp * p.regen));
        p.hp = Math.min(p.maxhp, p.hp + h);
        this.log(`${p.name}の傷が再生していく (${h})`, "heal");
      }
    }
    // リジェネ (技の効果): 2ラウンド目以降、最大HPの割合だけ回復する
    if (this._roundNo > 1) {
      for (const p of this.livingParty()) {
        const rg = this._bm(p, "regen");
        if (rg <= 1 || p.hp >= p.maxhp) continue;
        const h = Math.max(1, Math.round(p.maxhp * (rg - 1)));
        p.hp = Math.min(p.maxhp, p.hp + h);
        this.log(`${p.name}の傷が癒えていく (${h})`, "heal");
      }
    }
    if (this._roundNo > 1) this._perkRound(); // 固有パッシブ (round)
    // 激昂: HPが3割を切った敵が一度だけ荒れ狂い、ATK/AGI が跳ね上がる
    for (const e of this.livingEnemies()) {
      if (!e.enrage || e._enraged || !e.maxhp || e.hp > e.maxhp * 0.3) continue;
      e._enraged = true;
      this._applyMod(e, "atk", 1.5, 99, "激昂");
      this._applyMod(e, "agi", 1.3, 99, "激昂");
      this.log(`${e.name}は激昂した！`, "dmg");
    }
    this._checkEnd();
    let pool = [...this.party, ...this.enemies];
    if (this._roundNo === 1 && this.opening === "preempt") pool = [...this.party];
    else if (this._roundNo === 1 && this.opening === "ambush") pool = [...this.enemies];
    const eagi = (a) => (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1);
    this.queue = pool
      .filter((a) => a.alive)
      // 加速装置 (actFirst) は必ず手番の最初に行動する。同士の中では AGI 順
      .sort((a, b) => ((b.actFirst ? 1 : 0) - (a.actFirst ? 1 : 0)) || ((b.haste ? 1 : 0) - (a.haste ? 1 : 0)) || ((eagi(b) + rand(4)) - (eagi(a) + rand(4))));
    // 神速 (haste): 目にも止まらぬ速さの敵は、ラウンドの頭 (加速装置の次) に動き、後半にもう一度動く
    for (const e of this.queue.filter((a) => a.haste && a.side === "enemy")) {
      const from = Math.max(this.queue.indexOf(e) + 1, Math.ceil(this.queue.length / 2));
      this.queue.splice(from + rand(this.queue.length - from + 1), 0, e);
    }
    // テスト記録: 味方と敵の組のうち、味方が先に動く組の数 (先制・奇襲の1ラウンド目は片側だけなので数えない)
    const T = this._tally();
    let seenP = 0;
    for (const a of this.queue) {
      if (a.side === "party") seenP++;
      else { T.of += seenP; }
    }
    const np = this.queue.filter((a) => a.side === "party").length;
    T.op += np * (this.queue.length - np);
  }

  // 逃走率 (5%〜95%)。逃走を選んだ者の実効AGI と、生存する敵の「追跡AGI」の平均の比で決まる:
  //   55% + 35% × log2(本人のAGI ÷ 追跡AGI) + 逃げ足 → 5%〜95% に収める
  //   追跡AGI = 敵の実効AGI の平均 × fleeK (主がいれば ×FLEE_BOSS_MUL)。互角で55%、本人が2倍速ければ90%、半分なら20%
  //   実効AGI はバフ/デバフ込み (水技の鈍足・影縫い・激昂・先駆けの号令が効く)
  fleeChance(actor) {
    if (this.noFlee) return 0;
    const foes = this.livingEnemies();
    if (!foes.length) return FLEE_MAX;
    const agiOf = (a) => Math.max(1, (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1));
    let chase = (foes.reduce((s, e) => s + agiOf(e), 0) / foes.length) * (this.fleeK || 1);
    if (foes.some((e) => e.boss)) chase *= FLEE_BOSS_MUL;
    // 逃げ足 (fleetFoot): 個人の習得は+30%、隊の誰かの Lv に応じ +30/45/60%。高い方を採用
    const fleetSelf = this.party.some((p) => p.alive && pv(p, "fleetFoot")) ? 0.30 : 0;
    const fleetOrder = this.orderFleet >= 3 ? 0.60 : this.orderFleet >= 2 ? 0.45 : this.orderFleet >= 1 ? 0.30 : 0;
    const p = FLEE_BASE + FLEE_SLOPE * Math.log2(agiOf(actor) / chase) + Math.max(fleetSelf, fleetOrder);
    return Math.min(FLEE_MAX, Math.max(FLEE_MIN, p));
  }

  // AGI による回避の素の率。敵 → 味方の物理は相対値 (EVADE_*)、それ以外 (味方 → 敵・同士討ち) は旧来の
  // 「対象の AGI − 6」× 1.2% (上限40%)。実効AGI はバフ/デバフ込み
  _evadeBase(tgt, actor) {
    const agiOf = (a) => Math.max(1, (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1));
    if (tgt.side === "party" && actor && actor.side === "enemy") {
      const p = EVADE_EVEN + EVADE_SLOPE * Math.log2(agiOf(tgt) / (agiOf(actor) * (this.fleeK || 1)));
      return Math.min(EVADE_MAX, Math.max(0, p));
    }
    return Math.min(0.4, Math.max(0, ((tgt.agi || 6) - 6) * 0.012));
  }

  // テスト記録の集計 (中断セーブから戻った古い戦闘にも器を用意する)
  _tally() { return this.tally || (this.tally = newTally()); }

  // 次の手番へ。味方なら input (行動不能なら stunned)、敵なら enemy フェーズで止まる
  advance() {
    if (this.result) { this.phase = "done"; return; }
    while (true) {
      if (this.queue.length === 0) this._startRound();
      if (this.result) { this.phase = "done"; return; }
      const actor = this.queue.shift();
      if (!actor || !actor.alive) continue;
      this.current = actor;
      for (const p of this.party) p._hpPre = p.hp; // 勇者の意地: この手番の初めの HP を覚える
      if (actor.side === "party") {
        if (actor.asleep || actor.ailment === "paralyze" || actor.ailment === "stone") { this.phase = "stunned"; return; }
        actor._defending = false; // 防御は次の自分の手番まで
        // 魅了・混乱: 正気に戻れなければ勝手に動き (stunnedAct → _mindAct)、自然に戻ったらこの手番は動けない
        if (actor.mind && this._mindCheck(actor) !== "free") { this.phase = "stunned"; return; }
        this.phase = "input";
      } else {
        this.phase = "enemy";
      }
      return;
    }
  }

  // 行動不能の味方の手番 (睡眠/麻痺/石化)。麻痺・睡眠は毎ターン回復判定がある
  stunnedAct() {
    const a = this.current;
    // 魅了・混乱で勝手に動く手番 (眠り・麻痺・石化が先に効く)
    if (a.mind && !a.asleep && a.ailment !== "paralyze" && a.ailment !== "stone") return this._mindAct(a);
    const res = { actor: a, action: "stunned", side: a.side, hits: [] };
    if (a.ailment === "stone") this.log(`${a.name}は石化して動けない…`, "sys");
    else if (a.ailment === "paralyze") {
      if (this._naturalRecover(a, "para", 0.35)) { a.ailment = null; this.log(`${a.name}の麻痺が解けた！`, "heal"); }
      else this.log(`${a.name}は痺れて動けない…`, "sys");
    } else if (a.asleep) {
      if (this._naturalRecover(a, "sleep", 0.45)) { a.asleep = false; this.log(`${a.name}は目を覚ました`, "sys"); }
      else this.log(`${a.name}は眠っている…`, "sys");
    }
    this._checkEnd();
    return res;
  }

  // 手番の初めの自然回復の判定 (key = mind/sleep/para)。治らなかった手番ごとに AIL_RAMP ずつ治りやすくなり、
  // AIL_SURE 回目で必ず治る。治ったら数えを戻す
  _naturalRecover(actor, key, base) {
    const n = (actor._ailN || (actor._ailN = {}))[key] || 0;
    if (n + 1 >= AIL_SURE || Math.random() < base + AIL_RAMP * n) { actor._ailN[key] = 0; return true; }
    actor._ailN[key] = n + 1;
    return false;
  }
  // 魅了・混乱の手番の初め: 正気に戻れたか / 混乱していても動けるか。
  // "free" = いつも通り動ける / "auto" = 勝手に動く / "lost" = 自然に正気に戻ったが、この手番は動けない
  _mindCheck(actor) {
    const kind = actor.mind;
    if (!kind) return "free";
    const rec = (MIND_RECOVER[kind] || 0.3) + (actor.boss ? MIND_BOSS_RECOVER : 0);
    if (this._naturalRecover(actor, "mind", rec)) {
      actor.mind = null;
      this.log(`${actor.name}は正気に戻った！ …が、我に返るのが精一杯だ`, actor.side === "party" ? "heal" : "sys");
      return "lost";
    }
    if (kind === "confuse" && Math.random() < CONFUSE_FREE) {
      this.log(`${actor.name}は混乱しているが、どうにか動けそうだ`, "sys");
      return "free";
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
      if (!tgt) { this.log(`${actor.name}は魅了されている…`, "sys"); this._checkEnd(); return res; }
      this.log(`${actor.name}は魅了されている！ ${tgt.name}に襲いかかった！`, actor.side === "party" ? "dmg" : "hit");
    } else {
      if (Math.random() < CONFUSE_DAZE) { this.log(`${actor.name}は混乱してふらついている…`, "sys"); this._checkEnd(); return res; }
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
      this.log(`${actor.name}は混乱している！ ${tgt.name}に殴りかかった！`, "sys");
    }
    res.action = "attack";
    res.hits.push(this._physical(actor, tgt, { name: "攻撃" }));
    this._checkEnd();
    return res;
  }
  // 混乱して自分を殴る (見切り・回避・守りは効かない)
  _selfHit(actor) {
    const dmg = Math.max(1, Math.round(variance(this._eatk(actor)) * CONFUSE_SELF_MUL));
    actor.hp -= dmg;
    this.log(`${actor.name}は混乱している！ 自分を殴りつけた！ ${dmg} ダメージ`, actor.side === "party" ? "dmg" : "hit");
    const died = this._die(actor);
    return { target: actor, dmg, died };
  }
  // 行動できない (眠り・麻痺・石化) か、心を奪われている (魅了・混乱) — かばう・仁王立ち・反撃ができない
  _incap(p) { return !!(p.asleep || p.ailment === "paralyze" || p.ailment === "stone" || p.mind); }
  // 傷を受けた者の目覚め: 眠りは必ず覚め、魅了は MIND_CHARM_BREAK で正気に戻る (混乱は殴られても解けない)
  _wake(t) {
    if (!t || !t.alive) return;
    if (t.asleep) { t.asleep = false; if (t._ailN) t._ailN.sleep = 0; }
    if (t.mind === "charm" && Math.random() < MIND_CHARM_BREAK) {
      t.mind = null;
      if (t._ailN) t._ailN.mind = 0;
      this.log(`${t.name}は痛みで正気に戻った！`, t.side === "party" ? "heal" : "sys");
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
        this.log("効果のある対象がいない。", "sys"); this.pending = null; return { invalid: true };
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
      if (actor.mp < spellCost(actor, sp)) { this.log("MPが足りない！", "sys"); return { invalid: true }; }
      this.pending = { actor, action: "spell", spellKey };
      // 単体味方呪文で効果のある対象がいない場合は唱えさせない (満タンへの回復など)
      if (sp.target === "ally" && this._allyTargets(sp).length === 0) {
        this.log("効果のある対象がいない。", "sys"); this.pending = null; return { invalid: true };
      }
      if (sp.target === "all-enemy" || sp.target === "all-ally" || sp.target === "self") { this.phase = "resolve"; return { needTarget: false }; }
      this.phase = "target";
      return { needTarget: true };
    }
    if (action === "defend" || action === "run") {
      this.pending = { actor, action };
      this.phase = "resolve";
      return { needTarget: false };
    }
    return { invalid: true };
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
    const heals = sp.kind === "heal" && (sp.power || 0) > 0;
    const revives = !!sp.revive;
    const cures = sp.kind === "cure" || !!sp.cure;
    const otherBenefit = !!(sp.buff || sp.grantEndure || sp.grantBarrier || sp.regen); // 満タンでも有効な効果
    if (sp.kind === "mana") return this.party.filter((t) => t.alive && (t.maxmp || 0) > 0 && t.mp < t.maxmp);
    if (sp.kind === "cure" && sp.purge) return this.party.filter((t) => t.alive && (ailing(t) || (t.effects || []).some((e) => e.mult < 1)));
    return this.party.filter((t) => {
      if (!t.alive) return revives;            // 死者は蘇生呪文のみ
      if (otherBenefit) return true;
      if (heals && t.hp < t.maxhp) return true;
      if (cures && ailing(t)) return true;
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
    return res;
  }
  // 死者の軍勢 (死霊術師): 自分の手番の終わりに、ランダムな敵へ INT×0.5 の固定ダメージを 1/2/3 回 (金属の魔物には効かない)
  _necroLegion(a, res) {
    const lv = a.alive ? pv(a, "necroLegion") : 0;
    if (!lv) return;
    let any = false;
    for (let i = 0; i < Math.min(3, lv); i++) {
      const t = this._randAlive(this.livingEnemies().filter((e) => !isMetal(e)));
      if (!t) break;
      const dmg = Math.max(1, Math.round((a.int || 0) * 0.5));
      if (!any) { this.log(`${a.name}の呼ぶ死者の軍勢が襲いかかる！`, "hit"); any = true; }
      t.hp -= dmg;
      this.log(`${t.name}に ${dmg} ダメージ`, "dmg");
      this._wake(t);
      res.hits.push({ target: t, dmg, died: this._die(t) });
    }
    this._checkEnd();
  }

  // 敵の手番を実行し結果を返す。特殊能力 (ability) 持ちは一定確率で使う
  enemyAct() {
    const actor = this.current;
    let cmd;
    if (actor._nailed) {
      // 五寸釘 (呪術師): 最初の手番を失う
      actor._nailed = false;
      this.log(`${actor.name}は五寸釘に縫い止められて動けない！`, "sys");
      const res = { actor, action: "stunned", side: actor.side, hits: [] };
      this._checkEnd();
      return res;
    }
    if (actor._flinch) {
      // 怯み: この手番を失う
      actor._flinch = false;
      this.log(`${actor.name}は怯んで動けない！`, "sys");
      const res = { actor, action: "stunned", side: actor.side, hits: [] };
      this._checkEnd();
      return res;
    }
    // 麻痺: 35%で解ける。解けなければ 60%で手番を失う
    if (actor.ailment === "paralyze") {
      if (this._naturalRecover(actor, "para", 0.35)) { actor.ailment = null; this.log(`${actor.name}の痺れが解けた`, "sys"); }
      else if (Math.random() < 0.6) {
        this.log(`${actor.name}は痺れて動けない！`, "sys");
        const res = { actor, action: "stunned", side: actor.side, hits: [] };
        this._checkEnd();
        return res;
      }
    }
    // 魅了・混乱: 正気に戻れなければ、仲間を襲う・誰かれ構わず殴る・ふらつく。自然に戻ったらこの手番は動けない
    if (actor.mind && !actor.asleep) {
      const m = this._mindCheck(actor);
      if (m === "auto") return this._mindAct(actor);
      if (m === "lost") {
        const res = { actor, action: "stunned", side: actor.side, hits: [] };
        this._checkEnd();
        return res;
      }
    }
    // 金属の体: 自分の手番に、段ごとの確率で逃げ出す (倒されずに去った個体は戦果を残さない)
    if (actor.metal && !actor.asleep && Math.random() < (METAL_TIERS[actor.metal] || METAL_TIERS[1]).flee) return this._enemyFlee(actor);
    // 特技封じ: 役割 (回復・呼び出し) と特殊能力 (ブレス・状態異常など) を使えず、通常攻撃だけになる
    const sealed = this._bm(actor, "seal") < 1;
    if (actor.asleep) {
      cmd = { actor, action: "sleep" };
    } else if (sealed) {
      cmd = { actor, action: "attack", target: this._pickPartyTarget() };
    } else {
      // 役割持ちの行動 (通常攻撃より優先): 回復役は傷ついた仲間を癒し、呼び手は仲間を呼ぶ
      if (actor.role === "healer") {
        const t = this._woundedAlly(actor);
        if (t && Math.random() < 0.70) cmd = { actor, action: "eheal", target: t };
      } else if (actor.role === "summoner") {
        if (this.livingEnemies().length < MAX_ENEMIES && Math.random() < 0.50) cmd = { actor, action: "summon" };
      }
      if (!cmd) {
        const ab = actor.ability;
        // ブレス・全体呪文はどちらも隊全体への攻撃 (action "breath"。kind で吐息か呪文かを分ける)
        const wide = ab === "breath" || ab === "spell";
        if (ab && Math.random() < (actor.abRate || (wide ? 0.30 : 0.25))) {
          cmd = { actor, action: wide ? "breath" : "special", kind: ab, target: this._pickPartyTarget() };
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
    this.log(`${actor.name}は逃げ出した！`, "sys");
    const res = { actor, action: "eflee", side: actor.side, hits: [] };
    this._checkEnd();
    return res;
  }

  _randAlive(list) {
    const a = list.filter((x) => x.alive);
    return a[rand(a.length)] || null;
  }

  // 回復役の標的: 最もHP割合の低い負傷した仲間 (HP65%未満)
  _woundedAlly(actor) {
    let best = null;
    for (const e of this.livingEnemies()) {
      if (e.hp >= e.maxhp * 0.65) continue;
      if (!best || e.hp / e.maxhp < best.hp / best.maxhp) best = e;
    }
    return best;
  }

  // 護り手 (guard): 仲間への物理攻撃を一定確率で肩代わりする (回数制)。
  // 護り手を先に倒すか、呪文 (肩代わり不可) で本命を狙うのが対策になる
  _enemyGuardFor(tgt) {
    if (tgt.role === "guard") return null;
    for (const e of this.livingEnemies()) {
      if (e === tgt || e.role !== "guard" || !(e._guardLeft > 0)) continue;
      if (e.asleep || e._flinch || e.mind) continue;
      if (Math.random() < 0.60) return e;
      return null;
    }
    return null;
  }

  // 敵の単体行動の標的選び。前衛は狙われやすく (重み3)、後衛は狙われにくい (重み1)。
  // 挑発 (taunt) 持ちはさらに3倍狙われやすい
  _pickPartyTarget() {
    const list = this.livingParty();
    if (!list.length) return null;
    const pool = [];
    for (const p of list) {
      const w = (this.isBackRow(p) ? 1 : 3) * (pv(p, "taunt") ? 3 : 1) * Math.round(this._bm(p, "taunt"));
      for (let i = 0; i < w; i++) pool.push(p);
    }
    return pool[rand(pool.length)];
  }

  // 行動を実行し、演出用の結果 { actor, action, side, hits:[{target,dmg,crit,miss,heal,sleep,died}] } を返す
  _exec(cmd) {
    this._actSeq = (this._actSeq || 0) + 1; // たぎる血潮: 1手ごとに数える
    this._actor = cmd.actor; // 固有パッシブ (kill) が「誰が倒したか」を知るための印
    try { return this._execInner(cmd); } finally { this._actor = null; }
  }
  _execInner(cmd) {
    const { actor, action } = cmd;
    const res = { actor, action, side: actor.side, hits: [] };
    if (action === "sleep") {
      if (this._naturalRecover(actor, "sleep", 0.45)) { actor.asleep = false; this.log(`${actor.name}は目を覚ました`, "sys"); res.woke = true; }
      else { this.log(`${actor.name}は眠っている…`, "sys"); res.asleep = true; }
      return res;
    }
    if (action === "defend") {
      actor._defending = true;
      this.log(`${actor.name}は身を守っている`, "sys");
      return res;
    }
    if (action === "run") {
      // 迷宮の異変「閉ざされた退路」: 逃走そのものが封じられている
      const T = this._tally();
      T.ft++;
      if (this.noFlee) {
        T.fs++;
        this.log("迷宮の異変が退路を閉ざしている！ 逃げられない！", "dmg");
        res.fledFail = true;
        return res;
      }
      const chance = this.fleeChance(actor);
      T.fp = (T.fp || 0) + Math.round(chance * 1000);
      if (Math.random() < chance) { this.result = "flee"; T.fo++; this.log("うまく逃げ出した！", "sys"); res.fled = true; }
      else { this.log(`${actor.name}は逃げられなかった！`, "dmg"); res.fledFail = true; }
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
    if (action === "eheal") {
      // 敵の回復役: 傷ついた仲間を癒す (演出は味方の回復呪文と同系統で流用)
      res.action = "spell"; res.spellKind = "heal"; res.spellName = "癒しの詠唱";
      const t = (cmd.target && cmd.target.alive) ? cmd.target : this._woundedAlly(actor);
      if (t) {
        const heal = Math.max(1, variance(Math.round(t.maxhp * 0.22)));
        t.hp = Math.min(t.maxhp, t.hp + heal);
        this.log(`${actor.name}の妖しい詠唱！ ${t.name}のHPが ${heal} 回復した`, "dmg");
        res.hits.push({ target: t, heal });
      }
      return res;
    }
    if (action === "summon") {
      // 敵の呼び手: 仲間を1体呼び寄せる (最大6体)
      res.action = "spell"; res.spellKind = "summon"; res.spellName = "召喚";
      const key = actor.summonKey;
      if (key && MONSTERS[key] && this.livingEnemies().length < MAX_ENEMIES) {
        const e = makeEnemy(key, actor._scale || 1);
        if (actor._agiMul) { e._agiMul = actor._agiMul; e.agi = Math.max(1, Math.round(e.agi * actor._agiMul)); }
        // 属性の暴走 (異変): 呼ばれた仲間の属性もでたらめに
        if (actor._elemRandom) { const els = Object.keys(ELEMENTS).filter((k) => k !== "none"); e._elemRandom = true; e.element = els[Math.floor(Math.random() * els.length)]; }
        // ロード復元後の uid 重複を防ぐ (uid カウンタはリロードでリセットされる)
        e.uid = [...this.party, ...this.enemies].reduce((mx, x) => Math.max(mx, x.uid || 0), 0) + 1;
        e.buffs = { atk: 1, vit: 1, agi: 1 }; e.effects = [];
        // 同種が既にいるなら A/B/C… の続きで呼び分ける
        const same = this.enemies.filter((x) => x.key === key).length;
        if (same) e.name += String.fromCharCode(65 + same);
        this.enemies.push(e);
        this.log(`${actor.name}は ${e.mon.name} を呼び寄せた！`, "dmg");
        res.summoned = e;
      } else {
        this.log(`${actor.name}は何かを呼ぼうとしたが、応えはなかった。`, "sys");
      }
      return res;
    }
    if (action === "breath") {
      // ブレス / 全体呪文 (kind "spell"): 味方全体への属性ダメージ (回避不可)。
      //  ブレスは VIT で微減し、装備のブレス耐性 (breathRes) と守りの技 (wardB) で軽減する。
      //  全体呪文は INT・PIE (精神) で微減し、呪文避けの技 (wardS) で軽減する。どちらも大結界・魔障壁で半減できる
      const spell = cmd.kind === "spell";
      const what = spell ? "呪文" : "ブレス";
      this.log(spell ? `${actor.name}は${actor.boss ? "大いなる" : ""}呪文を唱えた！ 隊全体を${ELEM_SPELL[actor.element] || "魔力"}が襲う！`
        : `${actor.name}は${actor.boss ? "業炎の" : ""}ブレスを吐いた！`, "dmg");
      res.breath = true;
      res.espell = spell;
      // 大結界: 自動で隊全体の被ダメージを半減する (Lv1=1戦闘1回 / Lv2=2回)
      let bigB = false;
      const bigBMax = Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, "bigBarrier")));
      if ((this._bigBarrierUsed || 0) < bigBMax) {
        this._bigBarrierUsed = (this._bigBarrierUsed || 0) + 1;
        bigB = true;
        this.log("大結界がパーティを包んだ！", "heal");
      }
      for (const t of this.livingParty()) {
        const em = elemDmgMult(actor.element || "none", 1, t.element || "none", edefOf(t));
        const guard = spell ? ((t.int || 0) + (t.pie || 0)) * 0.12 : this._evit(t) * 0.25;
        let dmg = Math.max(1, Math.round(variance(this._eatk(actor) * (spell ? 0.75 : 0.85)) - guard));
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        if (t._defending) dmg = Math.ceil(dmg * 0.5);
        { const pt = this._perkSum(t, "take", { tgt: actor, el: actor.element || "none", on: [spell ? "spell" : "breath"] }); if (pt) dmg = Math.max(1, Math.floor(dmg * Math.max(0.2, 1 - pt))); } // 固有パッシブ (take)
        // 守りの技 (風避け・呪文避け): 効果の倍率で割る (重ねても 1/3 まで)
        const ward = this._bm(t, spell ? "wardS" : "wardB");
        if (ward > 1) dmg = Math.max(1, Math.round(dmg / ward));
        // 装備のブレス耐性 (竜鱗の盾など。合計の上限 50%)
        if (!spell && t.breathRes) dmg = Math.max(1, Math.round(dmg * (1 - Math.min(BREATH_RES_CAP, t.breathRes))));
        if (bigB) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        else if (t._barrierLeft > 0) {
          // 魔障壁: 個人のブレス・呪文被ダメ半減 (残回数制)。魔力反射は防いだ分を返す
          t._barrierLeft--;
          const cut = dmg - Math.ceil(dmg * 0.5);
          dmg = Math.ceil(dmg * 0.5);
          this.log(`${t.name}の魔障壁が${what}を弱めた！`, "heal");
          if (cut > 0 && pv(t, "reflect") && actor.alive && !isMetal(actor)) {
            actor.hp -= cut;
            this.log(`魔力反射！ ${actor.name}に ${cut} ダメージ`, "hit");
            this._die(actor);
          }
        }
        if (this._onceGuard(t, "spellGuard", "_sgUsed", "封の結界")) { res.hits.push({ target: t, dmg: 0, immune: true, died: false }); continue; }
        dmg = Math.max(1, Math.floor(dmg * (1 - this._shintou(t)))); // 心頭滅却: ブレス・呪文
        t.hp -= dmg;
        this.log(`${t.name}に ${dmg} ダメージ${em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : ""}`, "dmg");
        this._wake(t);
        const died = this._die(t);
        if (!died) { this._postDamage(t); this._perkHurt(t, actor, dmg, spell ? "spell" : "breath"); }
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
        if (!h.miss && !h.immune && tt.alive && !tt.ailment && Math.random() < this._rate(actor, tt, 0.4) * (1 - this._ailRes(tt, k))) {
          tt.ailment = k;
          h.ailment = k;
          this.log(`${tt.name}は${k === "poison" ? "毒" : "麻痺"}に侵された！`, "dmg");
        }
      } else if (k === "stone") {
        this.log(`${actor.name}の石化の凝視！`, "dmg");
        if (t.ailment || Math.random() >= this._rate(actor, t, 0.32) * (1 - this._hardRes(t, "stone"))) { this.log(`${t.name}は目を逸らした`, "sys"); res.hits.push({ target: t, miss: true }); }
        else { t.ailment = "stone"; this.log(`${t.name}は石になった！`, "dmg"); res.hits.push({ target: t, stoned: true }); }
      } else if (k === "sleep") {
        // 眠りの息 (鱗粉・子守唄など): 隊全体を眠りに誘う。眠った者は手番を失い、傷を受けるまで覚めにくい
        this.log(`${actor.name}は眠りを誘う息を吐いた！`, "dmg");
        for (const p of this.livingParty()) {
          if (p.asleep || p.ailment === "stone") continue;
          if (Math.random() < this._rate(actor, p, 0.25) * (1 - this._ailRes(p, "sleep"))) {
            p.asleep = true;
            this.log(`${p.name}は眠ってしまった！`, "dmg");
            res.hits.push({ target: p, status: "眠り!" });
          } else res.hits.push({ target: p, miss: true, resisted: true });
        }
      } else if (k === "charm" || k === "confuse") {
        // 魅惑の眼差し / 惑わしの声: 1人の心を奪う。魅了 = 仲間を襲う / 混乱 = 誰かれ構わず殴る
        const charm = k === "charm";
        this.log(charm ? `${actor.name}の魅惑の眼差し！` : `${actor.name}の惑わしの声！`, "dmg");
        if (t.mind || t.ailment === "stone" || Math.random() >= this._rate(actor, t, charm ? 0.4 : 0.45) * (1 - this._ailRes(t, k))) {
          this.log(`${t.name}は${charm ? "誘いを振り払った" : "惑わされなかった"}`, "sys");
          res.hits.push({ target: t, miss: true, resisted: true });
        } else {
          t.mind = k;
          this.log(charm ? `${t.name}は魅了されてしまった！` : `${t.name}は混乱してしまった！`, "dmg");
          res.hits.push({ target: t, status: charm ? "魅了!" : "混乱!" });
        }
      } else if (k === "critical") {
        const h = this._physical(actor, t, { power: 1.1, name: "死神の一撃" });
        res.hits.push(h);
        if (!h.miss && t.alive && Math.random() < this._rate(actor, t, 0.15) * (1 - this._hardRes(t))) {
          this.log(`${actor.name}は${t.name}の急所を貫いた！`, "dmg");
          t.hp = 0;
          h.fatal = true;
          h.died = this._die(t) || h.died; // 不屈持ちはHP1で耐える
        }
      } else if (k === "goldSteal" || k === "soulSteal") {
        if (Math.random() < 0.35) { this.log(`${actor.name}は${t.name}の懐を狙ったが、かわされた！`, "sys"); res.hits.push({ target: t, miss: true }); }
        else {
          const amt = k === "goldSteal" ? 5 + Math.round((actor.gold || 10) * 0.5) : 3 + Math.round((actor.soul || 5) * 0.6);
          res.hits.push({ target: t, steal: k, stealAmt: amt });
        }
      } else if (k === "drain") {
        const h = this._physical(actor, t, { power: 0.8, name: "魂喰らい" });
        res.hits.push(h);
        if (!h.miss && t.alive && Math.random() < 0.35) h.drain = true; // 魂レベルの控除は game.js 側
      } else if (k === "warcry") {
        // 鼓舞: 自分を含む味方 (敵側) 全体の ATK を数ターン上げる
        this.log(`${actor.name}の雄叫び！`, "dmg");
        for (const e of this.livingEnemies()) this._applyMod(e, "atk", 1.3, ENEMY_BUFF_DUR, "雄叫び");
        res.warcry = true;
      } else if (k === "weaken") {
        // 弱体: 近接 (×0.9) + 命中したプレイヤーの ATK を数ターン下げる
        const h = this._physical(actor, t, { power: 0.9, name: "呪いの一撃" });
        res.hits.push(h);
        const tt = h.target; // かばうで対象が替わることがある
        if (!h.miss && tt.alive) { this._applyMod(tt, "atk", 0.75, ENEMY_BUFF_DUR, "弱体"); this.log(`${tt.name}の力が削がれた…`, "dmg"); }
      }
      return res;
    }
    return res;
  }

  // バフ込みの実効ATK・VIT
  // 攻撃力 (物理の威力の元): ATK×強化 + 武器の能力補正 (AGI×0.4 など。能力値は強化・弱体込み)
  _eatk(a) {
    const atk = a.atk * this._bm(a, "atk");
    const bonus = a.wScale ? scaleBonus(a.wScale, (k) => (a[k] || 0) * this._bm(a, k)) : 0;
    return Math.max(1, Math.round(atk + bonus));
  }
  _evit(t) { return Math.round((t.vit || 0) * ((t.buffs && t.buffs.vit) || 1)); }

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

  // 異常耐性 (resistAilment / 聖域) + 装備の耐性 (ailRes[kind]): 毒・麻痺・眠り・魅了・混乱の付与率カット (上限90%)
  _ailRes(t, kind) {
    if (t.side !== "party") return 0;
    if (t.ailmentImmune) return 1; // 解呪の宝珠 (LR装飾品): 状態異常を完全無効
    let lv = pv(t, "resistAilment");
    if (lv < 1 && this.party.some((p) => p.alive && pv(p, "sanctuary"))) lv = 1;
    const pas = lv >= 2 ? 0.60 : lv === 1 ? 0.30 : 0;
    const eq = (kind && t.ailRes && t.ailRes[kind]) || 0;
    return Math.min(0.9, pas + eq + this._zokusei(t));
  }
  // 俗世拒絶 (隠修士): 敵から受ける状態異常 (石化・即死も) を -10/20/30%
  _zokusei(t) { return [0, 0.10, 0.20, 0.30][Math.min(3, pv(t, "hermitZokusei"))] || 0; }
  // 石化・即死への耐性 (異常耐性Lv2 + 装備の石化耐性)
  _hardRes(t, kind) {
    if (t.ailmentImmune) return 1; // 解呪の宝珠: 石化・即死系の付与も無効
    if (t.side !== "party") return 0;
    const pas = pv(t, "resistAilment") >= 2 ? 0.30 : 0;
    const eq = (kind && t.ailRes && t.ailRes[kind]) || 0;
    return Math.min(0.9, pas + eq + this._zokusei(t));
  }

  // 被ダメージ後の自動処理: 聖典の加護 (HP30%以下で1戦闘1回の自己回復)
  _postDamage(t) {
    if (t.side !== "party" || !t.alive || t._scriptureUsed) return;
    if (!pv(t, "scripture") || t.hp > t.maxhp * 0.3) return;
    t._scriptureUsed = true;
    const heal = Math.max(1, Math.round((t.pie || 1) * 1.2));
    t.hp = Math.min(t.maxhp, t.hp + heal);
    this.log(`聖典の加護！ ${t.name}のHPが ${heal} 回復`, "heal");
  }

  // 反撃 (counter/神罰の鉄槌): 物理を受けた味方が生きていれば反撃判定
  _tryCounter(defender, attacker) {
    if (defender.side !== "party" || !defender.alive || !attacker || !attacker.alive) return;
    if (this._incap(defender)) return;
    let cLv = pv(defender, "counter");
    const stance = this._bm(defender, "ctr") > 1; // 反撃の構え: 必ず ATK×1.0 で反撃
    if (stance || (cLv && Math.random() < [0, 0.15, 0.25, 0.35][cLv])) {
      const mul = stance ? 1.0 : [0, 0.5, 0.7, 1.0][cLv];
      // 反撃も物理なので隊列補正を受ける
      let dmg = Math.max(1, Math.round((variance(Math.round(this._eatk(defender) * mul)) - Math.floor(this._evit(attacker) * 0.5)) * this._rowMul(defender, attacker)));
      let crit = false;
      if (cLv >= 3 && Math.random() < 0.06 + (defender.critBonus || 0)) { crit = true; dmg = Math.floor(dmg * 1.85); }
      // 反撃も物理なので物理耐性を受ける (無効の敵には通らない)。会心なら物理耐性1・2を無視する
      const pr = (crit && (attacker.physResist | 0) < 3) ? { dmg, immune: false } : this._resistCut(attacker, dmg, "physResist");
      if (pr.immune) { this.log(`${defender.name}の反撃！ ${attacker.name}には効かない！ (物理無効)`, "hit"); return; }
      dmg = pr.dmg;
      attacker.hp -= dmg;
      this.log(`${defender.name}の反撃！ ${attacker.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}`, "hit");
      this._die(attacker);
      return;
    }
    if (pv(defender, "divineCounter") && Math.random() < 0.20) {
      // 神罰は聖なる術の一撃: 魔法耐性を受ける
      const mr = this._resistCut(attacker, Math.max(1, variance(Math.round((defender.pie || 1) * 0.8))), "magResist");
      if (mr.immune) { this.log(`${defender.name}の神罰の鉄槌！ ${attacker.name}には効かない！ (魔法無効)`, "hit"); return; }
      const dmg = mr.dmg;
      attacker.hp -= dmg;
      this.log(`${defender.name}の神罰の鉄槌！ ${attacker.name}に ${dmg} ダメージ`, "hit");
      this._die(attacker);
    }
  }

  // 通常攻撃後の追撃 (味方のみ): 残心 / 連撃 / 二刀の理
  _afterBasic(actor, tgt, h, res) {
    // 魔力付与 (魔騎士): 当たった通常攻撃に INT×0.8/1.2/1.6 の固定ダメージを上乗せ (金属の魔物には効かない)
    const dk = pv(actor, "dkEnchant");
    let extra = 0;
    if (dk && h && !h.miss && !h.immune && tgt.alive && !isMetal(tgt)) {
      extra = Math.max(1, Math.round((actor.int || 0) * ([0, 0.8, 1.2, 1.6][Math.min(3, dk)] || 0)));
      tgt.hp -= extra;
      this.log(`魔力付与！ ${tgt.name}に ${extra} ダメージ`, "hit");
      this._wake(tgt);
      const died = this._die(tgt);
      res.hits.push({ target: tgt, dmg: extra, died });
      if (died) h = { ...h, died: true };
    }
    // 魔力循環 (魔闘士): 通常攻撃で与えたダメージの 5/10/15% だけ MP を回復
    const mc = pv(actor, "bmManaCycle");
    const dealt = ((h && !h.miss && h.dmg) || 0) + extra;
    if (mc && dealt > 0 && actor.maxmp && actor.mp < actor.maxmp) {
      const gain = Math.max(1, Math.round(dealt * ([0, 0.05, 0.10, 0.15][Math.min(3, mc)] || 0)));
      actor.mp = Math.min(actor.maxmp, actor.mp + gain);
      this.log(`${actor.name}の魔力循環 (MP+${gain})`, "heal");
    }
    // 残心: 敵を倒した時25%で追加攻撃 (1ラウンド1回)
    if (h.died && pv(actor, "zanshin") && this._zanshinRound !== this._roundNo && Math.random() < 0.25) {
      const t2 = this._randAlive(this.attackableEnemies(actor)); // 残心の追撃も射程内のみ
      if (t2) {
        this._zanshinRound = this._roundNo;
        this.log(`${actor.name}の残心！`, "hit");
        res.hits.push(this._physical(actor, t2, { name: "残心" }));
      }
      return;
    }
    if (h.miss || !tgt.alive) return;
    // 連撃: 10/20%で2撃目 (威力60%)
    const ex = pv(actor, "extraHit");
    if (ex && Math.random() < [0, 0.10, 0.20, 0.30, 0.40][Math.min(ex, 4)]) {
      this.log(`${actor.name}の連撃！`, "hit");
      res.hits.push(this._physical(actor, tgt, { power: 0.6, name: "連撃" }));
      if (!tgt.alive) return;
    }
    // 二刀の理: 30%でINT×0.6の追撃呪文
    if (pv(actor, "twinArts") && Math.random() < 0.30) {
      const mr = this._resistCut(tgt, Math.max(1, Math.round(variance((actor.int || 1) * 0.6) - this._evit(tgt) * 0.2)), "magResist");
      if (mr.immune) {
        this.log(`二刀の理！ ${tgt.name}には効かない！ (魔法無効)`, "hit");
        res.hits.push({ target: tgt, dmg: 0, immune: true, died: false });
        return;
      }
      const dmg = mr.dmg;
      tgt.hp -= dmg;
      this.log(`二刀の理！ ${tgt.name}に ${dmg} ダメージ${mr.tag ? " " + mr.tag : ""}`, "hit");
      res.hits.push({ target: tgt, dmg, died: this._die(tgt) });
    }
  }

  // 物理耐性・魔法耐性 (耐性ランク 1〜3 → 50% / 75% / 100% 軽減)。key = "physResist" | "magResist"
  // 敵だけが持つ。耐性3 (無効) なら dmg は 0 になり immune が立つ
  _resistCut(tgt, dmg, key) {
    // 金属の体: 物理 (反撃など) は1ダメージ、魔法 (呪文・神罰・二刀の理など) は無効
    if (isMetal(tgt)) return key === "magResist" ? { dmg: 0, tag: METAL_TAG.mag, immune: true } : { dmg: Math.min(dmg, 1), tag: METAL_TAG.phys, immune: false };
    let r = tgt && tgt.side === "enemy" ? (tgt[key] || 0) : 0;
    if (r > 0 && r < 1) r = r >= 0.6 ? 2 : r >= 0.4 ? 1 : 0; // 旧形式 (割合) のまま保存された戦闘中の敵
    r = Math.min(3, r | 0);
    if (!r) return { dmg, tag: "", immune: false };
    const rate = resistRate(r);
    if (rate >= 1) return { dmg: 0, tag: RESIST_TAG[key][r], immune: true };
    return { dmg: Math.max(1, Math.round(dmg * (1 - rate))), tag: RESIST_TAG[key][r], immune: false };
  }

  _physical(actor, tgt, opt = {}) {
    // かばう: 瀕死の味方への攻撃は護衛役が肩代わりする
    let coverMul = 1;
    if (actor.side === "enemy" && tgt.side === "party") {
      // 仁王立ち: 単体攻撃は構えた者がすべて受ける (かばうより先)
      const sh = this._shieldFor(tgt);
      if (sh) {
        this.log(`${sh.name}が${tgt.name}の前に立ちはだかった！`, "sys");
        tgt = sh;
      }
    }
    if (actor.side === "enemy" && tgt.side === "party") {
      const g = this._coverFor(tgt);
      if (g) {
        g._coverLeft--;
        this.log(`${g.name}は${tgt.name}をかばった！`, "sys");
        const cvLv = pv(g, "cover");
        if (cvLv >= 3) coverMul = 0.6; else if (cvLv >= 2) coverMul = 0.7;
        tgt = g;
      }
    }
    // 敵側の護り手 (guard): 仲間への物理攻撃を肩代わりする (呪文・ブレスは防げない)
    if (actor.side === "party" && tgt.side === "enemy") {
      const g = this._enemyGuardFor(tgt);
      if (g) {
        g._guardLeft--;
        this.log(`${g.name}が${tgt.name}をかばった！`, "dmg");
        tgt = g;
      }
    }
    // テスト記録: 物理の試行 / 見切られた / かわされた (攻撃側ごと。味方 = p*、敵 = e*)
    // 魅了・混乱で同じ側を殴った分は数えない (捨てる器へ)
    const T = actor.side !== tgt.side ? this._tally() : newTally(), tk = actor.side === "party" ? "p" : "e";
    T[tk + "a"]++;
    // 見切り (parry): 確率で完全回避
    const pLvP = pv(tgt, "parry");
    if (pLvP && Math.random() < (pLvP >= 2 ? 0.15 : 0.10)) {
      T[tk + "p"]++;
      this.log(`${tgt.name}は見切った！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    // 命中判定: 素の命中漏れ + 対象の敏捷(AGI)による回避 + 回避持ちの追加回避。
    // 技の命中補正 (acc) は外れる確率をその割合だけ消す (1 = 必中)。目つぶし (hit<1) は外れる確率を足す
    const evade = (isMetal(tgt) ? metalEvade(tgt) : this._evadeBase(tgt, actor)) + (tgt.evasive ? 0.15 : 0)
      + (tgt.side === "party" && actor.side === "enemy" ? this._perkSum(tgt, "evade", { tgt: actor }) : 0); // 固有パッシブ (evade)
    let missP = (0.06 + evade) * (1 - Math.min(1, Math.max(0, opt.acc || 0)));
    const blind = this._bm(actor, "hit");
    if (blind < 1) missP += Math.min(0.4, 1 - blind);
    if (Math.random() < missP) {
      T[tk + "e"]++;
      this.log(`${tgt.name}は攻撃をかわした！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    const power = opt.power || 1;       // 技の倍率 (通常攻撃は1)
    // 魔法属性の武器: 通常攻撃 (と残心・連撃などの追撃) は威力の計算はそのまま、物理耐性の代わりに魔法耐性を受け、魔法弱点が効く。物理技は物理のまま
    const magHit = actor.side === "party" && !!actor.wMagic && !opt.skill;
    // 魔力撃 (spellBlade): 通常攻撃にINTを上乗せ
    const sb = pv(actor, "spellBlade");
    const sbAdd = sb ? Math.round((actor.int || 0) * (sb >= 2 ? 1.0 : 0.5) * power) : 0;
    // 魔法剣 (intScale): 技そのものが INT×倍率×係数 を上乗せする (ATKとINTの両方で伸びる)
    // 同様に AGI (疾風の技) / VIT (盾の技) / PIE (聖なる技) で伸びる技もある
    const ibAdd = opt.intScale ? Math.round((actor.int || 0) * opt.intScale * power) : 0;
    const stAdd = Math.round(((opt.agiScale || 0) * (actor.agi || 0) + (opt.vitScale || 0) * (actor.vit || 0) + (opt.pieScale || 0) * (actor.pie || 0)) * power);
    // 背水 (desperate): 自分のHPが減るほど威力が上がる (最大2倍)
    const despMul = opt.desperate && actor.maxhp ? 1 + Math.max(0, 1 - actor.hp / actor.maxhp) : 1;
    // 鎧貫き (pierce): 相手のVITによる軽減をその割合だけ無視する
    const defCut = Math.floor(this._evit(tgt) * 0.5 * (1 - Math.min(1, opt.pierce || 0)));
    // ダメージ = ATK×倍率×低HP補正 − VIT/2 (VITが被ダメージ軽減を担う)
    let dmg = Math.round((variance(Math.round(this._eatk(actor) * power * this._lowHpMul(actor))) + sbAdd + ibAdd + stAdd) * despMul * (opt.chargeMul || 1)) - defCut;
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    // 城壁の構え: 防御中の持ち主がいれば隊全体の被ダメ-10%
    if (tgt.side === "party") {
      const bastLv = Math.max(0, ...this.party.filter((p) => p.alive && p._defending).map((p) => pv(p, "bastion")));
      if (bastLv >= 2) dmg = Math.floor(dmg * 0.82); else if (bastLv >= 1) dmg = Math.floor(dmg * 0.9);
      if (actor.side === "enemy") { // 固有パッシブ (take)
        const pt = this._perkSum(tgt, "take", { tgt: actor, on: ["phys"] });
        if (pt) dmg = Math.floor(dmg * Math.max(0.2, 1 - pt));
      }
    }
    if (coverMul !== 1) dmg = Math.floor(dmg * coverMul);
    // 属性相性: 攻撃属性 (技 > 装備の属性攻撃 > 固有属性) × 対象の固有属性/属性防御
    const aE = opt.element || (actor.elemAtk && actor.elemAtk.el) || actor.element || "none";
    const aLv = (actor.elemAtk && actor.elemAtk.el === aE) ? Math.max(1, actor.elemAtk.lv) : 1;
    const em = elemDmgMult(aE, aLv, tgt.element || "none", edefOf(tgt)) * this._vulnMul(tgt, aE);
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
    // たぎる血潮 (修羅): 同じ敵へ続けて手を下すたび +10/15/20% (最大 +200%)。別の敵を討てば数え直し
    if (perkFoe) {
      const ch = pv(actor, "asuraChishio");
      if (ch) {
        if (actor._bloodAct !== this._actSeq) {
          actor._bloodStack = actor._bloodTgt === tgt ? (actor._bloodStack || 0) + 1 : 0;
          actor._bloodTgt = tgt; actor._bloodAct = this._actSeq;
        }
        const bonus = Math.min(2, (actor._bloodStack || 0) * ([0, 0.10, 0.15, 0.20][Math.min(3, ch)] || 0));
        if (bonus > 0) dmg = Math.round(dmg * (1 + bonus));
      }
    }
    if (actor.side === "party") { const evm = evDealMul(actor, tgt); if (evm !== 1) dmg = Math.round(dmg * evm); }
    // 会心: 基礎 + 会心パッシブ + 幸運(LUK) + 技の会心補正。確定会心系が先に立つ
    const luckCrit = Math.max(0, ((actor.luk || 8) - 8)) * 0.005;
    let critChance = 0.06 + (actor.critBonus || 0) + luckCrit + (opt.critBonus || 0) + (actor._evCrit || 0);
    if (perkFoe) critChance += this._perkSum(actor, "crit", { tgt, el: aE, on: pOn }); // 固有パッシブ (crit)
    if (pv(actor, "holyEdge") && HOLY_PREY.includes(enemyRace(tgt))) critChance += 0.15;
    const fs = pv(actor, "fightSpirit");
    if (fs >= 2 && actor.maxhp && actor.hp <= actor.maxhp * 0.3) critChance += [0, 0, 0.15, 0.20, 0.25][Math.min(fs, 4)];
    let sureCrit = false;
    if (opt.basic && actor._kenma) { actor._kenma = false; sureCrit = true; }       // 剣魔合一
    if (opt.basic && actor._ambushCritLeft > 0) { actor._ambushCritLeft--; sureCrit = true; } // 不意打ち
    if (tgt.asleep && actor.side === "party") sureCrit = true; // 眠っている敵への物理は必ず会心 (眠った味方を敵が殴っても会心は確定しない)
    if (pv(actor, "sleepKill") && tgt.side === "enemy" && (tgt.ailment === "paralyze" || tgt.mind)) sureCrit = true; // 寝込み襲い: 麻痺・魅了・混乱にも確定会心
    const crit = sureCrit || Math.random() < critChance;
    if (crit) dmg = Math.floor(dmg * 1.85 * [1, 1.25, 1.45][Math.min(pv(actor, "vitalEye"), 2)]); // 急所読み: 会心強化
    // 隊列補正: 後衛は物理の与ダメ・被ダメが半減
    const rm = this._rowMul(actor, tgt);
    if (rm !== 1) dmg = Math.round(dmg * rm);
    // 金属の体: 会心でなければ何で打っても1ダメージ (防御無視も魔法属性の武器も同じ)。会心の一撃は素通しで普段どおり通る
    const metalHit = isMetal(tgt);
    if (metalHit && !crit) dmg = 1;
    // 魔法弱点 (魔法属性の武器の一撃だけ): 攻撃呪文と同じく被ダメが増える
    let magWeak = false;
    if (magHit && !metalHit && tgt.magWeak && tgt.magWeak > 1) { dmg = Math.round(dmg * tgt.magWeak); magWeak = true; }
    // 物理耐性 (耐性ランク): 耐性1=50% / 耐性2=75% / 耐性3=無効。魔法属性の武器は魔法耐性を受ける
    // 防御無視の技 (pierce) と会心の一撃は物理耐性1・2を無視する。物理耐性3 (無効) はどちらでも通らない
    const pierceResist = !magHit && ((opt.pierce || 0) > 0 || crit) && tgt.side === "enemy" && ((tgt.physResist | 0) < 3);
    const pr = metalHit ? { dmg, tag: crit ? "" : METAL_TAG.phys, immune: false }
      : pierceResist ? { dmg, tag: "", immune: false } : this._resistCut(tgt, dmg, magHit ? "magResist" : "physResist");
    if (pr.immune) {
      // 無効: 傷ひとつ付かない (障壁も削れず、毒刃・怯ませ等の命中時効果も乗らない)
      this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}には効かない！ (${magHit ? "魔法" : "物理"}無効)`, tgt.side === "party" ? "dmg" : "hit");
      return { target: tgt, dmg: 0, crit: false, died: false, immune: true };
    }
    if (pr.tag) dmg = pr.dmg;
    // 障壁: 数回だけ被ダメを半減する敵 (回数制)
    let barriered = false;
    if (tgt.side === "enemy" && tgt._barrierLeft > 0) { tgt._barrierLeft--; dmg = Math.ceil(dmg * 0.5); barriered = true; }
    // 金剛の護符 (guard): 被ダメを常に割合カット (LR装飾品)
    if (tgt.guard) dmg = Math.ceil(dmg * (1 - tgt.guard));
    dmg = Math.max(1, dmg);
    if (actor.side === "enemy" && this._onceGuard(tgt, "firstGuard", "_fgUsed", "加護の祈り")) return { target: tgt, dmg: 0, crit: false, died: false, immune: true };
    tgt.hp -= dmg;
    // 吸血 (lifesteal): 与えた傷の一部を己のHPに変える (敵の能力・味方の吸命のLR装飾品の双方)
    let stolen = 0; // 吸血で癒えた量 (満タンで切られた分も含む素の値。演出で「+N」と見せる)
    if (actor.lifesteal && actor.alive && dmg > 0) {
      const hl = Math.max(1, Math.round(dmg * actor.lifesteal));
      stolen = hl;
      actor.hp = Math.min(actor.maxhp, actor.hp + hl);
      this.log(`${actor.name}は精気を吸い取った (${hl})`, "dmg");
    }
    // 報復の籠手 (counter): 敵の物理攻撃を受けた味方が反撃する (LR装飾品。反撃の反撃は起きない)
    if (tgt.side === "party" && tgt.counter && tgt.alive && actor.side === "enemy" && actor.alive && !opt._counter && dmg > 0) {
      const cdmg = isMetal(actor) ? 1 : Math.max(1, Math.round((tgt.power || tgt.atk || 1) * tgt.counter));
      actor.hp -= cdmg;
      this.log(`${tgt.name}の報復！ ${actor.name}に ${cdmg} ダメージ`, "hit");
      this._die(actor);
    }
    // 属性・障壁・物理耐性は重なっても全部見えるように併記する
    const eff = [em > 1 ? "弱点!" : em < 1 ? "耐性…" : "", magWeak ? "魔法弱点!" : "", barriered ? "障壁!" : "", pr.tag]
      .filter(Boolean).map((t) => " " + t).join("");
    this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}${eff}`,
      tgt.side === "party" ? "dmg" : "hit");
    this._wake(tgt);
    // 命中時の弱体 (毒刃など)
    if (opt.debuff && tgt.alive) { for (const k in opt.debuff) this._applyMod(tgt, k, opt.debuff[k], opt.debuffDur, opt.name); }
    // 仕込み毒 (venomBlade): 敵を毒に侵す
    const vb = pv(actor, "venomBlade");
    if (vb && tgt.alive && tgt.side === "enemy" && !metalHit && !tgt.ailment && Math.random() < this._rate(actor, tgt, vb >= 2 ? 0.30 : 0.15)) {
      tgt.ailment = "poison";
      this.log(`${tgt.name}は毒に侵された！`, "hit");
    }
    // 武器の追加効果 (onHit): 当てるだけで毒・麻痺・眠り・魅了・混乱を与える (装備の集約は items.js の recalc)
    let status = "";
    if (actor.side === "party" && tgt.side === "enemy" && tgt.alive && actor.onHit && actor.onHit.length) {
      const tags = [];
      for (const oh of actor.onHit) this._inflict(actor, tgt, onHitSpell(oh), tags);
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
    if (pv(actor, "flinch") && opt.basic && tgt.alive && tgt.side === "enemy" && !metalHit && !tgt.boss && !tgt._flinch && Math.random() < 0.10) {
      tgt._flinch = true;
      this.log(`${tgt.name}は怯んだ！`, "hit");
    }
    const died = this._die(tgt);
    // 魂喰い: 敵を倒した時にMPを回復
    if (died && actor.side === "party" && pv(actor, "soulEater") && actor.maxmp) {
      const mr = Math.max(1, Math.ceil(actor.maxmp * 0.05));
      actor.mp = Math.min(actor.maxmp, actor.mp + mr);
      this.log(`魂喰い！ ${actor.name}のMPが ${mr} 回復`, "heal");
    }
    if (!died && tgt.side === "party") {
      this._postDamage(tgt);
      if (actor.side === "enemy") { this._perkHurt(tgt, actor, dmg, "phys"); this._tryCounter(tgt, actor); }
    }
    const out = status ? { target: tgt, dmg, crit, died, status } : { target: tgt, dmg, crit, died };
    if (stolen) { out.lifesteal = stolen; out.stealer = actor; }
    return out;
  }

  _cast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    const echo = !!cmd._echo; // 重詠の2回目 (MP・代償を払わない)
    const cost = echo ? 0 : spellCost(actor, sp);
    actor.mp -= cost; // 省詠唱 (chant) 持ちは消費が軽い
    // 捨身 (hpCost): 最大HPの一定割合を代償に払う (HP1で踏みとどまる)。
    // ダメージ計算より先に払うため、自ら瀕死に踏み込んで荒行の果て・背水を起動できる
    if (sp.hpCost && !echo) {
      const cost = Math.max(1, Math.round((actor.maxhp || 1) * sp.hpCost));
      actor.hp = Math.max(1, actor.hp - cost);
      this.log(`${actor.name}は己の身を削った (${cost})`, "dmg");
    }
    if (pv(actor, "kenma")) actor._kenma = true; // 剣魔合一: 次の通常攻撃が確定会心
    res.spellName = sp.name;
    res.spellKind = sp.kind;
    res.spellElement = sp.element || null;
    const isPhys = sp.kind === "phys";
    this.log(echo ? `重詠！ ${actor.name}は ${sp.name} をもう一度唱えた！` : isPhys || sp.tech ? `${actor.name}の ${sp.name}！` : `${actor.name}は ${sp.name} を唱えた！`, "hit");
    let dealt = 0; // この技で与えた総ダメージ (drain / mpDrain の吸収量の基準)
    if (sp.kind === "escape") {
      // 確実な逃走 (煙玉など): 迷宮の異変で退路が閉ざされている時だけ失敗する
      const T = this._tally();
      T.ft++;
      if (this.noFlee) {
        T.fs++;
        this.log("迷宮の異変が退路を閉ざしている！ 逃げられない！", "dmg");
        res.fledFail = true;
      } else {
        T.fo++;
        this.result = "flee";
        this.log("姿をくらまし、戦いから逃れた！", "sys");
        res.fled = true;
      }
      return;
    }
    if (isPhys) {
      // 物理技は通常攻撃と同じ計算系 (倍率/多段/会心/弱体)。element 持ちは属性が乗る
      const chargeMul = this._takeCharge(actor); // 溜め: この技の全段に乗る
      const popt = {
        power: sp.power, critBonus: sp.critBonus, debuff: sp.debuff, debuffDur: sp.dur, element: sp.element,
        intScale: sp.intScale, agiScale: sp.agiScale, vitScale: sp.vitScale, pieScale: sp.pieScale,
        acc: sp.acc, pierce: sp.pierce, desperate: sp.desperate, execute: sp.execute, prey: sp.prey,
        chargeMul, name: sp.name, skill: true,
      };
      // 矢の雨 (scatter): ランダムな敵へ N 回。それ以外は対象ごとに hits 回
      const plan = [];
      if (sp.scatter) for (let i = 0; i < sp.scatter; i++) plan.push(null);
      else for (const t of (sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean))) plan.push(t);
      const connected = new Set(); // 1発でも命中した敵 (命中後の付与効果の条件)
      for (const t0 of plan) {
        const t = t0 || this._randAlive(this.enemies);
        if (!t) break;
        const hits = sp.scatter ? 1 : (sp.hits || 1);
        for (let h = 0; h < hits; h++) {
          if (!t.alive) break;
          const hit = this._physical(actor, t, popt);
          res.hits.push(hit);
          dealt += hit.dmg || 0;
          const tt = hit.target || t; // 敵の護り手に肩代わりされることがある
          if (!hit.miss && !hit.immune) connected.add(tt); // 無効で弾かれた一撃は命中扱いにしない
          // 追い剥ぎ (plunder): この技で倒した敵は落とすゴールドが2倍になる
          if (sp.plunder && hit.died && tt.gold) {
            tt.gold = Math.round(tt.gold * 2);
            this.log(`${actor.name}は${tt.name}から金品を剥ぎ取った！`, "win");
          }
        }
      }
      for (const t of connected) {
        // 盗む: 当たった敵の所持金の一部を奪う (1体につき1度)
        if (sp.steal && t.side === "enemy" && !t._stolen && (t.gold || 0) > 0) {
          const amt = Math.max(1, Math.round(t.gold * sp.steal));
          t._stolen = true;
          this.bonusGold = (this.bonusGold || 0) + amt;
          this.log(`${actor.name}は${t.name}から ${amt}G を盗んだ！`, "win");
          res.hits.push({ target: t, stole: amt });
        } else if (sp.steal && t._stolen) this.log(`${t.name}はもう何も持っていない`, "sys");
        if (t.alive) {
          const tags = [];
          this._inflict(actor, t, sp, tags);
          markStatus(res, t, tags);
        }
      }
    } else if (sp.kind === "atk") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      const scLv = pv(actor, "spellCrit"); // 呪文会心
      // 精神統一: INT強化。光の呪文と祈りの呪文 (faith) は INT と PIE の高い方で伸びる (聖職の術者は祈りで撃つ)
      const intv = Math.max((actor.int || 0) * this._bm(actor, "int"), isFaithSpell(sp) ? (actor.pie || 0) : 0);
      for (const t of targets) {
        if (!t.alive) continue;
        let dmg, em = 1, magWeak = false;
        if (sp.gravity) {
          // 重力: 今のHPの割合を削る (属性・INT・会心に依らない)。主には3割しか効かない
          dmg = Math.max(1, Math.round(t.hp * sp.gravity * (t.boss ? 0.3 : 1)));
        } else {
          // 呪文の属性は Lv1 扱い。同属性の属性攻撃を装備していれば、そのレベルで増幅される
          const aLv = (actor.elemAtk && actor.elemAtk.el === sp.element) ? Math.max(1, actor.elemAtk.lv) : 1;
          em = elemDmgMult(sp.element || "none", aLv, t.element || "none", edefOf(t));
          if (em < 1 && pv(actor, "elemFloor")) em = 1; // 森羅の理: 属性不利が出ない
          em *= this._vulnMul(t, sp.element); // 属性耐性ダウン
          // 攻撃呪文の威力は術者の INT で伸びる。低HP補正 (荒行の果て) も乗る
          const power = sp.power + intv * 0.5;
          dmg = Math.max(1, Math.round(variance(power) * this._lowHpMul(actor)) - Math.floor(this._evit(t) * 0.2));
          if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
          // 魔法弱点: 攻撃呪文の被ダメが増える (「魔法に弱い」)
          if (t.magWeak && t.magWeak > 1) { dmg = Math.round(dmg * t.magWeak); magWeak = true; }
          if (sp.prey && sp.prey.races.includes(enemyRace(t))) dmg = Math.round(dmg * sp.prey.mul);
        }
        // 魔法耐性 (耐性ランク): 耐性1=50% / 耐性2=75% / 耐性3=無効
        const mr = this._resistCut(t, dmg, "magResist");
        if (mr.immune) {
          this.log(`${t.name}には効かない！ (魔法無効)`, "dmg");
          res.hits.push({ target: t, dmg: 0, immune: true, died: false });
          continue;
        }
        dmg = mr.dmg;
        if (pv(actor, "gokudoku") && t.ailment === "poison") dmg = Math.round(dmg * 1.3); // 毒責め
        { const evm = evDealMul(actor, t); if (evm !== 1) dmg = Math.max(1, Math.round(dmg * evm)); } // 迷宮のイベントの加護
        { const pd = this._perkSum(actor, "deal", { tgt: t, el: sp.element || "none", on: ["spell"] }); if (pd) dmg = Math.max(1, Math.round(dmg * (1 + pd))); } // 固有パッシブ (deal)
        // 会心: 呪文会心パッシブ + 技固有の会心補正 (禁呪開帳など)。重力は会心しない
        const crit = !sp.gravity && Math.random() < (([0, 0.10, 0.18, 0.26][Math.min(scLv, 3)] || 0) + (sp.critBonus || 0));
        if (crit) dmg = Math.floor(dmg * 1.5);
        if (t.guard) dmg = Math.max(1, Math.ceil(dmg * (1 - t.guard))); // 金剛の護符: 呪文・ブレスの被ダメもカット
        t.hp -= dmg;
        dealt += dmg;
        const eff = [em > 1 || magWeak ? "弱点!" : em < 1 ? "耐性…" : "", mr.tag]
          .filter(Boolean).map((t) => " " + t).join("");
        this.log(`${t.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}${eff}`, "dmg");
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
        if (sp.stance === "counter") { this._applyMod(t, "ctr", 2, sp.dur, sp.name); mods.ctr = 2; }
        if (sp.charge) {
          t.effects = (t.effects || []).filter((e) => e.stat !== "charge"); // 溜めは重ねず掛け直し
          this._applyMod(t, "charge", sp.charge, sp.dur, sp.name); mods.charge = sp.charge;
        }
        if (sp.regen) { this._applyMod(t, "regen", 1 + sp.regen.pct, sp.regen.turns, sp.name); mods.regen = 1 + sp.regen.pct; }
        // 守りの陣 (ward): ブレス (wardB) / 全体呪文 (wardS) の被ダメを割る倍率として持つ (0.5 軽減 = ×2 で割る)
        if (sp.ward) for (const w in sp.ward) {
          const st = w === "breath" ? "wardB" : "wardS", m = 1 / (1 - sp.ward[w]);
          this._applyMod(t, st, m, sp.dur, sp.name); mods[st] = m;
        }
        // 法障壁 (grantBarrier): 魔障壁の残回数を配る (ブレス・呪文の被ダメ半減)
        if (sp.grantBarrier) t._barrierLeft = (t._barrierLeft || 0) + sp.grantBarrier;
        // 聖域の鐘 (cure / purge): 守りと同時に状態異常・弱体を祓う
        if (sp.cure && cureAil(t)) cured = true;
        if (sp.purge && this._purgeDown(t)) purged = true;
        res.hits.push({ target: t, buff: true, mods });
      }
      const what = sp.taunt ? "敵の注意を引き付けた" : sp.shield ? "仲間の盾となる構えを取った" : sp.stance === "counter" ? "反撃の構えを取った"
        : sp.charge ? "力を溜めている" : sp.regen && !sp.buff ? "癒しの加護が宿った" : sp.grantBarrier ? "魔障壁が身を包んだ"
        : sp.ward ? (sp.ward.breath ? "隊がブレスへの備えを固めた" : "隊が呪文への備えを固めた") : "力がみなぎる";
      this.log(what, "heal");
      if (cured || purged) this.log("穢れが祓われた", "heal");
    } else if (sp.kind === "debuff") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        if (isMetal(t)) { this.log(`${t.name}には効かない`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); continue; }
        const mods = { ...(sp.debuff || {}) };
        for (const k in (sp.debuff || {})) this._applyMod(t, k, sp.debuff[k], sp.dur, sp.name);
        if (sp.vuln) for (const el in sp.vuln) mods["r_" + el] = sp.vuln[el];
        const tags = [];
        const died = this._inflict(actor, t, sp, tags);
        const st = statusText(tags);
        res.hits.push(died ? { target: t, dmg: 0, died: true, fatal: true } : st ? { target: t, debuff: true, mods, status: st } : { target: t, debuff: true, mods });
      }
      if (sp.debuff && sp.debuff.hit && Object.keys(sp.debuff).length === 1) this.log("敵の狙いが乱れた", "hit");
      else if (sp.debuff) this.log("敵の力が削がれた", "hit");
      if (sp.vuln) this.log(`敵の${Object.keys(sp.vuln).map((k) => VULN_LABEL[k] || k).join("・")}への守りに綻びが生じた`, "hit");
    } else if (sp.kind === "cure") {
      // 治療: 状態異常を治す。purge 付きは弱体 (▼) も解く。全体版は味方全員
      const targets = sp.target === "all-ally" ? this.livingParty() : [(cmd.target && cmd.target.alive) ? cmd.target : actor];
      let any = false;
      for (const t of targets) {
        const had = cureAil(t);
        const pg = sp.purge ? this._purgeDown(t) : false;
        if (had || pg) any = true;
        res.hits.push({ target: t, cured: had || pg });
      }
      this.log(any ? `${sp.name}！ 状態異常と弱体が治った` : `${sp.name}…効果がなかった`, "heal");
    } else if (sp.kind === "mana") {
      // 魔力の譲渡: 味方の MP を回復する (術者の INT で少し伸びる)
      const t = (cmd.target && cmd.target.alive) ? cmd.target : actor;
      const gain = Math.max(1, Math.round(variance(sp.power + (actor.int || 0) * 0.25)));
      const before = t.mp;
      t.mp = Math.min(t.maxmp || 0, t.mp + gain);
      this.log(`${t.name}のMPが ${t.mp - before} 回復`, "heal");
      res.hits.push({ target: t, mpHeal: t.mp - before });
    } else if (sp.kind === "heal") {
      // 回復量は術者の PIE で伸びる。荒行の果て (低HP時) は回復も+30%
      const aMul = pv(actor, "asceticism") && actor.maxhp && actor.hp <= actor.maxhp * 0.3 ? 1.3 : 1;
      const healPower = (sp.power + (actor.pie || 0) * 0.5) * aMul * (1 + this._perkSum(actor, "heal")); // 固有パッシブ (heal)
      // 全体回復
      if (sp.target === "all-ally") {
        let cured = false, revivedAny = false;
        for (const t of this.party) {
          // 復活の福音 (revive): 倒れた味方も対象にして蘇生する
          const wasDead = !t.alive;
          if (wasDead) {
            if (!sp.revive) continue;
            t.alive = true; t.ailment = null; t.asleep = false; t.mind = null; t.reviveAt = null; t._dead = false;
            t.hp = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : Math.min(t.maxhp, variance(healPower));
            revivedAny = true;
            res.hits.push({ target: t, heal: t.hp, revived: true });
            continue;
          }
          const heal = variance(healPower);
          t.hp = Math.min(t.maxhp, t.hp + heal);
          // 大聖祈祷 (cure): 癒しと同時に穢れを祓う / 聖壁の祈り (buff): 守りも固める
          if (sp.cure && cureAil(t)) cured = true;
          if (sp.purge && this._purgeDown(t)) cured = true;
          if (sp.buff) for (const k in sp.buff) this._applyMod(t, k, sp.buff[k], sp.dur, sp.name);
          if (sp.regen) this._applyMod(t, "regen", 1 + sp.regen.pct, sp.regen.turns, sp.name);
          if (sp.grantBarrier) t._barrierLeft = (t._barrierLeft || 0) + sp.grantBarrier;
          res.hits.push({ target: t, heal });
        }
        this.log(revivedAny ? `福音が倒れた者を呼び戻した！` : `味方全員のHPが回復した`, "heal");
        if (cured) this.log("パーティの穢れが祓われた", "heal");
        if (sp.buff) this.log("パーティの守りも固められた", "heal");
      } else {
        // 蘇生呪文は戦闘不能の味方も対象にできる
        let t = sp.target === "self" ? actor : (cmd.target || actor);
        if (!t.alive && !sp.revive) t = actor;
        const wasDead = !t.alive;
        if (wasDead && sp.revive) { t.alive = true; t.ailment = null; t.asleep = false; t.mind = null; t.reviveAt = null; t._dead = false; }
        // revivePct があれば最大HPの割合で蘇生、それ以外は power 回復
        const heal = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : variance(healPower);
        t.hp = Math.min(t.maxhp, (t.hp > 0 ? t.hp : 0) + heal);
        if (wasDead && sp.revive) this.log(`${t.name}は蘇った！ HP ${t.hp}`, "heal");
        else this.log(`${t.name}のHPが ${heal} 回復`, "heal");
        if (sp.cure && cureAil(t)) this.log(`${t.name}の穢れも祓われた`, "heal");
        if (sp.purge) this._purgeDown(t);
        if (sp.regen) this._applyMod(t, "regen", 1 + sp.regen.pct, sp.regen.turns, sp.name);
        // 聖句の加護 (grantEndure): 致死ダメージをHP1で耐える力を授ける (1戦闘1回)
        if (sp.grantEndure && t.alive && !t._grantEndure) {
          t._grantEndure = true;
          this.log(`${t.name}に聖句の加護が宿った (致死を一度耐える)`, "heal");
        }
        res.hits.push({ target: t, heal, revived: wasDead && sp.revive });
      }
    } else if (sp.kind === "sleep") {
      for (const t of this.livingEnemies()) {
        if (isMetal(t)) { this.log(`${t.name}には効かない`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); continue; }
        if (Math.random() < this._rate(actor, t, t.boss ? 0.3 : 0.6)) { t.asleep = true; this.log(`${t.name}は眠った`, "sys"); res.hits.push({ target: t, sleep: true, status: "眠り!" }); }
        else this.log(`${t.name}には効かない`, "sys");
      }
    }
    // 物理技の聖なる余光 (天命の剣など)
    if (isPhys && sp.partyHeal) this._partyHeal(actor, sp.partyHeal, res);
    // 与えたダメージに応じた吸収 (聖光斬・冥魂喰らい / 魔喰いの太刀・魔力強奪)
    if (dealt > 0 && sp.drain && actor.alive) {
      const heal = Math.max(1, Math.round(dealt * sp.drain));
      actor.hp = Math.min(actor.maxhp, actor.hp + heal);
      this.log(`${actor.name}は命を吸い取った (HP+${heal})`, "heal");
      res.hits.push({ target: actor, heal });
    }
    if (dealt > 0 && sp.mpDrain && actor.maxmp) {
      const gain = Math.max(1, Math.round(dealt * sp.mpDrain));
      actor.mp = Math.min(actor.maxmp, actor.mp + gain);
      this.log(`${actor.name}は魔力を喰らった (MP+${gain})`, "heal");
    }
    // 本効果に付随する敵全体への弱体 (攻守の法陣・霞の帳)
    if (sp.debuffAll) {
      for (const t of this.livingEnemies()) {
        if (isMetal(t)) continue; // 金属の体: 弱体は効かない
        for (const k in sp.debuffAll) this._applyMod(t, k, sp.debuffAll[k], sp.dur, sp.name);
        res.hits.push({ target: t, debuff: true, mods: sp.debuffAll });
      }
      this.log("敵の力が削がれた", "hit");
    }
    // 重詠 (大魔導): 攻撃呪文が 20/40/60% でもう一度放たれる (2回目は MP を使わず、重ねては起きない)
    const ch = sp.kind === "atk" && !echo && actor.alive ? pv(actor, "archmageChoei") : 0;
    if (ch && this.livingEnemies().length && Math.random() < ([0, 0.2, 0.4, 0.6][Math.min(3, ch)] || 0)) {
      const tgt = sp.target === "enemy" ? ((cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.livingEnemies())) : cmd.target;
      this._cast(actor, { ...cmd, target: tgt, _echo: true }, res);
    }
    this._perkCast(actor, sp, cost); // 固有パッシブ (cast)
  }

  // 道具を使う。効き目は品で決まり、使い手の能力では伸びない (妨害だけは Lv差が効く)。
  // 結果は呪文と同じ形 (action "spell" + spellKind) で返し、game.js の演出をそのまま使う
  _useItem(actor, cmd, res) {
    const it = cmd.item, u = (it && it.use) || {};
    const owner = cmd.owner || actor;
    const idx = owner && owner.items ? owner.items.indexOf(it) : -1;
    if (idx < 0) { this.log(`${actor.name}は道具を探したが、見当たらない…`, "sys"); return; }
    owner.items.splice(idx, 1); // 使えば (効かなくても) 無くなる
    res.action = "spell"; res.item = it; res.spellName = it.name; res.spellElement = null;
    this.log(`${actor.name}は ${it.name} を使った！${owner !== actor ? ` (${owner.name}の袋から)` : ""}`, "hit");
    if (u.escape) {
      res.spellKind = "escape";
      const T = this._tally();
      T.ft++;
      if (this.noFlee) { T.fs++; this.log("迷宮の異変が退路を閉ざしている！ 逃げられない！", "dmg"); res.fledFail = true; }
      else { T.fo++; this.result = "flee"; this.log("煙に紛れて、戦いから逃れた！", "sys"); res.fled = true; }
      return;
    }
    const tk = useTarget(it);
    if (u.bomb) {
      const b = u.bomb;
      res.spellKind = "atk"; res.spellElement = b.el || null;
      const targets = tk === "all-enemy" ? this.livingEnemies() : [(cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(this.enemies)].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        let em = elemDmgMult(b.el || "none", 1, t.element || "none", edefOf(t));
        em *= this._vulnMul(t, b.el);
        let dmg = Math.max(1, variance(b.power) - Math.floor(this._evit(t) * 0.2));
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        const weak = !!(t.magWeak && t.magWeak > 1);
        if (weak) dmg = Math.round(dmg * t.magWeak);
        if (b.prey && HOLY_PREY.includes(enemyRace(t))) dmg = Math.round(dmg * 1.5);
        const mr = this._resistCut(t, dmg, "magResist");
        if (mr.immune) { this.log(`${t.name}には効かない！`, "dmg"); res.hits.push({ target: t, dmg: 0, immune: true, died: false }); continue; }
        dmg = mr.dmg;
        if (t.guard) dmg = Math.max(1, Math.ceil(dmg * (1 - t.guard)));
        t.hp -= dmg;
        const eff = [em > 1 || weak ? "弱点!" : em < 1 ? "耐性…" : "", mr.tag].filter(Boolean).map((x) => " " + x).join("");
        this.log(`${t.name}に ${dmg} ダメージ${eff}`, "dmg");
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
        else { this.log(`${t.name}には効かなかった`, "sys"); res.hits.push({ target: t, miss: true, resisted: true }); }
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
        t.hp = Math.max(1, Math.min(t.maxhp, Math.round(t.maxhp * u.revive)));
        this.log(`${t.name}は蘇った！ HP ${t.hp}`, "heal");
        res.hits.push({ target: t, heal: t.hp, revived: true });
        any = true;
        continue;
      }
      if (!t.alive) continue;
      if (u.heal || u.full) {
        const heal = u.full ? t.maxhp : u.heal;
        const before = t.hp;
        t.hp = Math.min(t.maxhp, t.hp + heal);
        if (t.hp > before) { this.log(`${t.name}のHPが ${t.hp - before} 回復`, "heal"); any = true; }
        res.hits.push({ target: t, heal: u.full ? t.hp - before : heal });
      }
      if ((u.mp || u.mpFull) && (t.maxmp || 0) > 0) {
        const before = t.mp;
        t.mp = Math.min(t.maxmp, t.mp + (u.mpFull ? t.maxmp : u.mp));
        if (t.mp > before) { this.log(`${t.name}のMPが ${t.mp - before} 回復`, "heal"); any = true; }
        res.hits.push({ target: t, mpHeal: t.mp - before });
      }
      if (kinds.length) {
        const had = cureKinds(t, kinds);
        if (had) { this.log(`${t.name}の状態異常が治った`, "heal"); any = true; }
        if (!(u.heal || u.full || u.mp || u.mpFull)) res.hits.push({ target: t, cured: had });
      }
      if (u.buff) {
        for (const k in u.buff) this._applyMod(t, k, u.buff[k], u.dur || 3, it.name);
        res.hits.push({ target: t, buff: true, mods: { ...u.buff } });
        any = true;
      }
    }
    if (u.buff) this.log(u.all ? "隊の誰もが力をみなぎらせた" : "力がみなぎる", "heal");
    else if (!any) this.log("…効果がなかった", "sys");
  }

  // 攻撃の後に味方全体を癒す (聖剣奮迅・護摩焚き・天命の剣)。PIEで伸びる
  _partyHeal(actor, base, res) {
    const hPow = (base + (actor.pie || 0) * 0.3) * (1 + this._perkSum(actor, "heal"));
    for (const t of this.livingParty()) {
      const heal = variance(hPow);
      t.hp = Math.min(t.maxhp, t.hp + heal);
      res.hits.push({ target: t, heal });
    }
    this.log("聖なる残光がパーティを癒した", "heal");
  }

  // 加護の祈り (firstGuard: 物理) / 封の結界 (spellGuard: 呪文・ブレス): 戦闘中、最初に受けるダメージを Lv 回まで無効にする。無効にしたら true
  _onceGuard(t, key, used, label) {
    if (!t || t.side !== "party") return false;
    const lv = pv(t, key);
    if (!lv || (t[used] || 0) >= lv) return false;
    t[used] = (t[used] || 0) + 1;
    this.log(`${label}が${t.name}を守った！ (無傷)`, "heal");
    return true;
  }
  // 心頭滅却 (修験者): 属性を帯びた攻撃・ブレス・呪文のダメージを -10/15/20%
  _shintou(t) { return t && t.side === "party" ? [0, 0.10, 0.15, 0.20][Math.min(3, pv(t, "asceticShintou"))] || 0 : 0; }

  _die(t) {
    if (t.hp <= 0 && t.alive) {
      // 不屈: 致死を HP1 で耐える (Lv2 で1戦闘2回 / 味方=聖句の加護付与分も同じ回数を共有 / 敵=def の endure)
      const eLv = t.side === "party" ? Math.max(pv(t, "endure"), (t.endure ? 1 : 0), (t._grantEndure ? 1 : 0)) : (t.endure ? 1 : 0);
      const maxEndure = eLv >= 2 ? 2 : (eLv >= 1 ? 1 : 0);
      if (maxEndure > 0 && (t._endureUsed || 0) < maxEndure) {
        t._endureUsed = (t._endureUsed || 0) + 1; t._grantEndure = false; t.hp = 1;
        this.log(`${t.name}は不屈で持ちこたえた！ (HP1)`, t.side === "enemy" ? "dmg" : "heal");
        return false;
      }
      // 勇者の意地 (heroIji): 1戦闘 1/2/3 回、致死を HP1 で耐える。この手番の初めに HP1 だった時は効かない
      const iji = t.side === "party" ? pv(t, "heroIji") : 0;
      if (iji && (t._ijiUsed || 0) < iji && !(t._hpPre != null && t._hpPre <= 1)) {
        t._ijiUsed = (t._ijiUsed || 0) + 1; t.hp = 1; t._hpPre = 1;
        this.log(`${t.name}は勇者の意地で踏みとどまった！ (HP1)`, "heal");
        return false;
      }
      // 名を刻まれぬ墓碑 (迷宮のイベント): この潜入で一度だけ、致死を HP1 で免れる
      if (t.side === "party" && t._evSave) {
        t._evSave = false; t.hp = 1;
        this.log(`墓碑に刻んだ名が、${t.name}を死の淵から引き戻した！ (HP1)`, "heal");
        return false;
      }
      // 不死鳥の心臓 (autoRevive): 1戦闘1回だけ、戦闘不能を割合HPの蘇生で踏みとどまる (LR装飾品)
      if (t.autoRevive && !t._autoReviveUsed) {
        t._autoReviveUsed = true;
        t.hp = Math.max(1, Math.round(t.maxhp * t.autoRevive));
        this.log(`${t.name}は不死鳥の加護で蘇った！ (HP${t.hp})`, "heal");
        return false;
      }
      // 復活の祈り (大司教): 倒れた味方が 1戦闘 1/2/3 回まで HP1 で起き上がる (隊で一番高いLv)
      if (t.side === "party") {
        const ra = Math.max(0, ...this.party.filter((p) => p.alive).map((p) => pv(p, "riseAgain")));
        if (ra && (this._riseUsed || 0) < ra) {
          this._riseUsed = (this._riseUsed || 0) + 1; t.hp = 1;
          this.log(`復活の祈り！ ${t.name}が起き上がった (HP1)`, "heal");
          return false;
        }
      }
      t.hp = 0; t.alive = false; t.asleep = false; t.mind = null; t._ailN = null;
      // 討伐数はこの瞬間に数える (名前・HP の開示が戦闘中でもすぐ反映されるように。「〜を倒した！」より先)
      if (t.side === "enemy" && _onEnemyKilled) { try { _onEnemyKilled(t); } catch (er) { /* 記録の失敗で戦闘を止めない */ } }
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
      if (t.side === "enemy") this._perkKill(this._actor); // 固有パッシブ (kill)
      else this._perkFall(t); // 固有パッシブ (fall)
      // 殉教の祈り: 自分が倒れた時、味方全体を PIE で癒す (1戦闘1回)
      if (t.side === "party" && pv(t, "martyr") && !t._martyrUsed) {
        t._martyrUsed = true;
        const heal = Math.max(1, Math.round((t.pie || 1) * 1.0));
        for (const p of this.party) {
          if (!p.alive || p === t) continue;
          p.hp = Math.min(p.maxhp, p.hp + heal);
        }
        this.log(`殉教の祈り！ ${t.name}の祈りが味方を ${heal} 癒した`, "heal");
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
        this.log(`${e.name}は怒り狂っている！ (攻撃力上昇)`, "dmg");
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
    const soul = this.enemies.reduce((s, e) => s + (e.alive || e._fled ? 0 : ((e.soul != null ? e.soul : e.exp) || 0)), 0);
    const gold = this.enemies.reduce((s, e) => s + (e.alive || e._fled ? 0 : e.gold), 0); // 盗んだ金 (bonusGold) は game.js が別に足す
    return { soul, gold };
  }
}

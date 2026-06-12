// パーティ・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";
import { ITEMS, SLOTS, recalc, equip, weaponRange } from "./items.js";
import { elemDmgMult } from "./dungeons/schema.js";

export const SPELLS = {
  HALITO: { name: "ファイアアロー", mp: 2, kind: "atk", power: 10, element: "fire", target: "enemy", desc: "炎の矢" },
  MAHALITO: { name: "ファイアストーム", mp: 6, kind: "atk", power: 22, element: "fire", target: "all-enemy", desc: "業火" },
  DIOS: { name: "ヒール", mp: 2, kind: "heal", power: 14, target: "ally", desc: "傷を癒す" },
  DIAL: { name: "リカバー", mp: 4, kind: "heal", power: 28, target: "ally", desc: "大きく回復" },
  KATINO: { name: "スリープ", mp: 3, kind: "sleep", power: 0, target: "all-enemy", desc: "敵を眠らせる" },
  MADIOS: { name: "フルヒール", mp: 8, kind: "heal", power: 60, target: "ally", revive: true, desc: "大回復・蘇生" },
  // 僧侶系の上位回復・蘇生
  DIOSALL: { name: "ヒールオール", mp: 6, kind: "heal", power: 18, target: "all-ally", desc: "味方全員を回復" },
  REVIVE: { name: "リバイブ", mp: 8, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 0.5, desc: "戦闘不能をHP50%で蘇生" },
  RESURRECT: { name: "リザレクション", mp: 14, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 1.0, desc: "戦闘不能をHP100%で蘇生" },
  // 攻撃呪文の頂点
  TILTOWAIT: { name: "エクスプロージョン", mp: 16, kind: "atk", power: 48, element: "fire", target: "all-enemy", desc: "全体を消し飛ばす業火" },
  MADALT: { name: "ブリザード", mp: 10, kind: "atk", power: 34, element: "water", target: "all-enemy", desc: "全体を貫く氷嵐" },
  // 支援・治療・弱体 (バフ/デバフは六大ステ atk/vit/agi への倍率)
  CURE: { name: "キュア", mp: 3, kind: "cure", target: "ally", desc: "毒・麻痺・石化を治す" },
  BLESS: { name: "ブレス", mp: 4, kind: "buff", buff: { atk: 1.3 }, target: "ally", desc: "味方単体のATK UP" },
  PROTECT: { name: "プロテクション", mp: 4, kind: "buff", buff: { vit: 1.3 }, target: "ally", desc: "味方単体のVIT UP" },
  DISPEL: { name: "ディスペル", mp: 5, kind: "debuff", debuff: { atk: 0.75, vit: 0.8 }, target: "all-enemy", desc: "敵全体の能力DOWN" },
  WARCRY: { name: "武者震い", mp: 5, kind: "buff", buff: { atk: 1.4 }, target: "self", desc: "自身のATK大UP" },
  GUARDALL: { name: "守りの号令", mp: 6, kind: "buff", buff: { vit: 1.25 }, target: "all-ally", desc: "味方全体のVIT UP" },
  IRONWALL: { name: "鉄壁", mp: 5, kind: "buff", buff: { vit: 1.6 }, target: "self", desc: "自身のVIT大UP" },
  BLIND: { name: "目くらまし", mp: 4, kind: "debuff", debuff: { atk: 0.7 }, target: "enemy", desc: "敵単体のATK DOWN" },
  // 物理技 (攻撃力依存)。hits=多段, critBonus=会心率加算, debuff=命中時に弱体
  KYOUGEKI: { name: "強撃", mp: 3, kind: "phys", power: 1.8, target: "enemy", desc: "渾身の一撃" },
  MIDARE: { name: "乱れ斬り", mp: 7, kind: "phys", power: 0.9, target: "all-enemy", desc: "全体を斬る" },
  DOUBLE: { name: "二段斬り", mp: 4, kind: "phys", power: 1.0, hits: 2, target: "enemy", desc: "2回連続で斬る" },
  ISSEN: { name: "一閃", mp: 8, kind: "phys", power: 3.0, target: "enemy", desc: "必殺の一撃" },
  SHIELDBASH: { name: "シールドバッシュ", mp: 3, kind: "phys", power: 1.4, target: "enemy", desc: "盾で打ち据える" },
  POISONSTAB: { name: "毒刃", mp: 4, kind: "phys", power: 1.2, debuff: { atk: 0.85 }, target: "enemy", desc: "毒の刃で弱らせる" },
  ASSASSINATE: { name: "急所突き", mp: 6, kind: "phys", power: 1.6, critBonus: 0.5, target: "enemy", desc: "会心率の高い一撃" },

  // ---- 職業Lv 28-50 帯の上位スキル ----
  GOUZAN: { name: "豪斬", mp: 10, kind: "phys", power: 2.4, target: "enemy", desc: "鎧ごと断ち割る重い一刀" },
  SENPUU: { name: "旋風斬", mp: 12, kind: "phys", power: 1.3, target: "all-enemy", desc: "竜巻のごとき回転斬り" },
  ZANTETSU: { name: "斬鉄", mp: 16, kind: "phys", power: 4.2, target: "enemy", desc: "鉄をも両断する奥義の一閃" },
  BOUJIN: { name: "防陣", mp: 10, kind: "buff", buff: { vit: 1.4 }, target: "all-ally", desc: "隊列を固める鉄の陣形" },
  JOUMON: { name: "城門崩し", mp: 14, kind: "phys", power: 3.0, debuff: { vit: 0.8 }, target: "enemy", desc: "城門すら砕く渾身の盾撃" },
  KAGENUI: { name: "影縫い", mp: 9, kind: "debuff", debuff: { agi: 0.6 }, target: "all-enemy", desc: "影を縫い止め敵全体を鈍らせる" },
  ZETSUEI: { name: "絶影", mp: 14, kind: "phys", power: 1.1, hits: 3, critBonus: 0.25, target: "enemy", desc: "残像すら斬る神速の三連撃" },
  LAHALITO: { name: "インフェルノ", mp: 11, kind: "atk", power: 36, element: "fire", target: "enemy", desc: "一体を焼き尽くす灼熱の業炎" },
  SEISAI: { name: "星砕", mp: 22, kind: "atk", power: 64, target: "all-enemy", desc: "天より墜ちる星々が戦場を砕く" },

  // ---- 職業スキル拡充 (Lv3/5/7/10/25/30/40 帯を埋める中間スキル) ----
  // 物理技
  TATEWARI: { name: "兜割り", mp: 4, kind: "phys", power: 1.3, debuff: { vit: 0.85 }, target: "enemy", desc: "兜ごと打ち据えてVITを下げる" },
  NAGIHARAI: { name: "薙ぎ払い", mp: 6, kind: "phys", power: 0.7, target: "all-enemy", desc: "敵全体を薙ぎ払う" },
  KIKOKU: { name: "きこく斬", mp: 13, kind: "phys", power: 3.4, target: "enemy", desc: "鬼すら泣かせる怒涛の一刀" },
  KOTE: { name: "小手打ち", mp: 4, kind: "phys", power: 1.2, debuff: { atk: 0.85 }, target: "enemy", desc: "腕を打ちATKを下げる" },
  KASUMEGIRI: { name: "霞斬り", mp: 4, kind: "phys", power: 1.0, debuff: { agi: 0.8 }, target: "enemy", desc: "足を裂きAGIを下げる" },
  TSUJIKAZE: { name: "辻風", mp: 10, kind: "phys", power: 1.0, critBonus: 0.15, target: "all-enemy", desc: "旋風のごとく全体を斬り抜ける" },
  OBORO: { name: "朧抜き", mp: 12, kind: "phys", power: 2.8, critBonus: 0.4, target: "enemy", desc: "朧の太刀筋で急所をえぐる" },
  // 攻撃呪文 (属性のバリエーション)
  ICENEEDLE: { name: "アイスニードル", mp: 3, kind: "atk", power: 13, element: "water", target: "enemy", desc: "氷の針" },
  KAMAITACHI: { name: "かまいたち", mp: 4, kind: "atk", power: 17, element: "wind", target: "enemy", desc: "真空の刃" },
  ROCKBLAST: { name: "ストーンブラスト", mp: 8, kind: "atk", power: 30, element: "earth", target: "enemy", desc: "岩塊の弾丸" },
  HOLYRAY: { name: "聖光", mp: 3, kind: "atk", power: 14, element: "light", target: "enemy", desc: "聖なる光条" },
  SAINTRAY: { name: "聖閃", mp: 9, kind: "atk", power: 24, element: "light", target: "all-enemy", desc: "敵全体を貫く浄化の閃光" },
  // 回復・支援
  DIALALL: { name: "リカバーオール", mp: 12, kind: "heal", power: 40, target: "all-ally", desc: "味方全員を大きく回復" },
  OUJOU: { name: "王城の構え", mp: 18, kind: "buff", buff: { vit: 1.7 }, target: "all-ally", desc: "隊全体を城壁と化す究極の守り" },
};

// 旧プリメイド職テーブル (現行のパーティは人業=souls.js 経由で作られる)。六大ステで定義。
export const CLASSES = {
  fighter: { label: "戦士", hp: 34, mp: 0, atk: 12, vit: 8, agi: 6, int: 2, pie: 2, luk: 5, spells: [] },
  mage: { label: "魔法使い", hp: 18, mp: 14, atk: 5, vit: 3, agi: 7, int: 12, pie: 4, luk: 6, spells: ["HALITO", "MAHALITO", "KATINO"] },
  priest: { label: "僧侶", hp: 24, mp: 12, atk: 7, vit: 5, agi: 5, int: 4, pie: 12, luk: 6, spells: ["DIOS", "DIAL"] },
  knight: { label: "騎士", hp: 42, mp: 0, atk: 11, vit: 12, agi: 4, int: 2, pie: 4, luk: 5, spells: [] },
  thief: { label: "盗賊", hp: 22, mp: 0, atk: 9, vit: 5, agi: 11, int: 4, pie: 2, luk: 10, spells: [] },
  bishop: { label: "魔導僧", hp: 22, mp: 16, atk: 6, vit: 4, agi: 6, int: 9, pie: 9, luk: 6, spells: ["HALITO", "DIOS", "DIAL"] },
};

// パーティは最大6人
export const MAX_PARTY = 6;

export function createParty() {
  const make = (name, clsKey, race, align, gear = [], bag = []) => {
    const c = CLASSES[clsKey];
    const m = {
      name, clsKey, cls: c.label,
      race, align, // 種族・属性 (ウィザードリィ風)
      level: 1,
      hp: c.hp, maxhp: c.hp, mp: c.mp, maxmp: c.mp,
      atk: c.atk, vit: c.vit, agi: c.agi, int: c.int, pie: c.pie, luk: c.luk,
      base: { hp: c.hp, mp: c.mp, atk: c.atk, vit: c.vit, agi: c.agi, int: c.int, pie: c.pie, luk: c.luk }, // 素のステータス
      equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
      items: [],
      ailment: null,      // null | "poison"
      spells: c.spells.slice(),
      alive: true, side: "party",
    };
    // 初期所持品 → 装備
    for (const id of gear) { const it = cloneItem(id); if (it) { m.items.push(it); equip(m, it); } }
    for (const id of bag) { const it = cloneItem(id); if (it) m.items.push(it); }
    recalc(m);
    m.hp = m.maxhp; m.mp = m.maxmp;
    return m;
  };
  return [
    make("アレク", "fighter", "人間", "善", ["shortSword", "woodShield", "leatherArmor", "leatherGloves"], ["herb"]),
    make("ガレス", "knight", "ドワーフ", "善", ["battleAxe", "ironHelm", "ironGauntlets"], ["herb"]),
    make("ロビン", "thief", "ホビット", "中立", ["dagger", "leatherBoots", "leatherGloves"], ["herb", "antidote"]),
    make("メリナ", "mage", "エルフ", "中立", ["magicStaff", "robe"], ["manaDrop"]),
    make("セイル", "priest", "人間", "善", ["warHammer", "cap"], ["herb", "herb"]),
    make("イルザ", "bishop", "ノーム", "悪", ["dagger", "robe", "silverGloves"], ["manaDrop"]),
  ].slice(0, MAX_PARTY);
}

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
  const list = Array.from({ length: count }, () => makeEnemy(key, scale));
  // 同種の群れは A/B/C… で呼び分ける (ログ・対象選択の判別用)
  if (list.length > 1) list.forEach((e, i) => { e.name += String.fromCharCode(65 + i); });
  return list;
}

export function spawnBossEnemies(key = "dragon", scale = 1) {
  return [makeEnemy(key, scale, true)];
}

// 宝箱から出るミミック (通常より手強い)。迷宮のランクに合った個体に化ける
export function spawnMimic(rank, scale = 1) {
  const pool = Object.keys(MONSTERS).filter((k) => MONSTERS[k].rank === rank && !MONSTERS[k].boss);
  const key = pool.length ? pool[rand(pool.length)] : "cm_slime";
  const e = makeEnemy(key, scale);
  e.name = "ミミック";
  e.maxhp = Math.round(e.maxhp * 1.4);
  e.hp = e.maxhp;
  e.atk = Math.round(e.atk * 1.25);
  e.gold = Math.round(e.gold * 2);
  e.soul = Math.round(e.soul * 1.5);
  return [e];
}

function makeEnemy(key, scale = 1, boss = false) {
  const m = MONSTERS[key];
  const hp = Math.max(1, Math.round(m.maxhp * scale));
  return {
    uid: ++_uid, key, mon: m, name: (boss ? m.name : m.name),
    element: m.element || "none",
    hp, maxhp: hp,
    // モンスター定義の atk/def/spd を六大ステへ写像 (def→VIT, spd→AGI)
    atk: Math.max(1, Math.round(m.atk * scale)),
    vit: Math.round(m.def * scale),
    agi: m.spd,
    soul: Math.round(m.soul * scale), gold: Math.round(m.gold * scale),
    boss: boss || !!m.boss,
    ability: m.ability || null, // 特殊能力 (毒/麻痺/石化/即死/窃盗/ドレイン/ブレス)
    alive: true, asleep: false, side: "enemy",
  };
}

const rand = (n) => Math.floor(Math.random() * n);
const variance = (base) => Math.max(1, base + rand(Math.ceil(base * 0.4)) - rand(Math.ceil(base * 0.2)));

// 職業ランクパッシブのLvを引く (souls.js の recalcDoll が passiveMap を埋める)
const pv = (a, key) => (a && a.passiveMap && a.passiveMap[key]) || 0;
// 破邪・聖刃の対象種族
const HOLY_PREY = ["undead", "specter", "demon"];
const enemyRace = (e) => (e && e.mon && e.mon.race) || null;

// 省詠唱 (chant) 込みの実効MPコスト
export function spellCost(actor, sp) {
  const c = pv(actor, "chant");
  if (!c) return sp.mp;
  return Math.max(1, Math.ceil(sp.mp * (c >= 2 ? 0.7 : 0.85)));
}

// 戦闘の状態機械: AGI順に1人ずつ手番が回る。
// 1手ずつ進め、各行動は結果オブジェクトを返す (演出は game.js 側で行う)。
// opts.opening: "preempt" (先制) | "ambush" (奇襲) | null — 最初のラウンドで片側のみ行動
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
    this._blessingUsed = false;
    this.opening = opts.opening || null;
    this._roundNo = 0;
    this._bigBarrierUsed = false;
    for (const a of [...party, ...enemies]) { a.buffs = { atk: 1, vit: 1, agi: 1 }; a._enduredThisBattle = false; }
    for (const p of party) {
      p._coverLeft = pv(p, "cover");
      p._barrierLeft = pv(p, "barrier");
      p._scriptureUsed = false;
      p._martyrUsed = false;
      p._kenma = false;
      p._ambushCritLeft = this.opening === "preempt" && pv(p, "ambushCrit") ? 1 : 0;
    }
    this._openingStrikes();
    this.advance();
  }

  // 戦闘開始時の自動攻撃 (居合/開幕呪撃)。奇襲されている時は発動しない
  _openingStrikes() {
    if (this.opening === "ambush") return;
    for (const p of this.party) {
      if (!p.alive) continue;
      if (pv(p, "iai")) {
        const t = this._randAlive(this.attackableEnemies(p)); // 居合も武器の射程に従う
        if (t) { this.log(`${p.name}の居合！`, "hit"); this._physical(p, t, { power: 0.8, name: "居合" }); }
      }
      if (pv(p, "openSpell")) {
        const t = this._randAlive(this.enemies);
        if (t) {
          const dmg = Math.max(1, Math.round(variance((p.int || 1) * 1.2) - this._evit(t) * 0.2));
          t.hp -= dmg;
          this.log(`${p.name}の開幕呪撃！ ${t.name}に ${dmg} ダメージ`, "hit");
          if (t.asleep) t.asleep = false;
          this._die(t);
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

  // 物理の隊列補正: 後衛は物理を「与える」「受ける」ともに半減。魔法・ブレスには掛からない
  _rowMul(actor, tgt) {
    return (this.isBackRow(actor) ? 0.5 : 1) * (this.isBackRow(tgt) ? 0.5 : 1);
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

  // AGI(+乱数)で行動順を組み直す。ラウンド開始時に毒のダメージが入る。
  // 第1ラウンドは先制/奇襲なら片側のみが行動する
  _startRound() {
    this._roundNo++;
    for (const a of [...this.party, ...this.enemies]) {
      if (!a.alive || a.ailment !== "poison") continue;
      const d = Math.max(1, Math.round(a.maxhp * 0.05));
      a.hp -= d;
      this.log(`${a.name}は毒に蝕まれた (${d})`, "dmg");
      this._die(a);
    }
    this._checkEnd();
    let pool = [...this.party, ...this.enemies];
    if (this._roundNo === 1 && this.opening === "preempt") pool = [...this.party];
    else if (this._roundNo === 1 && this.opening === "ambush") pool = [...this.enemies];
    const eagi = (a) => (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1);
    this.queue = pool
      .filter((a) => a.alive)
      .sort((a, b) => (eagi(b) + rand(4)) - (eagi(a) + rand(4)));
  }

  // 次の手番へ。味方なら input (行動不能なら stunned)、敵なら enemy フェーズで止まる
  advance() {
    if (this.result) { this.phase = "done"; return; }
    while (true) {
      if (this.queue.length === 0) this._startRound();
      if (this.result) { this.phase = "done"; return; }
      const actor = this.queue.shift();
      if (!actor || !actor.alive) continue;
      this.current = actor;
      if (actor.side === "party") {
        if (actor.asleep || actor.ailment === "paralyze" || actor.ailment === "stone") { this.phase = "stunned"; return; }
        actor._defending = false; // 防御は次の自分の手番まで
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
    const res = { actor: a, action: "stunned", side: a.side, hits: [] };
    if (a.ailment === "stone") this.log(`${a.name}は石化して動けない…`, "sys");
    else if (a.ailment === "paralyze") {
      if (Math.random() < 0.35) { a.ailment = null; this.log(`${a.name}の麻痺が解けた！`, "heal"); }
      else this.log(`${a.name}は痺れて動けない…`, "sys");
    } else if (a.asleep) {
      if (Math.random() < 0.45) { a.asleep = false; this.log(`${a.name}は目を覚ました`, "sys"); }
      else this.log(`${a.name}は眠っている…`, "sys");
    }
    this._checkEnd();
    return res;
  }

  // 手番の味方の行動を選択。{ needTarget } を返す
  chooseAction(action, spellKey = null) {
    const actor = this.current;
    if (action === "attack") {
      this.pending = { actor, action: "attack" };
      this.phase = "target";
      return { needTarget: true };
    }
    if (action === "spell") {
      const sp = SPELLS[spellKey];
      if (actor.mp < spellCost(actor, sp)) { this.log("MPが足りない！", "sys"); return { invalid: true }; }
      this.pending = { actor, action: "spell", spellKey };
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
    const sp = SPELLS[p.spellKey];
    if (sp.target === "enemy") return sp.kind === "phys" ? this.attackableEnemies(p.actor) : this.livingEnemies(); // 物理技は射程に従う。呪文は全体に届く
    if (sp.target === "ally") return sp.kind === "heal" ? this.party : this.livingParty(); // 回復系は死者も選べる(蘇生)
    return [];
  }

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
    return res;
  }

  // 敵の手番を実行し結果を返す。特殊能力 (ability) 持ちは一定確率で使う
  enemyAct() {
    const actor = this.current;
    let cmd;
    if (actor._flinch) {
      // 怯み: この手番を失う
      actor._flinch = false;
      this.log(`${actor.name}は怯んで動けない！`, "sys");
      const res = { actor, action: "stunned", side: actor.side, hits: [] };
      this._checkEnd();
      return res;
    }
    if (actor.asleep) {
      cmd = { actor, action: "sleep" };
    } else {
      const ab = actor.ability;
      if (ab && Math.random() < (ab === "breath" ? 0.30 : 0.25)) {
        cmd = { actor, action: ab === "breath" ? "breath" : "special", kind: ab, target: this._pickPartyTarget() };
      } else {
        cmd = { actor, action: "attack", target: this._pickPartyTarget() };
      }
    }
    const res = this._exec(cmd);
    this._checkEnd();
    return res;
  }

  _randAlive(list) {
    const a = list.filter((x) => x.alive);
    return a[rand(a.length)] || null;
  }

  // 敵の単体行動の標的選び。前衛は狙われやすく (重み3)、後衛は狙われにくい (重み1)。
  // 挑発 (taunt) 持ちはさらに3倍狙われやすい
  _pickPartyTarget() {
    const list = this.livingParty();
    if (!list.length) return null;
    const pool = [];
    for (const p of list) {
      const w = (this.isBackRow(p) ? 1 : 3) * (pv(p, "taunt") ? 3 : 1);
      for (let i = 0; i < w; i++) pool.push(p);
    }
    return pool[rand(pool.length)];
  }

  // 行動を実行し、演出用の結果 { actor, action, side, hits:[{target,dmg,crit,miss,heal,sleep,died}] } を返す
  _exec(cmd) {
    const { actor, action } = cmd;
    const res = { actor, action, side: actor.side, hits: [] };
    if (action === "sleep") {
      if (Math.random() < 0.45) { actor.asleep = false; this.log(`${actor.name}は目を覚ました`, "sys"); res.woke = true; }
      else { this.log(`${actor.name}は眠っている…`, "sys"); res.asleep = true; }
      return res;
    }
    if (action === "defend") {
      actor._defending = true;
      this.log(`${actor.name}は身を守っている`, "sys");
      return res;
    }
    if (action === "run") {
      // 逃げ足 (fleetFoot): 隊に持ち主がいれば成功率+30%
      const fleet = this.party.some((p) => p.alive && pv(p, "fleetFoot"));
      if (Math.random() < Math.min(0.95, 0.55 + (fleet ? 0.30 : 0))) { this.result = "flee"; this.log("うまく逃げ出した！", "sys"); res.fled = true; }
      else { this.log(`${actor.name}は逃げられなかった！`, "dmg"); res.fledFail = true; }
      return res;
    }
    if (action === "attack") {
      // 標的が倒れていたら選び直す (味方は射程内から、敵は隊列の重み付きで)
      const tgt = (cmd.target && cmd.target.alive) ? cmd.target
        : actor.side === "party" ? this._randAlive(this.attackableEnemies(actor)) : this._pickPartyTarget();
      if (tgt) {
        const h = this._physical(actor, tgt, { basic: true });
        res.hits.push(h);
        if (actor.side === "party") this._afterBasic(actor, tgt, h, res);
      }
      return res;
    }
    if (action === "spell") {
      this._cast(actor, cmd, res);
      return res;
    }
    if (action === "breath") {
      // ブレス: 味方全体への属性ダメージ (回避不可・VITで微減)
      this.log(`${actor.name}は${actor.boss ? "業炎の" : ""}ブレスを吐いた！`, "dmg");
      res.breath = true;
      // 大結界: 1戦闘1回、自動で隊全体の被ダメージを半減する
      let bigB = false;
      if (!this._bigBarrierUsed && this.party.some((p) => p.alive && pv(p, "bigBarrier"))) {
        this._bigBarrierUsed = true;
        bigB = true;
        this.log("大結界が隊を包んだ！", "heal");
      }
      for (const t of this.livingParty()) {
        const em = elemDmgMult(actor.element || "none", 1, t.element || "none", t.elemDef);
        let dmg = Math.max(1, Math.round(variance(this._eatk(actor) * 0.85) - this._evit(t) * 0.25));
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        if (t._defending) dmg = Math.ceil(dmg * 0.5);
        if (bigB) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        else if (t._barrierLeft > 0) {
          // 魔障壁: 個人のブレス・呪文被ダメ半減 (残回数制)。魔力反射は防いだ分を返す
          t._barrierLeft--;
          const cut = dmg - Math.ceil(dmg * 0.5);
          dmg = Math.ceil(dmg * 0.5);
          this.log(`${t.name}の魔障壁がブレスを弱めた！`, "heal");
          if (cut > 0 && pv(t, "reflect") && actor.alive) {
            actor.hp -= cut;
            this.log(`魔力反射！ ${actor.name}に ${cut} ダメージ`, "hit");
            this._die(actor);
          }
        }
        t.hp -= dmg;
        this.log(`${t.name}に ${dmg} ダメージ${em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : ""}`, "dmg");
        if (t.asleep) t.asleep = false;
        const died = this._die(t);
        if (!died) this._postDamage(t);
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
        if (!h.miss && tt.alive && !tt.ailment && Math.random() < 0.4 * (1 - this._ailRes(tt))) {
          tt.ailment = k;
          h.ailment = k;
          this.log(`${tt.name}は${k === "poison" ? "毒" : "麻痺"}に侵された！`, "dmg");
        }
      } else if (k === "stone") {
        this.log(`${actor.name}の石化の凝視！`, "dmg");
        if (t.ailment || Math.random() >= 0.32 * (1 - this._hardRes(t))) { this.log(`${t.name}は目を逸らした`, "sys"); res.hits.push({ target: t, miss: true }); }
        else { t.ailment = "stone"; this.log(`${t.name}は石になった！`, "dmg"); res.hits.push({ target: t, stoned: true }); }
      } else if (k === "critical") {
        const h = this._physical(actor, t, { power: 1.1, name: "死神の一撃" });
        res.hits.push(h);
        if (!h.miss && t.alive && Math.random() < 0.15 * (1 - this._hardRes(t))) {
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
      }
      return res;
    }
    return res;
  }

  // バフ込みの実効ATK・VIT
  _eatk(a) { return Math.max(1, Math.round(a.atk * ((a.buffs && a.buffs.atk) || 1))); }
  _evit(t) { return Math.round((t.vit || 0) * ((t.buffs && t.buffs.vit) || 1)); }

  // 低HP系パッシブ (闘魂/荒行の果て) の与ダメージ倍率
  _lowHpMul(a) {
    if (!a.maxhp || a.hp > a.maxhp * 0.3) return 1;
    let m = 1;
    const fs = pv(a, "fightSpirit");
    if (fs) m *= fs >= 2 ? 1.40 : 1.25;
    if (pv(a, "asceticism")) m *= 1.3;
    return m;
  }

  // かばう: 瀕死の味方への攻撃を肩代わりする味方を探す
  _coverFor(tgt) {
    if (tgt.side !== "party" || !tgt.maxhp || tgt.hp > tgt.maxhp * 0.25) return null;
    let best = null;
    for (const p of this.party) {
      if (!p.alive || p === tgt || !(p._coverLeft > 0)) continue;
      if (p.asleep || p.ailment === "paralyze" || p.ailment === "stone") continue;
      if (!best || pv(p, "cover") > pv(best, "cover")) best = p;
    }
    return best;
  }

  // 異常耐性 (resistAilment / 聖域): 毒・麻痺・睡眠の付与率カット
  _ailRes(t) {
    if (t.side !== "party") return 0;
    let lv = pv(t, "resistAilment");
    if (lv < 1 && this.party.some((p) => p.alive && pv(p, "sanctuary"))) lv = 1;
    return lv >= 2 ? 0.60 : lv === 1 ? 0.30 : 0;
  }
  // 石化・即死への耐性 (異常耐性Lv2のみ)
  _hardRes(t) {
    return t.side === "party" && pv(t, "resistAilment") >= 2 ? 0.30 : 0;
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
    if (defender.asleep || defender.ailment === "paralyze" || defender.ailment === "stone") return;
    const cLv = pv(defender, "counter");
    if (cLv && Math.random() < [0, 0.15, 0.25, 0.35][cLv]) {
      const mul = [0, 0.5, 0.7, 1.0][cLv];
      // 反撃も物理なので隊列補正を受ける
      let dmg = Math.max(1, Math.round((variance(Math.round(this._eatk(defender) * mul)) - Math.floor(this._evit(attacker) * 0.5)) * this._rowMul(defender, attacker)));
      let crit = false;
      if (cLv >= 3 && Math.random() < 0.06 + (defender.critBonus || 0)) { crit = true; dmg = Math.floor(dmg * 1.85); }
      attacker.hp -= dmg;
      this.log(`${defender.name}の反撃！ ${attacker.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}`, "hit");
      this._die(attacker);
      return;
    }
    if (pv(defender, "divineCounter") && Math.random() < 0.20) {
      const dmg = Math.max(1, variance(Math.round((defender.pie || 1) * 0.8)));
      attacker.hp -= dmg;
      this.log(`${defender.name}の神罰の鉄槌！ ${attacker.name}に ${dmg} ダメージ`, "hit");
      this._die(attacker);
    }
  }

  // 通常攻撃後の追撃 (味方のみ): 残心 / 連撃 / 二刀の理
  _afterBasic(actor, tgt, h, res) {
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
    if (ex && Math.random() < (ex >= 2 ? 0.20 : 0.10)) {
      this.log(`${actor.name}の連撃！`, "hit");
      res.hits.push(this._physical(actor, tgt, { power: 0.6, name: "連撃" }));
      if (!tgt.alive) return;
    }
    // 二刀の理: 30%でINT×0.6の追撃呪文
    if (pv(actor, "twinArts") && Math.random() < 0.30) {
      const dmg = Math.max(1, Math.round(variance((actor.int || 1) * 0.6) - this._evit(tgt) * 0.2));
      tgt.hp -= dmg;
      this.log(`二刀の理！ ${tgt.name}に ${dmg} ダメージ`, "hit");
      res.hits.push({ target: tgt, dmg, died: this._die(tgt) });
    }
  }

  _physical(actor, tgt, opt = {}) {
    // かばう: 瀕死の味方への攻撃は護衛役が肩代わりする
    let coverMul = 1;
    if (actor.side === "enemy" && tgt.side === "party") {
      const g = this._coverFor(tgt);
      if (g) {
        g._coverLeft--;
        this.log(`${g.name}は${tgt.name}をかばった！`, "sys");
        if (pv(g, "cover") >= 2) coverMul = 0.7;
        tgt = g;
      }
    }
    // 見切り (parry): 確率で完全回避
    const pLvP = pv(tgt, "parry");
    if (pLvP && Math.random() < (pLvP >= 2 ? 0.15 : 0.10)) {
      this.log(`${tgt.name}は見切った！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    // 命中判定: 素の命中漏れ + 対象の敏捷(AGI)による回避
    const evade = Math.min(0.4, Math.max(0, ((tgt.agi || 6) - 6) * 0.012));
    if (Math.random() < 0.06 + evade) {
      this.log(`${tgt.name}は攻撃をかわした！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    const power = opt.power || 1;       // 技の倍率 (通常攻撃は1)
    // 魔力撃 (spellBlade): 通常攻撃にINTを上乗せ
    const sb = pv(actor, "spellBlade");
    const sbAdd = sb ? Math.round((actor.int || 0) * (sb >= 2 ? 1.0 : 0.5) * power) : 0;
    // ダメージ = ATK×倍率×低HP補正 − VIT/2 (VITが被ダメージ軽減を担う)
    let dmg = variance(Math.round(this._eatk(actor) * power * this._lowHpMul(actor))) + sbAdd - Math.floor(this._evit(tgt) * 0.5);
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    // 城壁の構え: 防御中の持ち主がいれば隊全体の被ダメ-10%
    if (tgt.side === "party" && this.party.some((p) => p.alive && p._defending && pv(p, "bastion"))) dmg = Math.floor(dmg * 0.9);
    if (coverMul !== 1) dmg = Math.floor(dmg * coverMul);
    // 属性相性: 攻撃属性 (技 > 装備の属性攻撃 > 固有属性) × 対象の固有属性/属性防御
    const aE = opt.element || (actor.elemAtk && actor.elemAtk.el) || actor.element || "none";
    const aLv = (actor.elemAtk && actor.elemAtk.el === aE) ? Math.max(1, actor.elemAtk.lv) : 1;
    const em = elemDmgMult(aE, aLv, tgt.element || "none", tgt.elemDef);
    if (em !== 1) dmg = Math.round(dmg * em);
    // 種族特効 (破邪) / 毒の獲物 (蠱毒)
    if (pv(actor, "smite") && HOLY_PREY.includes(enemyRace(tgt))) dmg = Math.round(dmg * 1.3);
    if (pv(actor, "gokudoku") && tgt.ailment === "poison") dmg = Math.round(dmg * 1.3);
    // 会心: 基礎 + 会心パッシブ + 幸運(LUK) + 技の会心補正。確定会心系が先に立つ
    const luckCrit = Math.max(0, ((actor.luk || 8) - 8)) * 0.005;
    let critChance = 0.06 + (actor.critBonus || 0) + luckCrit + (opt.critBonus || 0);
    if (pv(actor, "holyEdge") && HOLY_PREY.includes(enemyRace(tgt))) critChance += 0.15;
    const fs = pv(actor, "fightSpirit");
    if (fs >= 2 && actor.maxhp && actor.hp <= actor.maxhp * 0.3) critChance += 0.15;
    let sureCrit = false;
    if (opt.basic && actor._kenma) { actor._kenma = false; sureCrit = true; }       // 剣魔合一
    if (opt.basic && actor._ambushCritLeft > 0) { actor._ambushCritLeft--; sureCrit = true; } // 不意打ち
    if (pv(actor, "sleepKill") && (tgt.asleep || tgt.ailment === "paralyze")) sureCrit = true; // 寝込み襲い
    const crit = sureCrit || Math.random() < critChance;
    if (crit) dmg = Math.floor(dmg * 1.85 * (pv(actor, "vitalEye") ? 1.25 : 1)); // 急所読み: 会心強化
    // 隊列補正: 後衛は物理の与ダメ・被ダメが半減
    const rm = this._rowMul(actor, tgt);
    if (rm !== 1) dmg = Math.round(dmg * rm);
    dmg = Math.max(1, dmg);
    tgt.hp -= dmg;
    const eff = em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : "";
    this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}${eff}`,
      actor.side === "party" ? "hit" : "dmg");
    if (tgt.asleep) tgt.asleep = false;
    // 命中時の弱体 (毒刃など)
    if (opt.debuff && tgt.alive) { tgt.buffs = tgt.buffs || { atk: 1, vit: 1, agi: 1 }; for (const k in opt.debuff) tgt.buffs[k] *= opt.debuff[k]; }
    // 毒刃 (venomBlade): 敵を毒に侵す
    const vb = pv(actor, "venomBlade");
    if (vb && tgt.alive && tgt.side === "enemy" && !tgt.ailment && Math.random() < (vb >= 2 ? 0.30 : 0.15)) {
      tgt.ailment = "poison";
      this.log(`${tgt.name}は毒に侵された！`, "hit");
    }
    // 怯ませ (flinch): 主(ボス)には効かない・既に怯んでいる敵には重ねない
    if (pv(actor, "flinch") && opt.basic && tgt.alive && tgt.side === "enemy" && !tgt.boss && !tgt._flinch && Math.random() < 0.10) {
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
      if (actor.side === "enemy") this._tryCounter(tgt, actor);
    }
    return { target: tgt, dmg, crit, died };
  }

  _cast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    actor.mp -= spellCost(actor, sp); // 省詠唱 (chant) 持ちは消費が軽い
    if (pv(actor, "kenma")) actor._kenma = true; // 剣魔合一: 次の通常攻撃が確定会心
    res.spellName = sp.name;
    res.spellKind = sp.kind;
    res.spellElement = sp.element || null;
    const isPhys = sp.kind === "phys";
    this.log(isPhys ? `${actor.name}の ${sp.name}！` : `${actor.name}は ${sp.name} を唱えた！`, "hit");
    if (isPhys) {
      // 物理技は通常攻撃と同じ計算系 (倍率/多段/会心/弱体)
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      const hits = sp.hits || 1;
      for (const t of targets) {
        for (let h = 0; h < hits; h++) {
          if (!t.alive) break;
          res.hits.push(this._physical(actor, t, { power: sp.power, critBonus: sp.critBonus, debuff: sp.debuff, name: sp.name }));
        }
      }
    } else if (sp.kind === "atk") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      const scLv = pv(actor, "spellCrit"); // 呪文会心
      for (const t of targets) {
        if (!t.alive) continue;
        // 呪文の属性は Lv1 扱い。同属性の属性攻撃を装備していれば、そのレベルで増幅される
        const aLv = (actor.elemAtk && actor.elemAtk.el === sp.element) ? Math.max(1, actor.elemAtk.lv) : 1;
        let em = elemDmgMult(sp.element || "none", aLv, t.element || "none", t.elemDef);
        if (em < 1 && pv(actor, "elemFloor")) em = 1; // 森羅の理: 属性不利が出ない
        // 攻撃呪文の威力は術者の INT で伸びる。低HP補正 (荒行の果て) も乗る
        const power = sp.power + (actor.int || 0) * 0.5;
        let dmg = Math.max(1, Math.round(variance(power) * this._lowHpMul(actor)) - Math.floor(this._evit(t) * 0.2));
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        if (pv(actor, "gokudoku") && t.ailment === "poison") dmg = Math.round(dmg * 1.3); // 蠱毒
        const crit = scLv && Math.random() < (scLv >= 2 ? 0.18 : 0.10);
        if (crit) dmg = Math.floor(dmg * 1.5);
        t.hp -= dmg;
        const eff = em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : "";
        this.log(`${t.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}${eff}`, "dmg");
        if (t.asleep) t.asleep = false;
        res.hits.push({ target: t, dmg, crit, eff: em > 1 ? "weak" : em < 1 ? "resist" : null, died: this._die(t) });
      }
    } else if (sp.kind === "buff") {
      const targets = sp.target === "self" ? [actor] : sp.target === "all-ally" ? this.livingParty() : [cmd.target || actor].filter(Boolean);
      for (const t of targets) {
        t.buffs = t.buffs || { atk: 1, vit: 1, agi: 1 };
        for (const k in sp.buff) t.buffs[k] = Math.min(3, (t.buffs[k] || 1) * sp.buff[k]);
        res.hits.push({ target: t, buff: true });
      }
      this.log(`${sp.name}の効果！`, "heal");
    } else if (sp.kind === "debuff") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        t.buffs = t.buffs || { atk: 1, vit: 1, agi: 1 };
        for (const k in sp.debuff) t.buffs[k] = Math.max(0.3, (t.buffs[k] || 1) * sp.debuff[k]);
        res.hits.push({ target: t, debuff: true });
      }
      this.log(`${sp.name}！ 敵の力が削がれた`, "hit");
    } else if (sp.kind === "cure") {
      const t = (cmd.target && cmd.target.alive) ? cmd.target : actor;
      const had = t.ailment;
      t.ailment = null;
      this.log(had ? `${sp.name}！ ${t.name}の状態異常が治った` : `${sp.name}…効果がなかった`, "heal");
      res.hits.push({ target: t, cured: !!had });
    } else if (sp.kind === "heal") {
      // 回復量は術者の PIE で伸びる。荒行の果て (低HP時) は回復も+30%
      const aMul = pv(actor, "asceticism") && actor.maxhp && actor.hp <= actor.maxhp * 0.3 ? 1.3 : 1;
      const healPower = (sp.power + (actor.pie || 0) * 0.5) * aMul;
      // 全体回復
      if (sp.target === "all-ally") {
        for (const t of this.party) {
          if (!t.alive) continue;
          const heal = variance(healPower);
          t.hp = Math.min(t.maxhp, t.hp + heal);
          res.hits.push({ target: t, heal });
        }
        this.log(`味方全員のHPが回復した`, "heal");
      } else {
        // 蘇生呪文は戦闘不能の味方も対象にできる
        let t = cmd.target || actor;
        if (!t.alive && !sp.revive) t = actor;
        const wasDead = !t.alive;
        if (wasDead && sp.revive) { t.alive = true; t.ailment = null; t.reviveAt = null; t._dead = false; }
        // revivePct があれば最大HPの割合で蘇生、それ以外は power 回復
        const heal = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : variance(healPower);
        t.hp = Math.min(t.maxhp, (t.hp > 0 ? t.hp : 0) + heal);
        if (wasDead && sp.revive) this.log(`${t.name}は蘇った！ HP ${t.hp}`, "heal");
        else this.log(`${t.name}のHPが ${heal} 回復`, "heal");
        res.hits.push({ target: t, heal, revived: wasDead && sp.revive });
      }
    } else if (sp.kind === "sleep") {
      for (const t of this.livingEnemies()) {
        if (Math.random() < 0.6) { t.asleep = true; this.log(`${t.name}は眠った`, "sys"); res.hits.push({ target: t, sleep: true }); }
        else this.log(`${t.name}には効かない`, "sys");
      }
    }
  }

  _die(t) {
    if (t.hp <= 0 && t.alive) {
      // 不屈: 致死を1回だけ HP1 で耐える
      if (t.side === "party" && (t.endure || pv(t, "endure")) && !t._enduredThisBattle) {
        t._enduredThisBattle = true; t.hp = 1;
        this.log(`${t.name}は不屈で持ちこたえた！ (HP1)`, "heal");
        return false;
      }
      t.hp = 0; t.alive = false;
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
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
        e.buffs = e.buffs || { atk: 1, vit: 1, agi: 1 };
        e.buffs.atk = Math.min(3, (e.buffs.atk || 1) * 1.3);
        this.log(`${e.name}は怒り狂っている！ (攻撃力上昇)`, "dmg");
        this._enrageFx = true; // game.js が演出に使う
      }
    }
    if (this.livingEnemies().length === 0) { this.result = "win"; return; }
    // 全滅 = 生存者ゼロ、または生存者全員が石化
    const living = this.livingParty();
    if (living.length === 0 || living.every((p) => p.ailment === "stone")) {
      // 聖者の祝福: 全滅時、1回だけ全員HP1で復活 (祝福持ちが編成にいれば)
      if (!this._blessingUsed && this.party.some((p) => p.blessing)) {
        this._blessingUsed = true;
        for (const p of this.party) { p.alive = true; p.hp = Math.max(1, p.hp); p.ailment = null; p.reviveAt = null; p._dead = false; }
        this.log("聖者の祝福！ 倒れた仲間が HP1 で立ち上がった！", "win");
        this._blessingFired = true;
        return;
      }
      this.result = "lose";
    }
  }

  // 戦闘後の報酬計算。Soul が経験値の役割を兼ねる (魂の成長は館の「魂の強化」で行う)。
  // 旧セーブの戦闘中データは soul を持たないため exp を引き継ぐ
  rewards() {
    const soul = this.enemies.reduce((s, e) => s + (e.alive ? 0 : ((e.soul != null ? e.soul : e.exp) || 0)), 0);
    const gold = this.enemies.reduce((s, e) => s + (e.alive ? 0 : e.gold), 0);
    return { soul, gold };
  }
}

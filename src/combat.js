// パーティ・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";
import { ITEMS, SLOTS, recalc, equip } from "./items.js";
import { elemMult } from "./dungeons/schema.js";

export const SPELLS = {
  HALITO: { name: "ハリト", mp: 2, kind: "atk", power: 10, element: "fire", target: "enemy", desc: "炎の矢" },
  MAHALITO: { name: "マハリト", mp: 6, kind: "atk", power: 22, element: "fire", target: "all-enemy", desc: "業火" },
  DIOS: { name: "ディオス", mp: 2, kind: "heal", power: 14, target: "ally", desc: "傷を癒す" },
  DIAL: { name: "ディアル", mp: 4, kind: "heal", power: 28, target: "ally", desc: "大きく回復" },
  KATINO: { name: "カティノ", mp: 3, kind: "sleep", power: 0, target: "all-enemy", desc: "敵を眠らせる" },
  MADIOS: { name: "マディオス", mp: 8, kind: "heal", power: 60, target: "ally", revive: true, desc: "大回復・蘇生" },
  // 僧侶系の上位回復・蘇生
  DIOSALL: { name: "ヒールオール", mp: 6, kind: "heal", power: 18, target: "all-ally", desc: "味方全員を回復" },
  REVIVE: { name: "リバイブ", mp: 8, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 0.5, desc: "戦闘不能をHP50%で蘇生" },
  RESURRECT: { name: "リザレクション", mp: 14, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 1.0, desc: "戦闘不能をHP100%で蘇生" },
  // 攻撃呪文の頂点
  TILTOWAIT: { name: "ティルトウェイト", mp: 16, kind: "atk", power: 48, element: "fire", target: "all-enemy", desc: "全体を消し飛ばす業火" },
  MADALT: { name: "マダルト", mp: 10, kind: "atk", power: 34, element: "water", target: "all-enemy", desc: "全体を貫く氷嵐" },
  // 支援・治療・弱体 (バフ/デバフは六大ステ atk/vit/agi への倍率)
  CURE: { name: "キュア", mp: 3, kind: "cure", target: "ally", desc: "毒・麻痺を治す" },
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
// カードでめくったモンスター: 階層が深いほど複数で出やすい。scale で迷宮ごとの強さ調整
export function spawnCardEnemies(key, floor, scale = 1) {
  const count = Math.random() < 0.2 + floor * 0.12 ? 2 : 1;
  return Array.from({ length: count }, () => makeEnemy(key, scale));
}

export function spawnBossEnemies(key = "dragon", scale = 1) {
  return [makeEnemy(key, scale, true)];
}

// 宝箱から出るミミック (通常より手強い)
export function spawnMimic(floor, scale = 1) {
  const pool = ["d01_kobold", "d02_armkobold", "d03_orc"];
  const key = pool[Math.min(pool.length - 1, Math.floor(floor) - 1 + (Math.random() < 0.5 ? 0 : 1))] || "d03_orc";
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
    alive: true, asleep: false, side: "enemy",
  };
}

const rand = (n) => Math.floor(Math.random() * n);
const variance = (base) => Math.max(1, base + rand(Math.ceil(base * 0.4)) - rand(Math.ceil(base * 0.2)));

// 戦闘の状態機械: AGI順に1人ずつ手番が回る。
// 1手ずつ進め、各行動は結果オブジェクトを返す (演出は game.js 側で行う)。
export class Battle {
  constructor(party, enemies, log) {
    this.party = party;
    this.enemies = enemies;
    this.log = log;
    this.queue = [];          // このラウンドの行動順 (AGI順)
    this.current = null;      // 手番のキャラ
    this.phase = "input";     // input | target | resolve | enemy | done
    this.pending = null;      // 対象選択待ちの行動
    this.result = null;       // "win" | "lose" | "flee"
    this._blessingUsed = false;
    for (const a of [...party, ...enemies]) { a.buffs = { atk: 1, vit: 1, agi: 1 }; a._enduredThisBattle = false; }
    this.advance();
  }

  livingParty() { return this.party.filter((p) => p.alive); }
  livingEnemies() { return this.enemies.filter((e) => e.alive); }

  // AGI(+乱数)で行動順を組み直す
  _startRound() {
    const eagi = (a) => (a.agi || 1) * ((a.buffs && a.buffs.agi) || 1);
    this.queue = [...this.party, ...this.enemies]
      .filter((a) => a.alive)
      .sort((a, b) => (eagi(b) + rand(4)) - (eagi(a) + rand(4)));
  }

  // 次の手番へ。味方なら input、敵なら enemy フェーズで止まる (実行はしない)
  advance() {
    if (this.result) { this.phase = "done"; return; }
    while (true) {
      if (this.queue.length === 0) this._startRound();
      const actor = this.queue.shift();
      if (!actor || !actor.alive) continue;
      this.current = actor;
      if (actor.side === "party") {
        actor._defending = false; // 防御は次の自分の手番まで
        this.phase = "input";
      } else {
        this.phase = "enemy";
      }
      return;
    }
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
      if (actor.mp < sp.mp) { this.log("MPが足りない！", "sys"); return { invalid: true }; }
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
    if (p.action === "attack") return this.livingEnemies();
    const sp = SPELLS[p.spellKey];
    if (sp.target === "enemy") return this.livingEnemies();
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

  // 敵の手番を実行し結果を返す
  enemyAct() {
    const actor = this.current;
    const cmd = {
      actor,
      action: actor.asleep ? "sleep" : "attack",
      target: this._randAlive(this.livingParty()),
    };
    const res = this._exec(cmd);
    this._checkEnd();
    return res;
  }

  _randAlive(list) {
    const a = list.filter((x) => x.alive);
    return a[rand(a.length)] || null;
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
      if (Math.random() < 0.55) { this.result = "flee"; this.log("うまく逃げ出した！", "sys"); res.fled = true; }
      else { this.log(`${actor.name}は逃げられなかった！`, "dmg"); res.fledFail = true; }
      return res;
    }
    if (action === "attack") {
      const tgt = (cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(actor.side === "party" ? this.enemies : this.party);
      if (tgt) res.hits.push(this._physical(actor, tgt));
      return res;
    }
    if (action === "spell") {
      this._cast(actor, cmd, res);
      return res;
    }
    return res;
  }

  // バフ込みの実効ATK・VIT
  _eatk(a) { return Math.max(1, Math.round(a.atk * ((a.buffs && a.buffs.atk) || 1))); }
  _evit(t) { return Math.round((t.vit || 0) * ((t.buffs && t.buffs.vit) || 1)); }

  _physical(actor, tgt, opt = {}) {
    // 命中判定: 素の命中漏れ + 対象の敏捷(AGI)による回避
    const evade = Math.min(0.4, Math.max(0, ((tgt.agi || 6) - 6) * 0.012));
    if (Math.random() < 0.06 + evade) {
      this.log(`${tgt.name}は攻撃をかわした！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    const power = opt.power || 1;       // 技の倍率 (通常攻撃は1)
    // ダメージ = ATK×倍率 − VIT/2 (VITが被ダメージ軽減を担う)
    let dmg = variance(Math.round(this._eatk(actor) * power)) - Math.floor(this._evit(tgt) * 0.5);
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    // 属性相性 (攻撃属性 = 技 or 行動者。通常攻撃や無属性は等倍)
    const em = elemMult(opt.element || actor.element || "none", tgt.element || "none");
    if (em !== 1) dmg = Math.round(dmg * em);
    // 会心: 基礎 + 盗賊パッシブ + 幸運(LUK) + 技の会心補正
    const luckCrit = Math.max(0, ((actor.luk || 8) - 8)) * 0.005;
    const crit = Math.random() < 0.06 + (actor.critBonus || 0) + luckCrit + (opt.critBonus || 0);
    if (crit) dmg = Math.floor(dmg * 1.85);
    dmg = Math.max(1, dmg);
    tgt.hp -= dmg;
    const eff = em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : "";
    this.log(`${actor.name}の${opt.name || "攻撃"}！ ${tgt.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}${eff}`,
      actor.side === "party" ? "hit" : "dmg");
    if (tgt.asleep) tgt.asleep = false;
    // 命中時の弱体 (毒刃など)
    if (opt.debuff && tgt.alive) { tgt.buffs = tgt.buffs || { atk: 1, vit: 1, agi: 1 }; for (const k in opt.debuff) tgt.buffs[k] *= opt.debuff[k]; }
    return { target: tgt, dmg, crit, died: this._die(tgt) };
  }

  _cast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    actor.mp -= sp.mp;
    res.spellName = sp.name;
    res.spellKind = sp.kind;
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
      const spMul = actor.spellMaster ? 1.25 : 1; // 大賢者/賢者王: 攻撃呪文+25%
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        const em = elemMult(sp.element || "none", t.element || "none");
        // 攻撃呪文の威力は術者の INT で伸びる
        const power = sp.power + (actor.int || 0) * 0.5;
        let dmg = Math.max(1, Math.round(variance(power) * spMul) - Math.floor(this._evit(t) * 0.2));
        if (em !== 1) dmg = Math.max(1, Math.round(dmg * em));
        t.hp -= dmg;
        const eff = em > 1 ? " 弱点!" : em < 1 ? " 耐性…" : "";
        this.log(`${t.name}に ${dmg} ダメージ${eff}`, "dmg");
        if (t.asleep) t.asleep = false;
        res.hits.push({ target: t, dmg, eff: em > 1 ? "weak" : em < 1 ? "resist" : null, died: this._die(t) });
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
      // 回復量は術者の PIE で伸びる
      const healPower = sp.power + (actor.pie || 0) * 0.5;
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
      // 不屈 (聖堂騎士長): 致死を1回だけ HP1 で耐える
      if (t.side === "party" && t.endure && !t._enduredThisBattle) {
        t._enduredThisBattle = true; t.hp = 1;
        this.log(`${t.name}は不屈で持ちこたえた！ (HP1)`, "heal");
        return false;
      }
      t.hp = 0; t.alive = false;
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
      return true;
    }
    return false;
  }

  _checkEnd() {
    if (this.result) return;
    if (this.livingEnemies().length === 0) { this.result = "win"; return; }
    if (this.livingParty().length === 0) {
      // 聖者の祝福: 全滅時、1回だけ全員HP1で復活 (祝福持ちが編成にいれば)
      if (!this._blessingUsed && this.party.some((p) => p.blessing)) {
        this._blessingUsed = true;
        for (const p of this.party) { p.alive = true; p.hp = 1; p.ailment = null; p.reviveAt = null; p._dead = false; }
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

// パーティ・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";
import { ITEMS, SLOTS, recalc, equip } from "./items.js";

export const SPELLS = {
  HALITO: { name: "ハリト", mp: 2, kind: "atk", power: 10, target: "enemy", desc: "炎の矢" },
  MAHALITO: { name: "マハリト", mp: 6, kind: "atk", power: 22, target: "all-enemy", desc: "業火" },
  DIOS: { name: "ディオス", mp: 2, kind: "heal", power: 14, target: "ally", desc: "傷を癒す" },
  DIAL: { name: "ディアル", mp: 4, kind: "heal", power: 28, target: "ally", desc: "大きく回復" },
  KATINO: { name: "カティノ", mp: 3, kind: "sleep", power: 0, target: "all-enemy", desc: "敵を眠らせる" },
  MADIOS: { name: "マディオス", mp: 8, kind: "heal", power: 60, target: "ally", revive: true, desc: "大回復・蘇生" },
  // 物理技 (攻撃力依存。混成職などが習得)
  KYOUGEKI: { name: "強撃", mp: 3, kind: "phys", power: 1.8, target: "enemy", desc: "渾身の一撃" },
  MIDARE: { name: "乱れ斬り", mp: 7, kind: "phys", power: 0.9, target: "all-enemy", desc: "全体を斬る" },
};

export const CLASSES = {
  fighter: { label: "戦士", hp: 34, mp: 0, atk: 12, def: 8, spd: 6, spells: [] },
  mage: { label: "魔法使い", hp: 18, mp: 14, atk: 5, def: 3, spd: 7, spells: ["HALITO", "MAHALITO", "KATINO"] },
  priest: { label: "僧侶", hp: 24, mp: 12, atk: 7, def: 5, spd: 5, spells: ["DIOS", "DIAL"] },
  knight: { label: "騎士", hp: 42, mp: 0, atk: 11, def: 12, spd: 4, spells: [] },
  thief: { label: "盗賊", hp: 22, mp: 0, atk: 9, def: 5, spd: 11, spells: [] },
  bishop: { label: "魔導僧", hp: 22, mp: 16, atk: 6, def: 4, spd: 6, spells: ["HALITO", "DIOS", "DIAL"] },
};

// パーティは最大6人
export const MAX_PARTY = 6;

export function createParty() {
  const make = (name, clsKey, race, align, gear = [], bag = []) => {
    const c = CLASSES[clsKey];
    const m = {
      name, clsKey, cls: c.label,
      race, align, // 種族・属性 (ウィザードリィ風)
      level: 1, exp: 0,
      hp: c.hp, maxhp: c.hp, mp: c.mp, maxmp: c.mp,
      atk: c.atk, def: c.def, spd: c.spd,
      base: { hp: c.hp, mp: c.mp, atk: c.atk, def: c.def, spd: c.spd }, // 素のステータス
      equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
      items: [],
      ailment: null,      // null | "poison"
      ac: 10 - c.def,
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
  const pool = ["kobold", "orc", "wraith"];
  const key = pool[Math.min(pool.length - 1, Math.floor(floor) - 1 + (Math.random() < 0.5 ? 0 : 1))] || "orc";
  const e = makeEnemy(key, scale);
  e.name = "ミミック";
  e.maxhp = Math.round(e.maxhp * 1.4);
  e.hp = e.maxhp;
  e.atk = Math.round(e.atk * 1.25);
  e.gold = Math.round(e.gold * 2);
  e.exp = Math.round(e.exp * 1.5);
  return [e];
}

function makeEnemy(key, scale = 1, boss = false) {
  const m = MONSTERS[key];
  const hp = Math.max(1, Math.round(m.maxhp * scale));
  return {
    uid: ++_uid, key, mon: m, name: (boss ? m.name : m.name),
    hp, maxhp: hp,
    atk: Math.max(1, Math.round(m.atk * scale)),
    def: Math.round(m.def * scale),
    spd: m.spd,
    exp: Math.round(m.exp * scale), gold: Math.round(m.gold * scale),
    boss: boss || !!m.boss,
    alive: true, asleep: false, side: "enemy",
  };
}

const rand = (n) => Math.floor(Math.random() * n);
const variance = (base) => Math.max(1, base + rand(Math.ceil(base * 0.4)) - rand(Math.ceil(base * 0.2)));

// 戦闘の状態機械: 素早さ順に1人ずつ手番が回る。
// 1手ずつ進め、各行動は結果オブジェクトを返す (演出は game.js 側で行う)。
export class Battle {
  constructor(party, enemies, log) {
    this.party = party;
    this.enemies = enemies;
    this.log = log;
    this.queue = [];          // このラウンドの行動順 (素早さ順)
    this.current = null;      // 手番のキャラ
    this.phase = "input";     // input | target | resolve | enemy | done
    this.pending = null;      // 対象選択待ちの行動
    this.result = null;       // "win" | "lose" | "flee"
    this.advance();
  }

  livingParty() { return this.party.filter((p) => p.alive); }
  livingEnemies() { return this.enemies.filter((e) => e.alive); }

  // 素早さ(+乱数)で行動順を組み直す
  _startRound() {
    this.queue = [...this.party, ...this.enemies]
      .filter((a) => a.alive)
      .sort((a, b) => (b.spd + rand(4)) - (a.spd + rand(4)));
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
      if (sp.target === "all-enemy") { this.phase = "resolve"; return { needTarget: false }; }
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
    if (sp.target === "ally") return this.party; // 死者も蘇生対象外だが選択可
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

  _physical(actor, tgt) {
    // 命中判定: 素の命中漏れ + 対象の敏捷(AGI)による回避
    const evade = Math.min(0.4, Math.max(0, ((tgt.agi || 6) - 6) * 0.012));
    if (Math.random() < 0.06 + evade) {
      this.log(`${tgt.name}は攻撃をかわした！`, "sys");
      return { target: tgt, miss: true, evaded: true };
    }
    let dmg = variance(actor.atk) - Math.floor(tgt.def * 0.5);
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    // 会心: 基礎 + 盗賊パッシブ + 幸運(LUK)
    const luckCrit = Math.max(0, ((actor.luk || 8) - 8)) * 0.005;
    const crit = Math.random() < 0.06 + (actor.critBonus || 0) + luckCrit;
    if (crit) dmg = Math.floor(dmg * 1.85);
    dmg = Math.max(1, dmg);
    tgt.hp -= dmg;
    this.log(`${actor.name}の攻撃！ ${tgt.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}`,
      actor.side === "party" ? "hit" : "dmg");
    if (tgt.asleep) tgt.asleep = false;
    return { target: tgt, dmg, crit, died: this._die(tgt) };
  }

  _cast(actor, cmd, res) {
    const sp = SPELLS[cmd.spellKey];
    actor.mp -= sp.mp;
    res.spellName = sp.name;
    res.spellKind = sp.kind;
    const isPhys = sp.kind === "phys";
    this.log(isPhys ? `${actor.name}の ${sp.name}！` : `${actor.name}は ${sp.name} を唱えた！`, "hit");
    if (sp.kind === "atk" || isPhys) {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        // phys: 攻撃力×倍率 − 防御。atk呪文: 固定power − 防御の一部
        const base = isPhys ? variance(Math.round(actor.atk * sp.power)) - Math.floor(t.def * 0.5)
                            : variance(sp.power) - Math.floor(t.def * 0.2);
        const dmg = Math.max(1, base);
        t.hp -= dmg;
        this.log(`${t.name}に ${dmg} ダメージ`, "dmg");
        if (t.asleep) t.asleep = false;
        res.hits.push({ target: t, dmg, died: this._die(t) });
      }
    } else if (sp.kind === "heal") {
      // 蘇生呪文は戦闘不能の味方も対象にできる
      let t = cmd.target || actor;
      if (!t.alive && !sp.revive) t = actor;
      const wasDead = !t.alive;
      if (wasDead && sp.revive) { t.alive = true; t.ailment = null; t.reviveAt = null; t._imprinted = false; }
      const heal = variance(sp.power);
      t.hp = Math.min(t.maxhp, (t.hp > 0 ? t.hp : 0) + heal);
      if (wasDead && sp.revive) this.log(`${t.name}は蘇った！ HPが ${heal} 回復`, "heal");
      else this.log(`${t.name}のHPが ${heal} 回復`, "heal");
      res.hits.push({ target: t, heal, revived: wasDead && sp.revive });
    } else if (sp.kind === "sleep") {
      for (const t of this.livingEnemies()) {
        if (Math.random() < 0.6) { t.asleep = true; this.log(`${t.name}は眠った`, "sys"); res.hits.push({ target: t, sleep: true }); }
        else this.log(`${t.name}には効かない`, "sys");
      }
    }
  }

  _die(t) {
    if (t.hp <= 0 && t.alive) {
      t.hp = 0; t.alive = false;
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
      return true;
    }
    return false;
  }

  _checkEnd() {
    if (this.result) return;
    if (this.livingEnemies().length === 0) this.result = "win";
    else if (this.livingParty().length === 0) this.result = "lose";
  }

  // 戦闘後: 防御フラグ解除・報酬計算
  rewards() {
    const exp = this.enemies.reduce((s, e) => s + (e.alive ? 0 : e.exp), 0);
    const gold = this.enemies.reduce((s, e) => s + (e.alive ? 0 : e.gold), 0);
    return { exp, gold };
  }
}

// レベルアップ判定
export function gainExp(member, exp) {
  // 人業の魂は戦闘では成長しない。
  // 魂のレベルアップは人業の館「魂の強化」で Soul を与えたときのみ。
  if (member.isDoll) return [];
  member.exp += exp;
  const msgs = [];
  while (member.exp >= member.level * 30) {
    member.exp -= member.level * 30;
    member.level++;
    const c = CLASSES[member.clsKey];
    // 素のステータスを成長させ、装備込みで再計算
    const b = member.base;
    b.hp += 6 + rand(5);
    b.mp += c.mp > 0 ? 2 + rand(3) : 0;
    b.atk += 2 + rand(2);
    b.def += 1 + rand(2);
    recalc(member);
    member.hp = member.maxhp;
    member.mp = member.maxmp;
    msgs.push(`${member.name}はレベル${member.level}になった！`);
  }
  return msgs;
}

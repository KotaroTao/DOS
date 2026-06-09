// パーティ・呪文・ターン制戦闘ロジック
import { MONSTERS } from "./sprites.js";

export const SPELLS = {
  HALITO: { name: "ハリト", mp: 2, kind: "atk", power: 10, target: "enemy", desc: "炎の矢" },
  MAHALITO: { name: "マハリト", mp: 6, kind: "atk", power: 22, target: "all-enemy", desc: "業火" },
  DIOS: { name: "ディオス", mp: 2, kind: "heal", power: 14, target: "ally", desc: "傷を癒す" },
  DIAL: { name: "ディアル", mp: 4, kind: "heal", power: 28, target: "ally", desc: "大きく回復" },
  KATINO: { name: "カティノ", mp: 3, kind: "sleep", power: 0, target: "all-enemy", desc: "敵を眠らせる" },
};

export const CLASSES = {
  fighter: { label: "戦士", hp: 34, mp: 0, atk: 12, def: 8, spd: 6, spells: [] },
  mage: { label: "魔法使い", hp: 18, mp: 14, atk: 5, def: 3, spd: 7, spells: ["HALITO", "MAHALITO", "KATINO"] },
  priest: { label: "僧侶", hp: 24, mp: 12, atk: 7, def: 5, spd: 5, spells: ["DIOS", "DIAL"] },
};

export function createParty() {
  const make = (name, clsKey) => {
    const c = CLASSES[clsKey];
    return {
      name, clsKey, cls: c.label,
      level: 1, exp: 0,
      hp: c.hp, maxhp: c.hp, mp: c.mp, maxmp: c.mp,
      atk: c.atk, def: c.def, spd: c.spd,
      spells: c.spells.slice(),
      alive: true, side: "party",
    };
  };
  return [
    make("アレク", "fighter"),
    make("メリナ", "mage"),
    make("セイル", "priest"),
  ];
}

let _uid = 0;
export function spawnEnemies(floor, forceBoss = false) {
  if (forceBoss) {
    return [makeEnemy("dragon")];
  }
  const pool = ["slime", "bat", "kobold", "skeleton", "orc", "wraith"];
  // 階層が深いほど強い敵が出やすい
  const count = 1 + Math.floor(Math.random() * 3);
  const list = [];
  for (let i = 0; i < count; i++) {
    const maxIdx = Math.min(pool.length - 1, 1 + floor);
    const key = pool[Math.floor(Math.random() * (maxIdx + 1))];
    list.push(makeEnemy(key));
  }
  return list;
}

function makeEnemy(key) {
  const m = MONSTERS[key];
  return {
    uid: ++_uid, key, mon: m, name: m.name,
    hp: m.maxhp, maxhp: m.maxhp,
    atk: m.atk, def: m.def, spd: m.spd,
    exp: m.exp, gold: m.gold,
    alive: true, asleep: false, side: "enemy",
  };
}

const rand = (n) => Math.floor(Math.random() * n);
const variance = (base) => Math.max(1, base + rand(Math.ceil(base * 0.4)) - rand(Math.ceil(base * 0.2)));

// 戦闘の状態機械
export class Battle {
  constructor(party, enemies, log) {
    this.party = party;
    this.enemies = enemies;
    this.log = log;
    this.commands = [];      // 各味方の行動予約
    this.actorIdx = 0;       // コマンド入力中の味方
    this.phase = "input";    // input | target | resolve | done
    this.pending = null;     // 対象選択待ちの行動
    this.result = null;      // "win" | "lose" | "flee"
    this._advanceToLivingActor();
  }

  livingParty() { return this.party.filter((p) => p.alive); }
  livingEnemies() { return this.enemies.filter((e) => e.alive); }
  currentActor() { return this.party[this.actorIdx]; }

  _advanceToLivingActor() {
    while (this.actorIdx < this.party.length && !this.party[this.actorIdx].alive) {
      this.actorIdx++;
    }
    if (this.actorIdx >= this.party.length) {
      this.resolveRound();
    } else {
      this.phase = "input";
    }
  }

  // 行動を選択。対象が必要なら target フェーズへ
  chooseAction(action, spellKey = null) {
    const actor = this.currentActor();
    if (action === "run") {
      this.commands.push({ actor, action: "run" });
      this._nextActor();
      return;
    }
    if (action === "defend") {
      this.commands.push({ actor, action: "defend" });
      this._nextActor();
      return;
    }
    if (action === "attack") {
      this.pending = { actor, action: "attack" };
      this.phase = "target";
      return;
    }
    if (action === "spell") {
      const sp = SPELLS[spellKey];
      if (actor.mp < sp.mp) { this.log("MPが足りない！", "sys"); return; }
      this.pending = { actor, action: "spell", spellKey };
      if (sp.target === "all-enemy") {
        this.commands.push({ ...this.pending, target: null });
        this.pending = null;
        this._nextActor();
      } else {
        this.phase = "target";
      }
      return;
    }
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
    this.commands.push({ ...this.pending, target });
    this.pending = null;
    this._nextActor();
  }

  cancelTarget() {
    this.pending = null;
    this.phase = "input";
  }

  _nextActor() {
    this.actorIdx++;
    this._advanceToLivingActor();
  }

  // 全員のコマンドが揃ったら解決
  resolveRound() {
    this.phase = "resolve";
    // 敵の行動を生成
    const enemyActs = this.livingEnemies().map((e) => ({
      actor: e, action: e.asleep ? "sleep" : "attack",
      target: this._randAlive(this.livingParty()),
    }));
    const all = [...this.commands, ...enemyActs]
      .filter((c) => c.actor.alive)
      .sort((a, b) => (b.actor.spd + rand(3)) - (a.actor.spd + rand(3)));

    for (const cmd of all) {
      if (this.result) break;
      if (!cmd.actor.alive) continue;
      this._exec(cmd);
      this._checkEnd();
    }

    this.commands = [];
    this.actorIdx = 0;
    if (!this.result) this._advanceToLivingActor();
  }

  _randAlive(list) {
    const a = list.filter((x) => x.alive);
    return a[rand(a.length)] || null;
  }

  _exec(cmd) {
    const { actor, action } = cmd;
    if (action === "sleep") {
      if (Math.random() < 0.45) { cmd.actor.asleep = false; this.log(`${actor.name}は目を覚ました`, "sys"); }
      else this.log(`${actor.name}は眠っている…`, "sys");
      return;
    }
    if (action === "defend") {
      actor._defending = true;
      this.log(`${actor.name}は身を守っている`, "sys");
      return;
    }
    if (action === "run") {
      if (Math.random() < 0.6) { this.result = "flee"; this.log("うまく逃げ出した！", "sys"); }
      else this.log(`${actor.name}は逃げられなかった`, "sys");
      return;
    }
    if (action === "attack") {
      const tgt = (cmd.target && cmd.target.alive) ? cmd.target : this._randAlive(actor.side === "party" ? this.enemies : this.party);
      if (!tgt) return;
      this._physical(actor, tgt);
      return;
    }
    if (action === "spell") {
      this._cast(actor, cmd);
      return;
    }
  }

  _physical(actor, tgt) {
    const hitRoll = Math.random();
    if (hitRoll < 0.1) { this.log(`${actor.name}の攻撃は外れた`, "sys"); return; }
    let dmg = variance(actor.atk) - Math.floor(tgt.def * 0.5);
    if (tgt._defending) dmg = Math.floor(dmg * 0.5);
    const crit = Math.random() < 0.08;
    if (crit) dmg = Math.floor(dmg * 1.8);
    dmg = Math.max(1, dmg);
    tgt.hp -= dmg;
    this.log(`${actor.name}の攻撃！ ${tgt.name}に ${dmg} ダメージ${crit ? "(会心!)" : ""}`,
      actor.side === "party" ? "hit" : "dmg");
    if (tgt.asleep) tgt.asleep = false;
    this._die(tgt);
  }

  _cast(actor, cmd) {
    const sp = SPELLS[cmd.spellKey];
    actor.mp -= sp.mp;
    this.log(`${actor.name}は ${sp.name} を唱えた！`, "hit");
    if (sp.kind === "atk") {
      const targets = sp.target === "all-enemy" ? this.livingEnemies() : [cmd.target].filter(Boolean);
      for (const t of targets) {
        if (!t.alive) continue;
        const dmg = Math.max(1, variance(sp.power) - Math.floor(t.def * 0.2));
        t.hp -= dmg;
        this.log(`${t.name}に ${dmg} ダメージ`, "dmg");
        if (t.asleep) t.asleep = false;
        this._die(t);
      }
    } else if (sp.kind === "heal") {
      const t = cmd.target && cmd.target.alive ? cmd.target : actor;
      const heal = variance(sp.power);
      t.hp = Math.min(t.maxhp, t.hp + heal);
      this.log(`${t.name}のHPが ${heal} 回復`, "heal");
    } else if (sp.kind === "sleep") {
      for (const t of this.livingEnemies()) {
        if (Math.random() < 0.6) { t.asleep = true; this.log(`${t.name}は眠った`, "sys"); }
        else this.log(`${t.name}には効かない`, "sys");
      }
    }
  }

  _die(t) {
    if (t.hp <= 0 && t.alive) {
      t.hp = 0; t.alive = false;
      this.log(`${t.name}を倒した！`, t.side === "enemy" ? "win" : "dmg");
    }
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
  member.exp += exp;
  const msgs = [];
  while (member.exp >= member.level * 30) {
    member.exp -= member.level * 30;
    member.level++;
    const c = CLASSES[member.clsKey];
    member.maxhp += 6 + rand(5);
    member.maxmp += c.mp > 0 ? 2 + rand(3) : 0;
    member.atk += 2 + rand(2);
    member.def += 1 + rand(2);
    member.hp = member.maxhp;
    member.mp = member.maxmp;
    msgs.push(`${member.name}はレベル${member.level}になった！`);
  }
  return msgs;
}

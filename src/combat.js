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
// カードでめくったモンスター: 階層が深いほど複数で出やすい
export function spawnCardEnemies(key, floor) {
  const count = Math.random() < 0.2 + floor * 0.12 ? 2 : 1;
  return Array.from({ length: count }, () => makeEnemy(key));
}

export function spawnBossEnemies() {
  return [makeEnemy("dragon")];
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

// 戦闘の状態機械: 素早さ順に1人ずつ手番が回る
export class Battle {
  constructor(party, enemies, log) {
    this.party = party;
    this.enemies = enemies;
    this.log = log;
    this.queue = [];          // このラウンドの行動順 (素早さ順)
    this.current = null;      // 手番の味方 (入力待ち)
    this.phase = "input";     // input | target
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

  // 次の手番へ。敵は即座に行動し、味方の番が来たら入力待ちで止まる
  advance() {
    while (!this.result) {
      if (this.queue.length === 0) this._startRound();
      const actor = this.queue.shift();
      if (!actor.alive) continue;
      if (actor.side === "party") {
        actor._defending = false; // 防御は次の自分の手番まで
        this.current = actor;
        this.phase = "input";
        return;
      }
      this._exec({
        actor,
        action: actor.asleep ? "sleep" : "attack",
        target: this._randAlive(this.livingParty()),
      });
      this._checkEnd();
    }
  }

  // 手番の味方の行動を選択。対象が必要なら target フェーズへ、不要なら即実行
  chooseAction(action, spellKey = null) {
    const actor = this.current;
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
        const cmd = this.pending;
        this.pending = null;
        this._execute(cmd);
      } else {
        this.phase = "target";
      }
      return;
    }
    if (action === "defend" || action === "run") {
      this._execute({ actor, action });
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
    const cmd = { ...this.pending, target };
    this.pending = null;
    this._execute(cmd);
  }

  cancelTarget() {
    this.pending = null;
    this.phase = "input";
  }

  // 味方の行動を即時実行し、次の手番へ進める
  _execute(cmd) {
    this._exec(cmd);
    this._checkEnd();
    if (!this.result) this.advance();
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

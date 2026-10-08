// ===== テスト記録 (戦闘バランス調整用) =====
// 設定「自動化・データ」→「テスト記録」で ON にすると、プレイ中に次を迷宮ごとに集計する。
//   隊の様子 … 各迷宮の1階に着いた時・最後に着いた階・踏破した時の、出撃中の人業の職・Lv・能力値
//   戦闘     … 戦闘数・勝ち/逃げ/全滅・ラウンド数・先制/奇襲・物理の命中/回避 (味方→敵 / 敵→味方)・
//              手番の先後・逃走の試行/成功・与ダメ/被ダメ・戦闘前後の隊HP割合・隊と敵の AGI
//   戦利品   … 迷宮で手に入れた品のレア度別の数・図鑑の新種・持ちきれず置いてきた数・得たゴールド/✦Soul
//   ✦・金貨  … 迷宮で得た分の出どころ (戦闘の種類・出来事・死体…) と倍率の上乗せ (異変・掟・特別な階…) の内訳、
//              その迷宮へ入る前に町で得た分 (依頼の報告・王への報告・勲章・売却…)
//   魂       … 手に入れた職業の魂のレア度別の数 (迷宮の中 / その迷宮へ入る前の町 = 依頼・宝物庫の褒賞など) と、着いた階の数
//   時間     … 迷宮の中にいた実プレイ時間と、その迷宮へ入る前に町で過ごした実プレイ時間
//              (画面が見え、直近2分以内に操作があるか、自動探索・自動戦闘が進行している時間。5秒ごとの時計から)
// 「記録を書き出す」で調整に使う要点だけをテキストにして、そのまま貼り付けて送れる (生データは出さない)。保存先は端末内 (localStorage) のみで、外へは送らない。
// セーブとは別の鍵 (dos-testlog)。「はじめから」でも消えない (消すのは「記録を消す」)。
// game.js は import しない (game.js から呼ばれる側)。戦闘の挙動には一切影響しない。

import { STABILITY_MAX, STABILITY_ENTRY_COST, STABILITY_RECOVERY_MS } from "./stability.js";
import { partyAgi } from "./levelcurve.js";

const KEY = "dos-testlog";
const VERSION = 2;
// デプロイ時にコミットのハッシュへ置換する。過去版と新しい調整を混ぜない。
export const TEST_BUILD = "dos-dev";

function blank() { return { v: VERSION, build: TEST_BUILD, on: false, since: null, d: {} }; }
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    if (!s || ![1, VERSION].includes(s.v) || !s.d || typeof s.d !== "object") return blank();
    s.v = VERSION;
    return s;
  } catch (e) { return blank(); }
}
let S = load();
if (S.build !== TEST_BUILD) {
  if (Object.keys(S.d).length) (S.history || (S.history = [])).push({ build: S.build || "旧版(不明)", since: S.since, until: new Date().toISOString(), d: S.d, townMs:S.townMs || 0, townSl:S.townSl || null, townG:S.townG || null, stability:S.stability || null });
  S.stability = null; S.d = {}; S.townMs = 0; S.townSl = null; S.townG = null; S.build = TEST_BUILD; S.since = S.on ? new Date().toISOString() : null;
}
// 旧い出撃記録の装備 (品のデータ丸ごと) を品IDだけに縮める。端末の保存容量を超えて記録が書けなくなるのを防ぐ
function slimRuns(d) {
  for (const k in d || {}) for (const run of [d[k].firstEntry && { entry: d[k].firstEntry }, ...(d[k].runs || [])]) {
    for (const m of (run && run.entry && run.entry.loadout) || []) {
      if (!m.equip) continue;
      for (const slot in m.equip) { const it = m.equip[slot]; if (it && typeof it === "object") m.equip[slot] = it.id || null; }
    }
  }
}
slimRuns(S.d);
for (const h of S.history || []) slimRuns(h.d);
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 容量切れ等は諦める */ } }
persist();

// 同期処理の間だけ数値の代入を観測。消費→回復を相殺せず、実際に増減した量を数える。
// 満タンを超える回復・負のHPへの過剰ダメージは除く。例外でも元のデータ属性へ戻す。
const resourceFrames = [];
export function tlMeasure(where, party, source, fn) {
  if (!S.on || !where) return fn();
  const outer = resourceFrames.length === 0, restore = [];
  resourceFrames.push({ where, source });
  if (outer) for (const p of new Set(party)) for (const key of ["hp", "mp"]) {
    const desc = Object.getOwnPropertyDescriptor(p, key);
    if (!desc || !desc.configurable || !("value" in desc) || !desc.writable) continue;
    let value = desc.value;
    Object.defineProperty(p, key, { configurable: true, enumerable: desc.enumerable,
      get: () => value, set: (next) => {
        const cap = Math.max(0, p[key === "hp" ? "maxhp" : "maxmp"] || 0);
        const bounded = (v) => Math.min(cap, Math.max(0, v || 0));
        const delta = bounded(next) - bounded(value); value = next;
        if (!Number.isFinite(delta) || !delta) return;
        const frame = resourceFrames[resourceFrames.length - 1];
        addTo(slot(frame.where), "resources", frame.source + ":" + key + (delta > 0 ? "+" : "-"), Math.abs(delta));
      }
    });
    restore.push(() => Object.defineProperty(p, key, { ...desc, value }));
  }
  try { return fn(); }
  finally { for (const undo of restore) undo(); resourceFrames.pop(); if (outer) persist(); }
}

// クラスの挙動やセーブの列を変えず、同期の戦闘処理へ記録を添える。
export function tlWatchBattle(b, where) {
  if (Object.hasOwn(b, "_tlWatched")) return;
  Object.defineProperty(b, "_tlWatched", { value: true, configurable: true });
  const methods = { advance:"battle", commit:"battle", enemyAct:"enemy", stunnedAct:"battle",
    _exec:"action", _cast:"skill", _physical:"physical", _startRound:"round", _partyHeal:"skill",
    _perkRound:"passive", _perkHit:"passive", _perkHurt:"passive", _afterBasic:"passive",
    _perkHeal:"passive", _perkMp:"passive", _roundEndRank:"passive", _roundStartRank:"passive", _useItem:"item" };
  for (const [key, source] of Object.entries(methods)) {
    const original = b[key]; if (typeof original !== "function") continue;
    Object.defineProperty(b, key, { configurable:true, writable:true, value:function(...args) {
      if (key === "_exec" && S.on) {
        const cmd = args[0], actor = cmd?.actor;
        if (actor?.side === "party") addTo(slot(where), "actions", `${actor.jobKey || "?"}:${cmd.spellKey || cmd.action}`, 1);
      }
      return tlMeasure(where, this.party, source, () => original.apply(this, args));
    } });
  }
}

const stamp = () => {
  const d = new Date(), z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

export function tlOn() { return !!S.on; }
export function tlSetOn(v) {
  S.on = !!v;
  if (S.on && !S.since) S.since = stamp();
  persist();
}
export function tlClear() {
  const on = S.on;
  _tickN = 0;
  S = blank();
  S.on = on;
  if (on) S.since = stamp();
  persist();
}
export function tlHasData() { return Object.keys(S.d).length > 0 || !!S.stability; }

// 安定度の記録は迷宮別記録と独立。控え・オフラインの回復も含めて残す。
function stabilityData() {
  return S.stability || (S.stability = { activeMs:0, entries:0, spent:0, natural:0, red:0, redEarned:0, dolls:{}, events:[] });
}
function stabilityDoll(d) {
  const a = stabilityData();
  const key = String(d.uid);
  const row = a.dolls[key] || (a.dolls[key] = { uid:d.uid, name:d.name, activeMs:0, entries:0, spent:0, natural:0, red:0 });
  row.name = d.name; row.value = d.stability;
  return row;
}
export function tlStability(kind, changes, context = {}) {
  if (!S.on || !changes.length) return;
  const a = stabilityData();
  if (kind === "entry") a.entries++;
  const field = kind === "entry" ? "spent" : kind === "natural" ? "natural" : "red";
  for (const {doll, amount} of changes) {
    const row = stabilityDoll(doll);
    a[field] += amount; row[field] += amount;
    if (kind === "entry") row.entries++;
  }
  a.events.push({ at:Date.now(), kind, activeMs:a.activeMs, ...context,
    dolls:changes.map(({doll,amount})=>({uid:doll.uid,name:doll.name,amount,before:doll.stability+(kind==="entry" ? amount : -amount),value:doll.stability})) });
  if (a.events.length > 500) a.events.shift();
  persist();
}
export function tlStabilityTick(party, ms) {
  if (!S.on) return;
  const a = stabilityData(); a.activeMs += ms;
  for (const d of party) if (d.alive !== false) stabilityDoll(d).activeMs += ms;
}
export function tlRedGain(n, source) {
  if (!S.on || !(n > 0)) return;
  const a = stabilityData(); a.redEarned += n;
  addTo(a, "redSources", source, n); persist();
}
export function tlStabilitySummary(a = S.stability) {
  if (!a) return [];
  const hours = a.activeMs / 3600000;
  const perHour = hours > 0 ? a.spent / hours : 0;
  // 控えを回さず、測定した出撃頻度で同じ人業を使い続けた時の推計。初期100を使い切った後。
  const redNeeded = Object.values(a.dolls).reduce((sum,d)=>sum + (d.activeMs > 0 ? Math.max(0,d.spent - d.activeMs / STABILITY_RECOVERY_MS) : 0),0);
  return ["【魂の安定度】",
    `実プレイ ${(a.activeMs/60000).toFixed(1)}分 / 入場 ${a.entries}回 / 消費 合計${a.spent} (${perHour.toFixed(1)}/実プレイ1時間)`,
    `自然回復 ${a.natural} (控え・オフラインを含む) / 赤い魂で回復 ${a.red} = 実際の支出 🔴${a.red}`,
    `初期${STABILITY_MAX}を使い切った後、控えを回さず休まず続ける推計: 🔴${hours > 0 ? (redNeeded/hours).toFixed(1) : "―"}/実プレイ1時間 (各人業の編成中の消費から3分に1の自然回復を差し引く)`,
    `記録中の赤い魂の獲得 ${a.redEarned} / 安定度回復分を引いた残り ${a.redEarned-a.red} (他用途の支出は含まない)`,
    ...(Object.keys(a.dolls).length ? ["人業別 (編成中の分/消費/自然回復/赤い魂回復/残り) " + Object.values(a.dolls).map(d=>`${d.name} ${Math.round(d.activeMs/60000)}/${d.spent}/${d.natural}/${d.red}/${d.value}`).join(" ")] : []),
    "推計は短い測定ほど誤差が大きい。初期残量・休止中の回復・控えのローテーションは推計に含めない。",
  ];
}

// ---- 戦利品・時間 ----
// 品1つを手に入れた (迷宮の中で)。isNew = 図鑑に初めて載る品
export function tlLoot(where, item, isNew) {
  if (!S.on || !where || !item) return;
  const L = lootOf(slot(where));
  const k = item.slot === "misc" ? "misc" : item.slot === "use" ? "use" : (item.rar || "c");
  L[k] = (L[k] || 0) + 1;
  if (isNew) L.nw = (L.nw || 0) + 1;
  persist();
}
// 持ちきれず置いてきた品
export function tlLost(where) {
  if (!S.on || !where) return;
  const L = lootOf(slot(where));
  L.lost = (L.lost || 0) + 1;
  persist();
}
// 迷宮で得たゴールド / ✦Soul (kind: "gold" | "soul")。
// src = 出どころ (GAIN_SRC: 戦闘の種類・出来事・死体・宝箱・殲滅…) → 欄 ss (✦) / gs (金貨) に出どころ別の合計。
// up = 上乗せの内訳 { psv, sf, mut, trait, oth, eq } (それぞれ「その倍率で増えた分」) → 欄 sx (✦) / gx (金貨)
export function tlGain(where, kind, n, src, up) {
  if (!S.on || !where || !(n > 0)) return;
  const d = slot(where);
  d[kind] = (d[kind] || 0) + Math.round(n);
  const pre = kind === "soul" ? "s" : "g";
  addTo(d, pre + "s", src || "x", n);
  if (up) for (const k in up) if (up[k] > 0) addTo(d, pre + "x", k, up[k]);
  persist();
}
// 町で得たゴールド / ✦Soul (依頼の報告・王への報告・勲章・売却…)。町の時間と同じく、次に入る迷宮の欄 (tsoul / tgold) へ持ち越す
export function tlTownGain(kind, n, src) {
  if (!S.on || !(n > 0)) return;
  const t = S.townG || (S.townG = {});
  addTo(t, kind === "soul" ? "tsoul" : "tgold", src || "x", n);
  persist();
}
function addTo(o, box, k, n) {
  const b = o[box] || (o[box] = {});
  b[k] = (b[k] || 0) + Math.round(n);
}
// 実プレイ時間を足す (5秒ごと)。where = 迷宮の中ならその欄、町なら null (次に入る迷宮の「町」の時間へ持ち越す)
let _tickN = 0;
export function tlPlayTick(where, ms) {
  if (!S.on) return;
  if (where) slot(where).ms = (slot(where).ms || 0) + ms;
  else S.townMs = (S.townMs || 0) + ms;
  if (++_tickN % 6 === 0) persist(); // 30秒ごとに保存 (取りこぼしは最大30秒)
}
function lootOf(d) { return d.loot || (d.loot = {}); }
// 職業の魂を1つ手に入れた (rarity: common/rare/epic/legend)。where = 迷宮の中ならその欄、町なら null
// (町の分は時間と同じく、次に入る迷宮の「町」の欄 tsl へ持ち越す)
const SOUL_RAR = { common: "c", rare: "r", epic: "e", legend: "l" };
export function tlSoul(where, rarity) {
  if (!S.on) return;
  const k = SOUL_RAR[rarity] || "c";
  const box = where ? (slot(where).sl || (slot(where).sl = {})) : (S.townSl || (S.townSl = {}));
  box[k] = (box[k] || 0) + 1;
  persist();
}


// 迷宮の欄 (key = 迷宮の id "w05" / 奈落は "A3"。旧来の "D10" の欄も読めるまま残る)
function slot(where) {
  if (!S.d[where.key]) S.d[where.key] = { name: where.name || "", s: {}, b: {} };
  const d = S.d[where.key];
  if (where.name) d.name = where.name;
  return d;
}

// 出撃中の人業1人 → [名前, 職, ランク, Lv, 列, 最大HP, 最大MP, STR, VIT, AGI, INT, PIE, LUK, 生存]
function dollRow(p, i) {
  return [p.name || "", p.jobKey || "", p.jobRank || 0, p.jobLv || 1, i < 3 ? "前" : "後",
    p.maxhp || 0, p.maxmp || 0, p.atk || 0, p.vit || 0, p.agi || 0, p.int || 0, p.pie || 0, p.luk || 0, p.alive ? 1 : 0];
}

function resourceState(party) {
  return party.map((p) => ({ name:p.name, hp:p.hp, mp:p.mp, maxhp:p.maxhp, maxmp:p.maxmp, stability:p.stability, uid:p.uid, alive:p.alive !== false }));
}
export function tlRunBegin(where, party, context = {}) {
  if (!S.on || !where) return;
  const d = slot(where), runs = d.runs || (d.runs = []);
  const entry = JSON.parse(JSON.stringify({ t:stamp(), floor:where.floor, p:party.map(dollRow), resources:resourceState(party), ...context }));
  if (!d.firstEntry) d.firstEntry = entry;
  runs.push({ entry });
  // 初記録は別に保持し、詳細な出撃履歴は直近20回まで。
  if (runs.length > 20) runs.shift();
  d.entries = (d.entries || 0) + 1;
  persist();
}
export function tlRunEnd(where, party, outcome) {
  if (!S.on || !where) return;
  const d = slot(where), run = d.runs?.[d.runs.length - 1];
  if (run && !run.exit) run.exit = { t:stamp(), floor:where.floor, outcome, resources:resourceState(party) };
  addTo(d, "outcomes", outcome || "return", 1);
  persist();
}

// 隊の様子を残す。kind: "floor" (階に着いた) / "clear" (迷宮を踏破)
// where = { key, name, lv, floor, floors } (key = 迷宮の id / 奈落は A深度)
export function tlSnapshot(kind, where, party) {
  if (!S.on || !where || !party) return;
  const d = slot(where);
  const snap = {
    t: stamp(), f: where.floor || 1,
    base: Math.round(partyAgi(where.lv || 1) * 10) / 10, // 推奨Lv の隊の AGI の物差し
    p: party.map(dollRow),
    resources: resourceState(party),
  };
  if (!d.s.firstObserved) d.s.firstObserved = snap;
  if (kind === "floor") {
    const f = d.floors || (d.floors = {}), checkpoint = f[where.floor] || (f[where.floor] = { n:0, hp:0, mp:0 });
    checkpoint.n++; checkpoint.hp += Math.round(hpRate(party) * 1000); checkpoint.mp += Math.round(mpRate(party) * 1000);
  }
  if (kind === "floor") d.fl = (d.fl || 0) + 1; // 着いた階の数 (同じ階へ何度着いても数える。魂・時間を階あたりにする物差し)
  if (kind === "clear") d.s.clear = snap;
  else if ((where.floor || 1) <= 1) {
    d.s.f1 = snap;
    // 迷宮に入った: それまで町で過ごした時間をこの迷宮の「町」の時間に足す (同じ迷宮へ何度入っても足し込む)
    if (S.townMs) { d.tms = (d.tms || 0) + S.townMs; S.townMs = 0; }
    if (S.townSl) {
      const t = d.tsl || (d.tsl = {});
      for (const k in S.townSl) t[k] = (t[k] || 0) + S.townSl[k];
      S.townSl = null;
    }
    if (S.townG) {
      for (const box in S.townG) for (const k in S.townG[box]) addTo(d, box, k, S.townG[box][k]);
      S.townG = null;
    }
  }
  else d.s.last = snap;
  persist();
}

// 戦闘ごとの集計の器 (kind: n=通常 / e=精鋭・ミミック・出来事 / b=主)
const AGG_KEYS = ["c", "w", "fl", "l", "r", "pre", "amb", "pa", "pe", "pp", "ea", "ee", "ep", "of", "op",
  "ft", "fo", "fs", "fp", "ambR", "ambX", "ambP", "dd", "dt", "hp0", "hp1", "pAgi", "eAgi", "eAgiAvg", "en"];
function agg(d, kind) {
  if (!d.b[kind]) { d.b[kind] = {}; for (const k of AGG_KEYS) d.b[kind][k] = 0; }
  return d.b[kind];
}

const hpRate = (party) => {
  let hp = 0, max = 0;
  for (const p of party) { max += p.maxhp || 0; hp += p.alive ? Math.max(0, p.hp || 0) : 0; }
  return max > 0 ? hp / max : 0;
};
const mpRate = (party) => {
  const max = party.reduce((n,p)=>n+(p.maxmp || 0),0);
  return max ? party.reduce((n,p)=>n+(p.alive === false ? 0 : Math.max(0,p.mp || 0)),0)/max : 0;
};

// 戦闘の開始: 戦闘ごとのメモを返す (Battle に持たせ、終了時に tlBattleEnd へ渡す)
export function tlBattleBegin({ where, kind, opening, openSrc, ambRate, party, enemies }) {
  if (!S.on || !where) return null;
  const alive = party.filter((p) => p.alive);
  const eAgis = enemies.map((e) => e.agi || 0);
  return {
    where, kind, opening: opening || null, openSrc: openSrc || null, ambRate: ambRate || 0,
    pAgi: alive.length ? alive.reduce((s, p) => s + (p.agi || 0), 0) / alive.length : 0,
    eAgi: eAgis.length ? Math.max(...eAgis) : 0,
    eAgiAvg: eAgis.length ? eAgis.reduce((s, v) => s + v, 0) / eAgis.length : 0,
    en: enemies.length,
    hp0: hpRate(party),
    mp0: mpRate(party),
    dd: 0, dt: 0,
  };
}

// 行動結果のダメージを足す (演出の入口 animateResult から)
export function tlHits(memo, res) {
  if (!memo || !res || !res.hits) return;
  for (const h of res.hits) {
    if (!h || !h.target || h.heal != null || !(h.dmg > 0)) continue;
    if (h.target.side === "enemy") memo.dd += h.dmg;
    else if (h.target.side === "party") memo.dt += h.dmg;
  }
}

// 戦闘の終了: result = "win" / "flee" / "lose"。tally = Battle.tally (combat.js が数える命中・手番・逃走)
export function tlBattleEnd(memo, { result, rounds, tally, party }) {
  if (!S.on || !memo || memo.done) return;
  memo.done = true;
  const d = slot(memo.where);
  const a = agg(d, memo.kind || "n");
  a.c++;
  if (result === "win") a.w++; else if (result === "flee") a.fl++; else if (result === "lose") a.l++;
  a.r += rounds || 0;
  if (memo.opening === "preempt") a.pre++; else if (memo.opening === "ambush") a.amb++;
  // 奇襲の出どころ: ambR = 開幕の抽選 / ambX = 出来事・密輸人の待ち伏せ。ambP = 抽選の奇襲率の合計 (×1000。予想回数の元)
  if (memo.opening === "ambush") { if (memo.openSrc === "rand") a.ambR = (a.ambR || 0) + 1; else if (memo.openSrc) a.ambX = (a.ambX || 0) + 1; }
  if (memo.ambRate) a.ambP = (a.ambP || 0) + Math.round(memo.ambRate * 1000);
  const t = tally || {};
  // 予想成功率 fp を数える前の記録 (fp の無い器) には、予想付きの試行数 fpn を別に持たせる
  if (a.fpn == null) a.fpn = a.fp ? a.ft : 0;
  if (t.fp != null) a.fpn += t.ft || 0;
  for (const k of ["pa", "pe", "pp", "ea", "ee", "ep", "of", "op", "ft", "fo", "fs", "fp"]) a[k] = (a[k] || 0) + (t[k] || 0);
  a.dd += memo.dd; a.dt += memo.dt;
  a.hp0 += Math.round(memo.hp0 * 1000);
  a.hp1 += Math.round(hpRate(party) * 1000);
  a.resourceBattles = (a.resourceBattles || 0) + (memo.mp0 != null ? 1 : 0);
  if (memo.mp0 != null) { a.mp0 = (a.mp0 || 0) + Math.round(memo.mp0 * 1000); a.mp1 = (a.mp1 || 0) + Math.round(mpRate(party) * 1000); }
  a.pAgi += Math.round(memo.pAgi * 10);
  a.eAgi += Math.round(memo.eAgi * 10);
  a.eAgiAvg += Math.round(memo.eAgiAvg * 10);
  a.en += memo.en;
  persist();
}

// ---- 読み出し ----
const pct = (n, d) => (d > 0 && Number.isFinite(n) ? `${Math.round((n / d) * 100)}%` : "―");
const avg = (n, c, div = 1) => (c > 0 && Number.isFinite(n) ? Math.round((n / c / div) * 10) / 10 : "―"); // 古い記録で欠けた項目は「―」
// 奇襲: 受けた回数と、開幕の抽選から見込まれる回数 (出来事・待ち伏せの分は別に添える)。
// 出どころを記録し始める前の器 (ambP の無いもの) は回数だけ出す
function ambushNote(a) {
  if (!a.amb && !a.ambP) return "";
  const exp = a.ambP != null ? `(予想${(a.ambP / 1000).toFixed(1)}${a.ambX ? `・出来事${a.ambX}` : ""})` : "";
  return ` 奇襲${a.amb || 0}${exp}`;
}
// 逃走の予想成功率 (予想を記録し始める前の試行は除いて平均する。予想の無い記録は出さない)
function fleeExpect(a) {
  const n = a.fpn != null ? a.fpn : (a.fp ? a.ft : 0);
  return n > 0 ? `(予想${pct((a.fp || 0) / 1000, n)})` : "";
}
const KIND_LABEL = { n: "通常", e: "精鋭等", b: "主" };
const mins = (ms) => `${Math.round((ms || 0) / 60000)}分`;
// 出どころの略称 (迷宮の中 / 町 / 上乗せ)
const SRC_LABEL = {
  bn: "通常戦", be: "精鋭等", bb: "主", mt: "金属", ev: "出来事", cp: "死体", ch: "宝箱", hd: "殲滅", x: "他",
  q: "依頼", qk: "依頼(討伐)", qs: "依頼(魂)", qc: "依頼(宝箱)", qf: "依頼(到達)", qd: "依頼(納品)", tip: "心付け", bond: "なじみ", fq: "頼み", r: "王の報告", a: "勲章", t: "宝物庫", sell: "売却",
  psv: "パッシブ", sf: "特別階", mut: "異変", trait: "掟", oth: "出来事等", eq: "装備",
};
const srcText = (b) => (b ? Object.keys(b).sort((x, y) => b[y] - b[x]).map((k) => `${SRC_LABEL[k] || k}${b[k]}`).join(" ") : "");
// ✦・金貨の出どころの行 (出どころを数え始める前の器には無いので、何も無ければ出さない)
function gainLines(d) {
  const out = [];
  const one = (label, src, up, town) => {
    const bits = [];
    if (src) bits.push(srcText(src));
    if (up) bits.push(`(うち上乗せ ${srcText(up)})`);
    if (town) bits.push(`/ 町 ${srcText(town)}`);
    if (bits.length) out.push(`${label} ${bits.join(" ")}`);
  };
  one("✦の出どころ", d.ss, d.sx, d.tsoul);
  one("金貨の出どころ", d.gs, d.gx, d.tgold);
  return out;
}

// 魂のレア度別の数 → 「C5 R1 E1」 (無ければ空)
function soulText(b) {
  if (!b) return "";
  return [["c", "C"], ["r", "R"], ["e", "E"], ["l", "L"]].filter(([k]) => b[k]).map(([k, n]) => `${n}${b[k]}`).join(" ");
}

function sortedKeys(data = S.d) {
  return Object.keys(data).sort((a, b) => (a[0] === b[0] ? parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) : a < b ? -1 : 1));
}

// 画面に出す要約・書き出しの本文 (迷宮ごとに数行。調整に使う数字だけ)
const r1 = (v) => Math.round(v * 10) / 10;
const RES_LABEL = { battle:"戦闘", enemy:"敵行動", action:"行動", skill:"技・呪文", physical:"物理・吸収", round:"ターン", passive:"戦闘パッシブ", victory:"勝利後", floor:"階移動", explore:"探索パッシブ", fountain:"泉", darkFountain:"黒い泉", victoryTerrain:"掟・特別階の勝利後", item:"道具", camp:"探索中の術", event:"出来事", trap:"罠", terrain:"床・盤面", poison:"毒", growth:"Lv上昇", revive:"蘇生" };
// 隊の様子 → 「Lv12-15 HP320 MP80 STR40 VIT35 AGI30 INT20 PIE22 LUK15 (6人)」(生きている者の平均)
function partyText(snap) {
  if (!snap || !snap.p) return "";
  const rows = snap.p.filter((r) => r[13]);
  if (!rows.length) return "全員倒れている";
  const lv = rows.map((r) => r[3]);
  const mean = (i) => Math.round(rows.reduce((s, r) => s + (r[i] || 0), 0) / rows.length);
  const names = ["HP", "MP", "STR", "VIT", "AGI", "INT", "PIE", "LUK"];
  return `Lv${Math.min(...lv)}-${Math.max(...lv)} ` + names.map((n, j) => `${n}${mean(5 + j)}`).join(" ") + ` (${rows.length}人)` +
    (snap.base ? ` 基準AGI${snap.base}` : "");
}
// 戦闘の種類ごとの1行
function battleLine(kind, a) {
  const hit = (n, e, p) => pct(n - e - p, n);
  const bits = [`${KIND_LABEL[kind]}${a.c}戦 勝${a.w || 0}/逃${a.fl || 0}/全滅${a.l || 0}`, `平均${avg(a.r, a.c)}R`,
    `被ダメ/戦${avg(a.hp0 - a.hp1, a.c, 10)}% (HP${avg(a.hp0, a.c, 10)}→${avg(a.hp1, a.c, 10)}%)`];
  if (a.resourceBattles) bits.push(`MP${avg(a.mp0, a.resourceBattles, 10)}→${avg(a.mp1, a.resourceBattles, 10)}%`);
  bits.push(`与/被ダメ${avg(a.dd, a.c)}/${avg(a.dt, a.c)}`, `敵の命中${hit(a.ea, a.ee, a.ep)}`, `味方の命中${hit(a.pa, a.pe, a.pp)}`,
    `味方先手${pct(a.of, a.op)}`);
  const amb = ambushNote(a).trim();
  if (amb) bits.push(amb);
  if (a.pre) bits.push(`先制${a.pre}`);
  if (a.ft) bits.push(`逃走${a.fo}/${a.ft}${fleeExpect(a)}`);
  bits.push(`AGI 隊${avg(a.pAgi, a.c, 10)}/敵最大${avg(a.eAgi, a.c, 10)}`, `敵数${avg(a.en, a.c)}`);
  return bits.join(" ");
}
// 進み方 (levelcurve の BATTLES_PER_HOUR / EXTRA / MIN_PER_FLOOR を合わせる材料)
function paceLine(d) {
  const bits = [];
  const battles = ["n", "e", "b"].reduce((s, k) => s + ((d.b && d.b[k] && d.b[k].c) || 0), 0);
  if (d.ms || d.tms) bits.push(`時間 迷宮${mins(d.ms)}/町${mins(d.tms)}`);
  if (d.fl) bits.push(`着いた階${d.fl}${d.ms ? ` (${r1(d.ms / 60000 / d.fl)}分/階)` : ""}`);
  if (d.ms && battles) bits.push(`${Math.round(battles / (d.ms / 3600000))}戦/時`);
  if (d.soul || d.gold) {
    const bs = d.ss ? (d.ss.bn || 0) + (d.ss.be || 0) + (d.ss.bb || 0) : 0;
    bits.push(`✦${d.soul || 0}${bs ? ` (戦闘の${r1((d.soul || 0) / bs)}倍)` : ""} ${d.gold || 0}G`);
  }
  return bits.join(" / ");
}
function lootLine(d) {
  const L = d.loot || {}, bits = [];
  const sl = soulText(d.sl), tsl = soulText(d.tsl);
  if (sl || tsl) bits.push(`魂 ${sl || "0"}${tsl ? ` (町 ${tsl})` : ""}`);
  const lab = [["c", "C"], ["uc", "UC"], ["r", "R"], ["sr", "SR"], ["lr", "LR"], ["misc", "収集"], ["use", "道具"]];
  const got = lab.filter(([k]) => L[k]).map(([k, n]) => `${n}${L[k]}`);
  if (got.length || L.nw || L.lost) bits.push(`品 ${got.join(" ") || "0"}${L.nw ? ` 新種${L.nw}` : ""}${L.lost ? ` 置き去り${L.lost}` : ""}`);
  return bits.join(" / ");
}
// 多い順に上位 n 件 → 「名前数 名前数」
function topText(b, n, label = (k) => k) {
  return Object.keys(b).sort((x, y) => b[y] - b[x]).slice(0, n).map((k) => `${label(k)}${b[k]}`).join(" ");
}
// HP/MP の収支 (出どころの多い順に上位3件ずつ)
function resourceLine(res) {
  if (!res) return "";
  const box = { "hp-": {}, "hp+": {}, "mp-": {}, "mp+": {} };
  for (const k in res) { const [src, kind] = k.split(":"); if (box[kind]) box[kind][src] = res[k]; }
  const one = (k) => topText(box[k], 3, (s) => RES_LABEL[s] || s) || "0";
  return `HP 消耗 ${one("hp-")} | 回復 ${one("hp+")} / MP 消耗 ${one("mp-")} | 回復 ${one("mp+")}`;
}
// 直近の出撃の作戦と魂
function runLine(d) {
  const run = d.runs && d.runs[d.runs.length - 1];
  const bits = [`出撃${d.entries || (d.runs ? d.runs.length : 0)}回`];
  if (d.outcomes) bits.push(`結果 ${topText(d.outcomes, 6)}`);
  const lo = run && run.entry && run.entry.loadout;
  if (lo && lo.length) {
    const tac = {};
    for (const m of lo) tac[m.tactic || "bal"] = (tac[m.tactic || "bal"] || 0) + 1;
    bits.push(`直近の作戦 ${topText(tac, 5)}`);
    const souls = lo.map((m) => (m.souls || []).filter((x) => x.clsKey).map((x) => `${x.clsKey}${x.level}+${(x.count || 1) - 1}`).join("・")).filter(Boolean);
    if (souls.length) bits.push(`魂 ${souls.join(" ")}`);
  }
  return bits.join(" / ");
}
export function tlSummary(data = S.d) {
  const out = [];
  for (const k of sortedKeys(data)) {
    const d = data[k];
    const parts = [];
    const f1 = partyText(d.s && d.s.f1), cl = partyText(d.s && d.s.clear), last = partyText(d.s && d.s.last);
    if (f1) parts.push(`隊 1階 ${f1}`);
    if (cl) parts.push(`隊 踏破 ${cl}`);
    else if (last) parts.push(`隊 最後の階 ${last}`);
    for (const kind of ["n", "e", "b"]) { const a = d.b && d.b[kind]; if (a && a.c) parts.push(battleLine(kind, a)); }
    for (const line of [paceLine(d), lootLine(d), ...gainLines(d), resourceLine(d.resources)]) if (line) parts.push(line);
    if (d.actions) parts.push(`技 ${topText(d.actions, 10)}`);
    if (d.floors) parts.push("階到着 HP/MP% " + Object.entries(d.floors).map(([f, a]) => `B${f}:${avg(a.hp, a.n, 10)}/${avg(a.mp, a.n, 10)}`).join(" "));
    if (d.runs || d.entries) parts.push(runLine(d));
    out.push({ head: `${k} ${d.name}`, lines: parts.length ? parts : ["戦闘の記録なし"] });
  }
  return out;
}

// 書き出し用テキスト。貼り付けて読めるよう、調整に使う要点だけ (生データ・出撃ごとの装備・安定度の出来事の明細は出さない)。
// past = 過去版 (デプロイで版が変わる前の記録) も同じ形で、新しい版から順に添える
export function tlExportText({ past = false } = {}) {
  const lines = [`【DOS テスト記録 v${VERSION}】 版 ${TEST_BUILD} / 記録開始 ${dateText(S.since)} / 書き出し ${stamp()}`];
  lines.push(...tlStabilitySummary());
  const now = tlSummary();
  if (!now.length) lines.push("(この版の迷宮の記録はまだない)");
  for (const s of now) { lines.push(s.head); for (const l of s.lines) lines.push("  " + l); }
  const history = S.history || [];
  if (past) {
    for (const h of [...history].reverse()) {
      lines.push("", `【過去版 ${h.build || "旧版(不明)"}】 ${dateText(h.since)} ～ ${dateText(h.until)}`);
      lines.push(...tlStabilitySummary(h.stability));
      for (const s of tlSummary(h.d || {})) { lines.push(s.head); for (const l of s.lines) lines.push("  " + l); }
    }
  } else if (history.length) lines.push(`(過去版の記録 ${history.length}件は「過去版も書き出す」で出せる)`);
  lines.push("注: 被ダメ/戦 = 戦闘前後の隊HP割合の差の平均。命中 = 物理の試行から回避・見切りを除いた割合。奇襲の予想 = 開幕の抽選の奇襲率の合計。✦の「戦闘の倍」= 迷宮で得た✦ ÷ 戦闘の✦。魂 = 職Lv+融合数。");
  return lines.join("\n");
}
// 過去版の数と、画面に出す要約 (新しい版から順)
export function tlPastCount() { return (S.history || []).length; }
export function tlPastSummary() {
  return [...(S.history || [])].reverse().map((h) => ({
    head: `過去版 ${h.build || "旧版(不明)"} ${dateText(h.since)} ～ ${dateText(h.until)}`,
    stability: tlStabilitySummary(h.stability), dungeons: tlSummary(h.d || {}),
  }));
}
// ISO の日時 (旧版の until) も stamp と同じ「2026-10-08 02:23」に揃える
function dateText(v) {
  if (!v) return "―";
  if (!/T/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d)) return v;
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}
// 記録そのもの (検証用。書き出しには出さない)
export function tlRawData() {
  return JSON.parse(JSON.stringify({ v: S.v, build:S.build, since: S.since, townMs: S.townMs || 0, townSl: S.townSl || null, townG: S.townG || null, d: S.d, history:S.history || [], stability:S.stability || null }));
}

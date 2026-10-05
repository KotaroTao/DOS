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
//              (画面が見えていて直近2分以内に操作がある時間だけ。game.js の5秒ごとの時計から)
// 「記録を書き出す」でテキストにして、そのまま貼り付けて送れる。保存先は端末内 (localStorage) のみで、外へは送らない。
// セーブとは別の鍵 (dos-testlog)。「はじめから」でも消えない (消すのは「記録を消す」)。
// game.js は import しない (game.js から呼ばれる側)。戦闘の挙動には一切影響しない。

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
  if (Object.keys(S.d).length) (S.history || (S.history = [])).push({ build: S.build || "旧版(不明)", since: S.since, until: new Date().toISOString(), d: S.d, townMs:S.townMs || 0, townSl:S.townSl || null, townG:S.townG || null });
  S.d = {}; S.townMs = 0; S.townSl = null; S.townG = null; S.build = TEST_BUILD; S.since = S.on ? new Date().toISOString() : null;
}
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
export function tlHasData() { return Object.keys(S.d).length > 0; }

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

// 出撃中の人業1人 → [名前, 職, ランク, Lv, 列, 最大HP, 最大MP, ATK, VIT, AGI, INT, PIE, LUK, 生存]
function dollRow(p, i) {
  return [p.name || "", p.jobKey || "", p.jobRank || 0, p.jobLv || 1, i < 3 ? "前" : "後",
    p.maxhp || 0, p.maxmp || 0, p.atk || 0, p.vit || 0, p.agi || 0, p.int || 0, p.pie || 0, p.luk || 0, p.alive ? 1 : 0];
}

function resourceState(party) {
  return party.map((p) => ({ name:p.name, hp:p.hp, mp:p.mp, maxhp:p.maxhp, maxmp:p.maxmp, alive:p.alive !== false }));
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
const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "―");
const avg = (n, c, div = 1) => (c > 0 ? Math.round((n / c / div) * 10) / 10 : "―");
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
// 戦利品と時間の1行 (記録し始める前の器には無いので、何も無ければ出さない)
function lootLine(d) {
  const L = d.loot || {};
  const bits = [];
  if (d.ms || d.tms) bits.push(`時間 迷宮${mins(d.ms)}/町${mins(d.tms)}${d.fl ? ` (${d.fl}階)` : ""}`);
  const sl = soulText(d.sl), tsl = soulText(d.tsl);
  if (sl || tsl) bits.push(`魂 ${sl || "0"}${tsl ? ` (町 ${tsl})` : ""}`);
  const lab = [["c", "C"], ["uc", "UC"], ["r", "R"], ["sr", "SR"], ["lr", "LR"], ["misc", "収集"], ["use", "道具"]];
  const got = lab.filter(([k]) => L[k]).map(([k, n]) => `${n}${L[k]}`);
  if (got.length || L.nw || L.lost) bits.push(`品 ${got.join(" ") || "0"}${L.nw ? ` 新種${L.nw}` : ""}${L.lost ? ` 置き去り${L.lost}` : ""}`);
  if (d.gold || d.soul) bits.push(`✦${d.soul || 0} ${d.gold || 0}G`);
  return bits.join(" / ");
}
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

// 画面に出す要約 (迷宮ごとに1〜2行)
export function tlSummary(data = S.d) {
  const out = [];
  for (const k of sortedKeys(data)) {
    const d = data[k];
    const snap = d.s.clear || d.s.last || d.s.f1;
    const lv = snap ? snap.p.filter((r) => r[13]).map((r) => r[3]) : [];
    const head = `${k} ${d.name}` + (lv.length ? `  Lv${Math.min(...lv)}-${Math.max(...lv)}` : "");
    const parts = [];
    for (const kind of ["n", "e", "b"]) {
      const a = d.b[kind];
      if (!a || !a.c) continue;
      parts.push(`${KIND_LABEL[kind]}${a.c}戦 勝${a.w || 0}/逃${a.fl || 0}/全滅${a.l || 0} ` +
        `敵の命中${pct(a.ea - a.ee - a.ep, a.ea)} 味方の命中${pct(a.pa - a.pe - a.pp, a.pa)} ` +
        `味方先手${pct(a.of, a.op)}${ambushNote(a)} 逃走${a.ft ? `${a.fo}/${a.ft}${fleeExpect(a)}` : "―"} ` +
        `AGI 隊${avg(a.pAgi, a.c, 10)}/敵${avg(a.eAgi, a.c, 10)}`);
      if (a.resourceBattles) parts.push(`  戦闘前後MP ${avg(a.mp0,a.resourceBattles,10)}%→${avg(a.mp1,a.resourceBattles,10)}% (記録${a.resourceBattles}戦)`);
    }
    const extra = lootLine(d);
    if (extra) parts.push(extra);
    parts.push(...gainLines(d));
    if (d.firstEntry) {
      const levels = d.firstEntry.p.map(p=>p[3]);
      parts.push(`この版の初記録出撃 B${d.firstEntry.floor}F・Lv${Math.min(...levels)}〜${Math.max(...levels)} / 出撃${d.entries || 1}回 / 帰還 ${srcText(d.outcomes) || "なし"}`);
    }
    if (d.floors) parts.push("階到着時 " + Object.entries(d.floors).map(([f,a])=>`B${f}F HP${avg(a.hp,a.n,10)}% MP${avg(a.mp,a.n,10)}% (${a.n}回)`).join(" / "));
    if (d.resources) {
      const labels = { battle:"戦闘", enemy:"敵行動", action:"行動", skill:"技・呪文", physical:"物理・吸収", round:"ターン", passive:"戦闘パッシブ", victory:"勝利後", floor:"階移動", explore:"探索パッシブ", fountain:"泉", darkFountain:"黒い泉", victoryTerrain:"掟・特別階の勝利後", item:"道具", camp:"探索中の術", event:"出来事", trap:"罠", terrain:"床・盤面", poison:"毒", growth:"Lv上昇" };
      const sources = [...new Set(Object.keys(d.resources).map(k=>k.split(":")[0]))];
      for (const source of sources) parts.push(`収支 ${labels[source] || source}: HP 回復${d.resources[source+":hp+"] || 0}/消耗${d.resources[source+":hp-"] || 0} MP 回復${d.resources[source+":mp+"] || 0}/消耗${d.resources[source+":mp-"] || 0}`);
    }
    out.push({ head, lines: parts.length ? parts : ["戦闘の記録なし"] });
  }
  return out;
}

// 書き出し用テキスト (要約 + 生データの JSON)
export function tlExportText() {
  const lines = [`【DOS テスト記録 v${VERSION}】 版 ${TEST_BUILD} / 記録開始 ${S.since || "―"} / 書き出し ${stamp()}`];
  for (const s of tlSummary()) { lines.push(s.head); for (const l of s.lines) lines.push("  " + l); }
  for (const history of S.history || []) {
    lines.push(`\n【過去版 ${history.build}】 ${history.since || "―"} ～ ${history.until}`);
    for (const s of tlSummary(history.d)) { lines.push(s.head); for (const l of s.lines) lines.push("  " + l); }
  }
  lines.push("");
  lines.push("隊の列: 名前,職,ランク,Lv,列,最大HP,最大MP,ATK,VIT,AGI,INT,PIE,LUK,生存 / base=基準AGI");
  lines.push("戦闘の鍵: c戦闘 w勝 fl逃 l全滅 rラウンド pre先制 amb奇襲 ambR/ambX=奇襲のうち抽選/出来事・待ち伏せ ambP=抽選の奇襲率×1000の合計 pa/pe/pp=味方の物理 試行/回避された/見切られた " +
    "ea/ee/ep=敵の物理 同 of/op=手番で味方が先だった組/総組 ft/fo/fs=逃走 試行/成功/封じ fp/fpn=逃走を試みた時の成功率×1000の合計/その試行数 dd/dt=与/被ダメ " +
    "hp0/hp1=戦闘前後の隊HP割合×1000の合計 pAgi/eAgi/eAgiAvg=隊平均/敵最大/敵平均AGI×10の合計 en=敵数の合計");
  lines.push("迷宮の鍵: ms/tms=迷宮の中/入る前の町の実プレイ時間(ミリ秒) fl=着いた階の数 gold/soul=迷宮で得たゴールド/✦Soul " +
    "loot=手に入れた品 (c/uc/r/sr/lr=装備のレア度 misc=収集品 use=道具 nw=図鑑の新種 lost=持ちきれず置いてきた) " +
    "sl/tsl=手に入れた職業の魂 迷宮の中/入る前の町 (c/r/e/l=コモン/レア/エピック/レジェンド) " +
    "ss/gs=迷宮で得た✦/金貨の出どころ (bn/be/bb=通常/精鋭等/主の戦闘 mt=金属の魔物 ev=出来事 cp=死体 ch=宝箱 hd=殲滅 x=他) " +
    "sx/gx=そのうち倍率で増えた分 (psv=パッシブ sf=特別な階 mut=異変 trait=迷宮の掟 oth=出来事の効果・奈落 eq=装備・恵み) " +
    "tsoul/tgold=その迷宮へ入る前に町で得た✦/金貨 (qk/qs/qc/qf/qd=依頼 討伐/魂/宝箱/到達/納品 tip=心付け bond=なじみの贈り物 fq=依頼人の頼み r=王への報告 a=勲章 t=宝物庫 sell=売却)");
  lines.push("追加の鍵: resources=出どころ:hp/mp:+回復/-消耗 (実増減・過剰回復を除く); actions=職:技/行動の使用回数; mp0/mp1=戦闘前後MP割合×1000; resourceBattles=MP記録済み戦闘数; floors=階到着時HP/MP割合×1000の合計と回数; firstEntry=この版で最初に記録した出撃 (初攻略とは限らない); runs=直近20出撃の入口と帰還時資源・結果; history=過去版の記録。未対応の回復経路は収支に含まれない。");
  lines.push(JSON.stringify({ v: S.v, build:S.build, since: S.since, townMs: S.townMs || 0, townSl: S.townSl || null, townG: S.townG || null, d: S.d, history:S.history || [] }));
  return lines.join("\n");
}

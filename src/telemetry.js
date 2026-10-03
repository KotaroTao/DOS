// ===== テスト記録 (戦闘バランス調整用) =====
// 設定「自動化・データ」→「テスト記録」で ON にすると、プレイ中に次を迷宮ごとに集計する。
//   隊の様子 … 各迷宮の1階に着いた時・最後に着いた階・踏破した時の、出撃中の人業の職・Lv・能力値
//   戦闘     … 戦闘数・勝ち/逃げ/全滅・ラウンド数・先制/奇襲・物理の命中/回避 (味方→敵 / 敵→味方)・
//              手番の先後・逃走の試行/成功・与ダメ/被ダメ・戦闘前後の隊HP割合・隊と敵の AGI
// 「記録を書き出す」でテキストにして、そのまま貼り付けて送れる。保存先は端末内 (localStorage) のみで、外へは送らない。
// セーブとは別の鍵 (dos-testlog)。「はじめから」でも消えない (消すのは「記録を消す」)。
// game.js は import しない (game.js から呼ばれる側)。戦闘の挙動には一切影響しない。

import { baselineAgi, progressX } from "./baseline.js";

const KEY = "dos-testlog";
const VERSION = 1;

function blank() { return { v: VERSION, on: false, since: null, d: {} }; }
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    if (!s || s.v !== VERSION || typeof s.d !== "object") return blank();
    return s;
  } catch (e) { return blank(); }
}
let S = load();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 容量切れ等は諦める */ } }

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
  S = blank();
  S.on = on;
  if (on) S.since = stamp();
  persist();
}
export function tlHasData() { return Object.keys(S.d).length > 0; }

// 迷宮の欄 (key = "D10" / 奈落は "A3")
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

// 隊の様子を残す。kind: "floor" (階に着いた) / "clear" (迷宮を踏破)
// where = { key, name, n, floor, floors }
export function tlSnapshot(kind, where, party) {
  if (!S.on || !where || !party) return;
  const d = slot(where);
  const snap = {
    t: stamp(), f: where.floor || 1,
    base: Math.round(baselineAgi(progressX(where.n, where.floor, where.floors)) * 10) / 10,
    p: party.map(dollRow),
  };
  if (kind === "clear") d.s.clear = snap;
  else if ((where.floor || 1) <= 1) d.s.f1 = snap;
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

function sortedKeys() {
  return Object.keys(S.d).sort((a, b) => (a[0] === b[0] ? parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) : a < b ? -1 : 1));
}

// 画面に出す要約 (迷宮ごとに1〜2行)
export function tlSummary() {
  const out = [];
  for (const k of sortedKeys()) {
    const d = S.d[k];
    const snap = d.s.clear || d.s.last || d.s.f1;
    const lv = snap ? snap.p.filter((r) => r[13]).map((r) => r[3]) : [];
    const head = `${k} ${d.name}` + (lv.length ? `  Lv${Math.min(...lv)}-${Math.max(...lv)}` : "");
    const parts = [];
    for (const kind of ["n", "e", "b"]) {
      const a = d.b[kind];
      if (!a || !a.c) continue;
      parts.push(`${KIND_LABEL[kind]}${a.c}戦 ` +
        `敵の命中${pct(a.ea - a.ee - a.ep, a.ea)} 味方の命中${pct(a.pa - a.pe - a.pp, a.pa)} ` +
        `味方先手${pct(a.of, a.op)}${ambushNote(a)} 逃走${a.ft ? `${a.fo}/${a.ft}${fleeExpect(a)}` : "―"} ` +
        `AGI 隊${avg(a.pAgi, a.c, 10)}/敵${avg(a.eAgi, a.c, 10)}`);
    }
    out.push({ head, lines: parts.length ? parts : ["戦闘の記録なし"] });
  }
  return out;
}

// 書き出し用テキスト (要約 + 生データの JSON)
export function tlExportText() {
  const lines = [`【DOS テスト記録 v${VERSION}】 記録開始 ${S.since || "―"} / 書き出し ${stamp()}`];
  for (const s of tlSummary()) { lines.push(s.head); for (const l of s.lines) lines.push("  " + l); }
  lines.push("");
  lines.push("隊の列: 名前,職,ランク,Lv,列,最大HP,最大MP,ATK,VIT,AGI,INT,PIE,LUK,生存 / base=基準AGI");
  lines.push("戦闘の鍵: c戦闘 w勝 fl逃 l全滅 rラウンド pre先制 amb奇襲 ambR/ambX=奇襲のうち抽選/出来事・待ち伏せ ambP=抽選の奇襲率×1000の合計 pa/pe/pp=味方の物理 試行/回避された/見切られた " +
    "ea/ee/ep=敵の物理 同 of/op=手番で味方が先だった組/総組 ft/fo/fs=逃走 試行/成功/封じ fp/fpn=逃走を試みた時の成功率×1000の合計/その試行数 dd/dt=与/被ダメ " +
    "hp0/hp1=戦闘前後の隊HP割合×1000の合計 pAgi/eAgi/eAgiAvg=隊平均/敵最大/敵平均AGI×10の合計 en=敵数の合計");
  lines.push(JSON.stringify({ v: S.v, since: S.since, d: S.d }));
  return lines.join("\n");
}

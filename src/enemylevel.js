// 敵の表示Lv (2026-10 ユーザーの指示): その魔物が一番弱く出る所 (台帳の迷宮のどこか) で会った時と比べて、
// いま会った個体が実際に何倍強いかを Lv で表す。強さそのものは変えない (状態異常の成功率に使う e.lv = 迷宮の推奨Lv とは別)。
//   強さ = √(最大HP × 攻撃) — 出現した個体の実際の値 (階・迷宮の手直し・特別な階・異変・主の倍率・出来事の強化込み)
//   基準 = その魔物の出方 (雑魚・取り巻き・呼ばれる手下・強敵・主・ミミック・出来事の魔物・金属) ごとに、
//          台帳の全迷宮・全階で同じ組み立て (combat.js の spawn*) を試した最小の強さ。特別な階・異変は含めない
//   Lv = 1 + (強さ ÷ 基準 − 1) ÷ DISPLAY_LV_STEP (整数・最低 1) → Lv10 ≈ 1.95倍 / Lv20 ≈ 3.0倍
// 台帳の迷宮に出ない魔物 (奈落の第11層から先の顔ぶれ) は、奈落の層の浅い階を基準にする。
// game.js も ui も import しない (combat.js の組み立てを借りるだけ)
import { WORLD, poolAt, strengthAt, abyssLayer } from "./dungeons/world.js";
import { lvPow } from "./levelcurve.js";
import { spawnEliteEnemies, spawnBossEnemies, spawnMimic, spawnRanked, spawnMetal } from "./combat.js";
import { MONSTERS } from "./sprites.js";
import { METAL_TIERS } from "./dungeons/index.js";

// 1Lv ごとに、基準 (Lv1) の強さの 10.5% ずつ強くなる
export const DISPLAY_LV_STEP = 0.105;
// 強敵階が出始める階 (game.js newFloor と同じ — 3F 以降)
const ELITE_FROM_FLOOR = 3;
// マスターミミックが出始める層 (game.js MASTER_MIMIC_LAYER と同じ)
const MASTER_MIMIC_LAYER = 4;
// 奈落だけに出る魔物の基準を探す層の上限 (第20層の先は第20層の顔ぶれのまま)
const ABYSS_LAYERS = 20;

export function strengthIndex(e) {
  return Math.sqrt(Math.max(1, (e && e.maxhp) || 1) * Math.max(1, (e && e.atk) || 1));
}

// 出現表の雑魚の最上位ランク (game.js mimicRef と同じ。ミミック・出来事の魔物・金属の体の基準)
function topRank(cfg, pool) {
  return Math.max(1, cfg.rank || 1, ...pool.map((k) => (MONSTERS[k] && MONSTERS[k].rank) || 0));
}

// 一つの場所 (迷宮の1階ぶん) で、その魔物が出うる組み立ての強さをすべて list へ積む
//   at = { cfg, floor, base (強さの素 × 推奨Lv の伸び), pool, tune, deep, bottom, elites, boss, bossRank, bossScale, layer }
function collectAt(key, at, list) {
  const m = MONSTERS[key];
  if (!m) return;
  const t = at.tune || {};
  const solo = at.base * (t.soloMul || 1);
  const reg = at.base * (t.enemyMul || 1) * (at.deep ? (t.deepMul || 1) : 1);
  const one = (arr) => { if (arr && arr[0]) list.push(strengthIndex(arr[0])); };
  // 雑魚 (出現表)・取り巻き (escort)・呼ばれる手下 (summonKey) は雑魚の倍率で組まれる
  if (at.pool.includes(key)) one(spawnEliteEnemies(key, reg));
  for (const k of at.pool) {
    const p = MONSTERS[k];
    if (p && (p.escort === key || p.summonKey === key)) one(spawnEliteEnemies(key, reg));
  }
  // 強敵 (強敵階は3階から)。強敵の呼ぶ手下は強敵の倍率のまま
  if (at.floor >= ELITE_FROM_FLOOR && at.elites) for (const k of at.elites) {
    if (k === key) one(spawnEliteEnemies(key, solo));
    else if (MONSTERS[k] && MONSTERS[k].summonKey === key) one(spawnEliteEnemies(key, solo));
  }
  // 迷宮の主 (最下階)。主の呼ぶ手下は主の倍率のまま
  if (at.bottom && at.boss) {
    const bs = at.bossScale * at.base;
    if (at.boss === key) {
      const e = spawnBossEnemies(key, bs, at.bossRank)[0];
      if ((t.bossHpMul || 1) !== 1) e.maxhp = Math.max(1, Math.round(e.maxhp * t.bossHpMul));
      list.push(strengthIndex(e));
    } else if (MONSTERS[at.boss] && MONSTERS[at.boss].summonKey === key) one(spawnEliteEnemies(key, bs));
  }
  // ミミック・出来事の魔物・金属は「その階の雑魚の最上位ランク」の体で組まれる
  if (key === "mimic") one(spawnMimic(topRank(at.cfg, at.pool), solo, false));
  if (key === "master_mimic" && at.layer >= MASTER_MIMIC_LAYER) one(spawnMimic(topRank(at.cfg, at.pool), solo, true));
  if (m.evOnly) one(spawnRanked(key, topRank(at.cfg, at.pool), 1, solo));
  if (m.metal) {
    const T = METAL_TIERS[m.metal];
    if (T && at.layer >= T.layer) one(spawnMetal(key, { rank: topRank(at.cfg, at.pool), scale: at.base, count: 1 }));
  }
}

function worldSpots() {
  const out = [];
  for (const cfg of WORLD) for (let f = 1; f <= (cfg.floors || 1); f++) {
    out.push({
      cfg, floor: f, base: strengthAt(cfg, f), pool: poolAt(cfg, f), tune: cfg.tune, deep: f > (cfg.floors || 3) / 2,
      bottom: f === cfg.floors, elites: cfg.elites, boss: cfg.boss, bossRank: cfg.bossRank, bossScale: (cfg.bossScale || 1) * ((cfg.tune && cfg.tune.bossMul) || 1),
      layer: cfg.layer || 1,
    });
  }
  return out;
}
// 奈落の層の浅い階 (強敵の出る3階相当) と門番の階 — 台帳の迷宮に出ない魔物のための基準
function abyssSpots() {
  const out = [];
  for (let L = 1; L <= ABYSS_LAYERS; L++) {
    const info = abyssLayer(L);
    const cfg = { rank: info.rank, layer: Math.min(20, L) };
    out.push({
      cfg, floor: ELITE_FROM_FLOOR, base: info.coef * lvPow(info.lvFrom), pool: info.pool, tune: null, deep: false, bottom: false,
      elites: info.elites, boss: null, layer: cfg.layer,
    });
    // 門番 (層の最後の階): 奈落の強さ × bossRel × 1.05 (game.js fightAbyssGuard と同じ)
    out.push({
      cfg, floor: 10, base: info.coef * lvPow(info.lvTo), pool: [], tune: null, deep: true, bottom: true,
      elites: [], boss: info.boss, bossRank: info.bossRank, bossScale: info.bossRel * 1.05, layer: cfg.layer,
    });
  }
  return out;
}

let _world = null, _abyss = null;
const _ref = new Map();
// その魔物の基準の強さ (一番弱く出る所)。どこにも出ない魔物は 0
export function enemyBaseStrength(key) {
  if (_ref.has(key)) return _ref.get(key);
  const list = [];
  for (const at of (_world ||= worldSpots())) collectAt(key, at, list);
  if (!list.length) for (const at of (_abyss ||= abyssSpots())) collectAt(key, at, list);
  const v = list.length ? Math.min(...list) : 0;
  _ref.set(key, v);
  return v;
}

// 出現した個体の表示Lv (整数・最低1)。基準の分からない魔物は null
export function enemyDisplayLevel(e) {
  if (!e || !e.key) return null;
  if (e._dlv != null) return e._dlv;
  const base = enemyBaseStrength(e.key);
  if (!(base > 0)) return null;
  const r = strengthIndex(e) / base;
  e._dlv = Math.max(1, 1 + Math.round((r - 1) / DISPLAY_LV_STEP));
  return e._dlv;
}
// 記録欄に添える「（Lv29）」。基準の分からない魔物は空
export function enemyLvTag(e) {
  const lv = enemyDisplayLevel(e);
  return lv ? `（Lv${lv}）` : "";
}

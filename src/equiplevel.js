// ===== 装備できるLv (装備可能レベル、2026-10 ユーザーの指示・docs/infinite-labyrinth.md 11章) =====
// どの装備にも「装備できるLv」があり、人業のメイン魂の Lv がそれに届かなければ付けられない。
// 値 = その品が通常の抽選で落ちうる迷宮のうち、推奨Lv (1階) が一番低い迷宮の推奨Lv。
//   - 品のランク R = ceil(隠しLv / 10)。迷宮の出現上限 (lootCapR) = 基準R (= ceil(落とし物の帯の上限 / 10)) + LOOT_R_HEADROOM
//   - 層の逸品 (layer つき・LR の tier 1〜4) は、その層以降の迷宮だけを数える (game.js pickOfRarity / lrPool と同じ条件)
//   - 職業専用・全職共通の LR (tier 5 以上) は、落とし物の帯の上限が解禁値 (LR_UNLOCK) に届く迷宮を数える
//   - 宝箱ランク・からくり錠・掟の上乗せ (lootBonusLv) は数えない。依頼・宝物庫・首級など落とし物から外した品も同じ式
//   - 台帳のどの迷宮でも落ちないランクは、台帳の伸び方で延ばす
// 品ごとに迷宮を調べず、読み込み時に台帳 (world.js の WORLD) から R ごとの表を作る。
// items.js は world.js を import しない (循環を避ける) ので、game.js が registerEquipLevel(equipLevelFor) で渡す。
import { WORLD } from "./dungeons/world.js";

// 出現上限の余白 (game.js lootCapR = 基準R + これ)
export const LOOT_R_HEADROOM = 2;
// 職業専用LR・全職共通のLR防具 (tier5以上) の解禁 lootLv (game.js lrPool・宝物庫の LR の節目)
export const LR_UNLOCK = { 5: 40, 10: 90, 15: 140, 20: 190 };

const clampR = (r) => Math.max(1, Math.min(20, Math.round(r) || 1));
let _rows = null;
function rows() {
  if (_rows) return _rows;
  _rows = WORLD.filter((d) => d && d.lootLv && d.lv).map((d) => {
    const top = d.lootLv[1] || 1;
    return { lv: d.lv, layer: d.layer || 1, top, cap: Math.min(20, Math.max(1, Math.ceil(top / 10)) + LOOT_R_HEADROOM) };
  });
  return _rows;
}
const minLv = (list) => (list.length ? Math.min(...list.map((r) => r.lv)) : null);

// R ごとの装備できるLv の表 (index = R、1〜20)
let _byR = null;
export function equipLvTable() {
  if (_byR) return _byR.slice();
  const t = new Array(21).fill(null);
  for (let R = 1; R <= 20; R++) t[R] = minLv(rows().filter((r) => r.cap >= R));
  // 台帳で落ちないランクは、直前のランクの伸び (落ちるランクの上側4つの平均の刻み) で延ばす
  const known = [];
  for (let R = 1; R <= 20; R++) if (t[R] != null) known.push(R);
  const last = known.length ? known[known.length - 1] : 0;
  const tail = known.slice(-5);
  const step = tail.length >= 2 ? Math.max(1, (t[tail[tail.length - 1]] - t[tail[0]]) / (tail[tail.length - 1] - tail[0])) : 6;
  for (let R = 1; R <= 20; R++) {
    if (t[R] != null) continue;
    t[R] = R > last && last ? Math.round(t[last] + step * (R - last)) : 1;
  }
  // 単調にそろえる (上のランクほど低くならない)
  for (let R = 2; R <= 20; R++) t[R] = Math.max(t[R], t[R - 1]);
  t[0] = 1;
  _byR = t;
  return t.slice();
}

// 品の層の条件 (層の逸品・LR の tier 1〜4)。無ければ 0
function layerReq(it) {
  if (it.layer) return it.layer;
  if (it.rar === "lr" && (it.lr || 0) > 0 && it.lr < 5) return it.lr;
  return 0;
}

const _cache = new Map();
// 品 (目録の品・所持品の実体どちらも) の装備できるLv。装備でない品は 1
export function equipLevelFor(it) {
  if (!it || !it.slot || it.slot === "use" || it.slot === "misc" || it.slot === "mat") return 1;
  const R = clampR(it.r20 || Math.ceil((it.lv || 1) / 10));
  const tier = it.rar === "lr" && !it.layer && (it.lr || 0) >= 5 ? it.lr : 0;
  const L = layerReq(it);
  const key = `${R}|${L}|${tier}`;
  let v = _cache.get(key);
  if (v != null) return v;
  const table = equipLvTable();
  if (tier) {
    const unlock = LR_UNLOCK[tier] || 40;
    v = minLv(rows().filter((r) => r.top >= unlock));
    if (v == null) v = table[clampR(Math.ceil(unlock / 10) + LOOT_R_HEADROOM)];
  } else if (L) {
    v = minLv(rows().filter((r) => r.layer >= L && r.cap >= R));
    if (v == null) v = table[R];
  } else {
    v = table[R];
  }
  v = Math.max(1, v || 1);
  _cache.set(key, v);
  return v;
}

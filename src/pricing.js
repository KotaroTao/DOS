// 装備の値段 = 性能で決める
//
// 以前は値段が隠しレベル lv だけで決まっていた (カタログの priceOf(lv)、items.js の基本装備は手書き)。
// 能力値は整数に丸められるので、低い lv では lv の違う品が同じ性能になったり、
// レア補正・pow・手書き価格のせいで「性能が上なのに安い」逆転が起きていた。
// ここでは装備の能力値 (+ 属性・状態異常耐性・追加効果) から「性能点」を出し、
// その部位の標準品 (catalog/defs.js のビルダー既定値) が同じ性能点になる lv を逆算して、
// 従来の価格曲線 priceOf(lv) に乗せる。標準品の値段は今までとほぼ変わらず、
//   ・性能が全く同じ品は同じ値段
//   ・同じ部位で、どの能力も同等以上 (かつどこかが上) の品は必ず高い
// が成り立つ。値段はレア度では上乗せしない (レアは性能が高いぶん高くなる)。
// % 補正 (mult) と戦闘効果 (eff) は効き目の大きさに応じた固定の点を足す (lv には依らない)。

// 能力値 1 あたりの性能点。部位をまたいで共通 (どの部位でも ATK+1 と VIT+1 は同じ重み)
const STAT_W = { atk: 1, vit: 1, agi: 1, int: 0.7, pie: 0.7, luk: 0.6, hp: 0.15, mp: 0.25, crit: 100 };

// 従来の価格曲線 (catalog/defs.js の priceOf と同じ)
const priceOfLv = (lv) => 10 + lv * lv * 0.30 + lv * 5;

// 部位ごとの標準品 (ビルダー既定値) の性能点。lv の単調増加関数
const REF = {
  weapon: (lv) => 2 + lv * 0.82 + lv * lv * 0.0026,                                  // 長剣 (片手) の ATK
  shield: (lv) => 2 + lv * 0.16 + lv * lv * 0.0014,                                  // 盾の VIT
  body: (lv) => 3 + lv * 0.22 + lv * lv * 0.0014,                                    // 重鎧の VIT
  head: (lv) => 1 + lv * 0.10 + lv * lv * 0.0012,                                    // 兜の VIT
  feet: (lv) => (1 + lv * 0.09 + lv * lv * 0.0010) + (0.6 + lv * 0.085),             // 革靴の VIT + AGI
  hands: (lv) => (0.8 + lv * 0.16 + lv * lv * 0.0006) + lv * 0.05,                   // 籠手の ATK + VIT
  acc: (lv) => 0.17 * (2 + lv * 0.82 + lv * lv * 0.0026),                            // 標準の腕輪・護符
};
const LV_MAX = 260;

// % 補正・戦闘効果の点 (装飾品の物差し)。部位ごとの標準品の大きさに合わせて SLOT_SCALE 倍する
const EFF_PTS = {
  actFirst: () => 15, ailmentImmune: () => 15,
  multistrike: (v) => 20 * Math.max(0, v - 1), // 連撃は 2 以上で効く (1 は通常どおり1回)
  guard: (v) => 100 * v, autoRevive: (v) => 50 * v, regen: (v) => 150 * v,
  lifesteal: (v) => 60 * v, counter: (v) => 40 * v, spellCostMul: (v) => 60 * (1 - v),
  goldUp: (v) => 30 * v, soulUp: (v) => 30 * v,
};
const MULT_PTS = 60; // %補正 +100% あたり (+20% = 12点)
const SLOT_SCALE = {};
for (const k in REF) SLOT_SCALE[k] = REF[k](100) / REF.acc(100);

function effScore(it) {
  let s = 0;
  if (it.eff) for (const k in it.eff) {
    const f = EFF_PTS[k], v = it.eff[k];
    s += f ? Math.max(0, f(typeof v === "number" ? v : 1)) : 10;
  }
  if (it.mult) for (const k in it.mult) s += MULT_PTS * Math.max(0, it.mult[k] || 0);
  return s * (SLOT_SCALE[it.slot] || 1);
}

// 能力値の性能点 (負の値は減点)
function statScore(it) {
  let s = 0;
  for (const k in STAT_W) if (typeof it[k] === "number") s += it[k] * STAT_W[k];
  return s;
}

// 武器の能力補正 (scale) の点: その lv の品を使う頃の隊の能力値の目安 (基準の隊 baseline.js の実測からの概算) × 係数。
// 攻撃力に直接足されるので ATK と同じ重みで数える
const statAtLv = (lv) => 8 + 1.7 * lv;
function scaleScore(it) {
  if (!it.scale) return 0;
  let s = 0;
  for (const k in it.scale) s += (it.scale[k] || 0) * statAtLv(it.lv || 1);
  return s;
}

// 属性・状態異常耐性・追加効果の上乗せ率 (能力値の点に掛ける)
function featureMul(it) {
  let m = 1;
  if (it.magic) m += 0.15; // 魔法属性の武器 (物理耐性の敵に通る)
  if (it.eAtk) m += 0.15 * (it.eAtk.lv || 1);
  if (it.eDef) m += 0.10 * (it.eDef.lv || 1);
  if (it.aRes) for (const k in it.aRes) m += 0.6 * (it.aRes[k] || 0);
  if (it.onHit) m += (it.onHit.chance || 0) * (it.onHit.pct ? 1.5 : 1);
  return m;
}

// 装備の性能点
export function equipScore(it) {
  const s = statScore(it) + scaleScore(it);
  return (s > 0 ? s * featureMul(it) : s) + effScore(it);
}

// 性能点 → 値段。標準品の曲線を lv について逆算し (二分法)、priceOf(lv) を返す
export function priceForScore(slot, score) {
  const ref = REF[slot];
  if (!ref) return null;
  const r0 = ref(0);
  if (score <= r0) return Math.max(1, Math.round(priceOfLv(0) * Math.max(0, score) / r0));
  let lo = 0, hi = LV_MAX;
  if (ref(hi) <= score) return Math.round(priceOfLv(hi) * score / ref(hi));
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ref(mid) < score) lo = mid; else hi = mid;
  }
  return Math.round(priceOfLv((lo + hi) / 2));
}

// 装備の値段。装備でない品・値段 0 の品 (呪いの品など) は null (= 変更しない)
export function equipPrice(it) {
  if (!it || !REF[it.slot] || it.price === 0) return null;
  const p = priceForScore(it.slot, equipScore(it));
  return p == null ? null : Math.max(1, p);
}

// ITEMS 全体の装備の値段を性能から付け直す (game.js が起動時に一度呼ぶ)
export function repriceEquipment(items) {
  for (const id in items) {
    const p = equipPrice(items[id]);
    if (p != null) items[id].price = p;
  }
}

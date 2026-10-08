// ===== レベルの曲線 (レベルデザインの1か所) =====
// 「6人を均等に育てて、実プレイ 7時間で Lv50 / 20時間で Lv100 / 以降 20時間ごとに +100」を目標に、
// 推奨Lv・敵の✦Soul・魂の強化費用・魂の残火をすべて Lv から決める。
//
//   1Lv の目標時間 lvMinutes(L) : Lv1〜49 は 4.3分 → 12.9分へ伸び (計7時間)、Lv50〜99 は 15.6分 (計13時間)、Lv100〜 は 12分
//   1戦の✦Soul  refSoul(L)     : 敵Lv L の迷宮で、出現表の雑魚と戦う普通の1戦に得る ✦Soul の基準 (精鋭・主はこの何倍か)
//   強化費用     trainCost(L)   : refSoul(L) × lvMinutes(L) × EXP_PER_MIN — Lv に合った迷宮で戦えば、狙いの分数で1Lv上がる
//
// EXP_PER_MIN = 魂1つに1分あたり入る ✦Soul を「1戦の✦」で数えたもの:
//   1時間に 57戦 (テスト記録: 1階 約3.1分・1階 約3戦、町の時間込み) × 死体・出来事・精鋭の上乗せ 1.3 ×
//   魂1つへの配分 0.5 (戦闘で各魂に 1/3 が自動で入り、祭壇で残りを6人に均等に注ぐと 1/6) ÷ 60分
// 迷宮1階あたり MIN_PER_FLOOR 分で、推奨Lv (world.js lv / lvTo) はこの曲線から付ける (下の levelAtMinutes)。
// テスト記録 (fl・ms・sl・soul) が届いたら、BATTLES_PER_HOUR / EXTRA / MIN_PER_FLOOR を実測で合わせ直す。
// 推奨Lv を超えて育ちすぎないよう、迷宮で得る ✦ は Lv差で減る (game.js soulLvMul: 推奨Lv+2 を超えた1Lvごとに −10%、下限20%)。
// 曲線は「その時いちばん深い迷宮を初めて潜る」分の ✦ で組んであり、魂融合・残火を集める周回や寄り道の迷宮の ✦ は勘定に入っていない
// (2026-10 のテスト記録: 初めての1階あたりの ✦ は設計の約1.1倍だったが、隊は縦穴 w10 (推奨Lv41-43) に Lv44-50 で着いた)。
// game.js も world.js も import しない (どちらからも読まれる側)。

export const BATTLES_PER_HOUR = 57;
export const EXTRA = 1.3;
export const SHARE = 0.5;
export const EXP_PER_MIN = BATTLES_PER_HOUR * EXTRA * SHARE / 60;
export const MIN_PER_FLOOR = 3.1;

// 1Lv の目標時間 (分)。Lv1〜49 の合計がちょうど 420分 (7時間) になるよう、4.25分から 0.18分ずつ伸ばす
export function lvMinutes(L) {
  L = Math.max(1, Math.floor(L));
  if (L < 50) return 4.25 + 0.18 * (L - 1);
  if (L < 100) return 15.6;
  return 12;
}

// Lv1 から Lv L に届くまでの目標時間 (分)
export function minutesToLevel(L) {
  let m = 0;
  for (let l = 1; l < L; l++) m += lvMinutes(l);
  return m;
}
// 目標時間 (分) で届く Lv (小数。推奨Lvの割り付けに使う)
export function levelAtMinutes(min) {
  let L = 1, m = 0;
  while (L < 10000) {
    const d = lvMinutes(L);
    if (m + d > min) return L + (min - m) / d;
    m += d; L++;
  }
  return L;
}

// 敵Lv L の普通の1戦の ✦Soul。Lv100 までは 10 + 0.4L² (Lv1 で 10・Lv50 で 1010・Lv100 で 4010)、その先は同じ傾きの直線 (+80/Lv)
export function refSoul(L) {
  L = Math.max(1, L);
  if (L <= 100) return 10 + 0.4 * L * L;
  return 4010 + 80 * (L - 100);
}

// 敵Lv L の普通の1戦の金貨 (戦闘で隊に入る額)。旧来の金貨は同じ迷宮の ✦Soul とほぼ同じ額で、品の値段もそれに合わせてあるので、
// 推奨Lv を上げた分の品 (落とし物の帯) の値段に釣り合うよう refSoul の 0.7倍 (Lv39 で 433G・Lv57 で 917G — 旧来の同じ Lv の迷宮とほぼ同じ)
export function refGold(L) { return 0.7 * refSoul(L); }

// 魂の強化費用 (Lv L → L+1)
export function trainCost(L) {
  return Math.max(1, Math.round(refSoul(L) * lvMinutes(L) * EXP_PER_MIN));
}

// 人業の能力値の Lv による伸び (souls.js の lvlFactor と同じ式)。敵の強さを推奨Lvに合わせる物差し
export function lvPow(L) { return 1 + (Math.max(1, L) - 1) * 0.12; }

// 魂の残火: 1回に得る数は敵Lv で増える (Lv1〜50 = 1、51〜100 = 2 … Lv400 = 8)
export function emberMul(L) { return Math.max(1, Math.ceil(Math.max(1, L) / 50)); }

// ===== 推奨Lv で引く隊の物差し (docs/tasks.md B1) =====
// 基準の隊の AGI ÷ lvPow(Lv)。旧来は基準の隊 (baseline.js) を迷宮の番号 n で引き、推奨Lv の伸びを掛けていた。
// 本筋の迷宮ごとの値 (2026-10 の実測から) をその迷宮の真ん中の推奨Lv に置き、間を直線で結ぶ。端の先は端の値のまま。
// 逃走 (game.js fleeScale)・敵の物理の回避・金属の魔物の AGI が読む。テスト記録が届いたら測り直す
// Lv28.5 以降は旧来 16.0 だったが、2026-10-07 のテスト記録では Lv27-49 の隊が 11〜13 (w06 11.2・w07 11.6・w09 12.7〜13.0)。
// 物差しが3割ほど高く、敵が「速い」扱いになって味方の物理が外れやすかった (w06 で命中59%、Lv40 の中央値の敵で約65%)
const AGI_K = [[1, 7.5], [7.5, 7.8], [13.5, 9.0], [19.5, 11.2], [24.5, 11.6], [52, 13.0]];
export function partyAgi(L) {
  L = Math.max(1, L);
  let k = AGI_K[AGI_K.length - 1][1];
  if (L <= AGI_K[0][0]) k = AGI_K[0][1];
  else for (let i = 1; i < AGI_K.length; i++) {
    const [a, ka] = AGI_K[i - 1], [b, kb] = AGI_K[i];
    if (L <= b) { k = ka + (kb - ka) * (L - a) / (b - a); break; }
  }
  return k * lvPow(L);
}
// 罠の解除の難しさ・罠のダメージの物差し: 推奨Lv の伸び (序盤は下限 LOCK_POW_MIN = 推奨Lv 7.25 相当で止める)。
// 旧来の「魂レベルの目安 (素体の soulLevelBonus) × 迷宮ランク × 推奨Lv の伸び ÷ n の物差しの伸び」は第2層から
// 解除 ≒ 22 × lvPow・罠 ≒ 0.62 × lvPow でほぼ一定だったので、その値に揃えた (第1層は下限で旧来並み)
export const LOCK_K = 22;
export const TRAP_K = 0.62;
export const LOCK_POW_MIN = 1.75;
export function lockPow(L) { return Math.max(LOCK_POW_MIN, lvPow(L)); }

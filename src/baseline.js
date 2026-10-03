// ===== 基準の隊 (戦闘バランスの基準点) =====
// 「レベル上げ・トレハンをほぼせず普通に進めた隊」が、その迷宮でどのくらいの能力値かを1行ずつ持つ表。
// 敵を1体ずつ調整するのではなく、この表を実測値で書き換えて合わせ込む (テスト記録 telemetry.js の書き出しが材料)。
// 今は逃走判定 (game.js fleeScale) が基準 AGI を読む。AGI 仕様の刷新で敵の AGI にも使う予定。
//
// 進行度 x = (迷宮番号 − 1) + その迷宮での階の進み具合 ((階 − 1) ÷ 全階数: 1階 = 0、最下階でも 1 未満)。
// 最下階 (踏破時) と次の迷宮の1階 (町で育てた後) が別の点になるよう、最下階を次の迷宮の入口と重ねない。
// 値は出撃している隊員の平均 (生存を問わず)。行は1層ぶんずつテスト記録の f1 (1階到着) と clear (踏破) から足す。

export const PARTY_BASELINE = [
  // ── 第1層 (実測 2026-10-03・はじめから・4→6人)。D4踏破→D5入口の跳ねは、町での育成と転職 (侍・魔盗賊・司教・死霊術師) の分
  { n: 1, floor: 1, floors: 3, lv: 1, hp: 25, atk: 10.5, vit: 5.3, agi: 7.5, int: 6.3, pie: 5.8, luk: 6.5 },     // D1 1階 4人
  { n: 1, floor: 3, floors: 3, lv: 1, hp: 25, atk: 10.5, vit: 5.3, agi: 7.5, int: 6.3, pie: 5.8, luk: 6.5 },     // D1 踏破
  { n: 2, floor: 1, floors: 3, lv: 3, hp: 31, atk: 19, vit: 8.3, agi: 11, int: 8.3, pie: 7.3, luk: 7.8 },        // D2 1階
  { n: 2, floor: 3, floors: 3, lv: 4, hp: 34, atk: 20, vit: 9, agi: 12, int: 8.8, pie: 7.8, luk: 9 },            // D2 踏破
  { n: 3, floor: 1, floors: 3, lv: 6, hp: 41, atk: 21.2, vit: 13.6, agi: 15, int: 10.2, pie: 10.8, luk: 10.8 },  // D3 1階 5人
  { n: 3, floor: 3, floors: 3, lv: 7.6, hp: 46, atk: 23, vit: 14.8, agi: 17, int: 11.6, pie: 12.2, luk: 12 },    // D3 踏破
  { n: 4, floor: 1, floors: 3, lv: 9.6, hp: 56, atk: 25, vit: 17.6, agi: 19, int: 13, pie: 15.4, luk: 13.6 },    // D4 1階
  { n: 4, floor: 3, floors: 3, lv: 10.6, hp: 59, atk: 25.6, vit: 18.4, agi: 19.8, int: 14, pie: 16, luk: 14.4 }, // D4 踏破
  { n: 5, floor: 1, floors: 5, lv: 15, hp: 81, atk: 41, vit: 25.3, agi: 26, int: 27.8, pie: 19.2, luk: 20.8 },   // D5 1階 6人
  { n: 5, floor: 5, floors: 5, lv: 16.3, hp: 86, atk: 43, vit: 26.5, agi: 27.3, int: 29.3, pie: 19.8, luk: 22.2 }, // D5 踏破 (層ボス撃破)
  // ── 第2層 (暫定)。別のセーブ・以前の版での1点だけ。いまの周回が第2層を終えたら差し替える
  // 迷宮10「よどみの大溜まり」B3F (全6階)。Lv21-24。6人中5人の実測 (フィモンは未計測)
  { n: 10, floor: 3, floors: 6, lv: 22.8, hp: 113, atk: 50.4, vit: 37, agi: 32.6, int: 19.4, pie: 32.2, luk: 26.4 },
];

// 進行度 x (迷宮番号と階から)
export function progressX(n, floor = 1, floors = 1) {
  const f = Math.max(1, floors || 1);
  const p = Math.min(1 - 1 / f, Math.max(0, ((floor || 1) - 1) / f));
  return Math.max(0, (n || 1) - 1) + p;
}

// AGI の仮の曲線 (実測の無い区間の目安): 迷宮1の入口で 7、1迷宮ごとに +2.4
const AGI_ORIGIN = 7;
const AGI_SLOPE = 2.4;

// 基準 AGI。実測点どうしの間は直線で結び、最初の実測点より前は (x=0, 7) から、
// 最後の実測点より先は仮の傾き (+2.4/迷宮) で延ばす。実測が無ければ仮の曲線そのもの。
export function baselineAgi(x) {
  const pts = PARTY_BASELINE
    .filter((r) => r.agi != null)
    .map((r) => ({ x: progressX(r.n, r.floor, r.floors), v: r.agi }))
    .sort((a, b) => a.x - b.x);
  if (!pts.length) return AGI_ORIGIN + AGI_SLOPE * x;
  const first = pts[0], last = pts[pts.length - 1];
  if (x <= first.x) {
    const t = first.x > 0 ? x / first.x : 1;
    return AGI_ORIGIN + (first.v - AGI_ORIGIN) * t;
  }
  if (x >= last.x) return last.v + AGI_SLOPE * (x - last.x);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (x <= b.x) return a.v + (b.v - a.v) * ((x - a.x) / (b.x - a.x || 1));
  }
  return last.v;
}

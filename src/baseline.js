// ===== 基準の隊 (戦闘バランスの基準点) =====
// 「レベル上げ・トレハンをほぼせず普通に進めた隊」が、その迷宮でどのくらいの能力値かを1行ずつ持つ表。
// 敵を1体ずつ調整するのではなく、この表を実測値で書き換えて合わせ込む (テスト記録 telemetry.js の書き出しが材料)。
// 今は逃走判定と、敵の物理を味方がかわす率 (どちらも game.js fleeScale → combat.js fleeK) が基準 AGI を読む。
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
  // ── 第2層 (実測 2026-10-03・第1層と同じ周回・6人)。D8 入口の AGI の落ち込みは転職 (戦士→神殿騎士) の分
  { n: 6, floor: 1, floors: 4, lv: 17.7, hp: 95, atk: 46, vit: 28.3, agi: 29.3, int: 31.8, pie: 21.2, luk: 23.7 },      // D6 1階
  { n: 6, floor: 4, floors: 4, lv: 17.8, hp: 95, atk: 46.2, vit: 28.3, agi: 29.5, int: 32.2, pie: 21.3, luk: 23.8 },    // D6 踏破
  { n: 7, floor: 1, floors: 4, lv: 18.8, hp: 100, atk: 50.5, vit: 30.3, agi: 32, int: 32.3, pie: 22, luk: 24.8 },       // D7 1階
  { n: 7, floor: 4, floors: 4, lv: 18.8, hp: 100, atk: 50.5, vit: 30.3, agi: 32, int: 32.3, pie: 22, luk: 24.8 },       // D7 踏破
  { n: 8, floor: 1, floors: 4, lv: 17.5, hp: 102, atk: 50.8, vit: 32.3, agi: 29.5, int: 32.7, pie: 25.2, luk: 24.5 },   // D8 1階
  { n: 8, floor: 4, floors: 4, lv: 19, hp: 108, atk: 52.8, vit: 33.7, agi: 30.8, int: 34.2, pie: 26.8, luk: 25.8 },     // D8 踏破
  { n: 9, floor: 1, floors: 4, lv: 20.3, hp: 120, atk: 58, vit: 37, agi: 33.7, int: 36.8, pie: 28.5, luk: 27.2 },       // D9 1階
  { n: 9, floor: 4, floors: 4, lv: 21.3, hp: 125, atk: 59.3, vit: 37.8, agi: 35, int: 38.2, pie: 29.3, luk: 28.3 },     // D9 踏破
  { n: 10, floor: 1, floors: 6, lv: 22, hp: 127, atk: 60.3, vit: 38.7, agi: 35.7, int: 38.5, pie: 29.8, luk: 29 },      // D10 1階
  { n: 10, floor: 6, floors: 6, lv: 22.8, hp: 131, atk: 61.5, vit: 39.3, agi: 36.5, int: 39.5, pie: 30.5, luk: 29.8 },  // D10 踏破 (層ボス撃破)
  // ── 第3層 (実測 2026-10-04・同じ周回・6人)。D10踏破→D11入口の跳ね (HP +21%・AGI +42%) はサブ魂の解禁 (当時は一律30%) と
  // 転職 (僧侶→祓魔師) の分。この行は「経験値2倍・サブ魂の能力加算をランク別 (10〜30%) に」の改定前の隊なので、
  // 改定後の隊は Lv で約5、能力値で1〜2割低い見込み。改定後のテスト記録が届いたら第1〜3層とも測り直す
  { n: 11, floor: 1, floors: 5, lv: 23.7, hp: 159, atk: 72.3, vit: 48.5, agi: 52, int: 41.8, pie: 36, luk: 40 },        // D11 1階
  { n: 11, floor: 5, floors: 5, lv: 23.8, hp: 160, atk: 72.5, vit: 48.5, agi: 52.2, int: 42, pie: 36, luk: 40.2 },      // D11 踏破
  { n: 12, floor: 1, floors: 5, lv: 24.3, hp: 164, atk: 77.7, vit: 49.3, agi: 52.7, int: 42.2, pie: 37.7, luk: 41 },    // D12 1階
  { n: 12, floor: 5, floors: 5, lv: 24.5, hp: 166, atk: 78.2, vit: 49.7, agi: 53.3, int: 42.7, pie: 38.2, luk: 41.3 },  // D12 踏破
  { n: 13, floor: 1, floors: 5, lv: 25.7, hp: 174, atk: 82.3, vit: 52.7, agi: 55.2, int: 44.3, pie: 39.5, luk: 42.7 },  // D13 1階
  { n: 13, floor: 5, floors: 5, lv: 25.7, hp: 177, atk: 83.3, vit: 53, agi: 55.7, int: 44.8, pie: 40.7, luk: 43.3 },    // D13 踏破
  { n: 14, floor: 1, floors: 5, lv: 27.3, hp: 183, atk: 89.2, vit: 55.2, agi: 58.2, int: 52, pie: 44.2, luk: 45.3 },    // D14 1階
  { n: 14, floor: 5, floors: 5, lv: 28.8, hp: 194, atk: 93, vit: 57.7, agi: 61.7, int: 54.5, pie: 47.2, luk: 48.3 },    // D14 踏破
  { n: 15, floor: 1, floors: 7, lv: 30.5, hp: 203, atk: 95.3, vit: 59.7, agi: 63.7, int: 56.3, pie: 49.2, luk: 50.5 },  // D15 1階 (踏破は未計測)
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

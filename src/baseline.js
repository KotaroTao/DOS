// ===== 基準の隊 (戦闘バランスの基準点) =====
// 「レベル上げ・トレハンをほぼせず普通に進めた隊」が、その迷宮でどのくらいの能力値かを1行ずつ持つ表。
// 敵を1体ずつ調整するのではなく、この表を実測値で書き換えて合わせ込む (テスト記録 telemetry.js の書き出しが材料)。
// 現段階では表と補間だけを提供し、戦闘の判定はまだこれを読まない (AGI 仕様の刷新で敵の AGI に使う予定)。
//
// 進行度 x = (迷宮番号 − 1) + その迷宮での階の進み具合 (1階 = 0、最下階 = 1)。D10 の最下階なら x = 10。
// 値は隊員の平均 (生存・控えを問わず、出撃している者)。

export const PARTY_BASELINE = [
  // 迷宮10「よどみの大溜まり」B3F (全6階)。Lv21-24。6人中5人の実測 (フィモンは未計測)
  { n: 10, floor: 3, floors: 6, lv: 22.8, hp: 113, atk: 50.4, vit: 37, agi: 32.6, int: 19.4, pie: 32.2, luk: 26.4,
    src: "実測 2026-10-03 (5人の平均)" },
];

// 進行度 x (迷宮番号と階から)
export function progressX(n, floor = 1, floors = 1) {
  const f = Math.max(1, floors || 1);
  const p = f > 1 ? Math.min(1, Math.max(0, ((floor || 1) - 1) / (f - 1))) : 0;
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

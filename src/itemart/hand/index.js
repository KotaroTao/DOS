// 手描きの装備の絵 (スーパーレア・レジェンドレア)。{ 品の id: { palette, art } }
// art は 24×24 の行の配列 ("." = 透明)、palette は一文字 → "#rrggbb"。光源は左上、黒縁 k。
// 一ファイル = ひとまとまり (層の逸品・LR の職ごと…)。足したらここで束ねる
export const HAND_ART = {};
const PARTS = [];
for (const part of PARTS) {
  for (const id in part) {
    if (HAND_ART[id]) throw new Error("itemart: duplicate hand art " + id);
    HAND_ART[id] = part[id];
  }
}

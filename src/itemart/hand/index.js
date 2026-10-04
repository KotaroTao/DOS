// 手描きの装備の絵 (スーパーレア・レジェンドレア)。{ 品の id: { palette, art } }
// art は 24×24 の行の配列 ("." = 透明)、palette は一文字 → "#rrggbb"。光源は左上、黒縁 k。
// 一ファイル = ひとまとまり (層の逸品・LR の職ごと…)。足したらここで束ねる
import { ART_SR1 } from "./sr1.js";
import { ART_ACC } from "./acc.js";import { ART_L12 } from "./l12.js";import { ART_L34 } from "./l34.js";
export const HAND_ART = {};
const PARTS = [ART_SR1, ART_ACC, ART_L12, ART_L34];
for (const part of PARTS) {
  for (const id in part) {
    if (HAND_ART[id]) throw new Error("itemart: duplicate hand art " + id);
    HAND_ART[id] = part[id];
  }
}

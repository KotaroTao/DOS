// 手描きの装備の絵 (スーパーレア・レジェンドレア)。{ 品の id: { palette, art } }
// art は 24×24 の行の配列 ("." = 透明)、palette は一文字 → "#rrggbb"。光源は左上、黒縁 k。
// 一ファイル = ひとまとまり (層の逸品・LR の職ごと…)。足したらここで束ねる
import { ART_SR1 } from "./sr1.js";
import { ART_ACC } from "./acc.js";import { ART_L12 } from "./l12.js";import { ART_L34 } from "./l34.js";import { ART_ARM2 } from "./arm2.js";import { ART_ARM3 } from "./arm3.js";import { ART_JOB4 } from "./job4.js";import { ART_ARM1 } from "./arm1.js";import { ART_L5 } from "./l5.js";import { ART_L67 } from "./l67.js";import { ART_L8 } from "./l8.js";import { ART_L9 } from "./l9.js";import { ART_JOB1 } from "./job1.js";import { ART_JOB3 } from "./job3.js";import { ART_JOB2 } from "./job2.js";
export const HAND_ART = {};
const PARTS = [ART_SR1, ART_ACC, ART_L12, ART_L34, ART_ARM2, ART_ARM3, ART_JOB4, ART_ARM1, ART_L5, ART_L67, ART_L8, ART_L9, ART_JOB1, ART_JOB3, ART_JOB2];
for (const part of PARTS) {
  for (const id in part) {
    if (HAND_ART[id]) throw new Error("itemart: duplicate hand art " + id);
    HAND_ART[id] = part[id];
  }
}

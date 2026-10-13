# 森の古屋の背景・入口・由来

序章の「近くの森の古屋」（w00_forest・全三階）に専用の描き下ろしを追加。

- 探索背景: 枯葉と土の一枚の床、葉・小枝・年輪を彫った木の蓋、樹皮の壁。ろうそくは置かない。
- 入口: 森の小径の先に、屋根が傾いた無人の古屋。窓・灯りは消えている。
- 由来: 古屋の棚にもたれる、ほこりをかぶった木と黒鉄の人業。魂の灯はなく、体は壊れていない。既存本文の三段落に合わせ、本文は変更していない。
- 戦闘背景: 第1層の墓所ではなく、既存の森の情景を使う。

原画は画像生成で1536×1024として制作。盤面・入口の原画はこのディレクトリ、由来は `art/story-review/dungeons/lore_w00_forest.png`。出荷する画像はWebPのみ。
由来は `node tools/storyart/prompt.mjs lore_w00_forest` の依頼をもとに、正典の `docs/art/story-refs/dolls.png` を人業の参照に使用。

[変更前](review-w00_forest/w00_forest-before.png) · [盤面](review-w00_forest/w00_forest-board.png) · [スマホ全画面](review-w00_forest/after-mobile.png) · [入口](review-w00_forest/entrance-mobile.png) · [由来](review-w00_forest/lore-mobile.png) · [検査結果](review-w00_forest/checks.json)

盤面の比較は同じ種で一部を開けた制作見本。[初期配置](review-w00_forest/initial-mobile.png)とは区別する。
由来と本文の照合は [由来の確認ページ](../../../art/story-review/review/dungeons.md#lore_w00_forest) と [縮小見本](../../../art/story-review/review/dungeons-small.jpg)。

## 再作成・検査

```bash
bash tools/crypt/build-dungeons.sh w00_forest
python3 tools/storyart/build.py
python3 -m http.server 8000
CRYPT_REVIEW_OUT=docs/art/dungeons/review-w00_forest node tools/crypt/verify-dungeons.cjs w00_forest w02
```

ブラウザで森の三階・墓地五階・回廊十階、幅320/390/600/1280px、画像失敗・片側失敗・不正寸法・読込遅延、タップ・めくり・ドラッグ・全体表示、描画による乱数の不変、蓋と中身の独立、素材キャッシュ上限を確認。入口は出撃画面、静止画の初回読込後の更新、失敗時の代替表示、別迷宮への切替を確認。由来は踏破済みの一覧で表示を確認。ローカルChromiumでの検査で、実機の速度測定は含まない。

既存の迷宮に絵を追加する変更で、攻略仕様と酒場の話（t_prologue_forest）は変更していない。

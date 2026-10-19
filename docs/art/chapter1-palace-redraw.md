# 第一章・王宮関連6場面の描き直し

2026-10-19のユーザー依頼により、王宮の見本を基準に第一章の王宮関連イラストを全面的に描き直した。

建築と家具の主基準は [王宮の正面](story-refs/palace-front.png)。灰色の彫刻石、黒い石床、黒鉄と金、深紅の布、暖かなろうそくと冷たい夜の光を共通にした。玉座の間では中央の玉座・東側の小さな宰相の椅子・浅い階段・赤い通路・窓と旗の配置を合わせ、旧画像の大きな机を取り除いた。倉庫は材質と装飾を共有する別室として描いた。

| 場面 | 描き直した主題 | 原画 | 修正前 |
|---|---|---|---|
| report_w01 | 倉庫から眠る人業を抱えて運ぶ弟子 | [後](../../art/story-review/chapter1/report_w01.png) | [前](../../art/story-review/fixes/report_w01-palace-before.png) |
| report_w02 | 修道院長の話をする王と報告を聞く宰相 | [後](../../art/story-review/chapter1/report_w02.png) | [前](../../art/story-review/fixes/report_w02-palace-before.png) |
| report_w03 | 宰相から目をそらす王と報告を待つ弟子 | [後](../../art/story-review/chapter1/report_w03.png) | [前](../../art/story-review/fixes/report_w03-palace-before.png) |
| report_w04 | 王の言葉を遮る宰相と褒美を受け取った弟子 | [後](../../art/story-review/chapter1/report_w04.png) | [前](../../art/story-review/fixes/report_w04-palace-before.png) |
| minePass | 三種の宝への褒美として通行証を渡す王 | [後](../../art/story-review/chapter1/minePass.png) | [前](../../art/story-review/fixes/minePass-palace-before.png) |
| report_w05 | 膝の手記、肘掛けを握る手、宰相を退ける王 | [後](../../art/story-review/chapter1/report_w05.png) | [前](../../art/story-review/fixes/report_w05-palace-before.png) |

制作指示は [指示書](codex-story-art-brief.md) のA-49〜A-54に記録し、各場面の `prompt.mjs` 出力を使った。元画像と人物の基準を参照し、倉庫の場面では人物として登場しない王と宰相のシートを省いた。本文・場面ID・画像の割り当て・ゲームの仕組みは変更していない。

6枚とも1536×1024。原寸と [縮小の見本](../../art/story-review/review/chapter1-small.jpg) で人物・腕の本数・見える手・主題・文字なしを確認した。衣装や持ち物に隠れた指・脚は直接判別できない。[本文と画像の確認ページ](../../art/story-review/review/chapter1.md) も再生成した。

`python3 tools/storyart/build.py` でWebP変換・原画ハッシュ・登録・確認ページを更新し、登録検査・指示書検査・物語一覧検査を通した。新しいファイル名を追加していないため、`src/storyimages.js` と `sw.js` の登録内容に差分はない。

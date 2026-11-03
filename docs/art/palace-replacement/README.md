# 王宮の挿絵を約一割に絞る

2026-11-03のユーザー指示による制作。王宮の背景を統一する負担を減らし、報告で語られる情景・記憶・暮らしへ主題を移す。10枚ずつ5担当、別室の追加3枚を1担当で並行制作し、PR経由で順次mainへ取り込む。

残す6枚は arrival / report_w09 / report_w20 / report_w33 / report_w41 / report_w52。元の玉座の間56場面のうち50枚を変更し、倉庫・肖像・通行証の3枚も変更する。対象全59場面のうち6枚（約10%）で王宮を描く。残す原画のSHA-256は plan.json に記録。

本文・場面ID・表示条件は変更しない。報告中に語られた情景を挿絵にし、報告の会話自体の場所は変えない。手がかりが未取得でも成立する主題を優先する。既存の手がかり・主の記憶と同じ構図を繰り返さず、人物・魂・器・小道具の基準を守る。今回の変更対象では過去の玉座固定合成・旧王宮構図の維持指示より本指示を優先し、旧合成を再適用しない。

各 batchNN/ に変更前原画、制作指示、参照、本文との照合、縮小見本を保存する。原画は既存の art/story-review/ の同名ファイル、出荷は build.py が生成するWebPを使う。

| 組 | 対象 | 枚数 |
|---|---|---:|
| batch01 | report_w02–08 / 10–12 | 10 |
| batch02 | report_w13–19 / 21–23 | 10 |
| batch03 | report_w24 / 26–32 / 34–35 | 10 |
| batch04 | report_w36–40 / 42–46 | 10 |
| batch05 | report_w47–51 / 53–57 | 10 |
| batch06 | report_w01 / report_w25 / minePass | 3 |

## 完成した53枚

全53枚を画像生成で制作し、原寸と縮小で確認。各10枚組を並行制作後、WebP変換・登録・指示書整合・読み物の検査を実施した。残す6枚は制作開始時mainのSHA-256と一致。本文・ID・条件・画像の読込先は変更していない。

[53枚の一覧](overview-all.jpg) / [全体の検証](final-verification.json)

- [batch01の制作記録](batch01/README.md) / [縮小一覧](batch01/overview.jpg)
- [batch02の制作記録](batch02/README.md) / [縮小一覧](batch02/overview.jpg)
- [batch03の制作記録](batch03/README.md) / [縮小一覧](batch03/overview.jpg)
- [batch04の制作記録](batch04/README.md) / [縮小一覧](batch04/overview.jpg)
- [batch05の制作記録](batch05/README.md) / [縮小一覧](batch05/overview.jpg)
- [batch06の制作記録](batch06/README.md) / [縮小一覧](batch06/overview.jpg)

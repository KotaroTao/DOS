# 見捨てられた狼煙台の描き下ろし

専用原画・WebPが未制作だったため、`node tools/storyart/prompt.mjs lore_ws6` の本文と制作指示に沿って新規制作した。百年燃え続ける狼煙、薪の代わりにくべた砦の扉と旗竿、援軍の来ない捨て砦を描く。

- 原画: [lore_ws6.png](lore_ws6.png)（1536×1024）
- 配信画像: [lore_ws6.webp](../../story/dungeons/lore_ws6.webp)（品質88、約432KB）
- [スマホの出撃画面](ws6-review/departure-mobile.png)・[PCの出撃画面](ws6-review/departure-desktop.png)
- [本文との比較](../review/dungeons.md#lore_ws6見捨てられた狼煙台--描き下ろし)・[縮小の見本](../review/dungeons-small.jpg)

`python3 tools/storyart/build.py` でWebP変換、由来の台帳、Service Worker、確認ページを生成。出撃画面もws6のWebPを滑らかに表示し、取得失敗時は既存の情景へ戻す。

確認: 原画と登録の整合、指示書と本文、読み物の解放・状態保全、変更JSの構文、差分の空白、Chromiumで幅390/1280pxの出撃表示、由来と先読みの登録、画像取得失敗時の旧描画。ブラウザ実行時エラーなし。

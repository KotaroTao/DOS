# 迷宮ごとの戦闘背景

全77迷宮と無限迷宮の78点。画像生成で描いた9分割原画を9枚収録し、境界から4px内側を切り出して504×336・品質88のWebPに変換。原画8の9枠目と原画9の8〜9枠目は予備で出荷しない。

- 原画: `atlas-01.png`〜`atlas-09.png` (各1536×1024)
- 対応: `manifest.json` の atlas・tile (左上から右へ1〜9)
- 出荷: `art/battle/<迷宮ID>.webp`
- 一覧: `review.html` / `all-backgrounds.jpg`
- ブラウザ検査: `checks.json` / `browser-preview.png`

本筋・寄り道・森の古屋をそれぞれ固有の景色にした。戦闘中は中央と足元の暗幕を重ね、主と強敵には赤い周辺光を足す。読み込み中や通信失敗時は従来の層の背景を表示し、失敗した画像は30秒後に再試行する。設定「漆黒」および出撃画面のドット絵は既存の描画経路を使う。

酒場の心得 `t_battle_scenery` を追加。`sw.js` に全画像と読み込みモジュールを登録した。

再生成: `python3 tools/battle-backgrounds/build.py` (Pillow)。ブラウザ検査: `python3 tools/battle-backgrounds/check.py` (Playwright・Chromium、ポート8765)。

実戦画面: 地下墓地 (`battle-w01.png`)・苗床 (`battle-w12.png`、横長)・極光の氷窟 (`battle-w24.png`)・大書庫 (`battle-w45.png`)。テストプレイで戦闘状態に入り、対応WebPの取得とブラウザ例外なしを確認。

第十二章「王家の廟」: `atlas-09.png` の1〜7枠を `w46`〜`w49`・`ws25`〜`ws27` に割り当てる。原画は琥珀のろうそくの光・ろう・香油・金の飾りを共通に、中央の戦場を空けた。確認用一覧は `chapter12-backgrounds.jpg`。追加の心得は無し (既存 `t_battle_scenery` の説明どおり)。

第十二章の実戦検査: `battle-w46.png`〜`battle-w49.png`・`battle-ws25.png`〜`battle-ws27.png`。縦長・横長の戦闘で専用背景の取得とブラウザ例外なしを確認する。

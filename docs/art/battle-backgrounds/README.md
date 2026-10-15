# 迷宮ごとの戦闘背景

全70迷宮と無限迷宮の71点。画像生成で描いた9分割原画を8枚収録し、境界から4px内側を切り出して504×336・品質88のWebPに変換。最後の原画の9枠目は予備で出荷しない。

- 原画: `atlas-01.png`〜`atlas-08.png` (各1536×1024)
- 対応: `manifest.json` の atlas・tile (左上から右へ1〜9)
- 出荷: `art/battle/<迷宮ID>.webp`
- 一覧: `review.html` / `all-backgrounds.jpg`
- ブラウザ検査: `checks.json` / `browser-preview.png`

本筋・寄り道・森の古屋をそれぞれ固有の景色にした。戦闘中は中央と足元の暗幕を重ね、主と強敵には赤い周辺光を足す。読み込み中や通信失敗時は従来の層の背景を表示し、失敗した画像は30秒後に再試行する。設定「漆黒」および出撃画面のドット絵は既存の描画経路を使う。

酒場の心得 `t_battle_scenery` を追加。`sw.js` に全画像と読み込みモジュールを登録した。

再生成: `python3 tools/battle-backgrounds/build.py` (Pillow)。ブラウザ検査: `python3 tools/battle-backgrounds/check.py` (Playwright・Chromium、ポート8765)。

# 騎士 R1〜R5

職業IDは `knight`。茶色の短い跳ね髪、青い目の若い男性、青い布と銀・金の鎧、剣と青い紋章盾を維持する。
ユーザーが確認した `knight-r1-draft.png` を採用し、聖戦士 `crusader` を人体と描画の基準にする。

既存ランクの成長と制作差分:
- R1 見習い騎士: 簡素な銀の鎧、青い首布、茶色のベルト。
- R2 騎士: 金縁と盾の紋章を強化。顔・人体・ポーズはR1に固定。
- R3 重騎士: 厚い重装の肩・胸・脚の鎧、大きめの盾。
- R4 騎士団長: 金の彫金、青い紋章マント、指揮官の飾り。
- R5 大騎士団長: 最大の肩装甲、白い裏地の青いマント、豪華な金の紋章と装飾。

各ランクを独立した透明画像として生成する。mainへのマージは別途指示を待つ。

## 採用原画と修正

採用原画は `knight-r1-final.png`〜`knight-r5-final.png`。
R1はユーザー承認済みの案をそのまま採用。R2は頭の位置を修正し、R4とR5はマントの右端を枠の内側へ修正した。
R4はマント修正後に滑らかになった描画を再生成で修正。修正前の案は `*-draft.png` と `knight-r4-smooth-rejected.png` に保存している。
茶髪・青い目の男性、青い布、銀と金の鎧、剣と紋章盾を維持。各画像はR1と聖戦士を参照し、集合絵の分割・機械的なドット化・減色は行っていない。

## 取り込み

`tools/jobimg.py` を使用し、透明WebPを `art/jobs/knight_1.webp`〜`knight_5.webp` へ保存。
原画ごとに頬・主な髪の頭頂・顎と下端を測定した値は `import-settings.json`。
跳ね髪の先端だけを人体の頭頂にせず、上部の房の先と付け根の中間を測定している。
共通枠90×92ドット、頭頂9ドット。足裏の半透明な輪郭に余白を残すため、頭頂〜原画下端を82.5ドット（聖戦士基準は約82.9）へ配置。
全職共通の表示枠や職業IDは変更していない。

`src/jobphotos.js` に騎士の5ランクと顔設定を追加し、優先される `src/jobart.js` の騎士だけを除去。
`sw.js` にWebP5枚を登録し、`CACHE = "dos-dev"` を維持。

再取り込みと確認（リポジトリのルートで実行）:

```bash
python3 docs/art/knight/import-art.py
python3 docs/art/knight/verify-assets.py
python3 tools/review-job-art.py knight --label 騎士 --require-photos --output docs/art/knight/final-review
```

最後の確認にはローカルHTTPサーバーが必要。
`final-review.png` は実際の `jobSprite` / `jobBust` による聖戦士とR1〜R5の同倍率全身・56/36/26pxの顔アイコン・顔拡大。
`final-review.json` は画像選択・共通座標・描画数・ブラウザーエラーの検査結果。
`asset-verification.json` は原画と出荷画像の透過・四辺の余白・取り込み画像の残片の検査結果。

作業ブランチ: `codex/knight-art`。下準備ブランチと最新mainは作業ブランチへ取り込み済み。mainへのマージは未実施。

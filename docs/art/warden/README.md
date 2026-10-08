# 護法師 R1〜R5

職業IDは `warden`。下準備は `origin/codex/job-art-preparation` を取り込み、人体の参照は聖戦士 `crusader` R1。ユーザーが確認した護法師R1を直接参照し、R2〜R5をそれぞれ独立した透明画像として制作した。mainへのマージは未実施。

## 固有の特徴と成長

黒茶のお団子髪、茶色の目の男性。紺・白・青緑の衣装、金の法具、珠の首飾り、護符と房を維持。

- R1: 青い宝珠と金の輪の杖、基本の護符と房。
- R2: 杖の斜めの輪、宝石と護符、腰の飾りを追加。
- R3: 多重の輪と明るい宝珠、肩の紋章と珠の鎖。
- R4: 発光する法具、重ねた肩衣、体に沿う青白い光。
- R5: 金の法輪、胸・肩・腰の金飾りと珠、豪華な裾。法輪と光を内側へ修正し、頭部もR1へ寄せた。

## 測定と取り込み

原画は `warden-r1-final.png`〜`warden-r5-final.png`。採用した座標は `import-settings.json`、測定の比較は `measurement-review.png`。共通枠90×92、人体の頭頂9ドット。原画のほぼ不可視な残りだけを `--alpha-floor 8` で除去し、ドット化・減色せず既存の `tools/jobimg.py` で取り込んだ。

```bash
python3 tools/jobimg.py warden docs/art/warden/warden-r1-final.png docs/art/warden/warden-r2-final.png docs/art/warden/warden-r3-final.png docs/art/warden/warden-r4-final.png docs/art/warden/warden-r5-final.png --per-dot 13.49,13.51,13.63,13.53,13.98 --head 493,620,235,506,1353 493,620,235,506,1355 492,620,228,504,1358 493,620,235,506,1357 494,627,215,493,1376 --frame 90,92 --frame-top 9 --alpha-floor 8 --preview docs/art/warden/import-preview.png
python3 tools/review-job-art.py warden --label 護法師 --output docs/art/warden/game-display-review
python3 docs/art/warden/verify-import.py
```

## 確認と残る差

`game-display-review.png` は実際の `jobSprite` / `jobBust` による聖戦士R1と護法師5ランクの全身・56/36/26pxの顔・拡大胸像。全30キャンバスの描画とゲーム起動、ブラウザー例外なしを確認。`src/jobart.js` に護法師の優先エントリーはない。`sw.js` には既存の5パスが登録済みで、CACHEは `dos-dev` のまま。

承認済みR1の形を維持したため、頭部の高さは19.885〜20.25ドットで、聖戦士の21.93ドットとは約2ドット異なる。全身の高さ・頭頂・足元は揃っているが、共通基準との厳密な頭身一致は未達。`--require-photos` はこの差も拒否するため使用していない。代わりに `verify-import.py` で画像選択、ランク間の頭部差、枠、透過とキャッシュ登録を検査した。

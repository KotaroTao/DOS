# 賢者 R1〜R5

職業IDは `sage`。ユーザー確認済みのR1を直接参照し、R2〜R5を透明背景の独立画像として制作した。制作基準は聖戦士 `crusader` の確定原画。下準備は `origin/codex/job-art-preparation` から取り込み済み。

## 採用した成長

- R1 見習い賢者: 白髭、水色の帽子とローブ、木製の宝珠杖、控えめな金縁。
- R2 賢者: 明るいローブ、青い宝石、金縁と杖金具の強化。
- R3 博学者: 幾何学紋様、重ねた肩掛け、金の宝珠台座。
- R4 賢人: 肩掛けの層、胸の鎖飾り、袖と裾の宝石飾り。
- R5 全知者: 宝石付き帽子飾り、白金と金の豪華なローブ、中央に配置した外套、装飾杖。

旧表示は `existing-review.png`、承認時の比較は `r1-comparison.png`。顔・白髭・ポーズを引き継ぎ、装備と装飾を強化した。集合絵の分割、機械的なドット化・減色は行っていない。

## 原画と取り込み

確定原画は `sage-r1-final.png`〜`sage-r5-final.png`。原画の透明背景を維持し、`tools/jobimg.py` で縮小と共通枠への配置だけを行った。生成由来のalpha値1以下の不可視な外周は既存ツールが除去する。

測定値は `import-settings.json`。頭頂・顎は帽子と髭に隠れているため、見える前髪・顔・目と全身の輪郭から推定した人体位置を使う。帽子の先端・髭の先端は人体の頭頂・顎に含めない。足裏からの倍率は、縮小補間による外周も含めて欠けないよう約82ドットに合わせた。

共通枠は90×92ドット、保存画像は360×368px、人体の頭頂は9ドット、顔中心は全ランク `[45, 20]`。顎位置は30.658〜30.714ドットで聖戦士R1との差は0.3ドット未満。

再取り込み:

```bash
python3 tools/jobimg.py sage docs/art/sage/sage-r1-final.png docs/art/sage/sage-r2-final.png docs/art/sage/sage-r3-final.png docs/art/sage/sage-r4-final.png docs/art/sage/sage-r5-final.png --per-dot 14.036585,14.829268,14.658537,14.426829,14.841463 --head 500,600,220,524 488,588,190,512 494,594,178,496 490,590,182,495 497,597,175,497 --frame 90,92 --frame-top 9 --preview docs/art/sage/import-preview.png
```

`src/jobphotos.js` に5ランクを登録し、`sw.js` に5枚のWebPを追加。賢者には優先される `JOB_IMAGES` がなく、旧ドット絵を変更せず新しい原画が選択される。`CACHE` は `dos-dev` のまま。

## 確認

`final-review.png` と `final-review.json` は実際の `jobSprite` / `jobBust` による聖戦士との同倍率比較。全身6枚、56/36/26pxと拡大確認用の顔24枚、原画選択、座標、非空の描画、ゲーム起動、ブラウザ例外なしを検査した。帽子・杖・外套・足の欠けと不要な残片は目視でも確認。`src/jobphotos.js` と `sw.js` のNode構文検査を通過。

作業ブランチは `codex/sage-job-art`。mainへのマージ・pushは行っていない。

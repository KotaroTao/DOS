# 修験者 R1〜R5

職業IDは `ascetic`。聖戦士 `crusader` の原画を直接参照して制作した。
ユーザーが承認した `ascetic-r1-review-v2.png` を人体・顔・ポーズの基準として、R2〜R5を各1枚ずつ独立生成した。背景は透明。集合絵の分割や機械的なドット化・減色はしていない。

黒い跳ね髪、小さな六角帽、茶色の目、白い修験装束、胸の白い飾り、錫杖、木の数珠、脚絆と草履を維持した。R2は金色の縁取りと錫杖の金具、R3は毛皮の肩掛けと首の数珠、R4は赤白の儀礼装束と刺繍、R5は最も豪華な金の刺繍・房飾り・宝石と光背を追加した。

R1の透明余白の薄い残片、R3で数珠に隠れた白い胸飾り、R5の光背の大きさを修正した。採用原画は `ascetic-r1-final.png`〜`ascetic-r5-final.png`。承認時の原画と比較画像、修正前の案も保存している。

## 取り込み

`python3 docs/art/ascetic/import-art.py` で、測定値を `import-settings.json` に保存し、既存の `tools/jobimg.py` に渡す。共通枠は90×92ドット、主な髪の頭頂は9ドット、頭頂から足元は約82.5ドット。縮小時の輪郭の補間も含めて足裏に余白を残す。帽子や跳ね毛の先端を人体の頭頂として測らない。

承認済み修験者R1の頭の縦寸法は聖戦士より短い。聖戦士の座標を流用せず、修験者の実際の頭頂・顎を測定し、全ランクを修験者R1に揃えている。顔アイコンはゲームの `jobBust` が実測した頭の高さから切り出す。聖戦士との顎座標の完全一致は検証条件にしていない。

出荷画像は `art/jobs/ascetic_1.webp`〜`ascetic_5.webp`。取り込みにより `src/jobphotos.js` を更新する。5画像は既に `sw.js` の `ASSETS` に登録済みで、`CACHE = "dos-dev"` を維持する。`src/jobart.js` に修験者の優先される旧原画はない。

## 確認

ローカルサーバー起動後、次のコマンドで実描画を再確認できる。

```bash
python3 tools/review-job-art.py ascetic --label 修験者 --output docs/art/ascetic/final-review
node docs/art/ascetic/verify-import.mjs
python3 docs/art/ascetic/verify-assets.py
```

`final-review.png` は聖戦士R1と修験者R1〜R5の同倍率全身、56/36/26pxの顔と拡大顔。`final-review.json` は画像選択・描画数・ゲーム起動時のエラー、`import-verification.json` は原画設定・画像選択・他職業の設定維持、`asset-verification.json` は透過と四辺の余白の確認記録。

作業ブランチは `codex/ascetic-art`。mainへの反映はPR経由で行う。

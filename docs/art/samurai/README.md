# 侍 R1〜R5 制作メモ

職業名は `侍`、職業IDは `samurai`。`src/souls.js` の `SOUL_CLASSES` と `JOB_RANKS`、`src/jobkit/samurai.js` で確認した。R1称号は `浪人`。

今回の基準は聖戦士 `crusader`。人体・顔・頭身・粒度は `docs/art/crusader/crusader-r1-final.png` を参照し、侍の性別・髪型・配色・武器・衣装は既存R1〜R5から維持する。

## 既存5ランクの特徴

既存の侍は `src/jobart.js` の旧ドット絵が使われている。参照用に `existing-r1.png`〜`existing-r5.png` と `existing-ranks.png` を保存した。

- R1: 茶髪の若い男性寄りの浪人。濃紺の着流し、赤い腰帯、手甲、脚絆、片手の打刀。
- R2: 胴と腕の小具足が増え、赤い紐と金具が少し強まる。
- R3: 鎧の部品と腰まわりが増え、袖と胴の重なりがはっきりする。
- R4: 兜・大袖・金縁の陣羽織が入り、侍大将らしい軍装になる。
- R5: 髪を出したまま鎧と金装飾が最も豪華になり、マント状の布と大きい刀装具が加わる。

## R1修正履歴

以下は確認途中の記録。最終的に `samurai-r1-katana-upturn-revision.png` が承認され、`samurai-r1-final.png` として採用された。

R1初稿は `samurai-r1-draft.png`。聖戦士R1との同倍率の全身・顔比較は `r1-comparison.png`。

刀の修正版は `samurai-r1-katana-revision.png`。柄の軸と巻きを整え、小さな丸鍔、反りのある片刃、刀らしい切先に変更した。修正版の同倍率比較は `r1-katana-comparison.png`。顔・衣装・人体・ポーズは初稿を維持する指示で編集し、確認待ち。

承認前のため、ゲーム用WebP、`src/jobphotos.js`、`src/jobart.js`、`sw.js` はまだ変更していない。

再修正版は `samurai-r1-katana-revision-2.png`。刀身の歪みと刃の上下が逆との指摘を受け、反りを控えた滑らかな輪郭、画面右下側の刃・左上側の峰を指定して再編集した。比較は `r1-katana-comparison-2.png`。引き続きR1の確認待ち。

ユーザー提供の刀の参考画像に基づく最新案は `samurai-r1-katana-reference-revision.png`。参考の向きを180度回転して、画面左上側の明るい刃、右下側の峰、刃文、細身の刀身を反映した。前案の刃の向き指定を訂正。人物の倍率が変わった中間生成は採用せず、元のR1から刀だけの修正を再指定した。最新の比較は `r1-katana-reference-comparison.png`。承認待ち。

刀の形は良いが上下が逆との確認を受け、最新案を `samurai-r1-katana-edge-flipped.png` に更新。柄と下向きの構えを維持し、明るい刃と刃文を画面右下側、峰を左上側に反転する指定で編集した。比較は `r1-katana-edge-flipped-comparison.png`。R1の承認待ち。

切先が変わったとの指摘を受け、切先修正版 `samurai-r1-kissaki-revision.png` を保存。細長い対称の尖りを避け、峰側に先端が寄る短い非対称の切先を指定して局所修正した。明るい刃は画面右下側のまま。比較は `r1-kissaki-comparison.png`。R1の承認待ち。

参考画像の再提示と「剣先は少し上向きに上がり、刃は下側、剣先に向けて少し細くなる」との指定に基づく最新案は `samurai-r1-katana-upturn-revision.png`。強すぎる反りと人物位置が動いた中間生成は採用せず、元のR1だけを編集元に戻して浅い上向きの反りと緩やかな細まりを指定した。比較は `r1-katana-upturn-comparison.png`。R1の承認待ちで、R2以降やゲーム取り込みは未実施。

## 採用・取り込み

ユーザーの「良い感じです。R2～５作成」でR1を確定し、R2〜R5を各1枚ずつ独立生成。全ランクで確定R1と聖戦士R1を直接参照し、対象ランクの旧絵も装備の参考にした。

- R2: 黒い胴鎧、肩・腰の小具足、赤い組紐。
- R3: 重なる鎧と組紐・金具を増やした剣客の装備。
- R4: 兜、大袖、金縁の陣羽織を持つ侍大将。
- R5: 髪を出し、金の花模様・飾り・背中の布を加えた最も豪華な剣神。

採用原画は `samurai-r1-final.png`〜`samurai-r5-final.png`。刀の上向きの浅い反り、下側の刃、先端への細まりをR1から維持する指示で制作した。

測定値は `import-settings.json`。各原画の頭頂・顎・頬・足裏を測り、`tools/jobimg.py` の `build` を使用して取り込み。共通枠は90×92、頭頂9。縮小後の薄い輪郭が下端に触れないよう、頭頂〜足裏は82.6ドット（基準82.9から0.3ドットの余白）で統一した。R4の兜は人体頭頂として数えない。機械的なドット化・減色は行っていない。

ゲーム用画像は `art/jobs/samurai_1.webp`〜`samurai_5.webp`。`src/jobphotos.js` に登録し、優先される旧 `src/jobart.js` の侍だけを除外。`sw.js` に5枚を追加し、CACHEは `dos-dev` のまま。他職業の旧画像定義が不変であることも照合した。

## 検証

`game-display-review.png` は実際の `jobSprite` / `jobBust` / `crispCanvas` による聖戦士との同倍率比較。全身6枚と顔アイコン56/36/26px・拡大顔24枚を確認した。`import-preview.png` は取り込み時の座標確認、`mobile-game-boot.png` は390×844のゲーム起動確認。

新画像のランク選択、顔中心と頭頂、R1に対するランク間の頭座標差0.3ドット未満、透明背景、画像端の余白、濃い不要な独立残片がないこと、ブラウザ例外がないことを検証した。結果は `asset-verification.json`。変更JS3ファイルの `node --check` と `git diff --check` も実行。

共通ツールの `--require-photos` は、聖戦士と頭座標が0.3ドット未満の差であるという厳密な条件だけ未達。承認済み侍R1の頭頂〜顎が聖戦士より約0.8ドット短いため。原画を変えず実測を記録し、写真選択・枠・顔中心・頭頂の一致と、侍R1を基準にした全ランクの一致を別途検証した。共通ツールの検査条件は変更していない。

作業ブランチは `codex/samurai-job-art`。mainへのマージ・pushは未実施。

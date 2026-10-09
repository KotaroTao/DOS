# 隠修士 R1〜R5

## 現在の採用画像：女性巡礼者

2026-10-09、ユーザーの指定で女性巡礼者のデザインへ変更。現行コードに `pilgrim` はなく、対象IDは `hermit`、ゲーム内の表示名は「隠修士」のまま。今回の絵は旧男性隠修士と区別し、茶髪の女性、巡礼帽、青灰のマント、貝殻と鈴、直杖を採用した。

R1の比較をユーザーが承認した後、R1と聖戦士の原画を直接参照してR2〜R5を各1枚ずつ独立制作。顔・人体・ポーズを保ち、装備と装飾を段階的に強化した。

- R1：巡礼帽、短マント、木の直杖、鈴と貝殻。
- R2：杖の金具、二重の金縁、整った革装備。
- R3：貝殻の杖頭、二つの鈴、重ねた肩掛け、貝殻刺繍。
- R4：青い宝石、小型ランタン、長いマント、豊かな刺繍。
- R5：装飾杖と金のランタン、宝石と真珠、帽子の刺繍、豪華な重ね衣装。

採用原画は `hermit-pilgrim-female-r1-final.png`〜`hermit-pilgrim-female-r5-final.png`。測定値は `pilgrim-import-settings.json`、取り込み比較は `pilgrim-import-preview.png`、実描画比較は `pilgrim-game-display-review.png`。帽子内の人体の頭頂は推定値。R1承認用の仮測定は足裏と頭頂の再確認で更新した。原画を機械的にドット化・減色せず、既存 `tools/jobimg.py` で90×92ドット・頭頂9ドットの透明WebPへ取り込んだ。

再取り込み：

```python
import json, subprocess
s = json.load(open('docs/art/hermit/pilgrim-import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', s['job'],
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', ','.join(map(str, s['frame'])), '--frame-top', str(s['frameTop']),
    '--alpha-floor', str(s['alphaFloor']),
    '--preview', 'docs/art/hermit/pilgrim-import-preview.png'], check=True)
```

`art/jobs/hermit_1.webp`〜`hermit_5.webp` と `src/jobphotos.js` を更新。`sw.js` の5画像は登録済みで、CACHEは `dos-dev`。旧 `src/jobart.js` に対象ランクの優先画像はない。`tools/review-job-art.py hermit --label 巡礼者 --require-photos --output docs/art/hermit/pilgrim-game-display-review` で全身6枚・顔24枚、各ランクの画像選択とゲーム起動、ブラウザーエラーなしを確認した。透過検査は `pilgrim-asset-verification.json`。構文と `git diff --check` も確認済み。

作業ブランチは `codex/hermit-female-pilgrim-art`。2026-10-10にユーザーがmainへのマージを指示。

## 旧採用画像の記録

以下は差し替え前の男性隠修士の制作記録。旧原画・旧設定・比較画像は履歴資料として保存する。

職業IDは `hermit`。聖戦士は `crusader`、聖騎士は `paladin`。

確定済み聖戦士の原画を直接参照し、ドット粒度を修正した隠修士R1をユーザー確認後に採用。採用R1を直接参照し、R2〜R5を各ランク1枚ずつ独立生成した。機械的なドット化・減色や集合絵の分割は行っていない。

暗い茶髪の男性、白いフードと行衣、茶の肩掛け、木の杖、白い祈り布、革のバッグを維持。既存5ランクは `existing-ranks.png` に記録した。

- R1: 簡素な木の杖と行衣。
- R2: 杖と腰の赤い結び紐・房飾り、整った革装備。
- R3: 木の数珠、金属の杖頭、厚みのある肩掛け。
- R4: 緑の宝珠、金縁、杖の小さな灯り、お守り。
- R5: 装飾杖、金の刺繍、重ねた数珠とお守り、小さな後光。

採用原画は `hermit-r1-final.png`〜`hermit-r5-final.png`。承認時のドット粒度比較は `r1-grain-comparison.png`、測定と取り込み設定は `import-settings.json`。

フードが頭頂を覆うため、人体の頭頂はフード内の位置を推定する。見えている前髪の上端やフード先端をそのまま頭頂としない。顔・顎・足裏の輪郭を各原画で比較して設定する。

再取り込みはリポジトリのルートで実行する。

```python
import json, subprocess
s = json.load(open('docs/art/hermit/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'hermit',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', ','.join(map(str, s['frame'])), '--frame-top', str(s['frameTop']),
    '--preview', 'docs/art/hermit/import-preview.png'], check=True)
```

実表示比較はローカルサーバー起動後、`python3 tools/review-job-art.py hermit --label 隠修士 --require-photos --output docs/art/hermit/game-display-review` で再確認できる。

## 取り込みと確認結果

`art/jobs/hermit_1.webp`〜`hermit_5.webp` と `src/jobphotos.js` を更新した。隠修士は優先される旧 `src/jobart.js` のランク画像がなく、既存の原画設定から新画像へ切り替わる。`sw.js` は5画像がすでに登録されているため変更不要。CACHEは `dos-dev` を維持。

共通枠は90×92ドット、頭頂9ドット。縮小時の輪郭を収める余白のため、人体の頭頂から足元は82.5ドット（聖戦士の約82.9ドットとの差は0.4ドット）。全ランクの顎は30.707〜30.827ドット、聖戦士は30.93ドットで、差は保存画像換算1px未満。フード内の頭頂は推定値。

`game-display-review.png` は聖戦士R1と隠修士R1〜R5の同倍率全身、56/36/26px顔アイコン、顔拡大。ゲーム描画の全身6枚・顔24枚、正しいランク画像の選択、共通座標、ゲーム起動、ブラウザーエラーなしを確認し、`game-display-review.json` に記録した。実表示の顔位置は全6枚で `[48,21]`。

全5枚は360×368pxの透明WebP。四辺のalphaは0で、杖・衣服・後光の欠けを目視確認。透過検査は `asset-verification.json` に保存。`node --check src/jobphotos.js` と `git diff --check` は成功。

作業ブランチは `codex/hermit-job-art`。mainへのマージはユーザーが承認済み。

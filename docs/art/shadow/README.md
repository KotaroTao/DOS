# 暗殺者 R1〜R5

職業IDは `shadow`。聖戦士 `crusader` の人体・顔・頭身を基準にし、ユーザーが確認した `shadow-r1.png` を直接参照する。

既存5ランクは `existing-review.png` で確認した。茶髪の若い男性寄りの顔、覆面、黒と紫の軽装、革ベルト、短剣を維持する。R1はフードなしの簡素な装備、R2はフードと二刀、R3は軽装甲と重なる布、R4は肩・腕の装甲と長い紫の布、R5は最も精緻な装甲・紫の刃を持つ。顔・人体・ポーズは固定し、装備を段階的に強化する。

R1は `r1-crusader-comparison.png` を提示して承認済み。各ランクは独立した透明背景画像として制作し、集合絵の分割や機械的なドット化・減色を行わない。

## 取り込み

採用原画は `shadow-r1.png`〜`shadow-r5.png`。測定値は `import-settings.json` に保存した。R2以降の頭頂はフードの下、顎は覆面の下の人体位置をR1から推定している。原画ごとの頭頂から足裏の長さで倍率を決め、共通枠90×92ドット・頭頂9ドットへ揃えた。保存画像は360×368pxの透明WebP。

再取り込みはリポジトリのルートで `python3 docs/art/shadow/import-art.py`。既存の `tools/jobimg.py` を使用し、`art/jobs/shadow_1.webp`〜`shadow_5.webp` と `src/jobphotos.js` を更新する。優先される旧 `src/jobart.js` の暗殺者だけを外し、`sw.js` の画像一覧へ5枚を追加した。CACHEは `dos-dev` を維持。

## 確認

`final-review.png` は聖戦士R1と暗殺者R1〜R5の同倍率全身、56/36/26pxの顔アイコン、顔拡大。ゲームの `jobSprite` / `jobBust` を使用し、全6枚の全身・24枚の顔表示、該当ランクの画像選択、ゲーム起動、ブラウザーエラーなしを確認した。実表示の顔中心は全6枚で `[48,21]`、頭頂は10ドット、顎位置の基準との差は0.14ドット以内。共通表示枠96×94ドットは変わっていない。

ローカルサーバー起動後に `python3 tools/review-job-art.py shadow --label 暗殺者 --require-photos --url http://127.0.0.1:8001/ --output docs/art/shadow/final-review` で再確認できる。透過、四辺の余白、不透明な残片なしは `python3 docs/art/shadow/verify-assets.py` で検査し、`asset-verification.json` へ記録する。武器・フード・外套の欠けも目視確認済み。全 `src/*.js` と `sw.js` の構文、および `git diff --check` を確認した。

作業ブランチは `codex/shadow-art`。制作の下準備と最新mainを作業ブランチへ取り込み済み。mainへのマージは未実施。

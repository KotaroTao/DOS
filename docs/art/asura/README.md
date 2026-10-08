# 修羅 R1〜R5

職業IDは `asura`。武芸者・修羅・羅刹・阿修羅・阿修羅王の5段階。
下準備ブランチと最新mainを専用ブランチ `codex/asura-art` に取り込んだ。

既存の赤黒の配色、逆立つ髪、二刀と開いた足の構え、上位で増える金色の装飾を維持。
R1案はユーザーが2026-10-08に承認。採用した赤髪・赤い目・角飾りの女性を全ランクで維持した。
聖戦士（`crusader`）の原画を直接参照し、R2〜R5を各1枚ずつ独立生成。
R2は重なる肩の鎧と金縁、R3は鬼面の肩・膝当てと宝石、R4は三段の肩飾りと彫金、
R5は角の冠・炎形の金の肩飾り・宝石・腰布の刺繍と二刀の装飾を強化した。
R5は初案の頭が小さく見えたため頭部の比率を修正し、初案も保存。

採用原画は `asura-r1-final.png`〜`asura-r5-final.png`。
測定値は `import-settings.json`。共通枠90×92ドット、人体の頭頂9ドットを維持。
逆立つ髪は先と根元の間を主な頭頂とし、後ろの髪束と角の先は測定から除外した。
再取り込みはリポジトリのルートで `python3 docs/art/asura/import-art.py`。
既存の `tools/jobimg.py` を使用し、機械的なドット化・減色はしていない。

ゲーム画像は `art/jobs/asura_1.webp`〜`asura_5.webp`。
`src/jobphotos.js` の顔設定と `sw.js` の画像一覧を更新。CACHEは `dos-dev`。
`src/jobart.js` に修羅の優先画像はなく、旧仮絵より新原画が選ばれるため旧定義の削除は不要。

`final-review.png` は聖戦士と同倍率の全身・56/36/26pxの顔・顔拡大。
`final-review.json` に実描画の座標・選択画像・ゲーム起動時のブラウザーエラーを記録。
`asset-verification.json` に透過・余白・残片の確認を保存。
確認はローカルサーバー起動後 `python3 tools/review-job-art.py asura --label 修羅 --require-photos --output docs/art/asura/final-review`。
画像検査は `python3 docs/art/asura/verify-assets.py`。

mainへの反映はユーザーの指示に基づきPR経由で行う。

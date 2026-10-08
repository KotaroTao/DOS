# 魔騎士 R1〜R5

職業IDは `darkknight`。聖戦士 `crusader` を基準にし、ユーザーが承認した `darkknight-r1-review.png` をR1の採用原画とした。R2〜R5はそのR1を直接参照し、各ランク1枚ずつ独立生成した。

黒鉄の全身鎧、顔を覆う兜、紫の魔晶と刻印の魔剣、紫の布とマントを維持。既存絵の成長差は `existing-review.png` に記録した。R2は重ねた肩鎧と魔晶、R3は浮遊魔晶と刺しゅう、R4は肩の突起と魔剣の炎、R5は3つの浮遊魔晶・魔力の輪・装飾鎧を追加。R3のマント右端、R5の魔力の輪の上端を部分修正した。修正前の案も保存している。

採用原画は `darkknight-r1-final.png`〜`darkknight-r5-final.png`。生成原画のドット化・減色はしていない。原画の角・魔力の輪を除いた兜本体の頭頂、面当ての左右と顎、足裏を測定し、既存 `tools/jobimg.py` で共通枠90×92ドット、頭頂9ドットへ取り込んだ。測定値は `import-settings.json`、再取り込みは `python3 docs/art/darkknight/import-art.py`。

承認済みの兜の輪郭を維持したため、兜本体の顎は約28.6〜28.9ドットで、聖戦士の肌の顎（30.93ドット）とは異なる。顔アイコンは各原画の兜の実測で倍率を揃えた。全身の頭頂と足元を共通枠へ揃え、装飾の大きさで人物の倍率を変えていない。

`src/jobphotos.js` に5ランクを登録し、優先される旧 `src/jobart.js` の魔騎士だけを外した。透明WebPは `art/jobs/darkknight_1.webp`〜`darkknight_5.webp`。`sw.js` のASSETSに追加し、CACHEは `dos-dev` のまま。

`final-review.png` は実際の `jobSprite` / `jobBust` による聖戦士R1と魔騎士5ランクの同倍率全身、56/36/26pxの顔アイコンと拡大。`final-review.json` は30描画とゲーム起動の結果。兜と肌の顎の座標が異なるため、基準との数値完全一致を要求する `--require-photos` は使用せず、`verify-assets.py` で全5ランクの新画像選択、共通枠、透過、端での欠けを別途検査した。

再確認はHTTPサーバー起動後、以下を実行する。

```bash
python3 tools/review-job-art.py darkknight --label 魔騎士 --output docs/art/darkknight/final-review
python3 docs/art/darkknight/verify-assets.py
```

作業ブランチは `codex/darkknight-art`。mainへのマージは未実施。

# 狂戦士 R1〜R5

狂戦士は `berserker`。濃い茶色の逆立った髪の男性。聖戦士は赤髪の女性の `crusader` で、人体・顔・描かれたドット粒度の直接の基準として参照した。職業名・IDは変更していない。

ユーザーが確認したR1を確定し、R2〜R5はそのR1と聖戦士の原画、対象ランクの既存絵を直接参照して各1枚ずつ独立生成した。集合絵の分割はしていない。採用原画は `berserker-r1-final.png`〜`berserker-r5-final.png`。R2・R4は脚と布の先を部分修正した案を採用し、質感が変わった修正案は採用していない。

## 固有の特徴と装備の成長

鋭い茶色の目、頬の赤い傷、肌の出た筋肉質の腕と腹、暗い革の交差胸帯、銀灰色の肩鎧・腕当て、赤い上腕布と腰布、白い毛皮、茶色の革ブーツ、大斧を維持。盾や兜は持たない。顔・髪・体格・立ちポーズはR1を直接の参照としている。

- R1 荒武者：簡素な肩鎧、革の胸帯と腕当て、赤い布、鉄の大斧。
- R2 狂戦士：肩鎧を多層にし、腕と脚に鉄板を追加。斧の刃を拡大。
- R3 血戦鬼：肩と斧に短い鉄の突起を追加。膝とすねの防具を強化。
- R4 大戦鬼：厚い多層の肩鎧、腕当て、脚の防具。斧の刃と補強金具を強化。
- R5 鬼神：最も重厚な鎧と角状の突起。赤銅色の縁・彫刻・腰の金具を加え、肩鎧を最も豪華にした。

既存の絵は `existing-r1.png`〜`existing-r5.png`、実描画比較は `existing-review.png`。R1承認時の比較は `r1-comparison.png`、原画は `berserker-r1-review-candidate.png`。途中の案も保存している。

## ゲームへの取り込み

透明WebPは `art/jobs/berserker_1.webp`〜`berserker_5.webp`。既存の `tools/jobimg.py` で取り込み、`src/jobphotos.js` の顔・頭の設定と `sw.js` の画像一覧を更新。優先される旧 `src/jobart.js` の狂戦士だけを外した。CACHEは `dos-dev` のまま。

原画の測定値は `import-settings.json`。逆立った髪は先端と付け根の中間を主な頭頂として測り、角や髪の先端を頭頂として代用していない。各画像の頬・顎・頭頂・足裏から個別に測定し、聖戦士の原画座標を流用していない。共通枠90×92ドット、人体の頭頂9ドットを維持。頭頂から足裏は82.2ドットへ揃え、靴の下端に透明余白を確保した。原画のドット化・減色はしていない。

再取り込み（リポジトリのルートで実行）:

```python
import json, subprocess
s = json.load(open('docs/art/berserker/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'berserker',
 *[x['source'] for x in s['sources']],
 '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
 '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
 '--frame', '90,92', '--frame-top', '9', '--alpha-floor', str(s['alphaFloor']),
 '--preview', 'docs/art/berserker/import-preview.png'], check=True)
```

## 確認

`final-review.png` は実際の `jobSprite` / `jobBust` / `crispCanvas` による聖戦士とR1〜R5の同倍率全身、56/36/26pxの顔、顔の拡大。ブラウザーで30枚のCanvas描画とゲーム起動を確認し、結果を `final-review.json` に保存した。全ランクの顔の位置は基準と同じで、頭の位置・高さの差は0.3ドット未満。

`asset-verification.json` に360×368pxの全5枚の透過と四辺の透明余白を記録。武器・赤い布・髪と装備の先の欠け、背景の残り、不要な残片、装備の成長と顔・人体・描かれたドット粒度は比較画像で目視確認した。編集したJSとサービスワーカーの構文も確認した。

再確認はローカルサーバー起動後に `python3 tools/review-job-art.py berserker --label 狂戦士 --require-photos --output docs/art/berserker/final-review`。作業ブランチは `codex/berserker-art`。ユーザーからmainへのマージ指示を受領済み。

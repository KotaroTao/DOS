# 死霊術師 R1〜R5

職業IDは `src/souls.js` の `necromancer`（死霊術師）。聖戦士は `crusader`。
`origin/codex/job-art-preparation` を取り込んだ専用ブランチ `codex/necromancer-art` で制作した。

R1を聖戦士R1と同倍率で比較し、ユーザー承認後にR2〜R5を各1枚ずつ独立生成した。
灰紫の髪・緑の目・黒紫のローブ・骨飾り・曲刃・青緑の霊火を維持した。
既存絵の成長に沿って、R2は骨飾りと銀鎖、R3は大きな頭骨の肩飾りと宝石・幾何学文様、
R4は広いマントと複数の霊火、R5は骨の冠・豪華な骨装飾・大型の杖と浮遊霊魂を追加した。

承認時の原画と比較は `necromancer-r1-approved.png`、`r1-crusader-comparison.png`。
最終案では顔立ちを保ちながら頭部の比率を微調整し、基準の頭身に近づけた。
上位ランクの初稿にあった人物の縮小も修正した。採用原画は `necromancer-r1-final.png`〜`necromancer-r5-final.png`。

## 取り込み

既存の `tools/jobimg.py` で透明WebPを生成し、`src/jobphotos.js` の死霊術師だけを更新。
共通枠90×92ドット、人体の頭頂9ドット。原画ごとの測定値は `import-settings.json`。
主な髪の頭頂と顎・頬・足裏を測定し、背景余白や冠・杖の先で人物の倍率を決めていない。
R5の頭頂は冠の下に隠れた髪の塊から推定。R3は縮小時の補間による不可視の端画素を避けるため倍率を微調整した。
機械的なドット化・減色は行っていない。

`sw.js` には既存の5画像がすべて登録済みで、`CACHE = "dos-dev"` を維持。
`src/jobart.js` に死霊術師の優先画像はないため、削除は不要。

再取り込み（リポジトリのルートで実行）:

```python
import json, subprocess
s = json.load(open('docs/art/necromancer/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'necromancer',
 *[x['source'] for x in s['sources']],
 '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
 '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
 '--frame', '90,92', '--frame-top', '9',
 '--preview', 'docs/art/necromancer/import-preview.png'], check=True)
```

## 検証

`final-review.png` は実際の `jobSprite` / `jobBust` による同倍率の全身と56/36/26pxの顔、顔拡大。
`final-review.json` に画像の選択・顔座標・全30枚のCanvas描画・ブラウザーエラーなしを記録。
ゲーム共通の表示枠96×94ドットは変更されず、他職業の表示倍率に影響しない。
全6枚の顔は `[48,21]`、人体の頭頂10ドット、顎は基準との差0.3ドット未満。
武器・マント・髪・冠・杖の欠けと装備の成長を目視確認した。
`asset-verification.json` に透過・画像端・出荷画像登録の検査、`startup-verification.json` にデスクトップとモバイルの起動確認を保存。
変更したJavaScriptとService Workerの構文、差分の空白を検査した。

```bash
python3 -m http.server 8000 --bind 127.0.0.1
python3 tools/review-job-art.py necromancer --label 死霊術師 --require-photos --output docs/art/necromancer/final-review
```

mainへのマージは行っていない。

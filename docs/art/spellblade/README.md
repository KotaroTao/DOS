# 魔法剣士 R1〜R5

職業IDは `spellblade`。`src/souls.js` と `src/jobkit/spellblade.js` で確認した。
`origin/codex/job-art-preparation` を取り込み、聖戦士（`crusader`）を参照して制作。
R1は `r1-comparison.png` を提示し、ユーザーの「良い感じです。R2～５作成」で採用した。

## 採用原画と装備の成長

`spellblade-r1-final.png`〜`spellblade-r5-final.png` が採用原画。
R2〜R5は承認済みR1、聖戦士R1、対応する聖戦士ランクの原画を直接参照して各1枚ずつ独立生成した。
集合絵の分割・機械的なドット化・減色はしていない。

旧画像は `existing-review.png` に保存。若い男性、茶色の乱れた短髪、青緑の布、黒白の服、茶革、銀鎧、右手の剣と左手の青紫の魔法を維持。
旧R1は軽装、R2は小さな胸当てと宝石、R3は鎧と長い布、R4は彫金と魔力、R5は肩鎧・マント・魔力が最も豪華だった。

- R1：承認済みの軽装・小さな銀鎧・青緑の肩掛け。
- R2：銀の胸当て、重ねた肩当て、小さな紫の宝石。
- R3：厚い銀鎧、肩と腰の宝石、長いマントと魔法紋。
- R4：金の彫金、白い裏地、宝石入りの腕当て、装飾した剣。
- R5：翼形の金の肩飾り、宝石と鎖、髪飾り、最も豪華なマントと魔法剣。

## 取り込み

原画ごとの頬・主な髪の頭頂・顎・足裏と倍率は `import-settings.json`。
髪のとがった先を頭頂として流用せず、各原画の主な髪の塊を測った。
共通枠90×92ドット、頭頂9ドット、保存360×368px。頭頂〜足裏は82.5ドットに統一。
承認済みR1の主な髪の頭頂〜顎は約20.55ドットで、聖戦士R1の21.93ドットより約1.38ドット短い。
承認済みの顔を維持し、設定値を聖戦士に見せかけず実測値を保存した。
R2〜R5の頭頂〜顎は20.33〜20.63ドットで、全5ランクの差は0.3ドット以内。
全身は同じ人体倍率で、顔アイコンはゲームの `jobBust` が実測した頭の高さを基準にそろえる。

再取り込み（リポジトリのルート）:

```python
import json, subprocess
s = json.load(open('docs/art/spellblade/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', s['job'],
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/spellblade/import-preview.png'], check=True)
```

`src/jobphotos.js` に5ランクを登録し、優先される旧 `src/jobart.js` の魔法剣士だけを除いた。
`sw.js` にWebP5枚を登録。CACHEは `dos-dev` のまま。

## 確認

`final-review.png` は聖戦士とR1〜R5を同倍率で並べた全身、56/36/26pxの顔アイコンと顔拡大。
剣・マント・髪飾りに欠けや背景の残りがないこと、ランクごとの成長を目視確認した。
`final-review.json` に30枚のCanvas描画とゲーム起動の検査結果を保存。
`asset-verification.json` は全身と顔の原画選択、透過、枠内収容、PC・モバイルの起動確認。

再確認はHTTPサーバー起動後 `python3 docs/art/spellblade/verify-art.py`。
聖戦士との顎の完全一致は承認済みR1に存在しないため、共通スクリプトの `--require-photos` の完全一致検査は使わず、専用スクリプトで原画選択とランク間の一致を検査する。
作業ブランチは `codex/spellblade-art`。mainへのマージはしていない。

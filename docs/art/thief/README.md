# 盗賊 R1〜R5

職業IDは `thief`。聖戦士 `crusader` の原画を共通基準とし、ユーザー承認済みR1の顔・人体・ポーズを直接参照して、R2〜R5を各1枚ずつ独立制作した。採用原画は `thief-r1-final.png`〜`thief-r5-final.png`。茶髪で片目が隠れる顔、緑の頭巾と口布、茶革の軽装、短剣を維持している。

## 装備の成長

- R1: 基本の革具、緑の布、短剣。
- R2: 二重ベルト、小物袋、革具の留め金。
- R3: 重ねた肩・腕の革具、頭巾の帯、金縁、短剣の装飾。
- R4: 革具の彫り模様、三重ベルト、長い布と金縁。
- R5: 最も豪華な彫り模様と刺繍、緑の宝石、装飾された道具・短剣・靴。

既存5ランクは `existing-review.png`、R1承認時の比較は `thief-r1-comparison.png`。不採用案は `*-draft.png` に保存。頭巾の先を人体の頭頂として測らず、口布に隠れた顎は承認済みR1の人体から推定した。測定の比較は `head-measurement.png`、原画座標と倍率は `import-settings.json`。

## 取り込み

`tools/jobimg.py` で原画をドット化・減色せず取り込んだ。共通枠は90×92ドット、人体の頭頂は9ドット。足裏の半透明な縁まで余白を残すため、全ランクの人体頭頂〜足裏を82.25ドットに揃えた。

出荷画像は `art/jobs/thief_1.webp`〜`thief_5.webp`。`src/jobphotos.js` に全5枚の顔・頭設定を追加し、優先される旧 `src/jobart.js` の盗賊のみを外した。`sw.js` の画像一覧を追加し、CACHEは `dos-dev` のまま。他職業と職業IDは変更していない。

再取り込み（リポジトリのルートで実行）:

```python
import json, subprocess
s = json.load(open('docs/art/thief/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'thief',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', ','.join(map(str, s['frame'])),
    '--frame-top', str(s['frameTop']),
    '--preview', 'docs/art/thief/import-preview.png'], check=True)
```

## 顔アイコンの補正 (2026-10)

取り込み時の頭の測定 (頭頂9・あご先30.7) は実際の顔より約4ドット下を指しており、顔アイコンで頭巾が切れて顔が上にずれていた。ゲーム画像のドット座標で目視で測り直し、`src/jobphotos.js` の `head` を全ランク `[46.0, 4.5, 26.3]` (頬の中心46・頭巾の下の髪の上端4.5・口布に隠れたあご先26.3、目の高さ約20) に直した。全身像の配置 (`face`) は変えていない。再取り込みした場合はこの値に戻すこと。

## 確認

`final-review.png` は実際の `jobSprite` / `jobBust` / `crispCanvas` による聖戦士R1と盗賊R1〜R5の同倍率全身、56/36/26pxの顔アイコンと拡大。全身6枚・顔24枚の画像選択と描画、共通座標、ゲーム起動の結果は `final-review.json`。

```bash
python3 -m http.server 8001 --bind 127.0.0.1
python3 tools/review-job-art.py thief --label 盗賊 --require-photos --url http://127.0.0.1:8001/ --output docs/art/thief/final-review
```

`asset-verification.json` に全5枚の透過・四辺の余白・不透明な残片なしを記録。武器・布の先端と粒度・人体の配置も目視確認した。`game-startup-verification.json` と `game-desktop.png` / `game-mobile.png` は通常のゲーム起動確認。この環境ではGoogle Fontsの取得が失敗したが、代替フォントで表示され、ゲーム本体の読み込み失敗とJavaScriptエラーはない。変更したJavaScriptの構文と `git diff --check`、盗賊以外の画像定義が変更前と一致することも確認済み。

作業ブランチは `codex/thief-job-art`。mainへのマージは別途指示を待つ。

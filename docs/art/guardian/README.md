# 守護騎士 R1〜R5

職業IDは `guardian`。`origin/codex/job-art-preparation` を取り込んだ `codex/guardian-knight-art` で制作した。聖戦士 (`crusader`) R1を共通基準とし、ユーザー承認済みの守護騎士R1を直接参照してR2〜R5を各1枚ずつ独立生成した。

## 特徴と成長

既存5ランクは `existing-review.png` に保存。茶髪の男性、鉄の兜、銀の重装鎧、青い布、右側の塔盾と左側の鉄槌を維持する。既存の成長は鎧・盾の厚みから城塞風の装備へ進む。

- R1（城門衛士）：承認された原画。基本の銀鎧と青い塔盾。
- R2（守護騎士）：盾の縁と中央の金具、重ねた肩鎧、鉄槌の補強。
- R3（城塞騎士）：城壁形の盾上部、厚い重装鎧、短い青いマント。
- R4（大城塞騎士）：金縁、青い宝石、裏地と縁飾りのあるマント。
- R5（不落の城壁）：城壁形の肩・兜飾り、宝石、金の彫金とマントの刺繍を最も豪華にする。

採用原画は `guardian-r1-final.png`〜`guardian-r5-final.png`。R1は承認済みの `guardian-r1-draft.png` と同一。R2・R3・R5は盾や鉄槌の端を収める配置修正を行い、修正前も `*-before-edge-fix.png` に保存した。集合絵の分割、機械的なドット化・減色は行っていない。

## 取り込み

`import-settings.json` に各原画の頬・頭頂・顎・足元と倍率を記録。兜で隠れた人体の頭頂はR1の輪郭から推定し、R5の追加飾りは除外した。頭頂から足元は82.9ドットに揃える。共通透明枠は90×92ドット、頭頂9ドット。聖戦士の原画座標は流用していない。

既存の `tools/jobimg.py` で `art/jobs/guardian_1.webp`〜`guardian_5.webp` と `src/jobphotos.js` を更新。旧 `src/jobart.js` の守護騎士だけを外し、`sw.js` に5枚を追加した。CACHEは `dos-dev` のまま。

再取り込み（リポジトリのルートから）:

```python
import json, subprocess
s = json.load(open('docs/art/guardian/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'guardian',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/guardian/import-preview.png'], check=True)
```

## 確認

`final-review.png` は `jobSprite` / `jobBust` による聖戦士との同倍率全身比較、56/36/26pxの顔、顔拡大。`final-review.json` に全身6枚・顔24枚の描画、全ランクの新画像選択、ゲーム起動とブラウザーエラーなしを記録した。ゲーム表示の共通枠は96×94ドット、顔位置は `[48,21]`。顎位置の基準との差は0.135ドット以内。

ローカルサーバー起動後の再確認:

```bash
python3 tools/review-job-art.py guardian --label 守護騎士 --require-photos --output docs/art/guardian/final-review
```

全身・盾・鉄槌・マントと顔の粒度は比較画像で目視確認。`asset-verification.json` に透過、端の不透明画素、残片の検査結果を保存。縮小の補間による弱いアルファは足元の最下行にもあるが、不透明な輪郭は画像端に接していない。JavaScript全ファイルと `sw.js` の構文、差分の空白も確認した。他職業の画像設定は変更していない。mainへのマージは未実施。

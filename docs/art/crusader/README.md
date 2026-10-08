# 聖戦士 R1〜R5

聖戦士は `crusader`（赤髪の女性）。金髪の男性の聖騎士は `paladin`。職業名とIDは変更していない。

死霊術師を基準に制作し、ユーザーが確認したR1を参照してR2〜R5を各ランク1枚ずつ独立生成した。集合絵の分割はしていない。採用原画は `crusader-r1-final.png`〜`crusader-r5-final.png`。既存の絵は `existing-r1.png`〜`existing-r5.png`、修正前の案も保存している。

赤いポニーテール、赤い目、白地に赤い十字の衣装、銀と金の鎧、赤いマント、剣を維持。R2は金縁、R3は鎧とマントの十字模様、R4は宝石・彫金・白い裏地、R5は金の翼形の肩飾り・赤い宝石・髪飾り・白金のリボンを強化した。R5の肩を最も豪華にした。マントの位置とリボン先端を修正し、装飾のために人物を縮小していない。

## ゲームへの取り込み

透明WebPは `art/jobs/crusader_1.webp`〜`crusader_5.webp`。既存の `tools/jobimg.py` で取り込み、`src/jobphotos.js` の顔・頭の設定、`sw.js` の画像一覧を更新。優先される旧 `src/jobart.js` の聖戦士だけを外した。

原画の測定値は `import-settings.json`。共通枠は90×92ドット（360×368px）、人体の頭頂は9ドット。頭頂より上のポニーテールとR5の髪飾りを残すため、取り込みに任意の `--frame-top` を追加した。指定しない場合の取り込み動作は従来どおり。原画を機械的にドット化し直していない。

再取り込み（リポジトリのルートで実行）:

```python
import json, subprocess
s=json.load(open('docs/art/crusader/import-settings.json'))
subprocess.run(['python3','tools/jobimg.py','crusader',*[x['source'] for x in s['sources']],
 '--per-dot',','.join(str(x['perDot']) for x in s['sources']),
 '--head',*[','.join(map(str,x['head'])) for x in s['sources']],
 '--frame',','.join(map(str,s['frame'])), '--frame-top',str(s['frameTop']),
 '--preview','docs/art/crusader/import-preview.png'],check=True)
```

## 確認

`game-display-review.png` はゲームと同じ描画関数による死霊術師とR1〜R5の同倍率全身、56/36/26pxの顔アイコンと顔拡大。再確認はローカルサーバー起動後 `python3 docs/art/crusader/review-game.py`。

ゲーム内の顔位置は全6枚で `[48,21]`、人体の頭頂は10ドット。聖戦士の顎位置は31.893〜31.94ドット、死霊術師は32.125ドットで、差は保存画像換算1px未満。頭頂から足元は約83ドットに統一し、頭身と粒度は同倍率画像で目視確認した。共通表示枠は96×94ドットで、従来同様に最大辺96を維持するため他職業の表示倍率は変わらない。

`game-verification.json` に全身6枚・顔24枚の描画と共通座標・ブラウザーエラーなしを記録。`asset-verification.json` に全5枚の透過、画像端での欠けなし、不透明な残片なしを記録。剣・マント・髪飾りも目視確認済み。

R1承認時の比較は `r1-comparison.png` と `r1-review-settings.json` に保存。作業ブランチは `codex/crusader-art`。mainへのマージは未実施。

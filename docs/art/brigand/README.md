# 義賊 R1〜R5 の原画と取り込み

各ランクを最初から1枚ずつ独立生成。確定した `brigand-r1-chin-corrected.png` をR2〜R5の参照に使用し、マント端の欠けを修正した最終原画を `brigand-r1-final.png` 〜 `brigand-r5-final.png` に保存した。初期案・修正案は比較の記録として残している。

既存の緑のフードとマント、赤い口元の布と裏地、茶系の革装備、短剣と金袋を維持。ランクが上がるほど金の縁取り、刺繍、革装備、短剣、金具と金袋を強化する。

基準はゲーム内の死霊術師R1。ユーザーの白線による顎先は元画像換算で約88.5px（22.125ドット）。死霊術師R1の `head` の顎先設定もこの値へ修正した。義賊は頭頂と顎先が衣装で隠れるため、ユーザー確認済みR1の頭身を共通の切り出し基準とした。

ゲーム用は透明WebP `art/jobs/brigand_1.webp` 〜 `brigand_5.webp`。全ランク360×336px、共通枠90×84ドット、`face: [45,12]`、`head: [45,1,23.125]`。人物の背丈は83ドットで固定し、装飾が増えても縮めない。全身の顔位置と頭頂・顎先は共通枠への配置後に死霊術師R1と一致する。メタデータの一致は生成原画の全輪郭が画素単位で同一であることを意味しない。

取り込みは `tools/jobimg.py`。透明PNGの透過を保ち、`--frame 90,84` で顔の列と足元を整列する。原画ごとの取り込み倍率・頭の指定は `import-settings.json` に記録。再取り込みは次をリポジトリのルートで実行する。

```bash
python3 - <<'PY'
import json, subprocess
s = json.load(open('docs/art/brigand/import-settings.json'))
rows = s['sources']
subprocess.run(['python3', 'tools/jobimg.py', 'brigand',
    *[r['source'] for r in rows], '--per-dot',
    ','.join(str(r['perDot']) for r in rows), '--head',
    *[','.join(map(str, r['head'])) for r in rows],
    '--frame', ','.join(map(str, s['frame'])),
    '--preview', 'docs/art/brigand/import-preview.png'], check=True)
PY
```

`game-display-review.png` はゲームの `jobSprite`、`jobBust`、`crispCanvas` をChromiumで描画した確認画像。死霊術師R1と義賊5枚の全身を同倍率で並べ、顔を56/36/26pxと拡大表示で確認した。原画の外周に不透明な切断箇所がなく、ゲーム用画像は各ランク1つの連結した人物像で、背景の残り・不要な残片がないことを確認。

JS193ファイルの構文、5ランクの画像選択・座標、PNG透過保持、共通枠の整列と枠外切断の拒否、Chromiumで30個のcanvasの描画とゲーム起動を確認。mainへのマージと公開は行っていない。

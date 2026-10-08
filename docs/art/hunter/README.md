# 狩人 R1〜R5

職業IDは `hunter`。基準の聖戦士は `crusader`、聖騎士は `paladin`。
`origin/codex/job-art-preparation` を取り込み、`codex/hunter-art` で制作した。

## 既存の特徴と装備の成長

`existing-review.png` に差し替え前の5ランクを保存。茶髪の若い男性、緑のフードとマント、茶色の革装備、弓と矢筒、骨・毛皮・羽根の装飾を維持した。

- R1：見習い狩人。革装備と緑の襟巻き、短弓。
- R2：狩人。フードと革の肩当て、留め具を強化。
- R3：獣狩り。毛皮と羽根の肩飾り、骨の留め具、矢筒と弓を強化。
- R4：首狩り。頭骨の戦利品、骨と毛皮の腕・脚装備、骨付きの弓。
- R5：狩猟王。角付きの頭骨、厚い毛皮と羽根の肩飾り、彫刻した骨の防具、最も豪華な弓と矢筒。

## 採用原画と測定

`hunter-r1-draft.png` と `r1-comparison.png` を提示し、ユーザーの承認後にR2〜R5を各1枚ずつ独立生成した。原画は `hunter-r1-final.png`〜`hunter-r5-final.png`。承認済みR1、聖戦士R1、各ランクの聖戦士原画、既存狩人の比較を生成時に直接参照した。

`import-settings.json` に各原画の測定値を保存。90×92ドットの共通枠、人体の頭頂9ドット、頭頂から靴底の薄い透過縁まで約82.7ドット。主な髪の頭頂を測り、フードや骨飾りの先を人体の頭頂として扱っていない。フードに隠れた頭頂は承認済みR1から推定した。

承認済みR1の人体を保持したため、頭の高さは21.142〜21.329ドットで聖戦士R1の21.93ドットより0.601〜0.788ドット小さい。顔位置・頭頂位置・全身枠は一致する。厳密な0.3ドット一致を要求する `review-job-art.py --require-photos` の座標条件には合致しないため、通常の比較に加え、全5ランクの全身と胸像が正しいWebPを選ぶことを別途Chromiumで検証した。設定値を偽って揃えず、実際の輪郭を `final-review.png` で比較した。

## 取り込みと確認

既存の `tools/jobimg.py` で透過WebPへ取り込み、機械的なドット化・減色はしていない。`src/jobphotos.js` と `sw.js` の画像一覧を更新し、優先される旧 `src/jobart.js` の狩人だけを外した。CACHEは `dos-dev` を維持。

再取り込み:

```python
import json, subprocess
s = json.load(open('docs/art/hunter/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'hunter',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', '90,92', '--frame-top', '9',
    '--preview', 'docs/art/hunter/import-preview.png'], check=True)
```

ローカルサーバー起動後の比較:

```bash
python3 tools/review-job-art.py hunter --label 狩人 --output docs/art/hunter/final-review
```

`final-review.png/json` は実際の `jobSprite` / `jobBust` による全身6枚、56/36/26pxと拡大の顔24枚。PC（1440×900）・スマートフォン（390×844）でゲーム起動、全ランクの画像読込、全身と顔の画像選択、ブラウザーエラーなしを確認。起動画面は `game-desktop.png` と `game-mobile.png`。

全5枚の透過と武器・マント・頭飾りの欠けを確認。R2の画像端には縮小補間によるアルファ1の不可視な画素があるが、可視部分は枠内。全3変更JSの構文と `git diff --check` を確認。mainへのマージは未実施。

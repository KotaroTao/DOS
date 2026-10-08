# 神殿騎士 R1〜R5

職業IDは `templar`。基準は聖戦士 `crusader`（聖騎士 `paladin` ではない）。
`origin/codex/job-art-preparation` の制作条件を取り込み、ユーザーが確認した `templar-r1-draft3.png` をR1の採用原画にした。

## 固有の特徴と成長

既存の金髪の女性、青い目、白い頭布、白・銀・金と青の配色、槍と盾を維持する。
R1は神殿衛士の装備。R2は重ねた肩鎧と強化盾、R3は白い聖なるマントと盾の金細工、R4は騎士長の青い宝石と装飾、R5は小さな冠・翼形の肩飾り・大型の盾・鎖飾りを加える。
全ランクを独立生成し、承認済みR1と聖戦士の原画を直接参照した。R4・R5の槍上部は、人物を縮めず共通枠へ収めるため短く修正した。

## 原画と取り込み

採用原画は `templar-r1-final.png`〜`templar-r5-final.png`。
`import-settings.json` に原画ごとの顔の左右、主な髪の頭頂、顎、足裏、1ドットの倍率を記録した。透明画像のほぼ不可視な外周は既存ツールが除去する。
頭布・冠の先は人体の頭頂に含めない。承認済み神殿騎士R1の頭身を維持し、聖戦士と数値が一致するように測定座標を変更してはいない。

```bash
python3 tools/jobimg.py templar \
  docs/art/templar/templar-r1-final.png \
  docs/art/templar/templar-r2-final.png \
  docs/art/templar/templar-r3-final.png \
  docs/art/templar/templar-r4-final.png \
  docs/art/templar/templar-r5-final.png \
  --per-dot 13.75,14.25,13.85,13.90,13.90 \
  --head 470,631,214,495 475,641,185,467 470,632,212,490 \
    469,633,213,493 470,632,239,505 \
  --frame 90,92 --frame-top 9 \
  --preview docs/art/templar/import-preview.png
```

## 確認

`game-display-review.png` は実際の `jobSprite` / `jobBust` による聖戦士R1と神殿騎士R1〜R5の同倍率比較。全身6枚、顔56/36/26pxと拡大表示24枚を確認した。
`game-display-review.json` は選択したWebPと顔設定・ブラウザーエラーの記録。全5ランクのWebP選択、非空描画、透過、共通枠と頭頂、ゲーム起動、変更したJSの構文を検証した。
`--require-photos` は聖戦士と顎座標まで0.3ドット以内の一致を要求するため、この比較には使用していない。承認済みR1の実測では頭の高さが聖戦士と異なるため、画像選択は記録から別途検証した。
mainへのマージ・公開は行っていない。

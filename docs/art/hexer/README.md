# 呪術師のランク別イラスト

職業IDは `hexer`。聖戦士 (`crusader`) を人体・顔・粒度の基準とする。
ユーザー確認で帽子を除いた顔のサイズを拡大したR1修正版を採用した。
確定R1は `hexer-r1-final.png`、承認時の比較は `r1-comparison-v2.png`。
旧案と修正版の原画も制作履歴として残す。

## 既存画像の特徴と成長

全ランク共通: 茶髪の若い中性的な人物、茶色の角つき頭巾、暗いローブ、
骨飾り、緑の毒瓶、緑の石を持つ木の杖。顔と人体のサイズ・位置は固定する。

- R1 呪い屋: 木の杖、基本の頭巾とローブ、胸の骨飾り、毒瓶。
- R2 呪術師: 頭巾の骨飾り、杖の巻き飾り、腰と裾の札を増やす。
- R3 毒呪師: 大きな肩の頭骨、骨の腰飾り、長い札、重ねたローブ。
- R4 大呪術師: 分かれた角、金の留め具と鎖、肩の骨、強化した杖。
- R5 禍津神: 緑の宝石つき骨冠、枝角、頭骨の肩飾り、豪華な杖、
  複数の毒瓶と札、体に沿った緑の毒霧。背景の魔法陣は付けない。

各ランクを独立した透明PNGとして生成し、R1を直接参照する。
R2以降も帽子・角を頭頂の測定に含めず、顔を小さくしない。
mainへのマージは別途指示を待つ。

## 採用と取り込み

採用原画は `hexer-r1-final.png`〜`hexer-r5-final.png`。
R5は骨冠を大型化した案で顔位置が下がったため、顔が揃っているR4に
骨冠・宝石・鎖・毒瓶・毒霧を追加した案を採用した。旧案は比較用に保存。
旧ゲーム画像は `existing-r1.webp`〜`existing-r5.webp`。

測定値は `import-settings.json`。帽子に隠れた人体の頭頂は承認済みR1から
推定し、帽子・角の先を測定には使わない。頬・顎・足裏は各原画を確認した。
共通枠90×92ドット、人体の頭頂9ドット、頭頂〜足裏82.7ドットで取り込む。
基準の約82.9ドットに対して0.2ドットの余白を足し、縮小補間の下端を収める。
機械的なドット化・減色は行わず、透明PNGを既存 `tools/jobimg.py` で縮小する。
`src/jobart.js` に呪術師の優先画像はなく、削除は不要。
`sw.js` の既存5画像を差し替え、画像一覧に制作基準のコメントを追加した。
CACHEは `dos-dev` を維持する。

再取り込み（リポジトリのルートで実行）:

```python
import json, subprocess
s = json.load(open('docs/art/hexer/import-settings.json'))
subprocess.run(['python3', 'tools/jobimg.py', 'hexer',
    *[x['source'] for x in s['sources']],
    '--per-dot', ','.join(str(x['perDot']) for x in s['sources']),
    '--head', *[','.join(map(str, x['head'])) for x in s['sources']],
    '--frame', ','.join(map(str, s['frame'])), '--frame-top', str(s['frameTop']),
    '--preview', 'docs/art/hexer/import-preview.png'], check=True)
```

## 検証

`game-display-review.png` と同名のJSONは既存 `tools/review-job-art.py` による
聖戦士R1と呪術師R1〜R5の同倍率の全身、56/36/26pxと拡大顔の確認。
画像選択、顔と頭の座標、30枚のCanvasが空でないこと、ゲーム起動を検証する。
`asset-verification.json` は出荷画像の寸法・透過・画像端の確認結果。
原画の比較と測定用は `source-measurement-review.png`。

最終検証は成功。全6枚の実表示枠は96×94、顔は `[48,21]`、人体の頭頂は
10ドット。呪術師の顎位置は31.663〜31.921で、聖戦士31.93との差は
0.267ドット以内。全30枚のCanvasは空でなく、ブラウザーエラーは0件。
5枚とも360×368の透明WebPで、画像端の不透明画素はない。
R2下端にalpha=1の不可視の補間画素が残るが、武器・衣装・角は欠けていない。
JavaScript構文と `git diff --check` も成功した。

再検証（ローカルHTTPサーバー起動後）:

```bash
python3 tools/review-job-art.py hexer --label 呪術師 --require-photos \
  --output docs/art/hexer/game-display-review
node --check src/jobphotos.js
node --check sw.js
git diff --check
```

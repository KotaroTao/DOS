# 聖戦士 R1〜R5 の原画と取り込み

ユーザー確認済みの `paladin-r1-review.png` をR1確定版とし、R2〜R5をそれぞれ独立した透明背景画像として生成した。集合絵の分割は行っていない。各生成では確定R1、死霊術師R1、そのランクの既存聖戦士を直接参照した。最終原画は `paladin-r1-final.png`〜`paladin-r5-final.png`。初稿と比較記録も保存している。

金髪・青い目・銀の鎧・青白の衣装・金の十字・直剣・青い盾を維持。R2は金縁と盾の光条、R3は重ねた肩鎧と盾の小紋、R4は鎧の模様と金縁のマント、R5は宝石とさらに豊かな金飾りを加えた。

## 取り込み

既存の `tools/jobimg.py` で透明背景を保持し、ドット化し直さずに縮尺調整した。装備の横幅で人物を縮めず、人物の縦の寸法から倍率を決定。原画ごとの頬の中心・頭頂・顎先・倍率は `import-settings.json` に記録した。全ランク360×336px（90×84升目）、`face: [45,12]`。

頭頂・顎先の測定値は原画の輪郭に沿った値を記録し、設定値だけを強制的に同じにして一致を装うことはしていない。ゲームの共通枠では全6枚の顔座標が `[48,17]`。頭頂と顎先の基準との差は最大0.205升目（保存画像で0.82px）、頭頂〜顎の長さは21.728〜22.111升目、基準は22.125升目。原画の画素形状が完全に同一という保証ではなく、同倍率比較で顔・頭身・粒度を確認した。

再取り込みはリポジトリのルートで実行する。

```bash
python3 - <<'PY'
import json, subprocess
s = json.load(open('docs/art/paladin/import-settings.json'))
rows = s['sources']
subprocess.run(['python3', 'tools/jobimg.py', 'paladin',
    *[r['source'] for r in rows], '--per-dot',
    ','.join(str(r['perDot']) for r in rows), '--head',
    *[','.join(map(str, r['head'])) for r in rows],
    '--frame', ','.join(map(str, s['frame'])),
    '--preview', 'docs/art/paladin/import-preview.png'], check=True)
PY
```

`src/jobphotos.js` に5ランクの設定を追加し、画像を優先表示するため `src/jobart.js` の旧聖戦士データを削除した。元の5枚の参照用描画は `existing-r1.png`〜`existing-r5.png` に保存。ゲーム用WebP5枚を `sw.js` のASSETSへ追加。キャッシュ名は変更していない。

## 確認

`game-display-review.png` はChromiumでゲームの `jobSprite`、`jobBust`、`crispCanvas` を使った実描画。左から死霊術師R1、聖戦士R1〜R5を同倍率・同枠で表示し、56/36/26px指定と拡大した顔アイコンを併記した。確認の再実行はローカルHTTPサーバーを起動して `python3 docs/art/paladin/review-game.py`。

全身6枚と顔24個のcanvasの描画、画像選択、顔座標、頭の位置の基準との差、ブラウザエラーなしとゲーム起動を確認した。JS193ファイルの構文確認済み。画像検査は `asset-verification.json`、実描画の設定は `game-verification.json`。全ランクの透明背景と1つの連結した不透明な人物像、画像外周での不透明な切断がないことを確認。剣先、盾、マントの端、靴も目視確認した。独立した不透明な残片や背景の残りは見つかっていない。

作業ブランチは `codex/paladin-art`。ローカルの `origin/main` は取り込み済み。プロキシ接続失敗で最新のfetchは未完了。mainへのマージ・push・公開は行っていない。

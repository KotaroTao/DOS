# アイテム制作番号101〜200

`src/itemnumbers.js` と `docs/art/item-number-ledger.csv` の固定制作番号101〜200。
`items.json` に番号・既存ID・名称・図鑑の説明・部位を記録している。

森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂の原画を参照し、左上からの光、
深い影、控えめな色、細かなドットの質感をそろえた。槍・弓・杖・盾・宝珠・護法書・
胴衣を、それぞれの図鑑説明にある素材・形・傷み・意匠に合わせて描き分ける。

原画は `master-101-120.png` から `master-181-200.png` の5枚。
各5列×4行、左から右・上から下の順。105番の角槍と128番の夢喰いの杖は
`corrections-105-128.png` の左右の原画を採用する。角槍は穂先を含む全体、
夢喰いの杖はバクの頭骨を描き直した。

隣り合う本体を分離して切り出し、刃先・弦・装飾を含めて384×384の透過WebPへ
変換する。原画・確認資料は公開対象外。ゲーム用は `art/items/<既存ID>.webp` の100点。

```sh
# Pillow・NumPy・SciPy が必要
python3 tools/itemart/build-101-200.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-101-200.cjs
```

`src/itemphotos.js` の対象を1〜200へ拡張し、共通描画から図鑑・袋・装備・商会へ
反映する。未鑑定装備は伏せ絵を優先する。読み込み失敗・寸法違い・4秒の時間切れでは
既存の絵を表示する。既存の文字列ID・名前・説明・性能・入手条件は維持する。

`preview.jpg` は番号順100点、`game-preview.png` は共通描画口の100点。
`codex-*.png` はスマホ幅での槍・盾・胴衣の図鑑表示。

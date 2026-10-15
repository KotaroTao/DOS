# アイテム制作番号1〜100

`src/itemnumbers.js` と `docs/art/item-number-ledger.csv` の固定制作番号1〜100。
既存の文字列ID・名称・説明・性能・入手条件は維持する。

森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂の原画を確認し、
左上からの光、深い影、控えめな色、細かなドットの質感を基準に制作した。
品ごとの図鑑の説明にある素材・形・傷み・魔法の意匠を描き分ける。
`items.json` は制作時の番号・ID・名称・説明の対応表。

原画は `master-001-020.png` から `master-081-100.png` の5枚。
各5列×4行、左から右・上から下の順。隣り合う品の本体を分離して切り出し、
刃先や装飾を含めて中央へ配置する。背景透過を保ち384×384 WebPへ変換する。
原画と確認資料は公開対象外、出荷するのは `art/items/<既存ID>.webp` の100点。

```sh
# Pillow・NumPy・SciPy が必要
python3 tools/itemart/build-001-100.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-001-100.cjs
```

`src/itemphotos.js` が起動時に並列で読み込み、共通のスプライト差し替え口で
図鑑・袋・装備・商会などへ反映する。未鑑定の装備は従来の伏せ絵を優先する。
読み込み失敗・寸法不一致・4秒の時間切れでは、その品の既存ドット絵を使う。
100番より後の装備・収集品には既存の描画を使う。

`preview.jpg` は番号順100点、`game-preview.png` は共通描画口での確認。

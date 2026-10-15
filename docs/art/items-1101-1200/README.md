# アイテム制作番号1101〜1200

固定台帳 `src/itemnumbers.js` の1101〜1200番の100点。`items.json` に既存ID・名称・図鑑の説明を記録した。
森の小屋の敵3体（`docs/art/prologue-enemies/preview.png` 上段）を直接参照し、暗い輪郭・左上の光・控えめな色・細かなドットの質感を合わせた。素材・形・由来の意匠は各品の図鑑の説明に合わせた。

原画は `master-1101-1120.png` 〜 `master-1181-1200.png` の5枚。各5列×4行、左から右・上から下の番号順。画像生成で制作し、各品を切り出して中央へ配置した。出荷物は `art/items/<既存ID>.webp` の透過384×384画像100点（合計約2.8MiB）。

`src/itemphotos.js` の既存描画口と `sw.js` に登録した。既存ID・名称・説明・性能は変更していない。

```sh
python3 tools/itemart/build-1101-1200.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-1101-1200.cjs
```

`preview.jpg` は番号順一覧。`game-preview.png` は共通描画口による100点の実描画。
`codex-*.png` は携帯幅での図鑑表示。検証は通常表示100点、未鑑定100点、取得失敗・寸法不一致・時間切れ時の代替表示を確認する。

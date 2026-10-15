# アイテム制作番号201〜300

固定制作番号は `src/itemnumbers.js`、品ごとの名称・説明は `items.json` に記録。
既存ID・名前・説明・性能・入手条件を維持し、胴装備51点と頭装備49点の専用原画を追加。
森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂の見本
(`docs/art/prologue-enemies/preview.png`) の左上の光、深い影、控えめな色、細かなドットの質感を参照した。
図鑑に記された補修板・苔・骨・銀板・焦げ跡・刺繍・空の宝石台座などを品ごとに描き分けた。

原画は `master-201-220.png` から `master-281-300.png` の5枚。
各5列×4行、左から右・上から下へ制作番号順。
本体を分離し、近い本体へ周囲の小部品を割り当てて切り出し、中央へ配置する。
出荷物は透過384×384 WebP (`art/items/<既存ID>.webp`) 100点。
原画と確認資料は公開対象外。`preview.jpg` は番号順の一覧、`game-preview.png` は共通描画口の確認。

```sh
python3 tools/itemart/build-201-300.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-201-300.cjs
```

既存の `src/itemphotos.js` とスプライト差し替え口を利用し、図鑑・袋・装備・商会へ表示。
未鑑定時は伏せ絵を優先し、取得失敗・寸法不一致・4秒の時間切れでは既存の固有ドット絵を使う。
新しいWebPは `sw.js` の `ASSETS` へ登録する。ゲームの仕組みの変更はなく、酒場の心得の変更はない。

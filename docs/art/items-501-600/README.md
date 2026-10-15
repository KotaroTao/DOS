# アイテム制作番号501〜600

正本は `src/itemnumbers.js` の固定制作番号と `docs/art/item-number-ledger.csv`。
`items.json` に既存ID・名称・図鑑の説明・部位を記録。既存の名称・説明・性能・入手条件は維持する。

森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂を参照し、左上からの光、深い影、控えめな色、細かなドットの質感で制作。
図鑑の記述に合わせて、素材・傷み・形・魔法の意匠を描き分ける。

原画は `master-501-520.png` 〜 `master-581-600.png` の5枚。各5列×4行、左から右・上から下の順。
つながった本体と近い小部品をまとめて切り出し、透明な余白を付けて384×384 WebPへ変換する。
出荷物は `art/items/<既存ID>.webp` の100点。原画・見本・確認記録は公開対象外のこのフォルダに保存。

```sh
python3 tools/itemart/build-501-600.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-501-600.cjs
```

`src/itemphotos.js` から既存の共通描画口へ登録し、図鑑・袋・装備・商会へ反映。
未鑑定装備の伏せ絵と、取得失敗・寸法不一致・4秒の時間切れでの既存絵への切り替えを維持する。
`sw.js` のASSETSに100点を登録し、キャッシュ名 `dos-dev` は変更しない。

`preview.jpg` は番号順100点、`game-preview.png` は実ブラウザの共通描画口、`codex-*.png` はスマホ幅の図鑑の確認。

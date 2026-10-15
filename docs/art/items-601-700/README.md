# アイテム制作番号601〜700

固定制作台帳の601〜700番、既存IDの装備100点を透過WebPにした。名称・説明・性能・入手条件は維持。

森の小屋の「ほこりゴキブリ」「枯葉ムカデ」「森の小蜂」の原画を参照し、細かなドットの質感、左上の光、深い影を基準に制作。図鑑の説明を `items.json` に保存し、素材と意匠を描き分けた。金剛杵は両端の法具、双刃は対、フランベルジュは波打つ刀身とし、進化した武器は同系統の意匠を発展させた。

原画は `master-601-620.png` から `master-681-700.png` の5列×4行5枚。左から右、上から下の番号順。透明度から本体を分離し、近接した小部品を割り当て、余白つき384×384 WebPに変換する。原画・確認資料は公開対象外、ゲームへ出荷するのは `art/items/<既存ID>.webp` の100点。

```sh
python3 tools/itemart/build-601-700.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-601-700.cjs
```

`src/itemphotos.js` と共通スプライト描画口で図鑑・袋・装備・商会へ反映。未鑑定時は既存の伏せ絵、取得失敗・寸法不一致・時間切れ時は既存ドット絵を使用。`sw.js` に全100点を登録し、キャッシュ定数は維持した。

`preview.jpg` は100点の番号順見本、`game-preview.png` は登録済み装備の共通描画口での確認。`codex-*.png` は代表4点のスマホ幅図鑑表示。

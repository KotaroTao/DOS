# アイテム制作番号1201〜1300

固定台帳 `src/itemnumbers.js` の1201〜1300に対応する100点。`items.json` に図鑑の名称・説明と既存IDを保存した。
森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂 (`docs/art/prologue-enemies/preview.png` 上段) を直接参照し、暗い輪郭、左上の光、控えめな色、細かなドットの質感を合わせた。布・革・鉄・精鋼・水晶など、図鑑にある素材と形を描き分けた。

原画は `master-1201-1220.png` から `master-1281-1300.png` の5枚。各5列×4行で、左から右・上から下の順。背景透過の本体を分離し、余白を付けて384×384のWebPに変換する。出荷先は `art/items/<既存ID>.webp`。原画と確認資料は公開対象外。

```sh
python3 tools/itemart/build-1201-1300.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-1201-1300.cjs
```

`src/itemphotos.js` と `sw.js` に登録し、図鑑・袋・装備・商会の共通描画へ反映する。未鑑定時は伏せ絵、読み込み失敗・寸法不一致・時間切れ時は既存絵を使う。`preview.jpg` は100点の一覧、`game-preview.png` は共通描画口での確認。

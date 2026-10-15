# アイテム制作番号1301〜1400

固定制作番号1301〜1400の100点。番号・既存ID・図鑑の名称と説明は `items.json` に記録した。
森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂を直接参照し、暗い輪郭、左上の光、深い影、落ち着いた色、細かなドットの質感をそろえた。絹、重ね革、鋼、魔銀、魔法の印やルーンを図鑑の説明に合わせて描き分けた。

原画は20点ずつ5枚。1301〜1320の原画は種類ごとに並んでいるため、変換スクリプトの確認済み対応表で切り出す。不足した鋼兜は `h_r3_steelhelm.png` の個別原画を使う。
出荷用は `art/items/<既存ID>.webp` の384×384透過WebP100枚。原画と確認資料は公開対象外。

```sh
python3 tools/itemart/build-1301-1400.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-1301-1400.cjs
```

共通の表示口を通じて図鑑・袋・装備・商会へ表示する。未鑑定は伏せ絵、画像取得失敗時は従来の絵を使う。

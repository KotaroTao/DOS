# アイテム制作番号401〜500

固定番号は `src/itemnumbers.js` と `docs/art/item-number-ledger.csv` に従う。
対象100点のうち403〜500番の98点は、奉納品の既存WebPを確認して再利用した。
新規制作は401番「不死鳥の尾羽」と402番「魂王の印の指輪」の2点。
文字列ID・名称・図鑑本文・性能・入手条件は変更しない。

森の小屋の3体の原画（`../prologue-enemies/bs_dustroach.png`、
`bs_littlecentipede.png`、`bs_woodbee.png`）を直接参照し、暗い輪郭、
左上の光、控えめな色、細かなドットの質感を合わせた。
尾羽は図鑑の「灰から蘇る霊鳥」「命をおき火のように保つ」をもとに、
長い赤金の尾羽と灰の残る軸で表現する。綿羽（499番）とは形を分ける。
指輪は黒い金属と魂王の印、影のような紫の刻印で表現する。

`master-401-402.png` は左が401番、右が402番の透過原画。
`items.json` は100点の番号・既存ID・説明・採用WebP・新規制作の有無。
`preview.jpg` は100点の一覧、`game-preview.png` は共通描画口での確認。
原画・確認資料は公開対象外。新規出荷は `art/items/` の透過384×384
ロスレスWebP2点で、既存98点の画像と登録先はそのまま使う。

```sh
python3 tools/itemart/build-401-500.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-401-500.cjs
```

図鑑・袋・装備・商会の共通描画口で表示する。未鑑定の装備は伏せ絵を優先し、
取得失敗・4秒の時間切れでは従来の固有ドット絵へ戻す。
新規2点は寸法不一致でも代替表示を確認する。既存画像の寸法（320/384）・
背景仕様（透過78点・不透明20点）は制作済みの状態を維持する。

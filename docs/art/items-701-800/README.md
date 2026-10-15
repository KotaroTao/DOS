# アイテム制作番号701〜800

固定台帳 `src/itemnumbers.js` の701〜800番100点。`items.json` に名称・既存ID・図鑑の説明を記録。ID・名称・説明・性能・入手条件は変更しない。

森の小屋のほこりゴキブリ・枯葉ムカデ・森の小蜂の原画を確認し、細かなドットの質感、左上の光、暗い影を制作基準にした。武器は神木・骨・銀刃・環付き錫杖など図鑑の素材と形を反映。久遠シリーズは青緑と古金、常世シリーズは藍と銀を基調に、布・革・鉄・黄金を描き分ける。

生成した5列×4行の原画を余白が確保されるよう修正し、`master-701-720.png`〜`master-781-800.png` に保存。左から右、上から下へ番号順。変換時はつながった本体と近接する装飾を同じ品へ割り当て、背景透過を保って384×384へ収める。出荷物は `art/items/<既存ID>.webp` の100点。原画・確認資料は公開対象外。

```sh
python3 tools/itemart/build-701-800.py
node tools/itemart/numbers.mjs --update
node tools/itemart/numbers.mjs
python3 -m http.server 8000
node tools/itemart/verify-701-800.cjs
```

`src/itemphotos.js` の既存の描画口から図鑑・袋・装備・商会へ適用。未鑑定は伏せ絵、取得失敗・寸法不一致・4秒の時間切れでは既存の絵へ戻る。新しいゲーム仕様はないため酒場の心得の追加は不要。

`preview.jpg` が番号順の全点一覧。`game-preview.png` と `codex-*.png` は共通描画口と携帯幅の図鑑での表示確認。

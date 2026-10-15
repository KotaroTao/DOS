# 奉納品81〜108の専用WebP

`src/catalog/misc.js` の収集品の定義順（道具を除く）81〜108番、計28点。
名前・来歴・ID・価格・出現条件は変更せず、説明に沿った専用の透過イラストを描いた。

- 原画: `atlas-1.png`〜`atlas-4.png`（各4列×2行、左上から7点、右下は空欄）
- 対応: `items.json` の順に7点ずつ
- 出荷画像: `art/treasury/<id>.webp`（384×384、透過、品質90）
- 見本: `contact-sheet.jpg`
- 表示: `src/treasuryphotos.js` → `makeItemSpriteResolver` → 共通Canvas描画
- オフライン: 全28画像と登録モジュールを `sw.js` に登録

制作は画像生成ツールで行い、原画を各セルで切り出して透過余白を整え、正方形へ収めた。
81〜108以外の収集品と装備の表示は従来の経路を使う。

読み込み失敗時は既存の固有ドット絵を使用する。

検証: Chromiumの幅390pxで全28点のCanvas描画・縮小表示と既存41〜80番の保持を確認 (`browser-mobile.png`)。全28画像の取得失敗時も起動し、従来の絵に戻ることを確認。JS構文・WebP寸法/透過・SW登録・ASSETS存在・差分検査を実施。

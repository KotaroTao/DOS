# 獄吏の詰所の敵イラスト

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`、`bs_littlecentipede.png`、`bs_woodbee.png`）を参照し、未作成だった主「鉄房の看守長」だけを制作した。細かなドットの質感、左上の光、暗い輪郭、控えめな茶・鉄色をそろえた。

図鑑の説明と伝承に合わせ、鎧と鉄格子が癒着した重い体、胸の鉄房に囚われた者の細い腕、手放さない鍵束を描いた。鍵の刻みは古い傷として表現し、読める文字を絵に加えていない。

## 作成済みの照合

通常敵12体（邪神の僧・バンシー・デュラハン・無人の鎧・鉄の騎士・黒甲の武者・亡霊騎士・ヴァンパイア・雷電の騎士・血霊・骨の巨兵・影の術師）、強敵「処刑人の大鬼」は作成済みのWebPを共用する。召喚先のさまよう亡霊、ミミック・マスターミミック・黒い宝箱、金属の魔物3種も既存画像を維持した。

新規出荷は `art/monsters/bs_ironcagewarden.webp` の1枚（520×381、透過・ロスレス）。原画は [bs_ironcagewarden.png](bs_ironcagewarden.png)。`python3 tools/guardhouse/build-enemies.py` で余白をそろえて変換する。`src/monsterphotos.js` と `sw.js` へ登録し、CACHEは `dos-dev` のまま。

能力値・出現条件・説明・伝承・技・旧絵は変更していない。同じIDは他の迷宮でも共用する。新機能や戦闘ルールの変更はないため、酒場の心得の更新はない。

## 確認

ローカルHTTPサーバーを8000番で起動し、`node tools/guardhouse/verify-enemies.cjs` を実行する（Playwright・Chromiumが必要）。保存なしのテストモードで、詰所の通常敵・強敵・主・召喚先・共通敵の計21種を確認した。

- 全21種の画像登録、画像の読み込み、戦闘用画像が空でないこと。
- 既存の能力値・説明・技・旧絵の維持。
- 全画像の取得失敗時に21種すべてが旧絵で起動すること。
- スマホの図鑑・盤面・主の出現表示と、PCの全敵一覧。
- JavaScript構文、差分の空白検査。

確認画像: [全敵一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[主の出現](battle-mobile.png)。原画と確認資料は公開対象外の `docs/` に保存する。

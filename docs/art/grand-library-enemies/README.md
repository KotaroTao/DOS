# 大書庫の敵イラスト

大書庫（`w45`）の未作成だった主 `bs_archivist`「大書庫の主」を透過WebPで制作。通常敵12種・強敵2種・共通敵5種は作成済みの原画をそのまま共用し、出現対象20種を網羅した。主の召喚先 `bs_grimoirebeast` も既存原画を使う。

## 画風と図鑑との対応

森の古屋の3体の原画（`../prologue-enemies/bs_dustroach.png`、`bs_littlecentipede.png`、`bs_woodbee.png`）を直接参照。暗い輪郭、細かなドットの質感、左上からの光、控えめな茶・青灰色と紙の黄褐色を合わせた。原画の機械的なドット化・減色は行わない。

図鑑の正本は `src/dungeons/bestiary.js` と `src/dungeons/monlore.js`。長机に座り続ける老いた司書、胸に抱えた読みかけの本、ひび割れた体から漏れる濁った紫の光、呼び寄せる魔導書を描いた。読み続けたい思いを残す、疲れた表情と前かがみの姿にした。図鑑・伝承・主の記憶の本文は変更しない。

## 画像と登録

`master.png` が採用原画。透明部分のα=1の不可視画素を余白の位置判定から除き、長辺512px以下へ縮小し、四辺4pxの完全透過余白を追加する。半透明の輪郭と原画の色を保持し、520×414pxのロスレスWebPとして出荷する。原画と確認画像は公開対象外のこのフォルダに置く。

```sh
python3 tools/grand-library/build-enemies.py
```

`src/monsterphotos.js` の専用欄と `sw.js` のASSETSを登録。同じphoto描画口で戦闘・盤面・図鑑に反映し、取得失敗時は既存絵を表示する。`dos-dev` は維持。能力・技・出現表・セーブ・ゲームの仕様を変えないため、酒場の心得の変更はない。

## 確認

ローカルHTTPサーバーを8000番で起動して実行する。

```sh
node tools/grand-library/verify-enemies.cjs
```

大書庫の出現表・強敵・主・召喚先・取り巻き・共通敵と検証対象一覧の一致、全20種の画像読み込み・非空の戦闘画像、既存能力の不変、画像取得失敗時の旧絵への復帰、ブラウザ例外なしを確認。新規WebPの透過・四辺の余白・寸法・ASSETS登録、JavaScript構文、伝承検査、差分の空白も確認する。

- [全20種の一覧](preview.png)
- [主の図鑑](codex-mobile.png)
- [主との戦闘](battle-mobile.png)
- [盤面](board-mobile.png)

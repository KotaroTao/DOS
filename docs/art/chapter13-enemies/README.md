# 第十三章「溶鉄炉」の敵原画

本筋 `w50`〜`w53`、寄り道 `ws28`・`ws29` の通常敵20体・強敵2体・主1体、計23体を制作。召喚先の鋳造のゴーレム・魂の鋳塊も含む。銀業・金業・銀業の王・ミミック・マスターミミックは既存原画を共用する。

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を画風の基準として確認し、暗い鉄と錆、左上の暖かい光、細かなドット調の筆致を採用。図鑑の説明・能力（`src/dungeons/bestiary.js`）と伝承（`src/dungeons/monlore.js`）に合わせた。鉄の器は工房の製品として描き、魂を鉄の材料にしない。魂の鋳塊は空の器の仕事の記憶、るつぼに浮く顔は鉄の面。主は大炉を胸に抱え、肩に古い注文札の鎖を掛けた工房長。

原画は `sheet-a.png`〜`sheet-f.png`。上段左・右、下段左・右の順（fは下段中央に主）。IDと各画像の制作指示は `groups.json`。透明な経路をたどって輪郭を切らずに分割し、長辺512px以内へ縮小して周囲4pxを空け、可逆WebPへ変換する。α>16の輪郭を横切る分割は中止する。原画の色・αは加工しない。分割境界でのみα16以下のごく薄い外側の光を左右いずれかに割り当てる。寸法は `dimensions.json`、出荷物は `art/monsters/<ID>.webp`。

```bash
python3 tools/chapter13/build-enemies.py
python3 -m http.server 8000
node tools/chapter13/verify-enemies.cjs
```

変換時に `src/monsterphotos.js` と `sw.js` に登録。検証は全6迷宮・召喚先・共通敵を網羅し、全28種の原画読込と非空の戦闘描画、通信失敗時の空枠表示、描画前後の敵データ一致を確認する。能力・出現条件・本文は維持しているため、酒場の心得の変更はない。

確認画像: [全28種](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

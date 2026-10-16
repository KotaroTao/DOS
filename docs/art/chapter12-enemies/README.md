# 第十二章「王家の廟」の敵原画

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を直接参照し、暗い輪郭、左上の暖かい光、細かなドット調の筆致と控えめな色をそろえた。図鑑の説明・能力（`src/dungeons/bestiary.js`）、伝承（`src/dungeons/monlore.js`）、制作一覧（`docs/art/chapter12-art-list.md`）を参照した。

本筋 w46〜w49、寄り道 ws25〜ws27 の通常敵20体・強敵2体・主1体、計23体を制作。召喚先の朽ちぬ亡骸・不朽の近衛も含む。銀業・金業・銀業の王・ミミック・マスターミミックの5体は既存画像を共用する。能力・出現条件・図鑑本文は変更しない。

白いろうと香油で固めた人の亡骸は木の人業と区別し、古い金の装飾と傷んだ衣を描く。半透明の霊は道具と姿勢で役目を示す。主は王冠・手・玉座がろうと金で一体になった、千年終われなかった王として描く。各シートの配置と反映した特徴は `groups.json` に記録。

原画は `sheet-a.png`〜`sheet-f.png`。各シートは上段左・右、下段左・右の順（fのみ下段中央に主）。透明な経路をたどって輪郭を保護し、見えないα=1の画素を余白の判定から除外、長辺512px以内へ縮小して周囲4pxの余白を付け、可逆WebPで保存する。切り分け経路にα>4の画素があれば中止する。原画の色や半透明の輪郭は変更しない。寸法は `dimensions.json`、ゲーム用は `art/monsters/<ID>.webp`。

```bash
python3 tools/chapter12/build-enemies.py
python3 -m http.server 8000
node tools/chapter12/verify-enemies.cjs
```

変換時に `src/monsterphotos.js` と `sw.js` に登録する。検証は全7迷宮と召喚先の網羅、共通敵を含む28体の画像読込・非空の戦闘描画、画像取得失敗時の既存絵への復帰、描画前後での敵データの一致を確認する。

確認画像: [全28体](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

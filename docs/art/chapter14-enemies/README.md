# 第十四章「深淵の聖堂」の敵原画

本筋 `w54`〜`w57` と寄り道 `ws30`・`ws31` の通常敵19体・強敵2体・主1体、計22体を制作。召喚先の偽りの熾天使と失われた聖歌隊も含む。銀業・金業・銀業の王・ミミック・マスターミミックの5種は既存原画を共用する。異端審問官はこの6迷宮の出現表に含まれないため対象外。

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を直接参照し、細かなドット調の筆致、左上からの暖かい光、暗い輪郭と灰紫の影を基準に制作。各敵の説明は `enemies.json`、シート内のID順と制作指示は `groups.json` に記録。衣・金属・石・霊・獣・蛾の輪郭を描き分け、主の大司教には白い重ね衣・縫いつけた祈りの紙・手鐘・胸の灯を持たせた。再会を願う祈りを預かる人物として描いている。

原画は `sheet-a.png`〜`sheet-f.png`。a〜eは上段左・右、下段左・右、fは左・右の順。透明な経路をたどって個別に分割し、長辺512px以内へ縮小、周囲4pxを空けて可逆WebPへ変換する。α16を超える輪郭を横切る分割は中止する。原画の色と透過は保持し、境界のごく薄い光だけを左右いずれかに割り当てる。寸法は `dimensions.json`、出荷物は `art/monsters/<ID>.webp`。

```bash
python3 tools/chapter14/build-enemies.py
python3 -m http.server 8000
node tools/chapter14/verify-enemies.cjs
```

変換時に `src/monsterphotos.js` と `sw.js` へ登録。検証では6迷宮・召喚先・共通敵の計27種を照合し、原画の読込・非空の戦闘描画・通信失敗時の空枠表示・描画前後の敵データ一致を確認する。能力・本文・出現条件に変更はないため、酒場の心得の変更はない。

確認画像: [全27種](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

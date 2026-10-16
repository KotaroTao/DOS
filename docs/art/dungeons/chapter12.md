# 第十二章「王家の廟」の探索素材

本筋 w46〜w49 と寄り道 ws25〜ws27 の全7迷宮・75階に専用の床・蓋・壁を適用する。

| 迷宮 | 素材 |
|---|---|
| 弔い灯の参道 | 温かな石とろうそくのくぼみ |
| 香油の仕立て場 | 香油のしみた黄土色の作業石 |
| 眠らずの近衛廊 | 黒い大理石と金の縁 |
| 終わらずの玉座 | 棺の段を思わせる石と古い金の装飾 |
| 名の無い墓所 | 灰褐色の土と摩耗した墓碑 |
| 剥製の大広間 | 茶色い石と古い獣の毛皮 |
| 王子の墓所 | 象牙色の石と細い金の装飾 |

画像生成による原画は同じフォルダの `<ID>-materials-master.png` と `<ID>-floor-master.png`。1536×1024px。素材集上段の512px四方3区画が蓋、右下が壁材。床は一枚の連続した原画から切り出し、反復・反転しない。配信には品質88のWebP計14枚を使う。原画と確認画像は公開しない。

共通の描画・人物・小物を利用する。危険な床は既存の専用表示を重ねる。蓋の模様は中身を示さず、描画は遊びの乱数を使わない。心得 `t_royal_tomb_stonework`。

再生成・確認:

```sh
bash tools/crypt/build-dungeons.sh w46 w47 w48 w49 ws25 ws26 ws27
python3 -m http.server 8000
NODE_PATH=/path/to/node_modules CRYPT_REVIEW_OUT=docs/art/dungeons/review-chapter12 node tools/crypt/verify-dungeons.cjs w46 w47 w48 w49 ws25 ws26 ws27
```

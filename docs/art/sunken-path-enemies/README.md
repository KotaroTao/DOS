# 水底の参道の敵イラスト

森の小屋の敵3体（`../prologue-enemies/bs_dustroach.png`、`bs_littlecentipede.png`、`bs_woodbee.png`）を直接参照し、細かなドットの質感・暗い輪郭・左上の光を合わせた。図鑑の説明・能力（`src/dungeons/bestiary.js`）と伝承（`src/dungeons/monlore.js`）を参考に未作成9体を制作した。

- sheet-a.png: 藻に巻かれし者、深みの灯りくらげ、聖水盤の異形
- sheet-b.png: 水底の祈り手、蛇身の巫女、水没聖歌隊
- sheet-c.png: 潮を呼ぶ司祭、たたりの大鐘、魂刈り

異端大司教・銀業・金業・銀業の王・ミミック・マスターミミックは作成済みの原画を共用。参道に主は設定されていない。能力・本文・出現条件は変更しない。原画の機械的なドット化・減色は行わず、透明な隙間を検査して切り出し、最大512pxと透過余白4pxのロスレスWebPへ変換。

再変換: `python3 tools/sunken-path/build-enemies.py`

表示と網羅の確認: HTTPサーバーを8000番で起動して `node tools/sunken-path/verify-enemies.cjs`。15種の原画と戦闘画像、図鑑・盤面・戦闘の携帯画面、取得失敗時の旧絵への復帰、能力の不変を確認する。確認画像はこのフォルダに保存。

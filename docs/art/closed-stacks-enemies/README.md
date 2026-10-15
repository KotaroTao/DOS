# 閉架の書庫の敵イラスト

`ws24` の通常敵12種と強敵1種を、森の古屋の3体の原画と図鑑の説明・伝承に合わせた透過WebPへ変更。主は通常敵と同じ `bs_tomeguardian` を使う。共通で出現する金業・銀業の王・マスターミミックも制作し、銀業とミミックは登録済みの原画を共用する。新規16枚、出現対象は重複を除いて18種。

## 画風と図鑑との対応

直接参照した原画: `../prologue-enemies/bs_dustroach.png`、`bs_littlecentipede.png`、`bs_woodbee.png`。細かなドットの質感、暗い影、左上からの暖色光、控えめな色と冷たい縁の光をそろえた。原画の機械的なドット化・減色は行わない。

| 原画の位置 | ID | 図鑑を反映した姿 |
| --- | --- | --- |
| a 左上 | bs_tomeguardian | 積み重なった本と頁の鎧、大きな腕で胸に抱えた鎖付きの禁書 |
| a 右上 | bs_runegolem | 石の体に刻まれた淡く光る古い文字 |
| a 左下 | bs_forbiddenspirit | 鎖で封じた本からはじけ出す紫の魔力 |
| a 右下 | bs_mindeater | 脈打つほどにふくれた頭、空の目、細い霊体と指 |
| b 左上 | bs_spellwraith | 雨ににじんだ呪文の頁でできた、唱え終わらない霊 |
| b 右上 | bs_cosmicwraith | 開いた本のとじ目から見返す目と暗がりの手（星空の霊にはしない） |
| b 左下 | bs_inkdragon | 墨の体、翼、長い尾と爪、口から流れる墨 |
| b 右下 | bs_elderlich | 古いローブの学者の骨、同じ本を開く書見台 |
| c 左上 | bs_arcanesentinel | 鋼の番兵、胸の刻印、急所を断つ刃 |
| c 右上 | bs_soulreaper | 鎌を持つ影、外套の内に包まれた小さな魂 |
| c 左下 | bs_inkhorror | 文字と頁を吸いこんだ黒い墨の塊、かみつく口 |
| c 右下 | bs_grimoirebeast | 羽のように打つ革の表紙、雨でにじんだ頁と紙の刃 |
| d 左上 | el_librarian | 干からびた司書、腰の鍵束、暗記した呪文と本 |
| d 右上 | mt_gold | 金の人業、翠の目と胸の灯、金魚の尾びれのような紅金の飾り布 |
| d 左下 | mt_king | 大きな白金の人業、小さな王冠、胸の魂、短い外套 |
| d 右下 | master_mimic | 金色の宝箱の王、牙と舌、王冠のような金具 |

参照した本文は `src/dungeons/bestiary.js`、`src/dungeons/monlore.js` と `src/sprites.js`。金属の魔物の小道具は `tools/hdart/metal/` の既存デザインも確認した。

## 取り込み

```sh
python3 tools/closed-stacks/build-enemies.py
```

`sheet-a.png`〜`sheet-d.png` が採用原画。切り出して長辺512px以下へ縮小し、四辺に4pxの完全透過余白を加えてロスレスWebPにする。原画のα=1の不可視画素は余白の位置判定だけから除外し、色や半透明の輪郭は変更しない。翼・鎌・紙片を含め、隣の敵の輪郭が入らない位置で切り分けた。

`src/monsterphotos.js` の専用登録欄と `sw.js` のASSETSも更新。`dimensions.json` は配信用寸法。既存のphoto描画口により戦闘・盤面・図鑑で共用し、画像取得失敗時は既存の絵を使う。同じIDの敵はほかの迷宮でも新しい絵になる。

能力・技・説明・伝承・出現条件・セーブ形式は変更しない。仕様変更を伴わないため、酒場の心得は変更しない。キャッシュ名 `dos-dev` は維持。

## 確認

ローカルHTTPサーバーを8000番で起動し、`node tools/closed-stacks/verify-enemies.cjs` を実行。出現対象18種（主・強敵・共通敵を含む）の登録網羅、画像読み込みと非空の戦闘画像、既存データ不変、取得失敗時の旧絵への復帰、ブラウザ例外なしを確認する。

- [全18種の一覧](preview.png)
- [図鑑](codex-mobile.png)
- [戦闘](battle-mobile.png)
- [盤面](board-mobile.png)

WebP全16枚の透過・四辺の余白・寸法とASSETS登録、JS構文、伝承検査、差分の空白も確認。

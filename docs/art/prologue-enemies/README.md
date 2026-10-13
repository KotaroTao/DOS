# 序章の森の魔物

「ほこりゴキブリ」「枯葉ムカデ」「森の小蜂」の専用絵と伝承を追加。作成済みの説明文・能力値・出現表は維持。

既存の第1層の通常敵（屍ウジ・墓火・腐肉あさりの大鴉）を参照し、左上の光・暗い影・控えめな色で制作した。原画は背景透過 PNG。ゲーム用には既存の変換道具で16色へ減色し、横長の姿は幅を基準に約96ドットへそろえた。

| 魔物 | ゲーム用寸法 | 伝承の出典 |
| --- | --- | --- |
| ほこりゴキブリ | 95×57 | 古屋の掃除帳 |
| 枯葉ムカデ | 95×77 | 森沿いの村の言い伝え |
| 森の小蜂 | 97×96 | 師オルドの暮らしの覚え書き |

[比較見本](preview.png)：上段が今回の3体、下段が参照した既存の3体。各画素を3倍で表示。

登録先は `src/dungeons/monart.js`。戦闘・盤面・図鑑の共通データへ反映される。原画と確認画像は公開対象外のこのフォルダに保存し、実行時の新規ファイルは追加していない。`sw.js` の既存登録と `dos-dev` は維持。

再変換（リポジトリのルートで実行）:

```sh
node tools/monart.mjs bs_dustroach docs/art/prologue-enemies/bs_dustroach.png --h 57 --colors 16
node tools/monart.mjs bs_littlecentipede docs/art/prologue-enemies/bs_littlecentipede.png --h 77 --colors 16
node tools/monart.mjs bs_woodbee docs/art/prologue-enemies/bs_woodbee.png --h 96 --colors 16
```

図鑑の確認画像は `bs_*-codex.png`。保存なしのテストモードで討伐数10体を設定し、各個体の既存説明・伝承・出典が表示されることを確認。伝承検査と変更した JavaScript の構文検査も実行。

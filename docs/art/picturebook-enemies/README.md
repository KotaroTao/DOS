# 絵本の閲覧室の敵原画

森の小屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を画風の基準とし、図鑑の説明 (`src/dungeons/bestiary.js`) と伝承 (`src/dungeons/monlore.js`) に合わせて制作。
左上の暖色の光、暗い影、控えめな色、細かな質感と読み取りやすい輪郭をそろえる。

| 原画 | ID | 敵 | 図鑑から反映した特徴 |
| --- | --- | --- | --- |
| sheet-a.png 左 | bs_bookworm | 知識喰らいの蟲 | 本を食べる長虫、体節に透ける文字 |
| sheet-a.png 中 | bs_papermimic | 擬書 | 革の本、刃のような紙の縁 |
| sheet-a.png 右 | bs_familiarswarm | 使い魔の群れ | 本を運ぶ小さな使い魔、爪の金文字のかけら |
| sheet-b.png 左 | bs_glyphhound | 呪印の番犬 | 墨色の犬、全身に刻んだ呪印 |
| sheet-b.png 中 | bs_cursescroll | 呪いの巻物 | 宙で広がる巻物と呪いの文 |
| sheet-b.png 右 | bs_eyetome | 眼の魔導書 | 頁と表紙の開いた目 |
| sheet-c.png 左 | bs_wordwraith | 言霊の霊 | 書き言葉が抜け出した文字の体 |
| sheet-c.png 中 | bs_astralwraith | 星辰の霊 | 古い星図、本の中の夜空、星くずの刃 |
| sheet-c.png 右 | el_voidarchon | 白紙の執政官 | 名も文字も失った白い影、白紙と定まらない輪郭 |

作成済みの「うごめく魔導書」(`bs_grimoirebeast`) と、共通敵の銀業・金業・銀業の王・ミミック・マスターミミックは既存原画を共用する。閲覧室の固有敵10種と共通敵5種の計15種を確認対象とする。召喚先・取り巻きの追加はない。
能力値・技・図鑑の本文・出現条件は変更しない。専用原画の読込に失敗した場合は既存のドット絵を表示する。

原画・制作記録はこの公開対象外のディレクトリ、実行時の画像は `art/monsters/<ID>.webp` に置く。

```bash
python3 tools/picturebook/build-enemies.py
python3 -m http.server 8000
node tools/picturebook/verify-enemies.cjs
```

変換は透明な余白を縦にたどって原画の各列を切り出し（切り分け線上のαが4（約1.6%）を超えたら中止し、輪郭を保護）、透明の余白を除いて長辺512px以下にそろえ、4pxの余白を付けた可逆WebP。寸法の記録は `dimensions.json`。同じ処理で `src/monsterphotos.js` と `sw.js` に登録する。

確認画像: [全15種](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

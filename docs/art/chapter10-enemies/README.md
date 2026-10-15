# 第十章「地底大空洞」の敵イラスト

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を直接参照し、暗い輪郭・左上の光・控えめな色・細かな段のある質感を合わせた。図鑑の説明・能力（`src/dungeons/bestiary.js`）と伝承（`src/dungeons/monlore.js`）に沿って、未作成の3体を追加した。

| ID | 魔物 | 絵に反映した特徴 |
| --- | --- | --- |
| bs_echowraith | 反響の霊 | 自分の名を探す複数の顔、つぶやく口、声が重なる青灰色の揺らぎ |
| bs_stalactiteghost | つらら石の霊 | 石に半ば溶けた顔、下を向くつらら石、先端から落ちる黒いしずく |
| bs_moldern | 宰相モルデン | 痩せた長身、静かな薄い笑み、黒紫の帽子と長衣、赤い内衣、金の職位の鎖と赤い宝石、胸の木の扉と古い魂の灯、加護を払う手 |

モルデンの顔と衣装は既存の人物基準 `docs/art/story-refs/morden.png`・`morden-chest.png` も直接参照した。原画は各IDのPNG。反響の霊・つらら石の霊は生成シートから連結した輪郭と近接するしずくを保って個別に切り出した。

最新main（制作開始時の照合元 `744ecd77d3f8c576f05657f82f932b061bfa8591`）の作成済み26体は維持。制作中に既存画像が見つかった闇這いの蟲・盲いた深淵獣・洞窟のトロール・大空洞の主の案は採用しない。対象は本筋4迷宮（w38〜w41）・寄り道3迷宮（ws20〜ws22）の全7迷宮。通常敵・主・強敵・召喚先24体と、共通のミミック2体・金属の魔物3体で計29体。出現表と各IDの作成状況は [coverage.json](coverage.json)。既存26体のWebPのSHA-256が作業前後で同一であることを確認した。

`python3 tools/chapter10/build-enemies.py`（Pillow）で透過を保って最大512pxに縮小し、外周4pxの余白を加え、個別のロスレスWebPへ変換する。3枚の合計は約556KiB。`src/monsterphotos.js` の寸法と `sw.js` のASSETSへ登録。原画・確認資料・制作ツールは公開対象外で、出荷物は `art/monsters/` のWebPのみ。

## 確認

ローカルHTTPサーバーを8000番で起動し、`node tools/chapter10/verify-enemies.cjs`（Playwright・Chromium）で以下を確認済み。

- 7迷宮と召喚先・共通敵を含む全29体の登録と画像読み込み。
- 追加3体の戦闘画像が空でないこと、図鑑・盤面・戦闘の表示、ブラウザー例外なし。
- 画像取得失敗時も追加3体が従来絵で起動すること。
- 既存の能力・図鑑本文・伝承・出現条件のソースを変更していないこと。

JS構文、伝承、読み物、物語の画像登録と指示書、オープニング画像の検査も実行。画像追加のみで機能や戦闘ルールの変更はないため、酒場の心得の変更はない。CACHEはdos-devのまま。

確認画像: [一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

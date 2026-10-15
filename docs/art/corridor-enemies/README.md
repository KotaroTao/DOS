# 亡骸の囁く回廊の魔物

森の小屋の3体の原画（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）と地下墓地の原画を直接参照し、暗い輪郭・左上の光・控えめな骨色と青灰色の陰影をそろえた。図鑑の説明・伝承（`src/dungeons/bestiary.js`・`monlore.js`）に合わせた専用の透過イラスト。

| ID | 魔物 | 絵に反映した特徴 |
| --- | --- | --- |
| bs_mournshade | 嘆きの喪影 | 頭を垂れた喪服の霊、青白い顔と涙 |
| bs_ghoul | 喰屍鬼 | やせた体、長い爪、飢えた口 |
| bs_pettyrevenant | 浅き怨霊 | 人の形を残す顔と衣、怒りをためる手と紫の霊気 |
| bs_sarcoguard | 石棺の番人 | 石棺のふたから立つ守護者、組んだ腕 |
| bs_skullswarm | ドクロの群れ | 宙を舞う5つのどくろ、かみつく顎 |
| bs_spiritbat | 霊蝙蝠 | 冷たい青い翼、霊体の尾と羽音 |
| bs_shroudstrangler | 死に装束の絞め手 | 骸のない空洞、首に巻きつく長い布 |
| bs_tombwarden | 墓守の重骸 | 厚い古びた鎧と盾、仲間を守る構え |
| bs_weepangel | すすり泣く墓像 | 顔を両手で覆う石の天使、指のすき間 |
| el_palebutcher | 蒼白の首切り鬼 | たるんだ蒼白の巨体、墓守の衣と大包丁 |
| bs_zombie | 腐乱死体 | 重骸の取り巻き、腐った体、毒の滴る爪 |
| mimic | ミミック（既存WebPを共用） | 木と鉄の宝箱、牙と舌 |

通常敵9種・強敵1種・取り巻き1種を新規作成。宝箱のミミックは既存の同じ画風のWebPを共用し、回廊で遭遇する12種を網羅する。第1層には金属の魔物・マスターミミックは出ない。回廊には主・死体・出来事の遭遇はない。

原画: [master.png](master.png)。`python3 tools/crypt/build-corridor-enemies.py` で輪郭別に切り出し、透過の余白を付け、ロスレスWebPへ変換する。減色や文字グリッド化は行わない。原画・制作記録・確認画像は公開対象外の `docs/` に保存。

登録先は `src/monsterphotos.js` と `sw.js` の `ASSETS`。共通の原画描画口を使い、同じIDの魔物には別の迷宮でも反映する。能力・技・伝承・出現条件・保存形式は変更しない。新機能・仕様変更はないため酒場の心得の追加・変更はない。

## 確認

HTTPサーバーをポート8000で起動し、`node tools/crypt/verify-corridor-enemies.cjs` を実行（Playwright・Chromiumが必要）。保存なしの回廊テストモードで次を確認する。

- 出現表・取り巻き・強敵・ミミックの全12種の登録。
- 原画の読み込みと、空でない戦闘ビットマップへの描画。
- 能力・既存絵・説明・伝承などの定義の維持。
- 全WebPを取得できない場合にも旧絵で起動すること。
- [一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)の表示。

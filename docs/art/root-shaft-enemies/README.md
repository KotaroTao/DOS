# 根の這う縦穴の敵イラスト

森の小屋の敵3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を直接参照し、暗い輪郭、左上の光、控えめな土色・苔色、細かな段のある質感をそろえた。図鑑の説明・能力と `src/dungeons/monlore.js` の伝承を参照して未作成の8種を制作。

| ID | 魔物 | 反映した特徴 |
| --- | --- | --- |
| bs_giantowl | 霧渡りの梟 | 大きな翼、音のない急降下、かぎ爪 |
| bs_stranglevine | 絞め蔦の魔 | 無数の絡みつく蔦、しびれのとげ |
| bs_sporezombie | 胞子の苗床 | 亡骸を結ぶ菌糸、頭と背のキノコ、口から吐く胞子 |
| bs_fungalhulk | キノコ人の巨体 | 朽ち木から育った菌糸の巨体、繊維の腕 |
| bs_flytrap | 大食虫花 | 独立した三つの顎、牙、毒液 |
| bs_mossgolem | 苔生す岩塊 | 分厚い岩、傷を埋める苔、樹根 |
| bs_stonegazer | 石にらみの大蜥蜴 | 苔色の硬い鱗、鶏冠ととげ、黄緑の眼 |
| bs_griffon | グリフォン | ワシの頭と翼、獅子の体、急襲する前脚 |

大蛾・古樹の巨人と共通の敵6種はmainの作成済み原画を維持。縦穴に主はいない。通常敵9種・強敵1種・共通6種の計16種を確認した。

原画: [master.png](master.png)。ゲーム用は透過ロスレスWebP。`python3 tools/root-shaft/build-enemies.py` で連結した輪郭を保って切り出し、`art/monsters/` へ出力。寸法は `src/monsterphotos.js`、配信は `sw.js` に登録。

HTTPサーバーを8000番で起動し、`node tools/root-shaft/verify-enemies.cjs` で16種の網羅、画像成功時の非空の戦闘絵、画像取得失敗時の旧絵、能力・技・説明の不変、ブラウザー例外なしを確認済み。

確認画像: [一覧](preview.png)、[図鑑](codex-mobile.png)、[盤面](board-mobile.png)、[戦闘](battle-mobile.png)。戦闘ルール・機能の変更がないため酒場の心得の変更はない。

# 樹液の苗床の敵イラスト

最新mainの出現表と原画台帳を照合し、未作成の「霧の古木」「柳の魔女」2体を制作。森の小屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）を直接参照し、暗い輪郭、左上の光、控えめな土色・苔色、段のある細かな質感をそろえた。

| ID | 魔物 | 図鑑から反映した特徴 |
| --- | --- | --- |
| bs_misttreant | 霧の古木 | 苔と霧、刃を受け止める太い幹、仲間をかばう枝、裂け目の乾いた芯 |
| bs_willowwitch | 柳の魔女 | 柳になった古い魔女、枝垂れる葉、掲げた枝の青白い魔法陣、足元の蔦。年を取らぬ薬を求めて柳となる伝承 |

通常敵のキノコ人の巨体・大食虫花・胞子の苗床・森の妖魔・鱗粉の大蛾・惑わしの群火・石にらみの大蜥蜴、強敵の霧の繭母、召喚先の絞め蔦の魔、共通6種は作成済みWebPを維持。苗床に主はいない。通常敵9種・強敵1種・追加召喚先1種・共通6種の計17種を確認する。

原画は [master.png](master.png)。`python3 tools/sap-nursery/build-enemies.py` で本体の輪郭と離れた粒を保って切り出し、最大512pxと透過余白を付け、ロスレスWebPへ変換（Pillow・NumPy・SciPy）。出荷先は `art/monsters/`、寸法は `src/monsterphotos.js`、配信は `sw.js` に登録。

ローカルHTTPサーバーを8000番で起動して `node tools/sap-nursery/verify-enemies.cjs` を実行。17種の網羅、画像成功時の非空の戦闘絵、画像取得失敗時の旧絵、既存能力・技・説明の不変、ブラウザー例外なしを検査する。

確認画像: [一覧](preview.png)、[図鑑](codex-mobile.png)、[盤面](board-mobile.png)、[戦闘](battle-mobile.png)。戦闘ルール・機能の変更がないため酒場の心得の変更はない。

# 溺れた聖歌の回廊の魔物

森の古屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`・`bs_littlecentipede.png`・`bs_woodbee.png`）の暗い輪郭、左上の光、控えめな色と細かな質感を基準に、図鑑の説明・伝承・能力を参照して未作成5体を制作。ゲーム用は透過ロスレスWebP。

| ID | 魔物 | 絵に反映した特徴 |
| --- | --- | --- |
| d04_grudge | 供物盗りの怨霊 | 黒紫のもや、抱えた黄金の聖杯、長い爪、盗んだ願いの金貨 |
| bs_idolguardian | 神像の番人 | 顔のない四本腕の石像、神殿の大盾、光る守りの紋 |
| bs_shadowseraph | 堕ちた光翼 | 体を持たない六枚の朽ちた翼、目を閉じた白い仮面、黒い光輪と灰色の粉 |
| bs_dreadlich | 嘆きのリッチ | 大神官の衣、枯れ枝の指、生者の魂を吸う姿、魂を分けた三つの宝珠 |
| bs_crystalgolem | 水晶の巨像 | 青白い角張った結晶、魔力による細かなひび、結晶の中で祈る顔 |

通常敵9種・強敵1種・召喚先の藻に巻かれし者と、共通敵5種（金属3種・ミミック2種）の計16種を網羅。水没聖歌隊・水底の祈り手・黄金の守り像・魂刈り・堕ちた神像・藻に巻かれし者と共通敵は作成済みの原画をそのまま使う。この迷宮に主の設定はない。同じIDが出るほかの迷宮にも反映される。

原画は [master.png](master.png)。`python3 tools/drowned-hymn/build-enemies.py` で透明な隙間をたどって切り出し、最大512pxに縮小して四辺に4pxの余白を付け、`art/monsters/<ID>.webp` と寸法・SW登録を更新する。原画登録は既存の `src/monsterphotos.js` を使う。能力値・説明・伝承・出現条件・セーブ形式は変更しない。機能・戦闘ルールの変更がないため、酒場の心得の変更もない。

ローカルHTTPサーバーを8000番で起動し、`node tools/drowned-hymn/verify-enemies.cjs` で16種の網羅・原画登録・非空の戦闘画像・既存定義の維持・画像取得失敗時の旧絵を検査する。保存なしのテストモードを使う。

確認画像: [一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

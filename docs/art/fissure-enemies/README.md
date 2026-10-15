# 火を噴く地割れの魔物

森の小屋の3体（`docs/art/prologue-enemies/preview.png` 上段）を画風の基準に、図鑑の説明・伝承・特徴から未作成の通常敵9体を制作。左上の光、暗い輪郭と深い影、控えめな色を保ち、火は黒い岩肌・炭・灰に赤い熱がのぞく姿として描いた。

| ID | 魔物 | 図鑑から反映した特徴 |
| --- | --- | --- |
| bs_magmaslime | 溶岩の粘塊 | 黒い皮膜、溶けかけた兜・盾と金貨 |
| bs_emberswarm | 火の粉の蟲群 | 光る腹、羽、赤熱した尾の針の群れ |
| bs_ashghoul | 灰かぶりの信徒 | 焼けた衣、灰をかぶった頭、灰をすくう手 |
| bs_cinderwraith | 燃え殻の亡霊 | 骨の手、くすぶる燃えさし、散る火の粉 |
| bs_lavamaw | 溶岩の顎 | 溶岩だまりから開く顎、黒曜石の牙 |
| bs_sulfurfiend | 硫黄の鬼 | 黄土色、長い手足、かぎ爪、硫煙 |
| bs_lavagolem | 溶岩のゴーレム | 背を丸めて床につく両拳、重なる黒い岩殻 |
| bs_magmaray | 溶岩のエイ | 翼のようなひれ、稲妻の長い尾 |
| bs_hellhound | 業火の番犬 | 黒い肌、燃えるたてがみ、千切れた鎖の首輪 |

作成済みの強敵「残り火の王」`el_cinderking` は既存のWebPを共用。召喚する火の粉の蟲群も今回の絵を使い、この迷宮の通常敵・強敵・召喚先を網羅する。

原画は `master.png`（左上から表の順、3×3、透過背景）。出荷するのは `art/monsters/<ID>.webp` のロスレスWebPだけ。登録は `src/monsterphotos.js` と `sw.js`。説明・伝承・能力・技・出現条件は既存のまま。

再変換: `python3 tools/crypt/build-fissure-enemies.py`

実画面の検証: HTTPサーバーを8000番で起動し、`node tools/crypt/verify-fissure-enemies.cjs`。9体の画像読込、戦闘用画像の非空、対象の網羅、能力と設定の不変、取得失敗時の旧絵への復帰を確認する。確認画像は `preview.png`・`codex-mobile.png`・`board-mobile.png`・`battle-mobile.png`。

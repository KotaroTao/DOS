# 灰の降る祭場の未作成の魔物

森の小屋の3体（`docs/art/prologue-enemies/preview.png`）の暗い輪郭、左上の光、控えめな色を基準に、図鑑の説明・伝承・特徴を参照して未作成の6体を制作した。透過・ロスレスWebP。能力・技・出現条件・伝承は変更しない。

| ID | 魔物 | 絵へ反映した特徴 |
| --- | --- | --- |
| bs_demon | 獄炎のデーモン | 山羊の角、皮膜の翼、赤銅の肌、加護を剥ぐ呪いの輪 |
| bs_pyrelich | 業火の祭司 | 高い冠帽、乾いた骨、杖の火皿 |
| bs_brimstonegolem | 硫黄の鋳像 | 角張った硫黄結晶の殻、肩の煙突、黄緑の煙 |
| bs_shadowogre | 煤の大鬼 | すすけた肌、突き出た腹、鉄のシャベル、魂を詰めた網袋 |
| bs_darkliege | 祭場の黒騎士 | 黒鉄の重鎧、頭上の大剣、兜の奥の残り火 |
| bs_flamedrake | 炎の幼竜 | 後ろ脚で立つ若い竜、業炎のブレス |

最新mainで作成済みの灰かぶりの信徒・燃え殻の亡霊・硫黄の鬼・残り火の王・召喚先の火の粉の蟲群と、ミミック・マスターミミック・金属の魔物3種は既存WebPを共用し、変更していない。祭場に主は設定されていない。

原画は `sheet-a.png` と `sheet-b.png`。制作中の原画には作成済みの姿も含むが、道具は今回の6体だけを書き出す。輪郭の連結成分と最寄りの本体を使い、翼や小道具を格子で切断せずに分離する。

再生成: `python3 tools/ash-altar/build-enemies.py`（Pillow・NumPy・SciPy）。`src/monsterphotos.js` と `sw.js` へ登録する。`dos-dev` は維持。

確認: HTTPサーバーを8000番で起動して `node tools/ash-altar/verify-enemies.cjs`。通常敵・強敵・召喚先・共通敵の登録の網羅、6体の非空の戦闘画像、能力値の維持、全画像の取得失敗時の旧絵への切り替えを確認する。

確認画像: [一覧](preview.png)、[図鑑](codex-mobile.png)、[盤面](board-mobile.png)、[戦闘](battle-mobile.png)。絵の追加のみで新機能・仕様変更はないため、酒場の話の更新対象はない。

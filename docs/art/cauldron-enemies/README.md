# 魂を煮る釜場の未作成の魔物

森の古屋の3体（`docs/art/prologue-enemies/preview.png` 上段）の暗い輪郭・左上の光・控えめな色とドットの質感を基準に、図鑑の説明・伝承に合わせて未作成の4体を制作。出荷画像は透過・ロスレスWebP。

| ID | 魔物 | 絵へ反映した特徴 |
| --- | --- | --- |
| bs_furnacefiend | 溶鉱の鬼神 | 腹の格子と白く燃える炉、両腕の大槌 |
| bs_obsidianguard | 黒曜の番兵 | 鏡のような黒曜石の面、身の丈ほどの大盾 |
| bs_basaltdrake | 玄武岩の竜 | 翼のない重い体、背の玄武岩の柱、灰白の眼 |
| bs_infernaltyrant | 獄炎の暴君 | 角の冠、黒い肌の溶岩の血管、両腕の上の業火の大玉 |

作成済みの溶岩のゴーレム・溶岩の粘塊・硫黄の鋳像・溶岩のエイ・溶岩の顎・強敵の溶鉄の蛇竜と、ミミック・マスターミミック・金属の魔物3種は既存WebPを共用。釜場に主・召喚先の設定はない。説明・伝承・能力・技・出現条件は維持。絵の追加だけのため酒場の話の更新は対象外。

原画は `master.png`（左上から表の順に2×2）。輪郭の連結成分で分離し、大槌や尾を格子で切断しない。再変換と登録: `python3 tools/cauldron/build-enemies.py`（Pillow・NumPy・SciPy）。`src/monsterphotos.js` と `sw.js` に登録し、`dos-dev` は維持する。

HTTPサーバーを8000番で起動し、`node tools/cauldron/verify-enemies.cjs` で対象全種の登録、4体の非空の戦闘画像、能力の維持、画像取得失敗時の既存絵への切り替えを検証。確認画像は `preview.png`・`codex-mobile.png`・`board-mobile.png`・`battle-mobile.png`。

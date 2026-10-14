# 第五〜七章の迷宮情景5枚

## 制作前の確認

mainの原画・WebP、対象ファイルのGit履歴、関連PR、制作待ち台帳を確認した。既存の `w18_blade`、`w24_aurora`、`mem_w25`、`w26_splint`、`w27_crest` は人物の登場する物語の挿絵で、今回の5迷宮の専用由来原画 `lore_*` は見つからなかった。既存の挿絵は保持し、画風と小道具の参照にして専用情景を新規制作した。

各迷宮の `node tools/storyart/prompt.mjs lore_<ID>` の本文・制作指示に沿い、原画1536×1024を画像生成で制作。第五章より先の秘密を地割れに描かず、第六章・第七章も各章の由来だけを描く。

| 迷宮 | 主題と参照 | 原画 | 出撃の確認 | 由来の確認 |
|---|---|---|---|---|
| w18 火を噴く地割れ | 火を隠す鉄扉、こじ開けた傷、折れた根切り刃。参照: `chapter5/w18_blade.png` | [原画](../lore_w18.png) | [スマホ](w18-departure-mobile.png)・[PC](w18-departure-desktop.png) | [表示](w18-lore-mobile.png) |
| w24 極光の氷窟 | 氷内の魂の極光、古い金貨、風が掘った天然の洞。参照: `chapter6/w24_aurora.png` | [原画](../lore_w24.png) | [スマホ](w24-departure-mobile.png)・[PC](w24-departure-desktop.png) | [表示](w24-lore-mobile.png) |
| w25 凍てつく大回廊 | 奈落をめぐる氷の道、空の玉座、解けた堤から流れ落ちる水。参照: `chapter6/mem_w25.png` | [原画](../lore_w25.png) | [スマホ](w25-departure-mobile.png)・[PC](w25-departure-desktop.png) | [表示](w25-lore-mobile.png) |
| w26 腐れ水の岸 | 滝、黒い泥、流れ着いた靴・手紙・木の腕、まだ光る魂。参照: `chapter7/w26_splint.png` | [原画](../lore_w26.png) | [スマホ](w26-departure-mobile.png)・[PC](w26-departure-desktop.png) | [表示](w26-lore-mobile.png) |
| w27 器の捨て場 | 未完成の木の器の山、異なる胸扉と継ぎ目、空の胸を持って起き上がる器。参照: `chapter7/w27_crest.png`・`docs/art/story-refs/dolls.png` | [原画](../lore_w27.png) | [スマホ](w27-departure-mobile.png)・[PC](w27-departure-desktop.png) | [表示](w27-lore-mobile.png) |

原画はすべて1回の生成で完成。参照の人物・隊は入れず、迷宮の情景として構図を変えた。WebPは `python3 tools/storyart/build.py` により品質88で変換し、5枚で約2.33MiB。由来の台帳、SW、[本文との比較](../../review/dungeons.md)、[縮小の見本](../../review/dungeons-small.jpg)も同じ道具で生成した。

出撃画面は今回の5迷宮を既存の狼煙台と同じWebP表示へ追加。取得失敗時はその迷宮の既存情景へ戻る。

検証: 原画・WebP・登録の整合、指示書と本文、読み物の解放・状態保全、オープニングの既存登録、変更JSの構文、差分の空白。Chromiumで5迷宮すべての幅390/1280pxの出撃表示、由来の詳細画面、先読み登録、画像取得失敗時の旧描画を確認。実行時エラーなし。

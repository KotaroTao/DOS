# 毒霧の葦原と第九章の迷宮情景5枚

制作前にmainの原画・WebP、対象ファイルの履歴、関連PR、由来制作のブランチを確認した。盤面素材や人物の登場する物語の挿絵は存在するが、今回の5迷宮の専用由来原画 `lore_*` は見つからなかった。

各迷宮の `node tools/storyart/prompt.mjs lore_<ID>` の本文・制作指示に沿って1536×1024の原画を画像生成で制作。既存の絵を材料・建築の参照に使い、物語の主人公と隊は入れず、情景の構図を新しくした。

| 迷宮 | 主題・参照 | 原画 | 出撃表示 | 由来表示 |
|---|---|---|---|---|
| w28 毒霧の葦原 | 背丈を越える葦、葉先の毒霧、中が空の茎、霧に隠れた這うもの。参照: `chapter7/w28_note.png` | [原画](../lore_w28.png) | [スマホ](w28-departure-mobile.png)・[PC](w28-departure-desktop.png) | [詳細](w28-lore-mobile.png) |
| w34 雲を渡る石橋 | 二本のわだち、枷の鉄輪、関所の跡、帰り道の減らない石。参照: `chapter9/w34_glove.png` | [原画](../lore_w34.png) | [スマホ](w34-departure-mobile.png)・[PC](w34-departure-desktop.png) | [詳細](w34-lore-mobile.png) |
| w35 闘獣の檻 | 内側から破られた檻、餌の記録、空の餌皿、世話人の寝床、出口を探す獣。参照: `chapter9/w35_lamps.png` | [原画](../lore_w35.png) | [スマホ](w35-departure-mobile.png)・[PC](w35-departure-desktop.png) | [詳細](w35-lore-mobile.png) |
| w36 亡き観客の階段席 | 灰の石段、肩を寄せる透けた観客、上下の席の違い。参照: `chapter9/ch9_end.png` | [原画](../lore_w36.png) | [スマホ](w36-departure-mobile.png)・[PC](w36-departure-desktop.png) | [詳細](w36-lore-mobile.png) |
| w37 血の砂の闘技場 | 乾かない血の砂、剣を構える闘士、遠い貴賓席の金の仮面。参照: `chapter9/ch9_end.png` | [原画](../lore_w37.png) | [スマホ](w37-departure-mobile.png)・[PC](w37-departure-desktop.png) | [詳細](w37-lore-mobile.png) |

第九章の外景は「百年目の青空」以降の正典に従い、古い参照画像の曇天を引き継がず、明るい青空と白い雲海にした。檻は地下のため天井の格子から昼の光を入れた。闘技場は終わらない試合の時点を描き、章の終わりの大穴と縄は描かない。葦原は第七章の地底の毒沼として描く。

原画は各1回の生成で完成。`python3 tools/storyart/build.py` で品質88のWebP、由来の台帳、SW、[本文との比較](../../review/dungeons.md)、[縮小の見本](../../review/dungeons-small.jpg)を生成した。出撃画面もこの5迷宮をWebP表示へ追加し、取得失敗時はその迷宮の従来の情景へ戻る。

確認: 原画・WebP・登録の整合、指示書と本文、読み物の解放・状態保全、変更JSの構文、差分の空白。Chromiumで5迷宮すべての幅390/1280pxの出撃表示、由来の詳細画面、先読み登録、画像取得失敗時の旧描画を確認。実行時エラーなし。

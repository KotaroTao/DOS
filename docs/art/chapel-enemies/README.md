# 沈んだ礼拝堂の敵イラスト

森の小屋の3体（`../prologue-enemies/preview.png` 上段）の暗い輪郭・左上の光・細かなドット調を基準に、図鑑の説明・伝承・能力を参照して制作した透過原画。出荷物はロスレスWebP 11枚。

| ID | 魔物 | 反映した特徴 |
| --- | --- | --- |
| bs_sludgeooze | 汚泥の塊 | 核を持たず寄り集まる毒の泥 |
| bs_waterelemental | 水の精霊 | 祈る人の形を覚えた流れる水 |
| bs_sewerdredger | 溝さらいの骸 | 人夫の作業着、骨、さびたかぎ竿 |
| bs_brinewraith | 塩水の亡霊 | 朽ちた水夫の服、半透明の体 |
| bs_waterhag | 水路の妖婆 | 藻の髪、濁った目、洗い物をする手 |
| bs_eelfiend | 噛みつき大ウナギ | 素早く曲がる体、帯電した牙 |
| bs_anglerfiend | 提灯アンコウ | 魂火をまねた青白い誘い灯、巨大な口 |
| d03_sahagin | 深淵のサハギン | 退化した目、骨のもり、魚のひれ |
| bs_abysstentacle | 深淵の触手 | 水底から伸びる太い腕と吸盤 |
| el_drownedpaladin | 沈みし聖騎士 | さびた重鎧、黒い水、曲げた膝 |
| bs_sewerlord | 水路の主 | 巨大な両生の体、厚い粘膜、汚泥 |

通常敵9種・強敵・主を網羅。主の召喚先は汚泥の塊、宝箱のミミックは既存WebPを共用する。第2層では金属の魔物とマスターミミックは出ない。同じIDを使う他の迷宮でも絵が変わる。

原画: [master.png](master.png)。`python3 tools/chapel/build-enemies.py` でつながった輪郭を分離し、薄い透過ノイズを取り除いて余白付きWebPへ変換する（Pillow・NumPy・SciPy）。登録先は `src/monsterphotos.js` と `sw.js`。能力・技・伝承・出現条件は維持。画像の取得失敗時は従来の絵を表示する。機能やルールの変更はないため酒場の心得に変更なし。

HTTPサーバーをポート8000で起動し、`node tools/chapel/verify-enemies.cjs` で確認（Playwright・Chromium）。対象12体の登録、戦闘画像が空でないこと、既存の定義が変わらないこと、全画像の取得失敗時の起動、ブラウザ例外なしを検査する。保存なしのテストモードを使用。

確認画像: [一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

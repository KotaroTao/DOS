# 捨て砦の本丸の敵イラスト

森の小屋の3体（`docs/art/prologue-enemies/preview.png` の上段）を画風の基準に、図鑑の説明・伝承・能力を参照して制作。最新のmainで作成済みの画像は再制作せず、未作成の6体を透過・ロスレスWebPで追加した。

| ID | 魔物 | 絵に反映した特徴 |
| --- | --- | --- |
| bs_dullahan | デュラハン | 首のない黒鎧、小脇に抱えた己の首、首筋を狙う剣 |
| bs_shadowmage | 影の術師 | 肉体を失った影、破れたローブ、呼び出す闇の手下 |
| bs_vampire | ヴァンパイア | 夜の貴族の衣、牙、命の記憶を奪う血の流れ |
| bs_bloodwraith | 血霊 | 石畳の血から立ち上がる霊、体へ集まる血の流れ |
| bs_fortlord | 砦の主 | 厚い古鎧、さびた大剣、退却を待つ将の指揮の手 |
| d03_ghost | さまよう亡霊 | 冷たい指、あばら、体温と魂を奪う青白い霊 |

影の術師の召喚先も対象。砦の主が呼ぶ無人の鎧、通常敵のほか8種、強敵2種、ミミック2種、金属の魔物3種、出来事の籠牢の看守は既存原画を共用する。能力・技・伝承・出現条件は変更しない。画像追加のみのため酒場の話は変更しない。

原画は `sheet.png`。再変換は `python3 tools/honmaru/build-enemies.py`。輪郭を分離し、透過の余白を付けて最大520pxのWebPにする。登録は `src/monsterphotos.js` と `sw.js`（CACHEは変更しない）。

HTTPサーバーをポート8000で起動し、`node tools/honmaru/verify-enemies.cjs` で対象22体の登録・非空の戦闘描画・能力等の維持・取得失敗時の旧絵を確認する。確認画像は `preview.png`、`codex-mobile.png`、`board-mobile.png`、`battle-mobile.png`。

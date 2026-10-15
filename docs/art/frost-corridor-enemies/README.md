# 第六章「氷結回廊」の敵イラスト

森の小屋の「ほこりゴキブリ」「枯葉ムカデ」「森の小蜂」の原画を直接参照し、左上からの光・暗い輪郭・細かなドットの質感を合わせた。章の氷と魂には、青灰色と白を中心に控えめな緑・紫を添えた。

第8層の本筋4迷宮（w22〜w25）と寄り道2迷宮（ws11・ws12）を照合し、未作成の通常敵20種と主1種を制作。強敵「凍王の影」「氷河の大顎」、宝箱のミミック類は作成済みのWebPを共用する。召喚先の氷霊・凍てつく先人も今回の対象に含む。

| ID | 魔物 | 図鑑から反映した特徴 |
| --- | --- | --- |
| bs_frostwolf | 白霜の狼 | 痩せた体、霜の白毛、上を見上げる姿 |
| bs_winterbat | 霜羽の蝙蝠 | 霜の結晶が付いた皮膜、眠りの粉雪 |
| bs_icewraith | 氷霊 | 下半身が氷柱に埋まり、魂の光へ伸ばす腕 |
| bs_blizzardspirit | 吹雪の精 | 仮面の顔、上向きの風の渦、頭上の氷晶の輪 |
| bs_iceserpent | 氷の大蛇 | 霜の鱗、とぐろ、冷気の牙 |
| bs_glacialcrab | 氷殻の大蟹 | 氷河の甲羅、盾のような巨大なはさみ |
| bs_snowstalker | 雪渡りの獣 | 長い白毛、頭上で組んだ太い両腕 |
| bs_rimecrawler | 霜甲の蟲 | 丸い節、鏡の氷殻、封じの紋、大顎 |
| bs_frozenexplorer | 凍てつく先人 | 氷漬けの操霊師、手首のかせ、伸ばす腕 |
| bs_snowmantis | 霜の大カマキリ | 白い霜、二本の氷の鎌 |
| bs_aurorawisp | 極光の群火 | 緑と紫に揺れる、群れをなす魂の火 |
| bs_iciclehorror | 氷柱の魔 | 多眼の氷塊、触手のように曲がる氷柱 |
| bs_frostknight | 凍れる騎士 | 空の近衛の鎧、兜の青い光、両手の長い氷剣 |
| bs_frostlich | 氷結の死霊術師 | 骸の術師、魂を捕らえた鳥かご型の灯籠 |
| bs_frostmaiden | 氷の乙女 | 閉じた目、歌う口、胸で組む手、癒しの雪 |
| bs_icegolem | 氷塊のゴーレム | 重なる厚い氷板、胸の魂の核 |
| bs_frozenangel | 氷漬けの堕天 | 氷柱にはりつけられた翼ある像、落ちる氷の羽根 |
| bs_frostwyrm | 氷牙の蛇竜 | 長い蛇身、背の氷のとげ、凍てつく息 |
| bs_rimegiant | 氷河の巨人 | 灰青の肌、頭上に担ぐ氷棚の塊 |
| bs_frostfiend | 氷の悪鬼 | 透けた氷の体、胸の魂、両手の凍える霧 |
| bs_glaciallord | 氷結回廊の主 | 氷の玉座と冠、長いひげ、毛皮の法衣、杖、ひざまずく先人 |

図鑑の説明・伝承の制作時点の控えは `brief.json`。原画は `sheet-a.png`〜`sheet-d.png`、出荷物は `art/monsters/<ID>.webp`。原画・確認画像は公開対象外のこのフォルダに置く。

再変換：`python3 tools/frost-corridor/build-enemies.py`（Pillow・NumPy・SciPy）。つながった輪郭を格子で切らずに分離し、離れた炎や氷片も同じ枠の魔物へまとめる。最大512pxに収め、透過余白を加え、減色せずロスレスWebPへ変換する。`src/monsterphotos.js` と `sw.js` へ登録し、従来の絵と能力値・出現表・説明・伝承は保持する。仕様の変更がないため、酒場の話の変更はない。

確認：ローカルHTTPサーバーを8000番で起動し、`node tools/frost-corridor/verify-enemies.cjs`。全6迷宮・強敵・召喚先・ミミック類の登録、21種の戦闘画像、取得失敗時の従来の絵を確認する。確認画像は `preview.png`・`codex-mobile.png`・`board-mobile.png`・`battle-mobile.png`。

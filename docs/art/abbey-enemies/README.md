# 朽ちた骸の修道院の魔物

森の小屋の3体（`docs/art/prologue-enemies/preview.png`）と既存の地下墓地の透過原画を参照。左上の光、暗い陰影、黄褐色・青灰色の控えめな色で統一し、図鑑の説明・伝承に合わせて未作成の12種を制作した。

| ID | 魔物 | 図鑑から反映した特徴 |
| --- | --- | --- |
| bs_zombie | 腐乱死体 | 腐った腕、毒の爪、埋葬の布 |
| bs_weepangel | すすり泣く墓像 | 両手で顔を覆う翼ある石像 |
| bs_tombwarden | 墓守の重骸 | 仲間をかばう分厚いさびた具足 |
| bs_shroudstrangler | 死に装束の絞め手 | 中身のない装束と巻きつく布 |
| bs_pettyrevenant | 浅き怨霊 | 人の形が残る顔、燃える怒り |
| bs_sarcoguard | 石棺の番人 | 石棺の蓋に彫られた腕を組む守護者 |
| bs_ghoul | 喰屍鬼 | やせた体、長い爪、飢えた姿 |
| bs_skullswarm | ドクロの群れ | 宙に浮き、顎を開く五つのどくろ |
| d02_soldier | 朽ちた兵士 | さびた具足と構えた剣 |
| bs_bonechanter | 白骨の唱導師 | 祈りの書、唱える骸の司祭 |
| bs_gravecaller | 墓呼びの語り部 | 土の下へささやき、呼び寄せる亡霊 |
| bs_cryptabbot | 骸の修道院長 | 祈る骸、古い法衣、返事のない手紙の束 |

通常敵12種・強敵1種・主1種と宝箱のミミックが対象。`d01_skeleton`・`el_cryptlord`・`mimic` は既存のWebPを共用する。召喚先もこの一覧に含まれる。同じIDの敵は他の迷宮でも同じ原画になる。

原画は `master.png`。再変換は `python3 tools/abbey/build-enemies.py`（Pillow・NumPy・SciPyが必要）。布や霧が格子を越えるため、つながった輪郭で12体を分離し、小さな破片は近くの輪郭へ割り当て、透過の余白を付けてロスレスWebPを保存する。原画を減色せず既存のphoto描画で表示する。出荷先は `art/monsters/`、登録先は `src/monsterphotos.js` と `sw.js`。能力・技・伝承・出現表の変更はないため、酒場の話の変更もない。

## 確認

ローカルHTTPサーバーを8000番で起動し、`node tools/abbey/verify-enemies.cjs` を実行（Playwright・Chromiumが必要）。保存なしのテストプレイで以下を確認済み。

- 出現表・主・強敵・召喚先・ミミックの全15種を網羅。
- 原画の登録、非空の戦闘ビットマップ、既存定義が変化しないこと。
- 全WebPの取得失敗時も従来の絵で起動し、ブラウザー例外がないこと。
- 図鑑・盤面・戦闘の携帯画面を保存。`codex-mobile.png`・`board-mobile.png`・`battle-mobile.png`。
- 変更したJavaScriptの構文・伝承304体の検査に合格。

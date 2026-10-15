# 業火の大釜の敵イラスト

森の古屋の塵の虫・小ムカデ・木蜂の原画3枚を画風の基準に、図鑑の説明と伝承に合わせて制作。

| ID | 名前 | 反映した設定 |
|---|---|---|
| bs_doombringer | 釜底の古竜 | 翼を失った巨体、翼の焼け跡、低い姿勢、胸の裂け目に溜める業火 |
| bs_infernolord | 業火の主 | 巨大な角、広げた両腕、吐く業炎、三百年にわたり守る魂の大釜 |

通常敵12種・主1種・強敵2種・共通敵5種・召喚先2種の計22種を確認。未作成の2種だけを追加し、ほか20種の絵・能力・本文・出現条件は維持。

原画は `master.png`。透過の連結成分で個体を切り出し、長辺512pxに縮小、外周4pxを足して可逆WebPへ保存する。寸法は `dimensions.json`。

- 再変換・登録: `python3 tools/inferno-cauldron/build-enemies.py`
- HTTPサーバー起動後の検証: `node tools/inferno-cauldron/verify-enemies.cjs`
- 確認画像: `preview.png`、`codex-mobile.png`、`board-mobile.png`、`battle-mobile.png`

画像差し替えのみのため、酒場の心得の変更はなし。

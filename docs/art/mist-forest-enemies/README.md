# 地の底の霧森の魔物

森の小屋の3体（`docs/art/prologue-enemies/preview.png`）を画風の基準に、図鑑の説明・伝承・能力を参照して制作。暗い輪郭、左上の光、控えめな土色・苔色・青灰色で統一した透過原画。ゲーム用はロスレスWebP11枚。

| ID | 魔物 | 絵に反映した特徴 |
| --- | --- | --- |
| bs_dryadfey | 森の妖魔 | 木の体、招く指、歌と癒しの灯 |
| bs_wisplure | 惑わしの群火 | 顔を持つ青い鬼火が渦を巻く群れ |
| bs_thornhound | 茨の猟犬 | 痩せた猟犬の体に絡む茨 |
| bs_direboar | 牙の大猪 | 巨体、反る牙、血走った目 |
| bs_chimera | キマイラ | 一つの体に獅子・山羊・蛇の三つの首、炎 |
| bs_thunderbird | 雷鳥 | 暗い翼の縁から走る稲妻 |
| bs_fogpanther | 霧豹 | 霧に溶ける後ろ半身、忍び寄る姿 |
| bs_corruptstag | 角の魔獣 | 汚れた白い毛、ねじれた角、血走った目 |
| bs_satyrpiper | 角笛の森人 | 山羊の脚、跳ねながら吹く角笛 |
| el_mistmother | 霧の繭母 | 白い大蜘蛛、牙から垂れる糸、繭の房 |
| bs_giantmoth | 鱗粉の大蛾 | 大きな模様の羽、金色の眠りの粉 |

通常敵9種、強敵1種、召喚先1種を新規制作。霧森に主はいない。ミミック、マスターミミック、檻番の獄卒、銀業・金業・銀業の王の6種は既存WebPを共用し、計17種を確認した。同じIDを使う別の迷宮にも反映される。

原画は [master.png](master.png)。`python3 tools/mist-forest/build-enemies.py` で輪郭と離れた粒・繭の所属を保って個別の透過WebPに変換する（Pillow・NumPy・SciPy）。出荷先は `art/monsters/`、寸法登録は `src/monsterphotos.js`、配信登録は `sw.js`。能力・技・伝承・出現条件は変えない。新機能や戦闘ルールの変更はないため酒場の心得の変更はない。

## 確認

ローカルHTTPサーバーを8000番で起動し、`node tools/mist-forest/verify-enemies.cjs` を実行（Playwright・Chromium）。保存なしのテストモードで次を確認する。

- 出現表・強敵・召喚先・共通の敵17種に登録漏れがなく、戦闘用画像が空でない。
- 画像読み込みによって既存の能力・技・伝承が変化しない。
- 全画像の取得失敗時も、17種すべて旧絵で起動する。
- 図鑑・盤面・戦闘が表示でき、ブラウザー例外がない。

確認画像: [一覧](preview.png)、[図鑑](codex-mobile.png)、[盤面](board-mobile.png)、[戦闘](battle-mobile.png)。

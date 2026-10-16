# 沈める大神殿の魔物

森の小屋の3体（`docs/art/prologue-enemies/bs_dustroach.png`、`bs_littlecentipede.png`、`bs_woodbee.png`）を直接参照し、暗い輪郭、左上の光、細かな段のある筆致、控えめな骨色・金色と青灰色の陰影をそろえた。図鑑の説明・能力と伝承（`src/dungeons/bestiary.js`・`monlore.js`）に合わせて制作。

| ID | 魔物 | 図鑑から反映した特徴 |
| --- | --- | --- |
| bs_divinegolem | 神のくぐつ | 白い石と金の長身、顔のない頭の一眼、裁かれた石像をかける天秤 |
| bs_fallenangel | 堕天使 | 水を吸った重い翼、顔を伏せる濡れ髪、祈る手と逆さの細剣 |
| bs_templelord | 沈める神官王 | 玉座を離れない王、王冠と司教冠の融合、民の名を唱える口、腰までの渦潮 |

通常敵12種・強敵2種・主1種、召喚先と共通敵を合わせた21種を確認。最新mainで作成済みの虚無の歩者を含め、ほか18種の原画は共用し、上記3種だけを追加した。原画は `master.png`。出荷物は `art/monsters/<ID>.webp` の透過ロスレスWebP、3枚合計約650KiB。原画・確認用画像は公開対象外のこのフォルダへ保存。

```sh
python3 tools/sunken-temple/build-enemies.py
python3 -m http.server 8000
node tools/sunken-temple/verify-enemies.cjs
```

変換は透明な余白をたどって3体を分離し、輪郭を横切る場合は停止する。各画像を長辺512px以内に縮小して4pxの透明余白を付け、寸法台帳とSW配信一覧へ登録する。PillowとNodeが必要。

保存なしのブラウザ検証で21種の登録・実画像と戦闘画像の非空・能力等の維持・取得失敗時の旧絵を確認。携帯幅の図鑑・盤面・戦闘を確認し、ブラウザ例外なし。JS構文、伝承304体、物語画像の整合性も確認。能力・本文・出現条件・セーブ形式は変更せず、仕様変更がないため酒場の心得は変更していない。

[実描画一覧](preview.png)・[神官王の図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)

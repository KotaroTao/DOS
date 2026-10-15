# 第九章「闘技場跡」の魔物

森の小屋の3体（ほこりゴキブリ・枯葉ムカデ・森の小蜂）の原画と比較見本を画風の基準に、図鑑の説明・伝承・能力を参照して未作成21体を制作。左上の光、暗い輪郭、さびた鉄・灰・くすんだ布の色をそろえた透過原画。

本筋 w34〜w37、寄り道 ws18・ws19 が対象。通常敵20体と主1体を追加し、灰燼の将・竜殺しの亡霊、ミミック2種、金属の魔物3種は作成済みのWebPを共用する。召喚先の闘犬・亡霊剣闘士も今回の絵を使う。敵ID・能力・説明・伝承・出現条件は変更しない。

## 対象

| ID | 魔物 |
| --- | --- |
| bs_championwraith | 不滅の闘士 |
| bs_netfighter | 網ともりの闘士 |
| bs_arenabeast | 闘獣 |
| bs_spectreaudience | 亡き観客 |
| bs_chainedogre | 鎖の巨闘士 |
| bs_bladedancer | 双刃の舞い手 |
| bs_executioner | 処刑人 |
| bs_beastmaster | 猛獣使いの亡霊 |
| bs_mirrorduelist | 鏡写しの決闘者 |
| bs_crowdroar | 歓声の渦 |
| bs_sandlurker | 砂中の顎 |
| bs_gladiatorlich | 闘技場の死霊術師 |
| bs_spikedgolem | 鉄刺の像 |
| bs_hookmaster | かぎ縄の使い手 |
| bs_bloodpriest | 血の司祭 |
| bs_warbeasthound | 闘犬 |
| bs_championofash | 灰の覇者 |
| bs_impaler | 串刺しの槍士 |
| bs_ghostgladiator | 亡霊剣闘士 |
| bs_chaingang | 鎖の囚徒 |
| bs_arenalord | 闘技場の支配者 |

図鑑の参照本文は [brief.json](brief.json)、対象一覧は [roster.json](roster.json)。灯籠のガラス片、胸の小さな灯、杯、足首の鈴、勝ち星を刻む槍、鎖につながれた囚徒、背の灯の輪などを描き分けた。

## 再変換・検証

原画は sheet-a〜d.png。Pillow・NumPy・SciPyを用い、輪郭の連結成分と最寄りの本体で武器・鎖・霊のかけらを分け、長辺512px以内へ縮小して透過余白を追加。

`python3 tools/arena/build-enemies.py` でロスレスWebP、寸法一覧、monsterphotos.js と sw.js の登録を再生成する。既存の共通表示で戦闘・盤面・図鑑へ反映する。新たなゲーム仕様がないため、酒場の話は変更しない。

ローカルHTTPサーバーを8000番で起動し、`node tools/arena/verify-enemies.cjs` を実行。6迷宮の対象と召喚先の網羅、原画の読み込み、空でない戦闘絵、能力・文字グリッドの維持、取得失敗時の旧絵、ブラウザ例外を確認する。

[ゲーム内一覧](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。出荷物は art/monsters/ のWebPのみ。原画・記録・確認画像は公開対象外。

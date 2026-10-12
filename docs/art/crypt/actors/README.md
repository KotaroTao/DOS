# 地下墓地の人物・小物 — 手順3

忘れられた地下墓地（w01、B1F〜B5F）の人物と小物を、床・墓石・壁に合う高解像度の絵へ更新する。

[素材と装いの一覧](review/gallery.png) · [スマホ画面](review/after-mobile.png) · [初期配置](review/initial-mobile.png) · [検査結果](review/checks.json)

| 変更前 | 変更後 |
|---|---|
| ![変更前](review/before-board.png) | ![変更後](review/after-board.png) |

比較は同じ種の盤面に小物を配置した確認用画面。初期配置は別に記録した。

## 原画と出荷物

透過PNGを画像生成で描き下ろし、WebPへ変換する。原画と確認画像は公開配置から除外する。

- `props-a-master.png`（1536×1024）: 閉じた宝箱、開いた空箱、下り階段、泉、遺体、帰還の印。
- `props-b-master.png`（1536×1024）: 罠、祭壇、手帳、主の扉、魂火、角灯。手帳は未使用。師の手がかりには角灯を使い、窓の火だけ青緑へ着色する。
- `walker-master.png`（1254×1254）: 下・上・左・右を向く探索者。暗いフード、金の縁取り、革の装具、角灯を共通に描く。
- 出荷物: `art/dungeon/crypt-props-a.webp`・`crypt-props-b.webp`・`crypt-walker.webp`、合計約1.1MiB。

切り出し範囲は `src/cryptactors.js` の `CRYPT_PROP_FRAMES` と方向別の枠で管理する。固定の等分割ではなく、実際の透過境界に合わせる。

## 描画と状態

画像は独立して読み込む。未到着・取得失敗・寸法不正の素材は従来のスプライトで描き、他の素材の表示を妨げない。

外套7色と縁取り4色は元の陰影を残して着色する。角灯と透過は保持し、装いのキャッシュは3組まで。4方向、移動の揺れ、浮遊と足元の影を維持し、同じマスの小物が見えるよう人物の位置と大きさを調整する。

宝箱は開封後に空箱になる。遺体は残り、魂を持ち帰るまでは魂火を添える。泉は飲んだ後も空の鉢として残る。罠・出来事・手がかりは既存の解決状態に従う。階段・帰還の印・主の扉も既存の条件で選ぶ。未発見の内容は描かず、魔物・セーブ形式・遊びの乱数は変更しない。死体・泉は全迷宮で状態を描き分ける。

## 再変換と確認

```bash
bash tools/crypt/build-actors.sh
python3 -m http.server 8000
# 別の端末で実行（PlaywrightとChromiumが必要）。
node tools/crypt/verify-actors.cjs
```

Playwrightが別の場所にある場合は `NODE_PATH` を指定する。確認用の状態アクセスは検査時の配信にだけ追加し、ゲームには出荷しない。

確認対象: 読込遅延・全画像失敗・一部失敗、未発見と解決済みの状態、外套と縁取り28組、透過と角灯の保持、4方向のタップ移動、ドラッグ・全体表示・浮遊・小物との同居、幅320/390/600/1280px、他の迷宮、遊びの乱数とキャッシュ上限。ローカルChromiumでの検査であり、実機の速度測定ではない。


## 死体の種類・空の泉・ポップアップの統一

[現在の14種一覧](states-review/popup-gallery.png) · [盤面](states-review/board.png) · [偉大なる死体の選択画面](states-review/corpseGreat-popup.png) · [検査結果](states-review/checks.json)

追加原画 `props-c-master.png`（1536×1024、透過PNG）は、顔をフードで隠し、片腕を投げ出して力尽きた冒険者・偉大なる鎧の人物・乾いた泉・風化した骨を別々に描いた。元の素材集を参照して画像生成し、`crypt-props-c.webp`（約337KiB）として出荷する。手順3当初の比較画像は以前の記録として保持する。

- 死体は `corpseGreat` を優先し、次に `corpseWarm`、どちらもなければ風化した死体を描く。回収・調査後も同じ姿が残り、魂火だけが消える。全長は探索者の身長と同じ基準を維持する。
- 泉は `cleared` で空の鉢へ切り替える。再度飲めず、オート移動の未解決対象にも戻らない。回復量・呪い・使用回数は変更しない。
- 共通のスプライト差し替え口で、作成済み14種のポップアップ・通知・行動ボタンを盤面と同じ切り出しに統一する。元の装備用の差し替えも維持する。画像到着後は開いているポップアップも更新され、取得失敗時は旧絵を表示する。

| 場所・種類 | 現在の対応 |
|---|---|
| 地下墓地の人物、宝箱開閉、階段、主の扉、帰還陣、罠、出来事、師の角灯、魂火 | 高解像度素材 |
| 全迷宮の死体3種類、泉・空の泉 | 高解像度素材、状態差分あり |
| 上記小物14種のポップアップ・通知 | 高解像度素材に統一 |
| 他迷宮の床・壁・人物、死体・泉以外の盤面小物 | 地下墓地用素材の展開は未対応 |
| 魂の残火・金貨・危険表示・守衛・入口 | 汎用5種も高解像度化済み（下記） |
| 魔物 | 今回の高解像度小物素材への置き換え対象外 |

```bash
node tools/crypt/verify-states.cjs
# 従来の操作・装いの確認画像を一時フォルダへ出す場合
CRYPT_REVIEW_OUT=/tmp/crypt-actors-review node tools/crypt/verify-actors.cjs
```

あたたかい死体は、眠っているような仰向け・組んだ手の姿を改め、顔の見えないフードと崩れた姿勢、折れた短剣で探索中の死を示す。変更前の原画は `fixes/props-c-before-hidden-face.png` に保持。


## 汎用アイコンと魂火の中央配置

[汎用5種と小さい通貨表示](common-review/common-gallery.png) · [遺体中央の魂火](common-review/soul-centered.png) · [魂の残火のポップアップ](common-review/ember-popup.png) · [検査結果](common-review/checks.json)

`props-d-master.png`（1536×1024、透過PNG）は、既存の質感を参照して画像生成した魂の残火・金貨・危険印・守衛・入口の旗の原画。出荷は `crypt-props-d.webp`（約339KiB）。残火は青い魂火と区別できる橙色の炎と燃える欠片、金貨は古い金貨の山、危険印は毒・熱・雷などに共通で使える三角の警告板として描く。守衛は顔の隠れた兜と槍・盾、入口は塔の紋のある赤い旗を維持する。

通知・ポップアップの共通差し替えに5種を追加し、合計19種を原画化。小さな残火と金貨の表示も同じ原画から切り出した `crypt-ember.webp`・`crypt-gold.webp` を使う（各6KiB未満、96px以内）。表示枠や数字の間隔は変更しない。いずれも `build-actors.sh` で再生成できる。

死体の魂火は従来の右寄せを取り除き、遺体中央を基準に小さく揺れる。光源も中央へ合わせる。駒と遺体が同じマスにいる時は、遺体を右へ寄せた分だけ魂火と光源も寄せる。大きさは元のまま、動きを減らす設定では中央で静止する。

確認: `node tools/crypt/verify-common.cjs`。通常・同居時の魂火と光源の中央位置、汎用5種類の原画描画、小さい通貨表示、320/390/1280px、遅延・取得失敗時のポップアップ、ゆらめきありの描画を確認する。

## 遺体の壁越え修正

遺体3種を `corpses-seated-master.png` の座り姿へ更新。立っている探索者と同じ体の比率で膝を曲げ、上体を起こしている。左から風化・あたたかい・偉大なる遺体。出荷画像は `art/dungeon/crypt-corpses-seated.webp`。元の `props-c` は空の泉に引き続き使う。

横幅をマスの高さから決める処理をやめ、マス幅の76%（探索者と同居する時は50%）を上限にする。縦横比を変形せず、左右の壁に余白を残す。魂火・回収状態・選択画面の3種の区別は維持する。表示のみの修正のため、酒場の心得の変更はない。

確認: [壁際の盤面](seated-review/board.png) · [選択画面一覧](seated-review/popup-gallery.png) · [検査結果](seated-review/checks.json)。幅320/390/600/1280px、拡大/全体、探索者との同居で、遺体3種の実描画矩形がマス内に収まることを検査した。再確認は `CRYPT_STATES_OUT=docs/art/crypt/actors/seated-review node tools/crypt/verify-states.cjs`。


## プレイヤーと異なる死体の装い

座り姿と壁際の配置を保ち、死体3種からフード・外套・角灯をなくした。

- あたたかい死体: 短い髪、橙色の作業着、白い袖、折れたつるはし。顔はうつむいて隠れる。
- 偉大なる死体: 閉じた筒形の兜、青緑の重装鎧、壊れた丸盾。
- 風化した死体: 露出した頭蓋骨・肋骨・手足と、薄い布の残り。

原画は `corpses-seated-master.png`、出荷物は `crypt-corpses-seated.webp`。変更前は `fixes/corpses-seated-before-distinct-design.png` に保持。切り出し枠を新しい輪郭に合わせ、盤面とポップアップへ共通で反映する。
確認: [盤面](distinct-review/board.png) · [選択画面一覧](distinct-review/popup-gallery.png) · [検査結果](distinct-review/checks.json)。
再確認: `CRYPT_STATES_OUT=docs/art/crypt/actors/distinct-review node tools/crypt/verify-states.cjs`。


## 死を示す姿勢と、同居時の人物サイズ

死体3種を、首が横へ落ち、腕が地面へ垂れる姿に変更した。あたたかい死体は青白い肌と破れた作業着、偉大なる死体は壊れた鎧と外れた兜、風化した死体は崩れた骨で死を表す。前の原画は `fixes/corpses-seated-before-lifeless.png` に保持。原画の隣の手が切り出しに入る箇所だけを描画時に除いている。

宝箱などのマスでもプレイヤーの描画寸法を空のマスとそろえた。原画の人物は左へマス幅の10%だけ寄せ、小物とともに表示する。人業の全身像を使う設定でも同居による高さの縮小を取り除いた。遊びの仕組み・酒場の心得に変更はない。

確認: [空のマス](lifeless-review/walker-empty.png) · [宝箱と同居](lifeless-review/walker-chest.png) · [あたたかい死体](lifeless-review/corpseWarm-popup.png) · [検査結果](lifeless-review/checks.json)。
`CRYPT_STATES_OUT=docs/art/crypt/actors/lifeless-review node tools/crypt/verify-states.cjs` で、幅320/390/600/1280、全4方向、浮遊、拡大/全体、未回収/回収後、小物8種の実描画寸法が一定で左右の壁内に収まることも検査する。


## 職業4系統×3状態の12種類

最新の死体は全種類で顔・髪を布または閉じた兜で隠し、性別を特定できない服装に統一。風化した骨も顔は覆う。力の抜けた首と腕、傷んだ服装・装備で死を示す。

| 系統 | 9職 | 装い |
|---|---|---|
| 戦士 | 戦士・狂戦士・騎士・侍・守護騎士・魔騎士・勇者・修羅・竜騎士 | 壊れた鎧、剣、盾 |
| 聖職者 | 僧侶・司教・聖騎士・聖戦士・神殿騎士・審問官・巡礼者・枢機卿・護教官 | 祭服、聖印、祈祷書 |
| 盗賊・軽装 | 盗賊・義賊・暗殺者・狩人・魔盗賊・武僧・隠修士・修験者・祓魔師 | 革装備、旅装、道具袋 |
| 魔法 | 魔導士・大魔導・魔法剣士・魔闘士・呪術師・護法師・秘術師・死霊術師・賢者 | 魔導衣、魔導書、杖 |

各系統に風化・あたたかい・偉大なる状態を用意。分類は `src/corpseart.js`。保存済みの `corpseClass` から選び、魂の抽選確率・保存形式は変更しない。不明な職業や職業のない古いマスは戦士系にする。セラ専用職は分類の対象外。回収後も系統・状態を保持する。盤面・選択画面・行動ボタン・死体が起き上がる通知で同じ絵を使う。心得 `t_crypt_objects` に系統の見分け方を追記し、`t_corpse_appearances` の状態の説明も新しい装いに合わせた。

原画は `corpses-{warrior,clergy,rogue,mage}-master.png`、配信は同名の `crypt-corpses-*.webp`。各シートは1536×1024で、左から風化・あたたかい・偉大なる。従来の原画と比較は制作履歴として保持。

[12種一覧](families-review/corpse-families.png) · [盤面](families-review/families-board.png) · [検査結果](families-review/checks.json)

再確認: `CRYPT_STATES_OUT=docs/art/crypt/actors/families-review node tools/crypt/verify-states.cjs`。

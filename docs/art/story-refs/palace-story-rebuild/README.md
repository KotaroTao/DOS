# 玉座の間56場面・固定背景での再制作

**後続修正**: `arrival` と `report_w02`〜`report_w10` は独自性改善の依頼により一枚絵へ更新した。この記録の固定合成はこれら10場面について過去の版。現在の制作記録は [最初の10枚](../../palace-story-ten.md) を参照。この10場面に旧合成を再適用しない。

対象は序章 `arrival` と `report_w02`〜`report_w57`（`report_w25` を除く）の56場面。完成背景を土台に、新しく描いた人物・小道具・影を合成した。本文・場面IDは変更していない。

[384×256の一覧・原寸・修正前後の比較](review.md) / [合成定義](composition.json) / [画素検査とハッシュ](verification.json) / [素材台帳](sources.json)

## 読んだ資料と範囲

- `AGENTS.md` と `CLAUDE.md` の Running & building / Conventions / ヘルプ・ストーリー。
- `docs/art/codex-story-art-brief.md` の共通規則・人物と時刻の正典・各場面の制作指示。
- `docs/art/story-refs/palace-3d/finished/README.md`。完成背景を含む `origin/main` の `93d4f3ee` を取り込んで制作。
- 全候補58場面と `minePass` に `node tools/storyart/prompt.mjs <場面ID>` を実行。対象56場面の出力は [prompts/](prompts/) の `*-story.md` に保存。
- 今回のユーザー指示により、背景を再生成していた旧方針を固定合成へ置き換えた。指示書A-66を参照。

## 対象外

| 場面 | 保持する理由 |
|---|---|
| `report_w01` | 王宮の倉庫の作業台で人業を受け取る場面。 |
| `report_w25` | 既存原画は回廊の肖像。 |
| `minePass` | 宝物庫での通行証の受け渡し。 |
| `departure` | 館からの出立。王の金貨への言及だけでは玉座の間へ移さない。 |
| `pre_w49` / `pre_w49_retry` / `mem_w49` 等 | 地下の王家の廟は別の玉座。 |

## 背景と時刻の対応

完成背景の正面・左右斜め・俯瞰・会話用を使い分けた。背景は反転せず、家具を移動しない。第三章後半〜第四章の夜景を保ち、青空になる前の時刻未指定を夜と断定しない。第八章の `report_w33` 以降は、本文・制作指示の昼／夕を守る。

昼の左右斜め・俯瞰・会話と、夕方の会話は不足していたため、共通差分5枚を一度だけ制作して [finished/variants/](../palace-3d/finished/variants/) に固定保存した。以後、場面ごとの背景生成は行っていない。共通差分の生成指示・画像ハッシュも保存している。朝の「雲ひとつない空」に合わせ、会話用の昼差分は雲を除いた共通版へ修正した。

| 場面ID | 内容 | 時刻・空 | 固定背景 |
|---|---|---|---|
| `arrival` | 玉座から託された三つの魂 | 時刻未指定・青空になる前（夜とは断定しない） | `front.png` |
| `report_w02` | 祈りの終わらない場所 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w03` | 封じた者の沈黙 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w04` | 答えを飲み込んだ王 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w05` | 捨て砦の門が開く | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w06` | 守れと命じ、迎えなかった | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w07` | 問いを罪にした王国 | 時刻未指定・青空になる前（夜とは断定しない） | `left.png` |
| `report_w08` | 雷鳴の答えを待つ玉座 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w09` | 先代という仮面 | 時刻未指定・青空になる前（夜とは断定しない） | `right.png` |
| `report_w10` | 庭へ出られない王 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w11` | 庭師の長い歳月 | 時刻未指定・青空になる前（夜とは断定しない） | `high.png` |
| `report_w12` | 飲まれなくなった杯 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w13` | 微笑む宰相、老いていく王 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w14` | 足元に沈む都 | 時刻未指定・青空になる前（夜とは断定しない） | `high.png` |
| `report_w15` | 名の残らない神官 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w16` | 破られた誓いの水 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w17` | 杯を遠ざけた手 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w18` | 床の下の熱 | 時刻未指定・青空になる前（夜とは断定しない） | `right.png` |
| `report_w19` | 燃やされる器 | 時刻未指定・青空になる前（夜とは断定しない） | `left.png` |
| `report_w20` | 床に置かれた杯 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w21` | 冷えていく指先 | 本文「今朝から」／報告自体の時刻は未指定 | `audience.png` |
| `report_w22` | 寒い玉座の間 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w23` | 済まされていなかった処刑 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w24` | 落ちきらなかった魂 | 時刻未指定・青空になる前（夜とは断定しない） | `right.png` |
| `report_w26` | 杯を満たしたもの | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w27` | 笑わない宰相 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w28` | 毒の底の灯 | 時刻未指定・青空になる前（夜とは断定しない） | `left.png` |
| `report_w29` | 死なない命令 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w30` | 鳴りやまぬ雷 | 時刻未指定・青空になる前（夜とは断定しない） | `right.png` |
| `report_w31` | 同じ問い | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w32` | 地の底に吸われる雷 | 時刻未指定・青空になる前（夜とは断定しない） | `audience.png` |
| `report_w33` | 百年目の青空 | 朝・青空 | `variants/audience-day.png` |
| `report_w34` | 空の上の町 | 昼・青空（本文の時刻指定なし） | `variants/left-day.png` |
| `report_w35` | 使い回された魂 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w36` | 玉座と観客席 | 午後遅く（制作指示）・明るい空 | `variants/right-day.png` |
| `report_w37` | 休みのない百年 | 夕方（制作指示）・明るい茜空 | `variants/audience-evening.png` |
| `report_w38` | 底で灯を拾う者 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w39` | 呼ばれなかった名 | 午後遅く（制作指示）・明るい空 | `variants/right-day.png` |
| `report_w40` | 三百年の墓守 | 夕方（制作指示）・明るい茜空 | `variants/audience-evening.png` |
| `report_w41` | 王の資格 | 本文「今夜は休め」／制作指示は昼。報告自体を夜と断定しない | `variants/audience-day.png` |
| `report_w42` | 命令の届かぬ所 | 昼・青空（本文の時刻指定なし） | `variants/right-day.png` |
| `report_w43` | 晴れた空の雨 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w44` | 一度だけ、と言える者 | 午後遅く（制作指示）・明るい空 | `variants/audience-day.png` |
| `report_w45` | 余の終わりの頁 | 夕方（制作指示）・明るい茜空 | `variants/audience-evening.png` |
| `report_w46` | 即位の日の文句 | 昼・青空（本文の時刻指定なし） | `variants/left-day.png` |
| `report_w47` | 術の生まれた所 | 午後遅く（制作指示）・明るい空 | `variants/audience-day.png` |
| `report_w48` | 尋ねなかった名 | 夕方（制作指示）・明るい茜空 | `variants/audience-evening.png` |
| `report_w49` | 余が決めた日に | 朝（制作指示）・青空 | `variants/left-day.png` |
| `report_w50` | 王の数え方 | 昼・青空（本文の時刻指定なし） | `variants/high-day.png` |
| `report_w51` | 誰のための器 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w52` | 座った侍従 | 昼・青空（本文の時刻指定なし） | `variants/left-day.png` |
| `report_w53` | 聞こえない声 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w54` | 帰りたい者 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w55` | 同じ日を生きる | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w56` | 願いだけが残る | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |
| `report_w57` | 待つ場所 | 昼・青空（本文の時刻指定なし） | `variants/audience-day.png` |

## 先行制作と配置

通常の謁見 `report_w06` と金貨の接触がある `report_w04` を先行制作し、着座位置と人物の縮尺を調整してから同じ合成方法を残りへ適用した。人物シートと旧場面を参照し、新しい姿勢を画像生成ツールで描いた。旧場面の人物の切り抜きは使っていない。

`report_w04` は両者の手を一つの新規前景として保ち、接触を崩さず配置した。最初の下半身が切れた案は `sources/report_w04-cropped-draft.png` に記録として残し、出荷には使っていない。通常の前景は透過領域を使って人物ごとに分離し、背景側の座面と床へ合わせた。左右反転は人物にも使っていない。前景の重なり順は、奥の王・宰相、床の杯、手前の弟子の順にし、衣のすそが杯の上半分を不自然に隠さないよう調整した。

`report_w32` / `report_w33` / `report_w43` は窓辺の立ち姿。`report_w52` / `report_w53` の侍従は本文にある小さな椅子を前景の小道具として新規制作し、宰相席を移動・流用しなかった。床に置いた杯は共通素材を使う。`report_w12` は手に杯を持たせず元の肘掛けに置き、`report_w56` は肘掛けへ手を下げる前景の修正を行った。修正前の前景案も保存した。本文にない灯籠の持参や回想の実体は描かない。

## 保存物と再現

- `before/`: 変更前の原画。既存の `art/story-review/fixes/` は上書きしない。
- `sources/`: 新規の透過原画と共通の杯。`parts/`: 人物分離用のマスク。
- `foregrounds/` / `shadows/` / `occlusion/`: 配置済み前景・接地影・背景を手前に保つためのマスク。衣装が家具の前に垂れる箇所は前景のalphaで隠す。
- `composition.json`: 元背景、切り抜き `[x,y,width,height]`、人物の縮尺と座標、影の範囲とぼかし、レイヤー順。
- `verification.json`: 背景・素材・マスク・変更前後原画のSHA-256、背景拡縮率、未遮蔽画素数と変更数。
- `comparisons/`: 変更前後、384×256の各場面、縮小一覧。
- `prompts/`: 本文のコマンド出力と実際の前景／共通差分の制作指示。

再現には Python、Pillow、NumPy が必要。制作補助の人物分離には SciPy を使った。最終配置は `composition.json` が正本であり、`palace-place.py` の初期配置へ戻さない。

```bash
python3 tools/storyart/palace-compose.py
python3 tools/storyart/palace-compose.py --check
python3 tools/storyart/palace-review-rebuild.py
python3 tools/storyart/build.py
```

合成後の画像全体をAIで再仕上げしていない。未遮蔽の画素は、記録された切り抜きと拡縮をした固定背景に一致する。出荷WebPの通常の非可逆圧縮はリポジトリ標準の品質88を使う。

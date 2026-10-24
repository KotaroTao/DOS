# 王宮の挿絵・11〜20枚目と書状の裏面

ユーザーの追加依頼により `report_w11`〜`report_w20` の10枚を一枚絵に描き直した。前回の序章到着＋報告02〜10に続く11〜20枚目にあたる。人物正典と王宮の材質を引き継ぎ、本文と場面ID・解放条件は変更しない。

## 書状の裏面の訂正

`report_w09`「先代という仮面」は、最終的なユーザー訂正「書状は裏側なので印は無い方がいい」に合わせ、こちらを向く紙を無地の裏面にした。封蝋・紋章・組紐を除去し、人物と手・姿勢・構図は維持。`mem_w09`「砦を捧げた書状」の表側は変更しない。

[変更前](palace-story-eleven-twenty/before/report_w09.png) / [変更後](../../art/story-review/chapter2/report_w09.png)

## 対象と構図

| 場面 | 今回の主題 | 修正前 | 修正後 |
|---|---|---|---|
| `report_w11` | 偽りの報告を崩す手記 | [前](palace-story-eleven-twenty/before/report_w11.png) | [後](../../art/story-review/chapter3/report_w11.png) |
| `report_w12` | 手を伸ばさない杯 | [前](palace-story-eleven-twenty/before/report_w12.png) | [後](../../art/story-review/chapter3/report_w12.png) |
| `report_w13` | 咳き込む王と微笑む宰相 | [前](palace-story-eleven-twenty/before/report_w13.png) | [後](../../art/story-review/chapter3/report_w13.png) |
| `report_w14` | 足元の石と重なる都の記録 | [前](palace-story-eleven-twenty/before/report_w14.png) | [後](../../art/story-review/chapter4/report_w14.png) |
| `report_w15` | 肘掛けを握る指と途切れた言葉 | [前](palace-story-eleven-twenty/before/report_w15.png) | [後](../../art/story-review/chapter4/report_w15.png) |
| `report_w16` | 破った誓いと胸に置く手 | [前](palace-story-eleven-twenty/before/report_w16.png) | [後](../../art/story-review/chapter4/report_w16.png) |
| `report_w17` | 咳をしながら杯を押し遠ざける | [前](palace-story-eleven-twenty/before/report_w17.png) | [後](../../art/story-review/chapter4/report_w17.png) |
| `report_w18` | すすの弟子と汗をぬぐう王 | [前](palace-story-eleven-twenty/before/report_w18.png) | [後](../../art/story-review/chapter5/report_w18.png) |
| `report_w19` | 焼けた木の顔の欠片 | [前](palace-story-eleven-twenty/before/report_w19.png) | [後](../../art/story-review/chapter5/report_w19.png) |
| `report_w20` | 床に置く杯と震える手 | [前](palace-story-eleven-twenty/before/report_w20.png) | [後](../../art/story-review/chapter5/report_w20.png) |

## 制作と確認

各場面で `node tools/storyart/prompt.mjs <ID>` を実行し、一覧とゲーム内本文を照合。出力は [prompts](palace-story-eleven-twenty/prompts/) に保存。今回のユーザー依頼を固定合成の旧指示より優先して描き直した。画像生成では既存原画と王・弟子の人物基準を参照し、宰相が登場する13では宰相の基準も使う。

宰相の登場は13だけ。12の杯は小卓の上に置き、王は触れない。17は杯を遠ざけ、20は床へ置く。18〜20でも床は通常の石床で、赤い亀裂・溶岩・床からの蒸気を足さない。19は焼けた木製の顔の欠片であり、人体の首ではない。

原画1536×1024を目視し、`python3 tools/storyart/build.py` でWebP変換・登録・各章384×256見本・本文との整合性を検査。変更前後のハッシュと寸法は [verification.json](palace-story-eleven-twenty/verification.json)。

確認ページ: [第2章](../../art/story-review/review/chapter2.md) / [第3章](../../art/story-review/review/chapter3.md) / [第4章](../../art/story-review/review/chapter4.md) / [第5章](../../art/story-review/review/chapter5.md)。

# 王宮の挿絵・21〜30枚目

ユーザー依頼により `report_w21`〜`report_w30` の10枚を、本文の主題に合わせた一枚絵へ描き直した。人物基準と王宮の石・黒鉄・金・赤い布を引き継ぎ、視点・距離・主役を変えた。

| 場面 | 主題と構図 |
|---|---|
| report_w21 | 冷えた手をこする王。指先と沈んだ表情への接近 |
| report_w22 | 膝掛けを引き寄せる王を上から見る |
| report_w23 | 名簿を膝へ下ろし、目を閉じる王。弟子の肩越しの沈黙 |
| report_w24 | 安堵をにじませて天井を見上げる王。低い視点と高い石の天井 |
| report_w25 | 無人の回廊。古い肖像の額と奥へ続くアーチ |
| report_w26 | 床に残った空の杯を手前に大きく、王を奥に配置 |
| report_w27 | 空いた宰相席を大きく見せ、その向こうで目を閉じる王 |
| report_w28 | 島の灯を説明する弟子の手と、身を乗り出して聞く王 |
| report_w29 | 塔を登れと上を指す手。低い視点から見る決意 |
| report_w30 | 窓外の雷と街、青い光を受ける王の横顔 |

制作指示は各場面で `node tools/storyart/prompt.mjs <ID>` を実行し、[prompts](palace-story-twentyone-thirty/prompts/) に保存。旧固定合成の構図より今回のユーザー依頼を優先した。生成時の追加構図と原画の取得元は [generation.json](palace-story-twentyone-thirty/generation.json)。

本文・場面ID・解放条件・修正済みの1〜20枚目は変更していない。宰相本人は登場させず、25は肖像だけの無人回廊。迷宮の氷・毒沼・極光・塔を玉座の間に持ち込まない。26の杯は床に置いたままの空の杯。

1536×1024の原画を目視し、384×256の縮小でも主題を確認。`python3 tools/storyart/build.py` で品質88のWebPへ変換・登録・検査した。変更前の原画は [before](palace-story-twentyone-thirty/before/)、寸法・ハッシュの記録は [verification.json](palace-story-twentyone-thirty/verification.json)。

確認ページ: [第5章](../../art/story-review/review/chapter5.md) / [第6章](../../art/story-review/review/chapter6.md) / [第7章](../../art/story-review/review/chapter7.md) / [第8章](../../art/story-review/review/chapter8.md)。

# 王宮の挿絵・31〜40枚目

`report_w31`〜`report_w40` を、各場面の本文に合わせて描き直した。人物基準と王宮の石・黒鉄・金・赤い布を引き継ぎ、距離・視点・光・動作を変えた。

| 場面 | 主題と構図 |
|---|---|
| report_w31 | 遠い鐘に耳を澄ます、目を閉じた王の横顔への接近 |
| report_w32 | 窓枠に手を添えた王の背後から、地へ向かう雷を見る |
| report_w33 | 床近くの低い視点から、初めての青空と陽光を見上げる王 |
| report_w34 | 大きな年代記の最初の頁を指し、空を振り返る王 |
| report_w35 | 膝の上に開いた手のひらと、顔を上げない王 |
| report_w36 | 王の肩越しに長い無人の広間を見下ろす逆向きの構図 |
| report_w37 | 人業を休ませよと、弟子へ身を寄せて助言する王 |
| report_w38 | 黒ずんだ灯籠に手を添え、目を閉じる王 |
| report_w39 | 名札と赤い封の布告を見比べ、その先の空席を見る |
| report_w40 | 胸に手を置き、夕日の中で静かに弔う王への接近 |

制作前に各場面で `node tools/storyart/prompt.mjs <ID>` を実行し、出力を [prompts](palace-story-thirtyone-forty/prompts/) に保存。今回の構図変更依頼を、旧固定構図・復元指示より優先した。追加の構図指示と生成元は [generation.json](palace-story-thirtyone-forty/generation.json)。

33以降は明るい空、37・40は茜色の夕空。宰相本人や先の場面の秘密は描いていない。40では墓の灯籠を持ち帰らない。文字は読めない走り書きとした。

全10枚の1536×1024原画を目視し、[384×256の一覧](palace-story-thirtyone-forty/overview.jpg)でも主題を確認。変更前は [before](palace-story-thirtyone-forty/before/)、寸法とハッシュは [verification.json](palace-story-thirtyone-forty/verification.json)。本文・ID・解放条件と修正済みの1〜30枚目は変更していない。

`python3 tools/storyart/build.py` で品質88のWebPへ変換し、登録・指示書・本文の検査を通した。

確認ページ: [第8章](../../art/story-review/review/chapter8.md) / [第9章](../../art/story-review/review/chapter9.md) / [第10章](../../art/story-review/review/chapter10.md)。

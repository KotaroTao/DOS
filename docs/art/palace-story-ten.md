# 王宮の挿絵・最初の10枚の描き直し

ユーザーの「独自性がありストーリーに沿った魅力的な挿絵にする」「まず10枚、その後mainにマージ」の依頼による修正。固定背景合成を一枚絵に置き換え、人物の顔と衣装・黒石と金と赤い布の王宮の材質を引き継ぐ。本文・解放条件・場面IDは変更しない。

| 場面 | 今回の主題 | 修正前 | 修正後 |
|---|---|---|---|
| `arrival` | 三つの魂を受け取る手 | [前](palace-story-ten/before/arrival.png) | [後](../../art/story-review/prologue/royal-audience.png) |
| `report_w02` | 地下の道をたどる地図と鍵 | [前](palace-story-ten/before/report_w02.png) | [後](../../art/story-review/chapter1/report_w02.png) |
| `report_w03` | 王がそらした視線 | [前](palace-story-ten/before/report_w03.png) | [後](../../art/story-review/chapter1/report_w03.png) |
| `report_w04` | 金貨で閉じられた問い | [前](palace-story-ten/before/report_w04.png) | [後](../../art/story-review/chapter1/report_w04.png) |
| `report_w05` | 手記を守り、宰相を制する王 | [前](palace-story-ten/before/report_w05.png) | [後](../../art/story-review/chapter1/report_w05.png) |
| `report_w06` | 守れと命じた空の手 | [前](palace-story-ten/before/report_w06.png) | [後](../../art/story-review/chapter2/report_w06.png) |
| `report_w07` | 老王と歳を取らない宰相 | [前](palace-story-ten/before/report_w07.png) | [後](../../art/story-review/chapter2/report_w07.png) |
| `report_w08` | 止まぬ雷雨を見つめる王 | [前](palace-story-ten/before/report_w08.png) | [後](../../art/story-review/chapter2/report_w08.png) |
| `report_w09` | 二つの封印と王の告白 | [前](palace-story-ten/before/report_w09.png) | [後](../../art/story-review/chapter2/report_w09.png) |
| `report_w10` | 空席の向こうの囚われた王 | [前](palace-story-ten/before/report_w10.png) | [後](../../art/story-review/chapter3/report_w10.png) |

## 制作と確認

各場面で `node tools/storyart/prompt.mjs <ID>` を実行し、一覧本文とゲーム内の王への報告を照合した。出力は [prompts](palace-story-ten/prompts/) に保存。今回のユーザー指示が構図維持と固定背景の旧指示に優先する。画像生成で既存原画と king / apprentice / morden の基準シートを参照して描き直した。序章は王と弟子の基準シートのみ。

序章の魂は赤・金・緑の3つ。`report_w09`・`report_w10` に宰相は描かない。`report_w08` の窓には暗い雷雨の空を描く。地下の修道院を地上の窓外に描かず、地下の根や砦の亡兵を現在の玉座の間へ実体として持ち込まない。

原画は1536×1024。`python3 tools/storyart/build.py` で品質88のWebP・台帳・確認ページと各章の384×256見本を生成する。

確認ページ: [序章](../../art/story-review/review/chapter0.md) / [第1章](../../art/story-review/review/chapter1.md) / [第2章](../../art/story-review/review/chapter2.md) / [第3章](../../art/story-review/review/chapter3.md)。旧固定合成の記録は過去の版として保存する。

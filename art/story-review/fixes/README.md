# 便1：A-1〜A-3の修正確認

PR #702を取り込んだmain (`711f3259c4f6f464eb90e3efaab7904c9f1dd695`) から修正。3枚ともユーザー承認後、PR #703でmainへマージ済み。比較画像は左が修正前、右が修正後。本文は変更していない。

| 項目 | 場面 | 修正 | 比較 |
|---|---|---|---|
| A-1 | irene_repair「砕けても、名は消えない」 | 作業台の頭と奥の人業の頭を無顔の丸い木に。イレーヌ・弟子・砕けた魂の結晶を保持。 | [修正前後](irene_repair-before-after.png) |
| A-2 | report_w03「封じた者の沈黙」 | 宰相を承認済みモルデンの顔・帽子・衣装に。王が目をそらし、宰相が王の横顔を見る構図を保持。 | [修正前後](report_w03-before-after.png) |
| A-3 | w02_sigil「水音の向こうへ」 | 鉄格子に錆びた錠前、挿した鍵と紐で結んだ紙札を追加。縁石の鍵を除去。壁の印を承認済み幾何学印に統一。 | [修正前後](w02_sigil-before-after.png) |

## 参照と確認

各場面の `node tools/storyart/prompt.mjs <場面ID>` の出力を使い、修正前の原画を最初の参照として画像編集へ渡した。追加の基準シートは承認済みのものを使用。

| 場面 | 追加の参照 |
|---|---|
| irene_repair | `docs/art/story-refs/irene.png`、`apprentice.png`、`dolls.png` |
| report_w03 | `docs/art/story-refs/king.png`、`morden.png`、`art/story-review/chapter3/report_w12.png` (prompt.mjs指定の玉座の間) |
| w02_sigil | `docs/art/story-refs/apprentice.png`、`props.png`、`sigil.png` |

原画と出荷WebPは1536×1024。見える手と腕、顔・衣装、構図と光、読める文字がないことを目視確認。隠れた指や画面外の脚は直接判別できない。384×256の縮小で結晶・無顔の頭、王と宰相、錠前と鍵と札が見えることを確認。一門の印は左の親指1本と右の指3本、独立した炎1つを保持。

WebP変換・原画ハッシュ記録・確認ページ・縮小見本・検査は `python3 tools/storyart/build.py` で生成。指示書の「(済)」は修正作業の完了を示し、ユーザー承認を意味しない。

- [序章の絵と本文](../review/chapter0.md#irene_repair)
- [第一章：封じた者の沈黙](../review/chapter1.md#report_w03)
- [第一章：水音の向こうへ](../review/chapter1.md#w02_sigil)
- [序章の縮小見本](../review/chapter0-small.jpg)
- [第一章の縮小見本](../review/chapter1-small.jpg)

A-4〜A-9の次の便は[別の確認記録](a4-a9.md)にまとめた。A-10以降は未着手。

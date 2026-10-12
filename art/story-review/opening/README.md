# オープニングの物語画風への差し替え

六幕の本文・字幕・英語ナレーションは維持し、物語と同じ承認済みの画風と人物基準で表示する。
全6枚がオープニング専用の描き下ろし。弟子とイレーヌはどの幕にも登場させない。
原画は1536×1024 PNG。出荷は品質88のWebP。原画と制作記録は公開対象から除外される。

[六幕の見本](index.html)

| 幕 | 題 | 出荷画像 | 制作方法 |
| --- | --- | --- | --- |
| 一 | 裂けた大地 | `art/opening/rift.webp` | 専用原画 |
| 二 | 還らぬ者 | `art/opening/fallen.webp` | 専用原画 |
| 三 | 人業 | `art/opening/vessels.webp` | 専用原画。木と黒鉄の器に魂が宿る瞬間 |
| 四 | 王の操霊師 | `art/opening/ordo.webp` | オルド・王・隊・印の基準を参照した専用原画 |
| 五 | 師の手紙 | `art/opening/letter.webp` | 小道具の基準を参照した専用原画 |
| 六 | 師の灯 | `art/opening/flame.webp` | 専用原画。館の白い蝋燭と、夜明けの山々・迷宮へ続く道 |

専用画像の制作指示は `node tools/openingart/prompt.mjs <rift|fallen|vessels|ordo|letter|flame>`。
毎回指定された基準画像を実際に画像生成へ渡す。印を基準にない場所へ追加しない。
オルドは一年前の負傷前の姿で、弟子と取り違えない。人業の頭は目鼻のない丸い木。
後の章で明かされるセラやモルデンの秘密は描かない。

変換は既存の道具を使う:

```bash
python3 tools/storyart/to-webp.py art/story-review/opening/rift.png art/opening/rift.webp
```

他の5枚も同じ指定で変換する。ストーリー一覧の場面IDではないため、物語の自動登録には
加えず、`src/openingillustrations.js` と `sw.js` のオープニング画像の欄に登録する。
変換後に `node tools/openingart/check.mjs --record` で原画とWebPのハッシュを記録し、
`node tools/openingart/check.mjs` で寸法・形式・登録・変換記録を検査する。PRのCIでも検査する。
画像を読み込めない時は既存の描画へ戻す。読み込めたWebPは原画から高解像度で描き、
字幕・幕送り・スキップ・長押し・動きを減らす設定・ナレーションの挙動を維持する。
横長画面では原画の高さを保ち、人物の頭や燭台を上下で切り落とさない。
縦長画面では幕ごとの主題に合わせて左右の表示位置を決める。

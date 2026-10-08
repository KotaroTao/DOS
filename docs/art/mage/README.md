# 魔導士 R1〜R5

職業IDは `mage`。`battlemage`（魔闘士）、`archmage`（大魔導）とは別職。
聖戦士 `crusader` の確定原画を基準とし、ユーザー承認済みR1を各ランクの直接参照に使用した。
各ランクを独立生成し、原画をドット化・減色せず `tools/jobimg.py` で取り込む。

## 固有の特徴と成長

既存絵は紫髪の若い中性的な術者、紫のとんがり帽、紫と黒の金縁ローブ、木の杖と青い炎、茶色のブーツ。
既存R2は金縁と杖先の強化、R3は肩掛けと前垂れ、R4は刺繍と重なる外套、R5は最も豪華な装飾。
採用原画でも同じ成長を維持し、R4〜R5には青い宝石と金の連飾りを加えた。

## 原画と測定

`mage-r1-final.png` は承認された `mage-r1-draft.png` と同じ画像。
`mage-r2-final.png`〜`mage-r5-final.png` はそれぞれ独立生成。
頭頂は帽子の先ではなく、帽子の下に隠れた主な髪の頭頂をR1の人体から推定した。
頬・顎・足裏は各原画の輪郭から測定。透過範囲は取込ツールと同じくalpha>1で測定。
頭頂9ドット、頭頂〜足裏82.8ドットを共通とする。測定値は `import-settings.json`。

## 再取り込みと確認

```bash
python3 docs/art/mage/import-art.py
python3 -m http.server 8000
python3 tools/review-job-art.py mage --label 魔導士 --require-photos --output docs/art/mage/final-review
```

`final-review.png` は実際の `jobSprite` / `jobBust` による聖戦士R1との同倍率比較。
全身、56・36・26pxの顔アイコン、拡大胸像を確認する。
旧 `src/jobart.js` の魔導士定義だけを外し、出荷画像5枚を `sw.js` に登録。
mainへのマージは行っていない。

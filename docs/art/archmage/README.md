# 大魔導 R1〜R5

職業IDは `archmage`。`src/souls.js` の職業定義とランク名で確認した。
`codex/archmage-job-art` で制作。下準備ブランチは取り込み済みで、制作前に最新の `origin/main` を取り込んだ。
制作完了時点ではmainへ未マージ。2026-10-09にユーザーからmainへのマージ指示を受け、PR経由で反映する。

## 制作条件

ユーザー指定の白髪の若い女性、白いローブ、赤い宝石付きの木杖を採用した。
聖戦士 `crusader` R1の原画を人体・顔・描画の参考とし、対応ランクの原画を装飾の成長の参考に渡した。
承認された `archmage-r1-draft.png` をそのまま `archmage-r1-final.png` として確定した。
R2〜R5はそれぞれR1を直接参照した独立した透明背景原画。集合絵の分割や機械的なドット化・減色は行っていない。

既存画像は `existing-review.png`。旧絵は紫系の魔導姿で、高襟・魔晶・浮く裾が特徴だった。
今回の配色と人物はユーザー指定を優先し、高襟、魔晶を思わせる赤い宝石、広がる裾で成長差を表現した。

| ランク | 装備と装飾 |
| --- | --- |
| R1 | 金縁の白ローブ、木杖の赤石、胸の小さな赤石、革ベルトと袋 |
| R2 | 二重の金縁、肩の赤石と金鎖、裾の小さな幾何学模様 |
| R3 | 高襟、重ね肩布、金の刺繍、木杖上部の大きな赤石 |
| R4 | 高襟と外套、増えた金鎖と赤石、腰の魔導書、広がる白い裾 |
| R5 | 最も豪華な重ね外套、広い刺繍、髪留めと靴の赤石、宝石と金鎖、最上位の木杖 |

## 取り込み

原画は `archmage-r1-final.png`〜`archmage-r5-final.png`。
各原画の頬の左右、主な髪の頭頂、顎、足裏を再測定し、`import-settings.json` に記録した。
R1承認用の `r1-review-settings.json` は仮測定であり、出荷設定には流用していない。
倍率は頭頂〜足裏82.8ドットから計算（R4のみ足裏の補間画素まで透明余白を確保するため82.6ドット）。共通枠90×92、頭頂9、保存解像度4px/ドット。
`tools/jobimg.py` で `art/jobs/archmage_1.webp`〜`archmage_5.webp` と `src/jobphotos.js` を生成した。
`sw.js` のASSETSに5枚を追加。CACHEは `dos-dev` を維持した。
`src/jobart.js` に優先される `archmage` の定義はなく、変更不要だった。

再取り込みは `import-settings.json` のsourcesを順に渡し、各perDotとheadを指定する。

```bash
python3 tools/jobimg.py archmage <R1原画> <R2原画> <R3原画> <R4原画> <R5原画> --per-dot <各perDot> --head <各head> --frame 90,92 --frame-top 9 --preview docs/art/archmage/import-preview.png
python3 tools/review-job-art.py archmage --label 大魔導 --url http://127.0.0.1:8001/ --output docs/art/archmage/final-review
```

## 確認結果

`final-review.png` は実際の `jobSprite` / `jobBust` / `crispCanvas` で描画した聖戦士R1と大魔導5ランクの同倍率比較。
全身6枚、56/36/26pxの顔アイコン、拡大した顔を確認した。
全ランクで対応するWebPが選択され、透明背景と枠内の杖・髪・裾・靴を確認した。
ゲーム起動を1440×1000と390×844で確認。ブラウザ例外とHTTPエラーなし。
`src/jobphotos.js` / `sw.js` の構文確認と `git diff --check` は成功。

聖戦士に対する顎位置の厳密検査（0.3ドット未満）は不合格。最大差は `verification.json` に記録した。
承認済みR1の輪郭を維持し、頭頂と足裏を揃えた場合、生成原画の頭の高さに小さな差が残る。
検査値を合わせるために顎の測定位置をずらしたり、人物を縮めたりしていない。
通常の比較スクリプトと、別途の画像選択・透過・枠・起動の検査は成功した。
詳細は `final-review.json` と `verification.json`、取り込み前後の全身・顔は `import-preview.png` と `final-review.png`。

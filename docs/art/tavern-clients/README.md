# 酒場の依頼者の肖像

掲示板の20人と固有の依頼者を合わせた47人。ダークファンタジー調の絵画的な胸像を生成し、暖かな酒場の光と暗い背景で顔を読み取りやすくした。隻眼のガルムの右目、盲目のヴェスナの白い目、ロッホスのくちばし面、ゴドーの眼帯を確認した。

原画は `atlas-1.png` から `atlas-3.png`。各原画は4列×4行、左から右、上から下の順。`names.json` の順に対応し、最後の1枠は未使用。名前の順序は変えず、追加する場合は末尾へ足す。ゴドーの眼帯は画像生成による修正で追加した。

`python3 tools/tavern/build-portraits.py` で原画をセルごとに切り出し、256×256のWebP（品質88）へ変換する。出荷画像は `art/quest-clients/`、名前別台帳は `src/questportraits.js`。SWの `QUEST_PORTRAITS` ブロックも同時に登録する。原画と確認画像は公開から除外される `docs/` に置く。

`src/ui/questportrait.js` で一覧28px・固有の依頼一覧40px・詳細52px・報告112pxを滑らかに表示。掲示板の目的の印は残し、その下に顔と名前を添える。画像の読み込み失敗は従来の絵へ戻る。依頼ID・依頼者番号・セーブ形式は変更しない。

確認は `python3 tools/tavern/portrait-check.py`（localhost:8000が必要）。390×844と744×1000で全47人の読み込み、受注からフリー・固定の報告、詳細の横幅、未登録・画像失敗の代替表示、ブラウザーエラーを検査する。

- [スマホの顔一覧](review/gallery-390.png)
- [掲示板](review/board-390.png)
- [依頼の詳細](review/detail-390.png)
- [フリーの報告](review/report-390.png)
- [固定の報告](review/fixed-report-390.png)
- [確認結果](review/verification.json)

心得 `t_quest_faces` を追加。既存の酒場の確認と依頼の出現・分類の確認も通過した。

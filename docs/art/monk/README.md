# 武僧 R1〜R5

職業IDは `monk`。修験者 `ascetic` とは別職業。
聖戦士 `crusader` を共通基準にし、ユーザーが承認した武僧R1を直接参照して各ランクを独立生成した。

茶色の乱れ髪の若い男性、柿色の修行衣、焦茶の袴、包帯、手甲、軽い足元、左手の錫杖を維持。
R2は数珠と手甲、R3は肩当てと赤い肩布、R4は金模様と錫杖の輪飾り、R5は白い祈りの布・金装飾・髪飾りを強化した。
R5は位置がずれた初稿を修正し、採用原画と修正前の案を保存した。

採用原画は `monk-r1-final.png`〜`monk-r5-final.png`。
`import-settings.json` に各原画の頬・主な髪の頭頂・顎・足裏の測定値を保存。
共通枠90×92ドット、頭頂9ドット、頭頂から足裏は約82.9ドット。
原画のドット化・減色は行っていない。

再取り込みはリポジトリのルートで `python3 docs/art/monk/import-art.py`。
既存の `tools/jobimg.py` により `art/jobs/monk_1.webp`〜`monk_5.webp` と `src/jobphotos.js` を更新。
優先される旧 `src/jobart.js` の武僧だけを外し、`sw.js` の画像一覧に5枚を追加。CACHEは `dos-dev` を維持。

`final-review.png` は実際の `jobSprite` / `jobBust` による聖戦士との同倍率全身、56/36/26px顔アイコンと顔拡大。
`final-review.json` は正しい5ランクの画像選択、共通の顔位置、顎位置の基準との差0.3ドット未満、30枚の描画、ブラウザーエラーなしを記録。
ゲーム起動、変更したJavaScriptの構文、画像端での欠けと透過、武器・布・髪飾りを確認した。

作業ブランチは `codex/monk-job-art`。mainへのマージは未実施。

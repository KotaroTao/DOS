# 次のセッションに貼る依頼

以下の本文を新しいセッションに貼ってください。現在の詳細な手順・承認記録は [START_HERE.md](START_HERE.md)、原画のハッシュと残りの順序は [resume-checkpoint.json](resume-checkpoint.json)。

```text
DOSリポジトリの最新mainから、一門の印の未完了修正を再開してください。

最初にAGENTS.mdと関連するCLAUDE.mdの節を読み、次を確認してください。
- art/story-review/sigil-audit/START_HERE.md
- art/story-review/sigil-audit/rules.md
- art/story-review/sigil-audit/progress.json
- art/story-review/sigil-audit/evidence.json
- art/story-review/sigil-audit/resume-checkpoint.json

現在は153枚のうち、修正不要131枚、修正・確認済み6枚、修正保留7枚、要確認9枚です。
修正・確認済みの6枚はmainへマージ済みです。PR #953のlore_w02・lore_w12、PR #959のirene_torso、PR #961のw16_legs、PR #965のch5_end、PR #968のirene_husksをやり直さないでください。

残りは次の順です。
1. irene_lineage（A-27）：額
2. irene_crest（A-28）：額と肘内側の既存の印
3. irene_order（A-29）：額
4. irene_rain（A-30）：額
5. irene_rest（A-31）：額
6. irene_names（A-32）：額
7. lore_w07（A-34）：額。壁の基準に合う印は保持

Pythonによる局所合成で、まずirene_lineageの1枚を修正してPRを作成してください。正本の形を抽出して使い、旧印を除去し、額の角度・小さい金の印の色・質感へ合わせてください。形を描き直したり、再生成した別の印を使ったりしないでください。
印の正本はdocs/art/story-refs/sigil.pngです。角張った掌、左の親指1本、右の平行な指3本、短い手首、上に独立した涙形の炎1つを保ってください。右の指を4本にしないでください。セラの魂火は胸にあり、背中へ付けないでください。

各対象の前にnode tools/storyart/prompt.mjs <場面ID>で現在の本文と修正指示を確認してください。隠れた関節内側や根拠不足の位置へ、推測で印を追加・削除・移動しないでください。要確認9枚と、ch5_endの盾、irene_restの開いた蓋の金の図形は保留し理由を記録してください。irene_restの脚と胸は別セッションで修正済みなので必ず保持してください。

最新mainからcodex/の作業ブランチを作り、153枚の現在原画のハッシュをprogress.jsonのcurrent_sha256と照合してください。更新があれば現在原画を再確認してください。新しい編集の入力はprogress.jsonのmasterの現在原画です。before/、rejected/、fixes/、過去のcandidate.png、古い部分参照を現在原画として使わないでください。composite-irene-torso/とcomposite-irene-husks/などのmake_candidate.pyは承認済み修正の再現用で、保存した修正前とハッシュに固定されています。手法の参考にはできますが、既存スクリプトの座標や入力を別の原画へそのまま流用しないでください。

確認は384×256の縮小を4枚以下ずつ、必要部分だけ拡大してください。修正は原寸1536×1024の対象を1枚ずつ処理し、現在原画と正本以外の参考は必要最小限にしてください。imagegenを使う必要が生じた場合もこの入力制約を守り、image_request_too_largeが出たら同じ入力を再送せず参考枚数やサイズを減らしてください。

候補は額の形・指の数・位置・人物・周囲の保持を照合し、基準を満たさない候補を原画へ反映しないでください。Python局所合成では変更領域外のRGBが修正前と完全一致することを確認してください。各画像の確認・候補採否が終わるたびにtrack.pyのupdateでprogress.jsonとprogress.mdを保存し、不採用なら理由と候補を残してください。

採用した原画だけ反映し、今回の修正前をart/story-review/fixes/へ上書きしない別名で保存、A-27に「(済)」を付け、python3 tools/storyart/build.pyで仕上げと検査を行ってください。原画・WebP・額の拡大比較・全体縮小・変更領域外の画素一致・再現スクリプト・ハッシュと進捗記録を確認できるPRを作成してください。PR前にmainを取り込んでください。

今回はirene_lineageの1枚のPRで確認を待ち、mainへのマージは別途指示します。
```

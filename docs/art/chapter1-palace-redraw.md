# 第一章・王宮関連6場面の描き直し

2026-10-19のユーザー依頼と、その後の「ベースとなる王宮背景は一切変えずに」という訂正を反映した。初稿では椅子・階段・窓が見本と異なっていたため、玉座の間5枚を背景固定の合成へ差し替えた。

背景は [王宮の正面](story-refs/palace-front.png) のPNGをそのまま使用する。背景の再生成・拡縮・移動・色調補正は行わず、画像生成ツールで作った透明な人物と小道具だけを重ねた。人物に隠れない画素はすべて背景と一致する。倉庫の report_w01 は別室のため、前回の原画と出荷WebPを変更していない。

| 場面 | 描き直した主題 | 原画 | 修正前 |
|---|---|---|---|
| report_w01 | 倉庫から眠る人業を抱えて運ぶ弟子 | [後](../../art/story-review/chapter1/report_w01.png) | [前](../../art/story-review/fixes/report_w01-palace-before.png) |
| report_w02 | 修道院長の話をする王と報告を聞く宰相 | [後](../../art/story-review/chapter1/report_w02.png) | [前](../../art/story-review/fixes/report_w02-fixed-background-before.png) |
| report_w03 | 宰相から目をそらす王と報告を待つ弟子 | [後](../../art/story-review/chapter1/report_w03.png) | [前](../../art/story-review/fixes/report_w03-fixed-background-before.png) |
| report_w04 | 王の言葉を遮る宰相と褒美を受け取った弟子 | [後](../../art/story-review/chapter1/report_w04.png) | [前](../../art/story-review/fixes/report_w04-fixed-background-before.png) |
| minePass | 三種の宝への褒美として通行証を渡す王 | [後](../../art/story-review/chapter1/minePass.png) | [前](../../art/story-review/fixes/minePass-fixed-background-before.png) |
| report_w05 | 膝の手記、肘掛けを握る手、宰相を退ける王 | [後](../../art/story-review/chapter1/report_w05.png) | [前](../../art/story-review/fixes/report_w05-fixed-background-before.png) |

制作指示は [指示書](codex-story-art-brief.md) のA-55〜A-59に記録し、各場面の `prompt.mjs` 出力から透明な人物素材を作成した。3人は個別に配置し、通行証を受け渡す王と弟子は接した手の関係を保つため一組のまま配置した。「捨て砦の門が開く」の王は人物レイヤーだけ左右反転し、宰相へ制止の手を向けている。本文・場面ID・画像の割り当て・ゲームの仕組みは変更していない。

## 背景を保つ仕組みと検査

- [人物素材・前景レイヤー](story-refs/palace-chapter1-overlays/README.md) を制作資料として保存。
- `node tools/storyart/palace-fixed.mjs` で、保存した素材を元の王宮背景へ合成し、原画を再現できる。ImageMagickが必要。
- `node tools/storyart/palace-fixed.mjs --check` で、人物に隠れない全画素の一致と、出荷WebPの全画素が原画と一致することを検査する。
- [検査記録](story-refs/palace-chapter1-overlays/verification.json) に元背景・前景・完成原画のSHA-256と未遮蔽画素数を保存。未遮蔽部分の変更画素数は5枚とも0。
- 今回の5枚だけWebPを可逆圧縮し、ゲームに届く画像にも画素の一致を保つ。`tools/storyart/to-webp.py` に対象を明記し、通常の `python3 tools/storyart/build.py` で再生成する。

6枚とも1536×1024。修正した5枚の原寸と [縮小の見本](../../art/story-review/review/chapter1-small.jpg) で、人物の座り位置・立ち位置・通行証の受け渡し・手記・本文との対応を確認した。衣装や持ち物に隠れた指・脚は直接判別できない。[本文と画像の確認ページ](../../art/story-review/review/chapter1.md) も再生成した。

`python3 tools/storyart/build.py` でWebP変換・原画ハッシュ・登録・確認ページを更新し、登録検査・指示書検査・物語一覧検査を通した。新しいファイル名を追加していないため、`src/storyimages.js` と `sw.js` の登録内容に差分はない。

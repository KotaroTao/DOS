# report_w13「微笑む宰相、老いていく王」 第3章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter3/report_w13.png`
- 出荷 (WebP): `art/story/chapter3/report_w13.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter3/report_w13.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 大樹の主を討った報告をする頃、王の衰えが目に見えるようになった。魂を送る木に変化が起きれば、つながれた命も変わるのだ。
> モルデンは玉座の陰から姿を見せた。弟子の働きを認める言葉のあとに、幹には触れないよう求めた。笑みの理由を、今は誰も確かめなかった。
> 師が幹を登り、王都の玉座の真下へ向かったことを伝えると、王は宰相を下がらせた。長く空けてきた玉座を思い、師のその先の足取りも確かめてほしいと弟子に頼んだ。
> 迷宮の奥へ進む旅は、王国の中心へ戻ってくる。弟子は師のために歩き始めた道で、師が向き合ったものと向き合おうとしていた。

### 本文 (ゲーム内・王への報告 REPORTS.w13)
> 「……昨夜から、胸の奥が冷える。主を鎮めたことで、魂脈の流れが変わったのやもしれぬな。」
> 王は咳き込んだ。一晩で、髪がさらに白くなったように見えた。
> 「一年前、オルドが根を断った後も、余の杯は届き続けた。根を一本断つだけでは、止まらなかったのだな。」
> 玉座の陰から、宰相モルデンが音もなく歩み出た。
> 宰相モルデン「オルドの弟子殿。まことに見事なお働きにございます。……ですが、幹にだけは、お手を触れませぬよう。」
> 「下がれ、モルデン。」
> 宰相は、いつもと同じ微笑みのまま一礼し、闇へ溶けるように退いた。
> 「幹の中を登り、王都の玉座の真下へ向かったと申すか。余が空けてきた、あの玉座のな。……その先の足取りを、確かめてくれ。」
> 「{弟子名}よ。いずれ、余を斬りに来るがよい。……オルドの代わりにな。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

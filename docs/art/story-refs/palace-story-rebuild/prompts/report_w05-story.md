# report_w05「捨て砦の門が開く」 第1章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter1/report_w05.png`
- 出荷 (WebP): `art/story/chapter1/report_w05.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter1/report_w05.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 手記を読み終えた王は、長く火を見つめた。魂脈という言葉を、初めて聞いた顔ではなかった。それから、師がこの暗がりを自分の足で歩いていたことに気づいて、低くうめいた。生身で迷宮へ入るなと王に説いたのは、ほかならぬ師だったのだ。王は宰相の言葉を退け、砦の封を解くと告げた。
> 百年前に王都が見捨てた国境の砦。師はそこへ向かっていた。王の語る過去は短かったが、短い言葉ほど重く玉座の間に残った。
> 弟子は新たな道を受け取った。師を探す旅は、王国が忘れたことを拾う旅にもなり始めていた。

### 本文 (ゲーム内・王への報告 REPORTS.w05)
> 「オルドの手記を見つけたそうだな。……見せよ。」
> 王は手記を読み終えると、玉座の肘掛けを握ったまま、しばらく動かなかった。
> 「『魂脈』か。……あの男は、そこまでたどり着いたか。」
> 宰相「陛下、その手記は、宰相府でお預かりいたしましょう。」
> 「下がれ、宰相。」
> 「……オルドは、生身で降りたのだな。人業だけを遣わせと余に説いたのは、あの男だというのに。」
> 「……捨て砦の封を解かせよう。国境の砦だ。王都が百年前に見捨てた、な。」
> 「{弟子名}よ。そなたの師は、生きておる。……少なくとも、まだ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

# report_w11「庭師の長い歳月」 第3章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter3/report_w11.png`
- 出荷 (WebP): `art/story/chapter3/report_w11.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter3/report_w11.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 森の探索を報告すると、王はヴェルナーについて語った。小屋の記録が見つかれば、処刑を済ませたという報告の真偽も確かめられる。処刑は済んだと、かつてモルデンから告げられていたのだ。
> 王が生まれる前から仕えていた男は、三百年、根に魂を送り続けている。王が信じた報告の数だけ、知らないままにされた出来事があった。
> 弟子は手記を持ち直した。迷宮で拾った紙が、王宮で長く信じられてきた言葉を崩していく。師が選んだ道の理由が、ようやく分かり始めていた。

### 本文 (ゲーム内・王への報告 REPORTS.w11)
> 「魂が木になる森……。そのような所が、大穴の底にあったとはな。」
> 「ヴェルナーは、牢を抜けておったのか。余はあの男の処刑を命じた。モルデンが『済ませました』と申した。……あれも、偽りであったか。」
> 「三百年、根に水をやる庭師。……モルデンが王家に仕えたのは、余が生まれる前からだ。」
> 森と苗床の探索の記録を地図に重ねると、大樹の根元へ続く道筋が見えてきた。

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

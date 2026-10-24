# report_w17「杯を遠ざけた手」 第4章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter4/report_w17.png`
- 出荷 (WebP): `art/story/chapter4/report_w17.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter4/report_w17.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 神官王の記憶を伝えると、王は宰相が仕えてきた年月を数えるのをやめていたと言った。祖父の祖父の代よりも、さらに前から。
> 毎朝差し出される杯が、どこで煮詰められているのか。王はそれを知って、杯を遠ざけた。
> 神殿の底には、火の洞へ続く道が見つかった。弟子はその道を地図に記し、師がそこで何を見たのかを確かめに行く。

### 本文 (ゲーム内・王への報告 REPORTS.w17)
> 「神官王を鎮めたか。……三百年、水の底で冠をかぶっておったか。」
> 王に、神官王の記憶を話した。若い神官が泉に苗木を植え、旧都が一夜で沈んだことを。
> 「モルデンは、余の祖父の祖父の代よりも前から、宰相であった。……数えるのを、いつしかやめていた。」
> 王は咳き込み、肘掛けの杯を遠ざけた。
> 「心臓は樹液を煮詰める釜、と申したな。余の毎朝の杯は、その釜で煮詰められておるのだろう。」
> 「神殿の底に、火の洞へ続く道があったか。……師は、その熱い風の中へ降りたのだな。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

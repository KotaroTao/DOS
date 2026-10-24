# report_w26「杯を満たしたもの」 第7章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter7/report_w26.png`
- 出荷 (WebP): `art/story/chapter7/report_w26.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter7/report_w26.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 奈落の底に沼があり、その水が腐った魂だと聞くと、王は膝掛けの端を握ったまま動かなくなった。
> 釜で煮られなかった魂は、みなそこへ落ちていく。王の杯を満たしたのは、その途中ですくい上げられた魂だった。弟子は口にしなかったが、王はもう自分で数を合わせていた。
> 葦原へ向かう弟子に、王はひと言だけ添えた。息を詰めて行け。

### 本文 (ゲーム内・王への報告 REPORTS.w26)
> 「奈落の底に、沼があったか。……底が無いと思うておったが。」
> 「氷の添え木が溶けて、器の腕の木で脚を固め直したと。……オルドは、まだ歩いておるのだな。」
> 「沼の水は、腐った魂だと申すか。……余の杯を満たした魂も、釜で煮られねば、そこへ落ちていったのだな。」
> 「沼の奥には、葦原へ続く道もあったか。……毒霧の中で長居はするな。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

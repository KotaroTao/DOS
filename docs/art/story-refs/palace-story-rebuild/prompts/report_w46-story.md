# report_w46「即位の日の文句」 第12章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter12/report_w46.png`
- 出荷 (WebP): `art/story/chapter12/report_w46.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter12/report_w46.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 門の一行を聞いた王は、即位の日にも同じ言葉を聞かされたと打ち明けた。古い儀式の文句だと思っていた、と。
> 歴代の王の棺は、縦穴の綱にゆだねられ、底へ底へと降ろされていく。その底がどこにあるのか、王は知ろうとしたことがなかった。
> そこに眠るのは、みな自分の祖だ。荒らすでないぞ。王はそう言って、町の眠りを守っていった師のことを、少しだけ誇らしそうに語った。

### 本文 (ゲーム内・王への報告 REPORTS.w46)
> 「大書庫の底の扉の下に、王家の廟が……。」
> 門の上の一行のことを伝えると、王は長いあいだ黙りこんだ。
> 「王を終わらせるな、か。……余も即位の日に、その言葉を聞かされた。古い儀式の文句だと思うておった。」
> 「歴代の王の棺は、王都の地下の縦穴から綱で降ろされ、底へ底へと葬られる。底がどこにあるのか、余は知らなかった。知ろうとも、しなかった。」
> 「オルドは、町の眠りを守るために閂を掛けていったか。……あの男らしい。」
> 「行け。だが、そこは墓だ。荒らすでないぞ。そこに眠る者は、みな余の祖だ。」
> 「近衛廊のほうで見たものも、聞かせてくれ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

# report_w37「休みのない百年」 第9章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter9/report_w37.png`
- 出荷 (WebP): `art/story/chapter9/report_w37.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter9/report_w37.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 三百年よりも昔から続いた試合が、ようやく終わった。灯籠で魂を使い回した町の話を、王は自分の手を見つめながら聞いた。
> 霊薬に支えられた王の百年も、魂を休ませずに使い続けた百年だった。灯番の子は友の魂を救おうとして棚を倒し、こぼれた火で生まれた町を焼いた。そして宰相は、その祖の言いつけのために、祖が逃げ出した町と同じことを続けている。
> 穴の底へ行け、と王は言った。それから少し間を置いて、人業たちにはきちんと休みを取らせるように、と付け加えた。

### 本文 (ゲーム内・王への報告 REPORTS.w37)
> 「闘技場の支配者を討ったか。……三百年より昔から続いた試合を、そなたが終わらせたのだな。」
> 灯籠で魂を使い回した町。棚を倒して逃げた灯番の子と、その火で焼けた町。支配者の記憶を話すあいだ、王は自分の手を見つめていた。
> 「休ませずに使い続けるから、腐る……。余の百年も、休みのない百年であった。霊薬で、魂を休ませずに使い続けてきたのだ。」
> 「祖は、魂を救おうとして、町をひとつ焼いたのだな。……正しいと信じてしたことが、誰かを焼く。王の座にいれば、いやでも覚える。」
> 「モルデンは主の言いつけを守ろうとして、主が逃げ出した町と同じことをしておる。……哀れとも、愚かとも、余には言えぬ。」
> 「オルドは穴の底へ降りたか。捨てられた魂の行き先を探しに。」
> 「行け、{弟子名}よ。……だが、そなたの人業は、よく休ませよ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

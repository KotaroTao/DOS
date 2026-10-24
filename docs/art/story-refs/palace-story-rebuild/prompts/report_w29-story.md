# report_w29「死なない命令」 第7章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter7/report_w29.png`
- 出荷 (WebP): `art/story/chapter7/report_w29.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter7/report_w29.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 魂を腐らせるな。弟子が伝えた祖の言いつけを、王は口の中で何度か転がした。
> 大樹も、霊薬も、釜も、その一言から始まった。王の長い命さえ、そのために使われた器だったのかもしれない。
> だが、と王は首をかしげた。大釜の前でモルデンが語った主の命は、魂を集めよ、だった。腐らせるなと命じられた者が、集めることならできると考え、その一つを三百年続けてきたのか。王は答えを出さないまま、塔を登るよう弟子に告げた。

### 本文 (ゲーム内・王への報告 REPORTS.w29)
> 「よどみの主を鎮めたか。……沼が、静かになったのだな。」
> 沼の島の工房で、死にかけた最初の操霊師が、ただひとつ仕上がった器に命じたこと。よどみの主の記憶を、王は身を乗り出して聞いた。
> 「魂を、腐らせるな……。」王は、その言葉を何度か口の中でくり返した。
> 「……待て。火の洞で、モルデンは『主の命は一つ、魂を集めよ』と申したのではなかったか。命じられたのは、腐らせるな、だ。集めよ、ではない。」
> 「あれは主の言いつけを、自分にできる形に言い換えて、三百年守ってきたのか。魂を途中で受けとめ、腐る前に使い切る。……余の命も、そのための器だったのだな。」
> 「言い換えたのが過ちか。言い換えねば、守れなかったのか。命じた者が死んでも、命令だけは死なぬ。王として命じてきた余には、どちらとも言えぬ。」
> 王は顔を上げた。「オルドは、塔を登っていったと申したな。……ならば、そなたも登れ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

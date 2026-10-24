# report_w21「冷えていく指先」 第5章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter5/report_w21.png`
- 出荷 (WebP): `art/story/chapter5/report_w21.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter5/report_w21.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 釜の火が消えた朝から、王の指先は冷たくなった。百年続いた命を支えていたものが、止まったのだ。
> 宰相が人業だったと知り、王は長く黙っていた。仕えられてきた年月が、別の主の命令の上にあったことを、王は受け止めようとしていた。
> 大釜の底の穴は、奈落と呼ばれていた。師の灯が燃えている限り、師はその中にいる。王はその先を知らず、追うなら必ず戻ってこいと弟子に言った。

### 本文 (ゲーム内・王への報告 REPORTS.w21)
> 「業火の主を討ったか。……釜の火が消えたのだな。今朝から、指先が冷たい。」
> 業火の主の記憶を、はじめから話した。モルデンが胸の扉を開いてみせたところで、王の肩がわずかに震えた。
> 師が大釜の底の穴へ落ちたところまで、王はひとことも口をはさまなかった。
> 「モルデンは、人業であったか。……余は百年、あの者の差し出す杯で生きてきたのか。」
> 「大釜の底の穴を、火の洞の者どもは『奈落』と呼んだという。魂が流れ落ちる、底なしの穴だ。」
> 「オルドの灯は、まだ燃えておるのだろう。ならば、あの男は奈落のどこかにおる。」
> 「奈落の先は、余にも分からぬ。師を追うなら、人業の備えを確かめよ。……必ず戻ってこい。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

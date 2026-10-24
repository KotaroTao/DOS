# report_w45「余の終わりの頁」 第11章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter11/report_w45.png`
- 出荷 (WebP): `art/story/chapter11/report_w45.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter11/report_w45.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 終わりの頁がない術の話を聞いて、王は自分の百年にも終わりの頁がなかったと言った。
> 終わりがあれば、とうに死んでいた。それが正しかったのだろう。だが、それを決めるのは自分自身であってほしかった。そう思うのはわがままか、と王は弟子に尋ねた。
> オルドはまだ答えを書けていない。救われた者の声も、不安な者の声も持って、追え。オルドが何を書こうとしているのか、そなたの目で読んでこい。

### 本文 (ゲーム内・王への報告 REPORTS.w45)
> 「大書庫の主を、鎮めたか。」
> 何度でも自分を器へ戻して、読み続けた司書のこと。濁って誰の顔も分からなくなっても、まだ読みたいと言ったこと。いちばん古い一冊の余白に、オルドが書いた言葉のこと。王は目を閉じて聞いていた。
> 「終わりの頁がない術、か。……余の百年にも、終わりの頁がなかった。」
> 「終わりがあれば、余はとうに死んでおった。それが正しかったのだろう。……だが、それを決めるのは余自身であってほしかった。そう思うのは、わがままか。」
> 「オルドは、答えを書けたら司書に最初に見せると言うたか。……あの男は、まだ書けておらぬのだな。」
> 「町の者たちは、オルドを待っておる。救われた者も、不安を抱く者も。」
> 「{弟子名}よ。追え。オルドが何を書こうとしておるのか、そなたの目で読んでこい。……町の者たちの声を、忘れずに持ってな。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

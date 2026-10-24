# report_w22「寒い玉座の間」 第6章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter6/report_w22.png`
- 出荷 (WebP): `art/story/chapter6/report_w22.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter6/report_w22.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 離宮の玉座の間は、火の気が失せたように冷えていた。王は膝掛けを胸もとまで引き寄せ、氷棚の話に耳を傾けた。
> 脚を折ってなお、石で足場を削って奥へ進んだ。そのくだりで、王の口もとがわずかにゆるんだ。昔から、そういう男だったのだろう。
> 氷棚の奥には、まだ洞窟が続いている。王は止めなかった。寒さにこわばった指で、続きを見てくるよう弟子を促しただけだった。

### 本文 (ゲーム内・王への報告 REPORTS.w22)
> 「奈落の壁に、氷の棚が……。底なしの穴にも、足場があったか。」
> 「オルドの外套が凍りついておった、と。……脚を折って、それでも先へ進んだか。」
> 王は膝掛けを引き寄せた。釜の火が消えてから、玉座の間がひどく冷えるという。
> 「氷棚の奥には、洞窟へ続く道もあったか。……その寒さだ。人業の備えを怠るな。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

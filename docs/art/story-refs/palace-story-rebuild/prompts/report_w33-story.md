# report_w33「百年目の青空」 第8章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter8/report_w33.png`
- 出荷 (WebP): `art/story/chapter8/report_w33.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter8/report_w33.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 嵐の主が鎮まった朝、離宮の窓の外に、雲ひとつない空が広がった。王の知るこの百年で、初めての青空だった。捨て砦の大手門に降り続けた雷雨も、やんだという。
> 還しても戻る。戻れば腐る。だから縛るしかなかった。宰相の選んだ道を、王は窓辺に立ったまま、一つずつ確かめるように言葉にした。
> 解かれた魂も、いずれは雨になって沼へ落ちる。王はそれも分かったうえで、青い空から目を離さなかった。オルドは、その逆を確かめに行ったのだろう。橋の向こうへ行け、と王は弟子に告げた。

### 本文 (ゲーム内・王への報告 REPORTS.w33)
> 「嵐の主を鎮めたか。……今朝、この空が晴れた。王都からも、同じ報せが届いた。余の知るこの百年で、初めての青空だ。」
> 「捨て砦からも報せが来た。大手門の雷雨が、止んだそうだ。」
> 空へ還した魂が、雨になって落ちてきたこと。モルデンが像を並べて、魂を塔に縛ったこと。話し終えても、王は窓から目を離さなかった。
> 「還しても戻ってくる。戻れば腐る。……だから縛った、か。縛られた魂が、この国の空を重くしておったのだな。」
> 「この青空は、解かれた魂の昇っていった跡だ。……その魂も、いずれ雨となって沼へ落ちるのであろう。モルデンが三百年おそれたのは、それだ。」
> 「オルドは、巡りを止めたから腐るのではないかと言うたか。……あの男は、モルデンとは逆の答えを探しに行ったのだな。」
> 「橋の向こうへ行け、{弟子名}よ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

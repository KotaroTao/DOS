# report_w41「王の資格」 第10章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter10/report_w41.png`
- 出荷 (WebP): `art/story/chapter10/report_w41.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter10/report_w41.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> オルドが魂の王になるために底へ降りたと聞いて、王は玉座の肘掛けを強く握った。器へ戻す仕組みに限りを書くという話には、長く黙った。
> 限りのない命を、霊薬に頼って百年生きてきた。そういう自分に、オルドを責める資格はない。けれど、善い王ほど誰の声も聞かなくなるというモルデンの言葉も、王には痛いほど覚えがあった。
> 勝った者が正しいとは限らない。追って、確かめて、自分の目で決めよ。それは命令ではない。人業たちにも、それぞれの灯に訊いてやれ。王はそう言い、今夜は休め、と付け加えた。

### 本文 (ゲーム内・王への報告 REPORTS.w41)
> 「モルデンを、退けたか。」
> 底に眠るもののこと。それを手にした者は魂の王となり、あらゆる命を思うままにできること。オルドがそれを取りに行ったこと。魂を何度でも器へ戻せる仕組みに限りを書き入れ、生き切った魂を誰も引き止められぬようにするために ── その限りが、イレーヌにもセラにも及ぶとしても。モルデンの記憶をすべて話し終えるまで、王は口を開かなかった。
> 「魂の王……。」王は、玉座の肘掛けを強く握った。
> 「余は百年、この国の王であった。民の命を霊薬に変えて飲んできた王だ。……限りのない命がどんな味か、余ほど知る者はおるまい。」
> 「オルドの言うことは、正しいのかもしれぬ。余には、それを責める資格がない。」
> 「だがモルデンは、悪い王ではなく、善い王を恐れたのだな。正しいと信じた王ほど、誰の声も聞かなくなる、と。……それも、余はよく知っておる。」
> 「勝ったからといって、そなたが正しいとは限らぬ。負けたからといって、モルデンが誤っておったとも限らぬ。」
> 「{弟子名}よ。追って、確かめて、そなたの目で決めよ。……余の命令ではない。そなたが決めるのだ。そなたの人業たちにも、それぞれの灯に訊いてやるがよい。」
> 「……今はまず、休め。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

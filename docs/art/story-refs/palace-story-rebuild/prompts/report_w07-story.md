# report_w07「問いを罪にした王国」 第2章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter2/report_w07.png`
- 出荷 (WebP): `art/story/chapter2/report_w07.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter2/report_w07.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 地下牢で見たものを伝えると、王は先代が操霊師たちを牢へ送ったと語った。魂を扱う者は、隠されているものに近づいてしまうのだという。
> 宰相が話を止めようとした時、王はその顔を見た。先代の頃から仕えているはずの男に、歳月の跡が見えない。
> 弟子は、師の師を閉じ込めた牢を出てきたばかりだった。ここで耳にする言葉も、やがて壁に刻まれた名のように、誰かが残さなければ消されるのだろうか。

### 本文 (ゲーム内・王への報告 REPORTS.w07)
> 王は、弟子が口を開くより先に尋ねた。
> 「地下牢の底で、何を見た。」
> 「歴代の操霊師の名、か。……先代は、操霊師を十二人、あの牢に入れた。」
> 「操霊師は魂を扱う。扱ううちに、見てはならぬものを見る。見た者は、牢へ送られた。」
> 宰相「陛下、そのお話は──」
> 「宰相。そなたは、先代の頃から宰相であったな。」
> 宰相は答えず、深く頭を垂れた。白髪の一本も無い頭を。
> 「正門も地下牢も見たそなたになら、本丸の門を開かせよう。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

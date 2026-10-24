# report_w42「命令の届かぬ所」 第11章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter11/report_w42.png`
- 出荷 (WebP): `art/story/chapter11/report_w42.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter11/report_w42.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 主をなくした人業たちが、自分の暮らしを選んでいる町。その多くが王家の操霊師の器だったと聞いて、王は長いあいだ目を伏せた。百年、その主たちを牢へ送ってきたのは自分だった。
> オルドが救い主と呼ばれていると聞くと、王は少しだけ笑った。助けた相手の名はみな覚えているくせに、礼を言われると逃げ出す男だ、と。
> その町では客であれ。あの者たちの暮らしは、あの者たちのものだ。それが、その日の王の言葉だった。

### 本文 (ゲーム内・王への報告 REPORTS.w42)
> 「階段の下に、町が……。人業だけが暮らす町か。」
> 灯籠の天井のこと。主をなくした人業たちが、主を持つかどうかも、何をして暮らすかも、自分で決めていること。弟子の話を、王は身を乗り出して聞いた。
> 「王家の操霊師の人業たちが……。余は百年、あの者たちの主を、牢へ送ってきた。」
> 「その人業たちが、余の命令の届かぬ所で、ようやく自分の暮らしを選んでおるのだな。」
> 「オルドは、そこで救い主と呼ばれておるのか。」王は少しだけ笑った。「あの男らしい。助けた相手の名は全部覚えておるくせに、礼を言われると逃げ出す。」
> 「戻り灯の陣で行き来できるか。……オルドは、そなたを帰らせる道だけは、残していったのだな。」
> 「行け。だが、その町では客であれ。あの者たちの暮らしは、あの者たちのものだ。」
> 「雨垂れの書庫で見たものも、聞かせてくれ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

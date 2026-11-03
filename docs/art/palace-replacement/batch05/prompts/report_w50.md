# report_w50「王の数え方」 第13章 ── 新規 (制作待ち)

## 保存先
- 原画 (PNG・1536×1024): `art/story-review/chapter13/report_w50.png`
- 出荷 (WebP): `art/story/chapter13/report_w50.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `docs/art/story-refs/king.png` — 基準: king
2. `docs/art/story-refs/morden.png` — 基準: morden
3. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 仕事を続けているから、生きたいのだと思う。王は、自分も臣下をそう数えてきたのではないかとつぶやいた。
> 作るなと命じれば済むのか。師と同じ問いを、王も手放せなかった。
> 水音のする道も確かめてほしい。工房が何を支えるのか見落とすなと、王は弟子を送り出した。

### 本文 (ゲーム内・王への報告 REPORTS.w50)
> 「王家の廟の下に、鉄の器を作る工房があったか。」
> 仕事の名を打たれた札と、裏に刻まれた針仕事の願いを話すと、王は指先で玉座の飾りをなぞった。
> 「命じた仕事を続けておれば、生きたいと望んでおるように見える。……余は臣下を、そのように数えておらなんだか。」
> 「オルドは、作るなと命じれば済むのか、と書いたのだな。余にも答えはない。水音のする道も確かめよ。あの工房が何を支えておるか、見落とすでない。」

## 描くもの・描かないもの (指示書 4章)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
The established elderly king in his throne room studies a copied metal order tag, troubled, tracing the armrest with one hand. Empty chancellor chair.
```


# report_w51「誰のための器」 第13章 ── 新規 (制作待ち)

## 保存先
- 原画 (PNG・1536×1024): `art/story-review/chapter13/report_w51.png`
- 出荷 (WebP): `art/story/chapter13/report_w51.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `docs/art/story-refs/king.png` — 基準: king
2. `docs/art/story-refs/morden.png` — 基準: morden
3. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 杯を持てる手の話を、王は身を乗り出して聞いた。規格に合わぬから作り直せとは、誰のための器なのか。
> 器を作ることを罪にはできないのなら、工房を壊すだけでは答えにならない。王は鋳造場の道筋を地図へ重ねた。
> その地図は、水路をたどった記録と合わせて、工房の中心へ向かう道を示すはずだった。

### 本文 (ゲーム内・王への報告 REPORTS.w51)
> 「一人のために、指の長さを変えた型か。」
> 杯を持てるようにと作られた手の話を、王は身を乗り出して聞いた。
> 「規格に合わぬから作り直せとは、誰のための器であろうな。……余の国でも、同じことがあったのであろう。」
> 「オルドも、器を作ることを罪にはできぬと書いたか。ならば、炉をすべて壊せばよいとは考えておらぬのだな。」
> 「鋳造場の道筋は分かった。水路の記録と重ね、大炉への道を確かめるがよい。」

## 描くもの・描かないもの (指示書 4章)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
The established elderly king leans forward listening to an account of a hand made for one individual. Quiet throne room; empty chancellor chair.
```


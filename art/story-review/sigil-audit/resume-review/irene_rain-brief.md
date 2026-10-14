# irene_rain「雨の音」 第8章 ── 修正 (A-30)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter8/irene_rain.png`
- 出荷 (WebP): `art/story/chapter8/irene_rain.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter8/irene_rain.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> その夜、ロアダルに静かな雨が降った。雷の気配はなく、屋根を打つ音だけが館を包んでいた。イレーヌは窓を細く開けた。
> 雨の夜には、師も必ず窓を開けたという。魂が帰ってくる音だ、と言って。セラが窓辺に並び、手のひらで雨粒を受けた。
> 空へ昇った魂が雨になって降ってくるのなら、この雨の中にもいる。イレーヌにはそれが、懐かしい足音のように聞こえた。燭台の灯は、雨音に合わせて小さく揺れていた。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_rain)
> その夜、ロアダルにも雨が降った。嵐ではない、静かな雨だった。
> 館の主は窓を少しだけ開けて、雨の音を聞いていた。
> イレーヌ「オルド様は、雨の夜は必ず窓を開けました。『魂が帰ってくる音だ』と言って。」
> イレーヌ「空へ還った魂は、雨になって、また降ってくるのですね。……だとしたら、この雨の中にも。」
> イレーヌ「モルデンは、落ちてくる雨が怖かったのでしょうか。わたしには、懐かしい音にしか聞こえないのです。」
> セラが窓辺に並んで、手のひらで雨粒を受けた。
> セラ「つめたい。……でも、なんだか、おかえりって言いたくなります。」
> 燭台の灯が、雨の音に合わせるように、小さく揺れた。

## 直すこと (指示書 3章)
- 根拠と判定: 額の原寸は杯状の掌と上向きの短い指で基準形と異なる。額のみ修正。手首内側は関節の帯と手の角度で隠れるため追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

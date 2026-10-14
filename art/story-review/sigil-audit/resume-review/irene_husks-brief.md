# irene_husks「締め直された継ぎ目」 第5章 ── 修正 (A-26)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter5/irene_husks.png`
- 出荷 (WebP): `art/story/chapter5/irene_husks.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter5/irene_husks.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> 札を受け取ったイレーヌは、書かれた手順を指でたどった。自分にも教えられなかった、セラの器の締め方だった。
> 宰相の器が壊れ続けたのは、魂を入れる前に形を急いだからだ。師はその逆を選び、一度で仕上げた。
> その夜、イレーヌはセラの継ぎ目を一つずつ締め直した。翌朝、セラの足取りは昨日より少しだけ軽かった。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_husks)
> イレーヌ「この札……オルド様の字です。」
> 館の主は札の裏の書き込みを、指でゆっくりなぞった。
> イレーヌ「セラの器の、継ぎ目の締め方です。わたしにも教えてくれなかったのに。」
> イレーヌ「モルデンは自分に似せた器を作っては、釜にくべていたのですね。……どれも、魂を入れる前に壊れてしまうから。」
> イレーヌ「オルド様は、一度で仕上げたのです。セラも、わたしも。」
> その夜、館の主はセラの継ぎ目を締め直した。
> セラ「……体が、軽いです。オルド様に仕上げてもらった日みたいに。」
> ── セラの魂のランクが上がった (灯守)。

## 直すこと (指示書 3章)
- 根拠と判定: 額を広く取り直した原寸で、金の印は圧縮した杯状の掌と上向きの突起。承認済みの斜めの平行な指3本・短い手首とは異なるため額のみ修正。先の狭い切り出しでは掌を見落としたため判定を訂正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

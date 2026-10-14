# irene_crest「捨てられなかった器」 第7章 ── 修正 (A-28)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter7/irene_crest.png`
- 出荷 (WebP): `art/story/chapter7/irene_crest.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter7/irene_crest.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> イレーヌはセラの腕をそっと持ち上げ、肘の継ぎ目の内側を弟子に見せた。灯にかざすと、そこにも小さく同じ印が彫られていた。
> 師は器を捨てたことがない、とイレーヌは言った。思うように動かない器も、直して、仕上げて、名を呼んだのだと。作業台には、捨て場から写してきた古い継ぎ方の紙が広げられていた。
> 古い継ぎ方で肘を締め直されると、セラは腕を何度か曲げ伸ばしした。わたしはあの子たちの妹なんですね、と彼女は笑い、その子たちの分まで動きます、と付け加えた。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_crest)
> イレーヌ「一門の印の器が、山ほど捨てられていたのですね。」
> 館の主は、作業台に腰かけたセラの腕を、そっと持ち上げた。肘の継ぎ目の内側に、小さく同じ印が彫られている。
> イレーヌ「オルド様は、器を捨てたことがないのです。うまくいかない継ぎ目は、仕上がるまで何度でもほどいて、継ぎ直していました。」
> イレーヌ「札の裏に、オルド様が捨て場の器の継ぎ方を写していました。三百年よりも古い、一門の継ぎ方です。」
> その夜、館の主は古い継ぎ方を一つずつ試しながら、セラの肘と膝の継ぎ目をほどいて、組み直した。
> セラ「……わたし、捨てられた子たちの、妹みたいなものなんですね。」
> セラ「だったら、あの子たちの分まで、ちゃんと動きます。」
> ── セラの魂のランクが上がった (灯守)。

## 直すこと (指示書 3章)
- 根拠と判定: 原寸で額と肘の内側の主題の印が杯状の別形。額と肘の既存位置の印のみ承認済み幾何学形へ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Also replace ONLY the small gold crest already shown on the inner elbow joint at the center of the picture with the same approved geometric crest, at its existing position and scale. Do not change any joint or hand anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

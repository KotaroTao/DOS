# irene_order「灯を守る理由」 第7章 ── 修正 (A-29)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter7/irene_order.png`
- 出荷 (WebP): `art/story/chapter7/irene_order.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter7/irene_order.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> 芯を整えながら、イレーヌは師から受けた言いつけを口にした。灯を、絶やすな。彼女が受け取った言葉は、それひとつだった。
> 師が帰らなければ、理由も分からなくなったまま、三百年でも灯を守っていたかもしれない。言いつけを守るだけなら、わたしも宰相も変わりません、と彼女は言った。
> 毎晩おやすみを言いに来ますから、とセラが燭台の向こうから顔を出した。イレーヌは小さく笑った。宰相のそばにも、そう言ってくれる誰かがいればよかったのに、と。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_order)
> イレーヌ「魂を、腐らせるな……。それが、モルデンの主の言いつけだったのですね。」
> 館の主は燭台の芯を整えながら、しばらく黙っていた。
> イレーヌ「わたしにも、言いつけがあります。オルド様が出かける前の晩に、ひとつだけ。……灯を、絶やすな。」
> イレーヌ「もしオルド様が帰ってこなかったら、わたしも三百年、この灯を守り続けたかもしれません。理由も、わからなくなったまま。」
> イレーヌ「言いつけは、守っているうちに形が変わります。わたしも『灯を絶やすな』を、いつのまにか『ここで待っていろ』と聞いていました。」
> イレーヌ「でも、わたしには、{弟子名:様}がいます。灯を守る理由を、毎晩、思い出させてくれる人が。」
> セラ「わたしも、思い出させます。毎晩、おやすみを言いに来ますから。」
> イレーヌは、小さく笑った。

## 直すこと (指示書 3章)
- 根拠と判定: 原寸で額の印が杯状の掌と上向きの短い突起の形。基準の角張った斜めの掌・右の平行な指3本へ額のみ修正。関節内側が隠れる箇所は追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

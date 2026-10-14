# irene_names「名を呼ぶ人」 第10章 ── 修正 (A-32)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter10/irene_names.png`
- 出荷 (WebP): `art/story/chapter10/irene_names.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter10/irene_names.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> イレーヌという名は、師がつけたものだった。目を開けて最初に耳にしたのが、自分の名だったという。
> 名を呼ばれると、灯が落ち着く。ここにいていいと言われた気がする。だから、三百年ひとりで札に名を書いてきた宰相のことを、彼女は責めきれずにいた。あの人は悪い人なのでしょうか、とイレーヌは燭台を見つめたまま尋ねた。
> モルデンさん、って呼んであげればいいんです、とセラが言った。イレーヌは答えず、灯の芯をほんの少しだけ長くした。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_names)
> イレーヌ「モルデンが、捨てられた魂に名をつけていたのですね。」
> 館の主は燭台の灯を見つめたまま、しばらく黙っていた。
> イレーヌ「わたしの名は、オルド様がつけてくださいました。目を開けて最初に聞いたのが、自分の名でした。」
> イレーヌ「名を呼ばれると、灯が落ち着くのです。ここにいていい、と言われた気がして。」
> イレーヌ「モルデンも、きっと誰かに名を呼ばれて目を開けたのでしょう。だから、名の無い灯を放っておけなかった。」
> セラ「わたしたちが呼んであげればいいんです。モルデンさん、って。」
> イレーヌ「……そうですね。会えたら、呼んであげてください。」
> イレーヌ「旧都を沈めた人です。魂を煮た人です。……それなのに、札の字が、あんなにていねいなのです。」

## 直すこと (指示書 3章)
- 根拠と判定: 額の原寸で杯状の掌と短い上向きの指を確認。基準の斜めの平行な指3本・角張った掌へ額のみ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```


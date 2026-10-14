# irene_rest「休む灯」 第9章 ── 修正 (A-31)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter9/irene_rest.png`
- 出荷 (WebP): `art/story/chapter9/irene_rest.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter9/irene_rest.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> 魂は、休ませないと腐る。イレーヌはその言葉を小さくくり返しながら、眠りについた人業たちの胸の灯を、一体ずつのぞいて回った。
> 師はどれほど急ぐ時でも、迷宮から戻った器を、灯が落ち着くまで次へ出さなかった。館に伝わるその決まりは、祖が灯番の子だった頃から、一門に受け継がれてきたものだったのかもしれない。
> わたしたちは、ちゃんと休みます、とセラが言った。あなたも、ですよ。イレーヌはそう言って、弟子の手もとの灯を、自分の手で落とした。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_rest)
> イレーヌ「魂は、休ませないと腐る……。」
> 館の主は、並んで眠る人業たちの胸の灯を、ひとつずつ見て回った。
> イレーヌ「オルド様は、どんなに急ぐ時でも人業を休ませました。迷宮から戻った器は、灯が落ち着くまで、決して次へ出さなかったのです。」
> イレーヌ「魂の安定度、とわたしたちは呼んでいます。……あれは、オルド様が祖から受け継いだ、いちばん大事な言いつけだったのですね。」
> イレーヌ「……わたしも、オルド様がいなくなってから、一晩も休んでいませんでした。灯の番を代わってくれる人が、いなかったので。」
> セラ「じゃあ、今夜はわたしが灯の番をします。イレーヌも、休んでください。」
> イレーヌは少し迷ってから、うなずいた。
> イレーヌ「{弟子名:様}も、ですよ。……今夜は、もうお休みください。」

## 直すこと (指示書 3章)
- 根拠と判定: 額の原寸で杯状の掌と短い上向きの指を確認。基準の斜めの平行な指3本・角張った掌へ額のみ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

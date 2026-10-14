# w16_legs「根の中を歩いた脚」 第4章 ── 修正 (A-24)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter4/w16_legs.png`
- 出荷 (WebP): `art/story/chapter4/w16_legs.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter4/w16_legs.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/apprentice.png` — 基準: apprentice

### 本文 (ストーリー一覧)
> 水の引いた大水槽の底で、根の筋が人業の脚を抱えていた。黒鉄の継ぎ目と、くるぶしの印が、セラのものだと告げていた。
> 脚の表には、細かな傷が幾筋も走っていた。流れに運ばれながら、根の中を自分の足で進もうとした跡のように見えた。
> 頭、腕、胴、そして脚。別々の迷宮で拾い集めたものが、これで一人の形になる。弟子は脚を丁寧に包み、館への帰り道を急いだ。

### 本文 (ゲーム内・師の手がかり STORY_CELLS.w16_legs)
> 水の引いた大水槽の底で、根の筋が何かを抱えていた。
> 人業の脚が一対。黒鉄の継ぎ目。くるぶしの内側に、灯を掌に載せた手。
> 幹を昇る流れに運ばれ、ここで根に絡め取られたのだろう。
> 脚には、細い傷がいくつも残っていた。根の中を、自分の足で歩こうとした跡のように。
> 頭と、腕と、胴と、脚。……これで、セラの体がそろう。
> 館へ連れて帰らなければ。

## 直すこと (指示書 3章)
- 根拠と判定: 原寸で印が片足の甲にあると確認。正典はくるぶし内側。甲の印を消し、見える内くるぶし近くの木面に小さく配置する。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: remove ONLY the black crest from the TOP OF THE FOOT closest to the viewer, restoring its existing wood grain. Carve one SMALL dark approved crest into the exposed inner ankle-side wooden surface immediately beside/above that foot's black iron ankle joint. Keep all toes, feet, legs, roots, joints, pose, proportions, the apprentice, and the scene exactly as they are. Do not place it on the shin or the top of the foot. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```


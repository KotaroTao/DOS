# irene_torso「お帰りを重ねる仕事」 第3章 ── 修正 (A-23)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter3/irene_torso.png`
- 出荷 (WebP): `art/story/chapter3/irene_torso.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter3/irene_torso.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> セラの頭と腕のそばに、胴が置かれた。イレーヌは急いで組み立てず、戻ってきたものを一つずつ確かめた。足りない場所も、戻った場所も、よく知っている手だった。
> 師が胸に残した紙を読み、彼女はセラが誰を守ったのかを知った。昔からそんな子だったと語る声に、責める響きはなかった。
> まだ脚が足りない。師も帰っていない。それでも館の台の上には、別々の場所から取り戻された仲間がいる。弟子は空いている場所を見て、次に持ち帰るものを考えた。

### 本文 (ゲーム内・館の語り IRENE_BEATS.irene_torso)
> イレーヌ「……お帰りなさい、セラ。」
> イレーヌは胴を抱きとめ、燭台の傍らに置いた頭と腕の隣へ、そっと並べた。
> イレーヌ「頭と、腕と、胴。……あとは脚だけですね。」
> イレーヌ「この子、オルド様をかばったのですね。昔から、そういう子でした。」
> 彼女は胴の扉から師の紙を取り出し、何度も読み返した。
> イレーヌ「『この子を頼む』とのことです。……頼まれなくても、わかっているのですが。」

## 直すこと (指示書 3章)
- 根拠と判定: 原寸の額の印は炎と複数の短い突起が一体化した形で、承認済みの角張った掌・独立した炎と一致しない。額のみ修正。腕の内側は金の継ぎ目と手の向きで印を判別できず追加は保留。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```


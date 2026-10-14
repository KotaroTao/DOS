# ch5_end「底のない穴の上で」 第5章 ── 修正 (A-25)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter5/ch5_end.png`
- 出荷 (WebP): `art/story/chapter5/ch5_end.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter5/ch5_end.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/sera.png` — 基準: sera
3. `docs/art/sera/sera-r1-final.png` — セラの原画 (必ず)

### 本文 (ストーリー一覧)
> 釜の火は消え、王都の床下の熱は少しずつ引いていった。それでも館の燭台は、変わらずに燃えていた。
> 宰相を作った最初の操霊師が誰なのか、まだ誰も知らない。師は奈落の中で、その答えに近づいているのかもしれない。
> 弟子は人業たちの支度を整えた。底のない穴へ降りるのは、帰ってくるためだ。館の扉の前で、イレーヌが見送っていた。

### 本文 (ゲーム内・章の結び CHAPTER_END[5])
> 釜の火は消えた。王の指先は冷え、杯はもう満たされない。
> 宰相モルデンは、人ではなかった。三百年よりも昔、ある操霊師に作られた最初の人業だった。その主の名は、まだ誰も知らない。
> 師は大釜の底の奈落へ落ちた。それでも館の燭台の灯は、落ちていく者を待つように、細く長く燃えている。
> ── 物語は第六章「氷結回廊」へ続く。

## 直すこと (指示書 3章)
- 根拠と判定: 額の原寸では金の炎だけで掌・右の指3本・手首が見えない。額のみ修正。盾の大きな印は配置根拠不足のため要確認として保持。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Keep the existing shield and its gold emblem unchanged: that shield placement is still under review. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

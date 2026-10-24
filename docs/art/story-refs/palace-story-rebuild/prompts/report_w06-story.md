# report_w06「守れと命じ、迎えなかった」 第2章 ── 修正 (A-66)

## 保存先 (同じ名前で上書き)
- 原画 (PNG・1536×1024): `art/story-review/chapter2/report_w06.png`
- 出荷 (WebP): `art/story/chapter2/report_w06.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `art/story-review/chapter2/report_w06.png` — 直す元の絵 (いちばん先に渡す)
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 亡兵の隊列を報告すると、王は援軍を送らなかった過去を語った。国を守るためだったという説明が、玉座の脇から添えられた。
> だが、守備隊が守り続けたものは何だったのか。地上に戻ることさえできない魂を見たあとでは、理由を聞くだけで納得はできなかった。
> 王は地下牢の話になると、知らないことにしていると認めた。知らないことと、知らないままでいることの違いが、その日ほどはっきりしたことはなかった。

### 本文 (ゲーム内・王への報告 REPORTS.w06)
> 「亡兵どもは、まだ持ち場を守っておったか。……百年経っても、か。」
> 「あの砦は、先代の王が見捨てた。北の軍勢に囲まれた折、援軍を送らず、王都の門を閉ざした。」
> 「『持ち場を守れ』──それが、守備隊が受け取った最後の言葉だ。」
> 宰相「国を守るための、苦いご決断にございました。」
> 宰相は微笑んだまま、目を伏せた。
> 「分かっておる。……余も、そう教えられて育った。」
> 「オルドは地下牢の鍵を借りていったか。あの牢に何があるか、余は知らぬ。……知らぬことにしておる。」
> 「正門の大手門は、いまも雷雨の中だという。行くなら、火を携えてゆけ。」

## 直すこと (指示書 3章)
- 今回のユーザー指示で背景再生成の旧方針を置き換える。本文は変更しない。修正前原画・再利用前景・接地影・遮蔽・切り抜き範囲・拡縮率・比較画像を保存する。
- 王宮の倉庫 report_w01、回廊の肖像 report_w25、宝物庫 minePass は対象外。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except: Use the exact approved fixed palace background from docs/art/story-refs/palace-3d/finished/ as the unchanged compositing base. Newly draw only the characters, scene-specific props and shadows as transparent foreground layers using the approved character sheets and the actual scene text. Never regenerate the entire scene or repaint the architecture/furniture. Crop and uniformly scale the background only, recording source, crop and scale. No mirroring or furniture relocation. Shared daylight/evening variants are fixed once for all matching scenes. Match seating, floor contact, occlusion, hand contact, eye lines and blue/amber lighting naturally. Keep the original story IDs and narrative unchanged. See the saved per-scene foreground instructions and composition manifest in docs/art/story-refs/palace-story-rebuild/.
```

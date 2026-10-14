# 地底大空洞と霧の迷い森の情景5枚

`node tools/storyart/prompt.mjs lore_<迷宮ID>` が出すストーリー本文・制作指示に沿って、1536×1024の専用原画を制作した。名前から組み立てた初期案は採用せず、本文を確認して描き直した5枚を登録している。物語本文は変更していない。

| 迷宮 | 本文に合わせた主題 | WebP | ゲーム画面 |
|---|---|---|---|
| 灯籠の吹き溜まり w38 | 闘技場の穴から落ちて積もる鉄とガラスの灯籠、漏れる濁り魂、拾って並べ直した跡 | [画像](../../../story/dungeons/lore_w38.webp) | [出撃・スマホ](w38-departure-390.png)・[PC](w38-departure-1280.png)・[由来](w38-lore-390.png) |
| 黒い灯の地底湖 w39 | 沈んだ灯籠の明かり、岸に並べた名札つきの灯籠、同じ手による走り書き | [画像](../../../story/dungeons/lore_w39.webp) | [出撃・スマホ](w39-departure-390.png)・[PC](w39-departure-1280.png)・[由来](w39-lore-390.png) |
| 名を刻む石窟 w40 | 天井まで続く壁のくぼみ、一つずつ納めた灯籠と刻まれた名、眠りを守る封じ | [画像](../../../story/dungeons/lore_w40.webp) | [出撃・スマホ](w40-departure-390.png)・[PC](w40-departure-1280.png)・[由来](w40-lore-390.png) |
| 底なしの大伽藍 w41 | 天井の見えない自然の巨柱、さらに下る石段、三百年立ち続けた床のくぼみ | [画像](../../../story/dungeons/lore_w41.webp) | [出撃・スマホ](w41-departure-390.png)・[PC](w41-departure-1280.png)・[由来](w41-lore-390.png) |
| 霧の迷い森 ws3 | 道を隠す霧、奥の泉の周りの足跡、水辺で互いを待ち続ける気配 | [画像](../../../story/dungeons/lore_ws3.webp) | [出撃・スマホ](ws3-departure-390.png)・[PC](ws3-departure-1280.png)・[由来](ws3-lore-390.png) |

[5枚の縮小見本](five-small.jpg)で384×256の見え方を確認。原画は一つ上の階層の `lore_<ID>.png` に保存。`python3 tools/storyart/build.py` で品質88のWebP、画像台帳、SWの先読み登録、[本文との比較](../../review/dungeons.md)、進み具合を生成した。

出撃画面も5迷宮のWebPを使う。読み込み失敗時は既存の各迷宮の情景描画に戻る。

確認: build.pyの登録・指示書・読み物の検査、変更JSの構文、差分の空白、WebP形式と寸法、縮小見本。Chromiumで390/1280px幅の全5迷宮の出撃画像、390px幅の全5迷宮の由来画像、取得失敗時の代替表示を確認。

# irene_rain（A-30）：額の一門の印

PR [#994](https://github.com/KotaroTao/DOS/pull/994) をユーザー指示でmainへマージし、Pages公開成功・公開サイトの版一致を確認。最新main `07f4d5f6` から今回の作業を行った。この1枚はユーザー確認・mainへのマージ待ち。

現在原画 `art/story-review/chapter8/irene_rain.png` の額の旧印だけを修正。正本 `docs/art/story-refs/sigil.png` の金色から輪郭を抽出し、12度回転して額の傾き・既存の小さい寸法・金色へ合わせた。形の描き直しや画像生成は行っていない。

旧印と近くの陰は境界色からラプラス補間で除去し、正本の金の濃淡を保持して合成。角張った掌、左親指1本、右の平行な指3本、短い手首、独立した涙形の炎1つを確認した。人物・顔・目・髪・手・胸の灯・窓・雨を保持。手首内側は関節の帯と手の角度で隠れるため印を追加しない。

## 比較

左が修正前、右が採用候補。

![額の拡大比較](comparison-detail-8x.png)

![全体384×256ずつの比較](comparison-small.jpg)

左がPNG原画、右が出荷WebP。WebPでも右指3本と独立した炎の保持を拡大で目視確認。

![原画とWebP](comparison-master-webp-8x.png)

## 検査と再現

- 原寸1536×1024、変更1,000画素。変更範囲 `(984,275)–(1020,328)`（右下を含まない）。
- 額の許可領域 `(981,273)–(1022,331)` の外側1,570,486画素のRGBは修正前と完全一致。
- [validation.json](validation.json)：修正前・正本・再現候補・採用原画・WebPのSHA-256、領域外一致、153枚の現在ハッシュ照合。
- [build-log.txt](build-log.txt)：`python3 tools/storyart/build.py` 成功。変更1枚のWebP変換、登録・指示書・読み物の検査が通過。
- 開始時と採用後、153枚の現在ハッシュはprogress.jsonとすべて一致。承認済み9枚を再編集していない。

```bash
python3 art/story-review/sigil-audit/composite-irene-rain/make_candidate.py
python3 art/story-review/sigil-audit/composite-irene-rain/verify.py
```

要Pillow・NumPy・SciPy。再現スクリプトは今回の現在原画から保存した [修正前](../../fixes/irene_rain-sigil-python-before.png) と正本のハッシュに固定し、現在原画へ書き込まない。過去の候補・before/・rejected/・古い部分参照は新規編集の入力に使用していない。

進捗はtrack.pyで保存。修正・確認済み10枚（今回の1枚は承認待ち）、修正保留3枚、要確認9枚、修正不要131枚。要確認9枚、ch5_endの盾、irene_restの開いた蓋の金の図形は、配置根拠・視認性不足の既存の理由で保留。irene_restの修正済みの脚・胸も保持。次はirene_rest（A-31）の額のみ。

[第八章の確認ページ](../../review/chapter8.md) ／ [縮小の見本](../../review/chapter8-small.jpg)

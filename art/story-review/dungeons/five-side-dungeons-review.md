# 依頼の迷宮5か所の描き下ろし

`node tools/storyart/prompt.mjs lore_<迷宮ID>` の由来本文と制作指示に合わせ、各1536×1024の原画を制作した。`python3 tools/storyart/build.py` で品質88のWebPへ変換し、踏破後の由来・Service Worker・確認ページに登録。出撃画面にも同じ情景を表示する。

| 迷宮 | 本文に合わせた主題 | WebP | スマホ | PC |
|---|---|---|---|---|
| 銀業の隠れ里 | 霧の里で暮らす銀の小人と、守り手の空の鎧・石の人形 | [画像](../../story/dungeons/lore_ws4.webp) | [表示](five-side-dungeons-review/ws4-mobile.png) | [表示](five-side-dungeons-review/ws4-desktop.png) |
| 獄吏の詰所 | 寝床、押収品の箱、鍵束、人の強さを越えた番人 | [画像](../../story/dungeons/lore_ws7.webp) | [表示](five-side-dungeons-review/ws7-mobile.png) | [表示](five-side-dungeons-review/ws7-desktop.png) |
| 沈んだ書庫 | 内から閉じた扉、封をした書の箱、名を墨で消した写し | [画像](../../story/dungeons/lore_ws8.webp) | [表示](five-side-dungeons-review/ws8-mobile.png) | [表示](five-side-dungeons-review/ws8-desktop.png) |
| 黒曜の切り場 | 黒いガラスの崖、古い刃と鏡、割れ口の研ぎ跡 | [画像](../../story/dungeons/lore_ws9.webp) | [表示](five-side-dungeons-review/ws9-mobile.png) | [表示](five-side-dungeons-review/ws9-desktop.png) |
| 火守りの僧院 | 釜の炎に浮かぶ顔、目を閉じて祈る火守り、底の帳面 | [画像](../../story/dungeons/lore_ws10.webp) | [表示](five-side-dungeons-review/ws10-mobile.png) | [表示](five-side-dungeons-review/ws10-desktop.png) |

原画は同じディレクトリの `lore_<迷宮ID>.png`。配信する5枚は合計約2.3MB。生成指示は [five-side-dungeons-generation.json](five-side-dungeons-generation.json)、本文との比較は [dungeons.md](../review/dungeons.md)、縮小の見本は [dungeons-small.jpg](../review/dungeons-small.jpg)。

確認: 原画とWebPの1536×1024寸法、登録の整合、指示書と本文、読み物の解放・状態保全、オープニング画像の整合、JS構文、差分の空白。Chromiumで幅390/1280pxの全5か所を表示し、画像の取得失敗時に既存の情景へ戻ることも確認。ブラウザ実行時エラーなし。表示検査の記録は [checks.json](five-side-dungeons-review/checks.json)。

# 第一章・王宮の背景固定用素材

背景は [palace-front.png](../palace-front.png) の元画像をそのまま使う。背景を描き直さず、画像生成ツールで作成した透明な人物素材だけを合成する。

| 場面 | 生成した人物素材 | 位置合わせ済みの前景 |
|---|---|---|
| report_w02 | [素材](report_w02-sheet.png) | [前景](report_w02-foreground.png) |
| report_w03 | [素材](report_w03-sheet.png) | [前景](report_w03-foreground.png) |
| report_w04 | [素材](report_w04-sheet.png) | [前景](report_w04-foreground.png) |
| minePass | [素材](minePass-sheet.png) | [前景](minePass-foreground.png) |
| report_w05 | [素材](report_w05-sheet.png) | [前景](report_w05-foreground.png) |

素材の左から王・弟子・宰相。人物だけを分離し、元画像の椅子・床の位置に合わせて拡縮・配置する。通行証を受け渡す王と弟子は、接している手と紙を分離せず、一組として配置する。王の制止の手は宰相へ向ける。

再生成: `node tools/storyart/palace-fixed.mjs`（ImageMagickが必要）。続けて `python3 tools/storyart/build.py`。

検査: `node tools/storyart/palace-fixed.mjs --check`。人物に隠れない背景の画素一致と、可逆圧縮した出荷WebPの全画素が完成原画に一致することを検査する。背景のSHA-256と場面別の検査結果は [verification.json](verification.json) に保存。

これは制作資料。ゲームには登録しない。

# 第十二章・追加制作4枚

原画はそれぞれ1536×1024のPNG。各場面の `node tools/storyart/prompt.mjs <場面ID>` の本文・参照順・英語指示に従って制作。

| 場面 | 題名 | 確認・修正 |
|---|---|---|
| mem_w49 | もう、よい | 二つの時代を霞でつなぐ一枚絵。オルドは基準画像と第十一章mem_w45を参照。外套・手袋なし、傷んだ暗い灰色のシャツ、焼けた指先。下降階段と片脚を引きずる姿勢を明確化（済） |
| report_w49 | 余が決めた日に | 朝の青空、自分の手を見る現在の老王、穏やかな笑み、膝掛け、空の宰相の席 |
| irene_enough | 訊く人 | 館の燭台の形はopening/flame.pngを優先。笑うイレーヌと両拳を上げるセラ、そばで笑う弟子。額の印をsigil.pngの左親指・右3本の指・独立した炎へ修正（済） |
| ch12_end | 答えを聞くまで | 空の玉座と殻のかけら、小さな昇る灯、刷毛を下ろした防腐師、空の棺。赤い熱が漏れる下降階段へ修正（済） |

制作済みの廟の王・玉座・防腐師・棺は、[既存pre_w49](https://github.com/KotaroTao/DOS/blob/codex/chapter12-story-art/art/story-review/chapter12/pre_w49.png)を取得し、目視確認して生成時の参照に使用。同ブランチのreport_w48も画風の照合に使用。

irene_enoughの指定参照8点はすべて確認。生成ツールの5ファイル上限に合わせ、後半4点（セラ原画、小道具シート、irene_roots、irene_familiar）だけを順番どおり縦に連結した参照シートとして渡した。完成原画は独立した一枚絵。

修正前の2枚は `art/story-review/fixes/mem_w49-before.png` と `art/story-review/fixes/ch12_end-before.png` に保存。

本文・ゲームの進行データは変更していない。出荷WebP・画像登録・確認ページ・縮小見本は `python3 tools/storyart/build.py` で生成する。

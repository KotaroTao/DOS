# Dead Sea Games 起動ロゴ

採用案1：アイボリーの文字を主役に、カトラスと波を添えたロゴ。
原画は `dead-sea-games-master.png`、ゲーム用は `art/branding/dead-sea-games.webp`（品質90）。

起動後は約5秒表示し、タイトルの素材がそろったら600msでフェードアウトする。
クリック・タップはフェードを省いてタイトルへ進む。読込中のクリックも保持し、準備が済み次第進む。

検証：`python3 tools/branding/browser-check.py`（localhost:8000）。

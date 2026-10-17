# 画像読み込みの館の灯

画面左下へ出す共通の待機表示。形の基準は館の灯の正本 `art/opening/flame.webp`（短い金の支柱・幅広い円形台座・一本の白い蝋燭）。この基準画像を参照して専用の透過原画 `master.png` を制作した。

原画を縦横比を保って128×192へ縮小し、WebP（quality=88、method=6）へ圧縮。Base64として `src/loadingcandle.js` へ埋め込む。待機表示自身の通信待ちを作らないため、別の画像ファイルは配信しない。

全体を42×63 CSS pxで表示する。本体は静止し、画像の上26%だけを別の層へ切り出して火を揺らす。取得完了時に薄く消え、取得失敗時と動きを減らす設定では静止する。原画は公開物から除外される `docs/` に保存。

確認: `python3 tools/performance/candle-loading-browser.py`（localhost:8000が必要）。

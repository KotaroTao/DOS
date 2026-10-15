奉納品21〜40の透過原画

番号は src/catalog/misc.js の slot === "misc" の収集品108種の並び。
対応表: items.json。品名・説明・性能・IDは変更しない。
原画: master.png（画像生成による4列5行の20品。説明をもとに個別意匠を指定）。
出荷物: art/misc/<id>.webp（各320×320、透過、quality=92）。
一覧: preview.jpg。ブラウザの一覧と詳細の共通描画口: browser-preview.png。

再作成: python3 tools/miscart/build-21-40.py（Pillow・NumPy・SciPy）
確認: python3 -m http.server 8000 を起動後 node tools/miscart/verify-21-40.cjs
20品の成功時・取得失敗時、縮小/詳細描画、キャッシュ、対象外の既存品を確認。
原画・見本・制作記録は公開対象外の docs/ に保存する。

# 名のある強敵24体のイラスト

森の小屋の3体（`docs/art/prologue-enemies/preview.png`）を画風の基準とし、`NAMED_FOES` に登録された全24体を制作。暗い輪郭、左上の光、落ち着いた色と細かな質感をそろえ、図鑑の説明にある体・装備・能力を描き分けた。

原画は `sheet-1.png`〜`sheet-4.png`。個体の一覧・図鑑本文・切り出し範囲・寸法は `manifest.json`。個別画像の一覧は [preview.jpg](preview.jpg)。

出荷用は `art/monsters/<ID>.webp` の透過ロスレスWebP24枚（計約7.7MiB）。墓所の君主・子産みヒルの女王の既存WebPも同じシリーズで更新した。`src/monsterphotos.js` と `sw.js` に登録し、戦闘・盤面・図鑑で共用する。能力・出現条件・文章は変更していないため、酒場の心得の変更はない。

再生成: `python3 tools/named-foes/build.py`（Pillowが必要）。原画は公開対象外の `docs/` に保存し、ゲーム用フォルダにはWebPだけを置く。

検証: `python3 -m http.server 8000` の起動後、`node tools/named-foes/verify.cjs`（Playwright・Chromiumが必要）。24体の網羅・画像読み込み・戦闘用ビットマップの非空・能力や文章の不変・画像取得失敗時の旧絵への復帰を確認。図鑑・盤面・戦闘の確認画像は同じフォルダに保存する。

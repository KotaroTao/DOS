# 銀業の隠れ里の魔物

森の小屋の3体（`../prologue-enemies/preview.png` 上段）を画風の基準に、図鑑の説明・伝承・能力を参照し、未作成だった「黄金の守り像」`bs_goldgolem` を透過ロスレスWebPで追加した（363×443、約188KiB）。暗い輪郭、左上の光、重い黄金の体と頭上で組んだ両拳で、図鑑の守り崩しを表現した。

最新mainでは他の12体が作成済みだったため、画像・登録をそのまま共用する。通常敵の自走バリスタ・亡き守備隊長・亡霊騎士・雷電の騎士・骨の巨兵・キノコ人の巨体・苔生す岩塊・霧の古木、共通の銀業・金業・銀業の王・マスターミミックが該当する。作成済みの通常ミミックも維持。ws4に主・専用の強敵はない。同じIDが出る別の迷宮にも今回の1枚が反映される。

原画は `guardians-master.png`。他8体は制作途中の案であり、出荷・差し替えをしない。`python3 tools/silver-village/build-enemies.py`（Pillow・NumPy・SciPy）は黄金の守り像だけを輪郭で切り出し、透過の余白を付けて `art/monsters/bs_goldgolem.webp` を再生成する。

既存の `src/monsterphotos.js` と `sw.js` へ1枚を追加し、戦闘・盤面・図鑑で表示。能力・技・説明・伝承・出現条件・セーブ形式とCACHEのdos-devは維持。新機能・戦闘ルールの変更はないため酒場の心得は更新しない。

## 確認

HTTPサーバーをポート8000で起動し、`node tools/silver-village/verify-enemies.cjs`（Playwright・Chromium）を実行する。

- 通常敵9種・金属3種・宝箱2種の全14種が登録済みで、新規1体が空でない戦闘画像へ描かれる。
- 能力値や説明・既存のドット絵が変化しない。
- WebP取得失敗時も旧絵で正常に起動する。
- PC幅の一覧と携帯幅の図鑑・盤面・戦闘、JS構文、SW登録と寸法、物語の画像登録・読み物の整合性を確認。

確認画像: [今回の追加](preview.png)・[図鑑](codex-mobile.png)・[盤面](board-mobile.png)・[戦闘](battle-mobile.png)。

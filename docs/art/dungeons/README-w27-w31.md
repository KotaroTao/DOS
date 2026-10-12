# 器の捨て場〜嵐を鳴らす鐘楼の探索盤面

地下墓地と同じ描き下ろし素材の方式で、w27〜w31（全55階）の床・未踏の蓋・壁を更新する。

| 迷宮 | 蓋の意匠・床の素材 | 変更前 | 変更後 |
|---|---|---|---|
| w27 器の捨て場 | 木の器の顔・手・胸板、泥に沈む木片と欠片 | [盤面](review-w27-w31/w27-before.png) | [盤面](review-w27-w31/w27-board.png) |
| w28 毒霧の葦原 | 葦の束・根・葉、枯れ葦と湿った土 | [盤面](review-w27-w31/w28-before.png) | [盤面](review-w27-w31/w28-board.png) |
| w29 よどみの底 | 水の輪・古い門・絡む根、水と泥に覆われた敷石 | [盤面](review-w27-w31/w29-before.png) | [盤面](review-w27-w31/w29-board.png) |
| w30 風鳴りの螺旋 | 螺旋・風の渦・段の紋、弧を描く塔の石床 | [盤面](review-w27-w31/w30-before.png) | [盤面](review-w27-w31/w30-board.png) |
| w31 嵐を鳴らす鐘楼 | 鐘・鐘の支え・三つの鐘、青銅の留め具と石床 | [盤面](review-w27-w31/w31-before.png) | [盤面](review-w27-w31/w31-board.png) |

[スマホ全画面](review-w27-w31/after-mobile.png) · [初期配置](review-w27-w31/initial-mobile.png) · [検査結果](review-w27-w31/checks.json)

比較は同じ乱数の種を使い、床を確認するため左下の一部を開いた制作見本。初期配置は別の画像として残す。

## 原画と配信画像

地下墓地の原画を直接参照し、画像生成で各迷宮につき1536×1024の原画を2枚制作した。

- `w27`〜`w31` の `*-materials-master.png`: 上段に蓋3種、右下に壁材。蓋の区画は幅512px。w30だけ原画の実際の境界に合わせ高さ488px、それ以外は512pxで切り出す。下段左・中央は制作見本。
- 同じIDの `*-floor-master.png`: 継ぎ目のない一枚の床。盤面の縦横比に合わせて切り出し、反復や鏡合わせで敷き詰めない。
- 配信用は `art/dungeon/<id>-materials.webp` と `<id>-floor.webp`。品質88、10枚合計約6.1MiB。原画と確認画像は公開配置から除外される。

`src/cryptpaint.js` の登録に5迷宮を追加し、床・蓋は論理寸法の3倍で保持する。螺旋の素材境界以外は既存の描画を共用する。人物・小物・魂火もmainの共通素材を使う。蓋の模様は中身と無関係で、ゲーム結果を決める乱数を消費しない。酒場の心得 `t_swamp_tower_stonework` に模様と足元の見方を追加した。

毒の沼・帯電した床・底なしの泥穴・吹き抜けは既存の表示を重ね、発生条件や通行判定は変えない。画像の取得待ち・失敗・不正寸法では旧描画を使い、ほかの迷宮の読み込みを妨げない。

## 再変換・確認

```bash
bash tools/crypt/build-dungeons.sh w27 w28 w29 w30 w31
python3 -m http.server 8000
# 別の端末。Playwrightのあるnode_modulesをNODE_PATHに指定する。
NODE_PATH=/path/to/node_modules CRYPT_REVIEW_OUT=docs/art/dungeons/review-w27-w31 node tools/crypt/verify-dungeons.cjs w27 w28 w29 w30 w31
```

検証対象: 全55階と地下墓地5階、幅320/390/600/1280px、素材の遅延・取得失敗・片方の失敗・寸法不正、タップ移動とめくり・ドラッグ・全体表示、蓋と中身の独立、描画による乱数消費の有無、危険な床と穴、対象外の迷宮、キャッシュ上限。構文・画像寸法・SW登録も確認する。ローカルChromiumの検証で、スマホ実機の性能測定は含まない。

# オート戦闘の描画負荷

行動選択・戦闘結果の表示・カード更新・Canvas描画・音の準備を、実ゲームの連続オートで計測する。エフェクト単体の処理時間だけで評価しない。

## 変更

- `auto-planner.js` は戦闘の共有参照を保った複製をWorkerへ送り、`auto-worker.js` が従来と同じ `decideAuto` を実行する。開示済みの属性/抵抗、手がかりの補正、解放済み・オート有効の技を渡す。結果の対象は本体の参照へ戻す。
- 応答時に戦闘・現在の人業・入力状態・オートONを確認する。作戦設定の変更やシートを開いた場合は選び直す。Worker不可/故障時は従来の同期経路へ戻す。
- 味方カードは変化していないものを再生成しない。HP/MPだけなら数値・充填率・瀕死表示を更新し、カードDOMを維持する。
- 斬撃素材の色変換を小分けにして描画へ時間を返す。音のバッファは戦闘開幕から小分けに準備する。
- オートの行動待ち中も60fpsを目指して描画する。全フレームの間隔が22msを超える状態が続くと軽量化し、安定後に復帰する。ユーザーが選んだ固定画質を優先する。打数・移動速度・数値・表示尺は変えない。

## 計測

Chromium、390×844、6人、通常画質、20秒の連続オート。クリック準備の時間も採取に含む。音の初期化済みの戦闘を比較し、関数ごとの時間とrequestAnimationFrame間隔を記録する。

| 項目 | 変更前 | 変更後 |
|---|---:|---:|
| 主スレッドの行動選択・最大 | 24.3ms | Workerへ移動（同期復帰0回） |
| 戦闘中の音準備・最大 | 8.5ms | 0.1ms |
| カード更新・95百分位 | 0.8ms | 0.5ms |
| フレーム間隔・95百分位 | 16.7ms | 16.7ms |
| フレーム間隔・最大 | 33.4ms | 33.4ms |

測定JSONは `docs/performance/auto-before.json`・`auto-after.json`。この端末での平均的な滑らかさは元から良く、主な改善は描画と競合する処理の削減。全端末でフレーム落ちがゼロになる保証ではない。最初の音声起動を含む別測定では約83msの間隔も記録したため、音声起動と継続中の戦闘を区別して調べた。

```sh
python3 tools/performance/auto-worker-browser.py
python3 tools/performance/auto-combat-browser.py
AUTO_CPU=4 AUTO_REPORT=/tmp/auto-stress.json python3 tools/performance/auto-combat-browser.py
node tools/performance/auto-frame-check.mjs
```

Workerと同期版の作戦・対象の一致、乱数/入力不変を30条件で確認。Worker不可時の復帰、HPだけの更新時のDOM維持、実戦の手動/オート5連撃も検査する。既存の `auto-intelligence.mjs`・`auto-resistance.mjs` は通過。`auto-three-turn.mjs` の `PLAN_VULN` 期待値は変更前のmain（825b1f0c）でも失敗し、今回の差分による退行ではない。

心得 `t_auto_smooth` を追加。

## 描画側のCPUを4倍遅延させた比較

同じ乱数種、同じ戦闘設定でChromiumのページ側CPUを4倍遅延させた試験。Workerを含む端末全体の性能を再現するものではなく、描画側が重い場合の比較。

| 項目 | 変更前 | 変更後 |
|---|---:|---:|
| 34ms超のフレーム間隔 | 37回 | 6回 |
| 50ms以上の長い処理 | 30回 | 2回 |
| フレーム間隔・95百分位 | 33.4ms | 16.8ms |
| フレーム間隔・最大 | 283.3ms | 166.6ms |
| 主スレッドの行動選択・最大 | 173.8ms | Workerで30回・同期復帰0回 |
| カード更新・95百分位 | 4.5ms | 2.2ms |
| 戦闘中の音準備・最大 | 30.7ms | 0.6ms |

測定JSONは `docs/performance/auto-stress-before.json`・`auto-stress-after.json`。重い場面の停止は大きく減ったが、ゼロではない。

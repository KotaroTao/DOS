# 固定の武魂上限表を共用する（2026-11-06）

基準: PR #1495のマージ `d3706fda`。Pages公開成功と公開サイトの版の一致を確認済み。

## 調査と実装

最新の作戦計算を300回プロファイルし、パッシブ補正の合計 `_perkSum` が主要な負荷として残っていることを確認した。その中で武魂の合計上限 `{deal:1,take:.8,crit:.8,heal:1}` を、呼び出すたびに新しいオブジェクトとして作っていた。

この固定表だけをモジュール内の定数 `BUKON_SUM_CAP` に移した。条件・持ち主・生死・効果量・加算順・上限適用順は従来どおり毎回評価する。合計値や戦闘状態のキャッシュは追加しない。通常のパッシブ、隊で最大の効果、上限のない武魂はそれぞれ既存の扱いを保つ。上限の値・式・乱数・演出時間・保存形式は変えない。

## 比較検査

変更前のcombat.js全体を比較用モジュールとして読み、上限を超える/超えない値、負数、0、無限大、NaN、生存者数、負傷条件、通常効果・最大効果・上限つき/なしの武魂の合算を含む32条件で値が完全一致した。上限表の対象外の種類と従来のプロパティ参照も比較した。5作戦で全候補の採点と最終選択も一致し、入力・乱数は不変。

## 時間と一時メモリ確保

6人・敵3体・支援技を含む「全力で討て」のNode計算を、変更前後に別々の戦闘を用意して測定した例。40回ずつ暖めてから、交互に24回ずつ測った。計測中にprototypeを付け替えたり、計数用のラッパーやgetterを使ったりはしない。

| 作戦1回の中央値 | 変更前 | 変更後 |
|---|---:|---:|
| 装備効果なし | 10.39ms | 9.88ms |
| 1人40成分の装備効果あり | 10.91ms | 10.70ms |

前後で約4.9%・1.9%短縮した一例。差は小さく、他の試行では装備効果ありの差は約0.9%だった。仮の能力・技・装備を使う計算部分の測定で、戦闘全体の短縮率ではない。装備で選ぶ未来の技や敵の倒れる時期が変わるため、行どうしの時間は比較しない。公開オンライン、Workerを含む所要時間の改善率、実機Safariは未計測。

時間計測と別に、Node InspectorのHeapProfilerで100回の作戦計算をサンプリングした。既にGCで回収したオブジェクトも含めて数える設定とし、暖めた後の累計確保量を観測した例:

| `_perkSum` に帰属した確保量の推計 | 変更前 | 変更後 |
|---|---:|---:|
| 作戦100回の累計 | 約55.9MB | 約24.6MB |

これは一時的な確保も含むサンプリング推計で、同時に保持するメモリ量や正確なオブジェクト数ではない。全体の確保量推計も約607.0→574.8MBだった。サンプリングやJITの状態で値は揺れるため、この比率を全端末の改善率とは扱わない。時間差が小さい条件でも、同じ固定表の反復確保を除けることを確認して採用した。

## 見送った試作

成分リストを添字で走査する試作は、装備効果ありで9.31→9.48msとなり、採用しなかった。強化効果のない敵で能力強化無視の参照を省く試作も、条件によって差がなくなる/遅くなるため除いた。固定表の共用だけを出荷する。

## 再検証

```bash
node tools/performance/auto-perk-cap-check.mjs
# 実際の直前ソースとの比較・時間計測・確保量サンプリング（Node 24）:
git show d3706fda:src/combat.js > /tmp/dos-before-perk-cap.js
node tools/performance/auto-perk-cap-check.mjs --reference /tmp/dos-before-perk-cap.js --bench --alloc
node tools/performance/auto-empty-bonus-check.mjs
node tools/performance/auto-passive-check.mjs
node tools/performance/auto-element-check.mjs
node tools/performance/auto-forecast-cost-check.mjs
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/combat-percent.mjs
node tools/balance/bukon.mjs
node tools/balance/bukon-legend.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-perk-cap-sim.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-perk-cap-auto.json python3 tools/performance/auto-combat-browser.py
```

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、既存の予測比較・作戦・割合計算・武魂140種の検査、全JS構文を確認した。実Workerは30条件で同期版と一致し、6,000品の袋・Worker不可時の復帰も確認。既知の敵との40秒オートはWorker13回成功、同期版への退避0回、演出中の作戦開始0回だった。

比較検査を既存のオート戦闘CIに追加する。CIでは時間・確保量の閾値を設けず、値・採点・選択・入力・乱数の一致を確認する。新しい出荷ファイル、SWのCACHE変更、心得の変更はない（内部の最適化）。

既存のauto-three-turn.mjsのPLAN_VULN選択期待とjob-overhaul.mjsの仙薬の旧説明期待は、前回までに変更前でも失敗を確認済み。この2検査全体を今回の成功とは扱わない。

追加で実行した `bukon-legend.mjs` は44行目の「同系MP軽減は最大70%」で、期待30に対して31となり失敗した。変更前のcombat.js実ソースへ静的/動的なcombat importを差し替えた同じ検査でも再現した。fixtureの人業はLv1で、基礎消費は100ではなく101、70%軽減後は切り上げで31になる。今回の上限表共用はMP軽減を変えておらず、この検査全体を成功とは扱わない。

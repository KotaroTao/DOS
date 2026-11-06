# 補正がない見積もりの処理を省く（2026-11-06）

基準: PR #1494のマージ `62eac13a`。Pages公開と公開サイトの版の一致を確認済み。

## 実装

種族特効の加護 `_evPrey` がない攻撃でも、`evDealMul` は毎回空配列を作っていた。加護がない時は、他の与ダメージ倍率だけをそのまま返す。加護がある時は従来の単体/配列の読み取り、種族判定、乗算順を維持する。

攻撃呪文の見積もり `estSpell` は、会心しない場合も会心倍率を毎回求めていた。会心率と装備の会心倍率補正がともにない時だけ、その計算を省く。補正がある場合は、会心率0でも従来の計算を通し、非常に大きな補正や非有限値の伝わり方も維持する。会心率の計算は省かず、確定会心・職業の会心・装備の会心を反映する。

式、採点、演出時間、乱数、保存形式は変えない。新しいキャッシュも追加しない。

## 比較結果と限界

変更前のcombat.js全体を別モジュールとして読み、同じ状態から比較した。会心の習得・追加会心率・装備の倍率補正・種族特効の有無/単体/複数を組み合わせた672条件で、通常攻撃と呪文（通常・確定会心・重力）の見積もりが完全一致した。最大の有限値、無限大、NaN、文字列の補正も含む。5作戦の60条件で全候補の採点と選択が一致し、入力・乱数も不変。

会心率・装備の会心倍率補正・種族特効がない呪文を1,000回見積もった際、種族特効用のconcatによる配列作成は1,000→0回、会心倍率を求める呼び出しも1,000→0回。

6人・敵3体・支援技を含む「全力で討て」のNode計算を比較した例:

| 作戦1回の中央値 | 変更前 | 変更後 |
|---|---:|---:|
| 装備効果なし | 11.55ms | 11.38ms |
| 1人40成分の装備効果あり | 10.93ms | 10.41ms |

各行の前後で約1.5%・4.8%短縮した一例。変更前後に別々の戦闘を用意し、40回ずつ暖めてから交互に24回ずつ計測した。計測中はprototypeを付け替えず、計数用のラッパーやgetterも使わない。装備によって未来に選ぶ技や敵の倒れる時期が変わるため、行どうしの所要時間は比較しない。

今回の差は小さく、短いウォームアップの試行では短縮しない条件もあった。処理回数の削減は確認できたが、仮の能力・技・装備を使った計算部分の測定であり、戦闘全体や全端末でこの率だけ速くなる意味ではない。公開オンラインの往復時間、Workerを含む作戦全体の時間短縮、実機Safariは未計測。

## 採用を見送った試作

- 先読みの候補比較で対象別の配列を作らず集計する試作は、装備効果なし12.92→13.12ms、装備効果あり13.58→13.56msだった。時間の改善を確認できず、コードと検査の試作を除いた。
- パッシブを本人用と隊への共有用へ追加分類する試作は、装備効果あり15.15→15.39msだった。分類の追加コストもあり、採用しなかった。既存の種類別参照・条件判定は維持する。

## 再検証

```bash
node tools/performance/auto-empty-bonus-check.mjs
# 直前の実ソースと比較・計測:
git show 62eac13a:src/combat.js > /tmp/dos-before-empty-bonus.js
node tools/performance/auto-empty-bonus-check.mjs --reference /tmp/dos-before-empty-bonus.js --bench
node tools/performance/auto-element-check.mjs
node tools/performance/auto-forecast-cost-check.mjs
node tools/performance/auto-passive-check.mjs
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/combat-percent.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-empty-bonus-sim.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-empty-bonus-auto.json python3 tools/performance/auto-combat-browser.py
```

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、既存の予測比較・作戦・割合計算、全JS構文が通過。実Workerは30条件で同期版と一致し、6,000品の袋・Worker不可時の復帰も確認した。既知の敵との40秒オートはWorker13回成功、同期版への退避0回、演出中の作戦開始0回だった。

比較検査を既存のオート戦闘CIに追加する。CIでは時間の閾値を置かず、出力・入力・乱数の一致と不要処理0回を検査する。新しい出荷ファイル、SWのCACHE変更、心得の変更はない（内部の最適化）。

既存のauto-three-turn.mjsのPLAN_VULN選択期待とjob-overhaul.mjsの仙薬の旧説明期待は、前回までに変更前でも失敗を確認済み。この2検査全体を今回の成功とは扱わない。

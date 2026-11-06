# オート先読みのMP計算の短縮（2026-11-06）

基準: PR #1491のマージ `2fc6c55d`。mainへのマージ・Pages公開・公開サイトの版の一致を確認済み。

## 重複していた処理と実装

`autoforecast.js` は、未来の各味方が使える技を列挙する時に消費MPを計算した後、対象ごとの候補の採点時と、選んだ技を適用する時にも同じ値を求めていた。同じ味方の候補を比較している間はMP・前回の技・装備・状態が変わらないため、最初の値を候補へ渡して共用する。MPの値打ちも、その手番で採点が必要になった時に一度だけ求める。

共用する範囲は一つの予測の一人の手番だけ。次の味方、次のターン、別の支援候補の予測では改めて計算する。最初に試す候補のMPも従来どおり読み直す。技を適用する際は、消費MPを引いてからダメージを計算する順序を保ち、残りMPを条件にするパッシブへ影響させない。式・採点・丸め・同点の選び方・演出時間は変更しない。

## 比較結果

変更前の `autoforecast.js` 全体を別モジュールとして読み、先読み以外は同じ現在の作戦・戦闘モジュールで比較した。

5作戦×属性開示2条件×抵抗開示2条件×13状態の260条件で、全候補の採点と最終選択が完全一致。負傷・死亡・金属・無効・技の封印・慧眼・魔法武器に加え、MP不足・最低消費・記憶による軽減・装備の消費軽減・残りMP条件・ターン経過で切れる強化を含む。入力と乱数も不変。

属性・抵抗が既知の65条件を合計した `costOf` の呼び出し回数は108,202→57,223回（約47%減）。これは先読みを含む作戦全体の回数。

6人・敵3体・支援技を含む「全力で討て」を、変更前後に別々の戦闘を用意してウォームアップ後に交互に8回ずつ計測した例:

| 作戦1回の中央値 | 変更前 | 変更後 |
|---|---:|---:|
| 装備効果なし | 15.3ms | 15.0ms |
| 1人40成分の装備効果あり | 17.7ms | 16.1ms |

後者は約9%短縮。仮の能力・装備を使ったNodeでの計算部分の測定であり、戦闘全体やすべての端末で9%短くなる意味ではない。装備効果が少ない条件の差は小さい。公開オンライン戦闘と実機Safariの所要時間は未計測。

## 検証と再実行

```bash
node tools/performance/auto-forecast-cost-check.mjs
# 実際の変更前ファイルによる比較・計測:
git show 2fc6c55d:src/autoforecast.js > /tmp/dos-forecast-before.js
node tools/performance/auto-forecast-cost-check.mjs --reference /tmp/dos-forecast-before.js --bench
node tools/performance/auto-passive-check.mjs
node tools/performance/auto-element-check.mjs
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-forecast-balance.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-forecast-auto.json python3 tools/performance/auto-combat-browser.py
```

通常の比較検査は、この変更で除いた計算を比較用モジュールだけへ戻す。`--reference` で変更前の実ファイルも指定できる。時間の閾値はCIに設けず、採点・選択・入力・乱数の一致と呼び出し回数の減少を検査する。既存のオート戦闘CIに追加する。

全960技・全356出来事の1,026選択肢・74職業条件の1,480模擬戦、既存の比較検査・作戦検査・全JS構文が通過。実Workerは30条件で同期版と一致し、6,000品を持つ場合とWorker不可時の復帰も通過。既知の敵との40秒オートはWorker13回成功、同期版への退避0回、演出中の作戦開始0回だった。

新しい出荷ファイル、SWのCACHE変更、心得の変更はない（内部の最適化）。既存の `auto-three-turn.mjs` のPLAN_VULN選択期待と、`job-overhaul.mjs` の仙薬の旧説明期待は、前回までに変更前でも失敗することを確認済み。今回これらを修正したり、検査全体を成功と扱ったりはしない。

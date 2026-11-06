# 属性防御の一時データの形を揃える（2026-11-06）

基準: PR #1492のマージ `3d071bcb`。Pages公開成功と公開サイトの版の一致を確認済み。

## 調査と実装

PR #1492までの短縮を入れた作戦計算をNodeで300回プロファイルしたところ、属性防御の合算 `edefOf` が主要な負荷として残った。必要な一属性だけを読む方式にはなっていたが、合算結果を `{[el]: value, reductions}` で渡すため、呼び出す属性ごとにプロパティが変わる一時オブジェクトを繰り返し作っていた。

合算結果を既存の単属性形式 `{el,pct,reductions}` で渡す。`elementValue` の既存の読み取り経路を使い、式や公開APIは変えない。正の有限値だけを渡し、負の合計・NaN・無限大は従来どおり0として扱う。有限値どうしの加算が無限大になる場合も同じ。装備の直接軽減 `reductions` はそのまま引き継ぐ。キャッシュは追加せず、変更された装備・加護・強化・敵の状態は毎回読み直す。

## 比較

変更前のcombat.js全体を比較用モジュールとして読み、属性の式は前後で同じ現行combatrules.jsを使った。

- 単一値参照468通り、装備と出来事の合算6,084通りで一致。旧形式・values形式・直接指定・負数・未知属性・NaN・無限大・加算の桁あふれ・直接軽減を含む。
- 予測144条件、作戦72条件で与ダメージ・全候補の採点・最終選択が一致。入力・乱数も不変。

変更前後に別の戦闘を用意し、計測中にprototypeを付け替えず、ウォームアップ後に交互に測定した例:

| Nodeでの計算部分の中央値 | 変更前 | 変更後 |
|---|---:|---:|
| 通常攻撃＋攻撃呪文の予測を各1,000回 | 11.58ms | 9.77ms |
| 6人・敵3体の作戦1回、装備効果なし | 18.70ms | 17.36ms |
| 同、1人40成分の装備効果あり | 16.66ms | 14.34ms |

各行の前後を比較すると、作戦1回は約7%・14%短縮した一例。行どうしは装備により選ぶ未来の技や敵の倒れる時期が異なるため、装備なし/ありの速さの比較には使わない。仮の能力・技・装備による計算部分の測定で、戦闘全体の短縮率ではない。実機Safariと公開オンライン戦闘の所要時間は未計測。

## 再検証

```bash
# 従来の全属性表を作る方式との比較（CIの既定）:
node tools/performance/auto-element-check.mjs
# 直前の実ソースだけを差し替え、属性の式を揃えた比較・計測:
git show 3d071bcb:src/combat.js > /tmp/dos-before-shape.js
node tools/performance/auto-element-check.mjs --reference /tmp/dos-before-shape.js --rules-reference src/combatrules.js --bench
node tools/performance/auto-forecast-cost-check.mjs
node tools/performance/auto-passive-check.mjs
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/combat-percent.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-shape-balance.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-shape-auto.json python3 tools/performance/auto-combat-browser.py
```

既存CIの属性比較に、有限値どうしの加算が無限大になる境界を追加した。時間の閾値は設けない。`--rules-reference` を指定しない既定の比較では、従来の表の生成と現行の生成0件も引き続き確認する。明示した比較用の式が現行版の場合には、前後とも表を生成しないため、変更前の表の生成回数の条件だけを適用しない。

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、既存の比較・作戦・割合計算・診断の検査、全JS構文が通過。実Workerは30条件で同期版と一致し、6,000品の袋・Worker不可時の復帰も確認。既知の敵との40秒オートはWorker13回成功、同期版への退避0回、演出中の作戦開始0回だった。

新しい出荷ファイル、SWのCACHE変更、心得の変更はない（内部の最適化）。既存のauto-three-turn.mjsのPLAN_VULN選択期待とjob-overhaul.mjsの仙薬の旧説明期待は、前回までに変更前でも失敗を確認済み。今回これらの検査全体を成功とは扱わない。

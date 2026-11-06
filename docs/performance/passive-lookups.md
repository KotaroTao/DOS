# パッシブの成分参照の短縮（2026-11-06）

基準: PR #1490のマージ `91445937`。PR #1490はmainへマージし、Pages公開成功と公開サイトの版の一致を確認済み。

## 実装

`_perkSum` は、攻撃・会心・回復など一種類の補正を求める時も、各隊員の全成分を走査し、種類の違う成分を毎回除外していた。`_perkValue` も全成分をfilter/mapしてから最大値を取っていた。

既存のパッシブ/装備成分列を、最初の参照時に種類ごとのMapへ分ける。順序は元の成分列のまま。Mapはその成分列を鍵にしたWeakMapに置く。既存のrecalcがpassiveMapやgearPerksを再生成すると成分列も替わるため、新しい分類を作る。使われなくなった列はWeakMapの鍵として回収可能になる。空の列には分類を作らない。

保存するのは種類と成分の対応のみ。HP・状態異常・生死・対象・手番・隊列・when・holder・aura・best・武魂の上限・効果量は、従来どおり呼び出すたびに評価する。合計値や最終ダメージは保存しない。効果の種類を変える装備変更は、既存のrecalcと同じくgearPerksを再生成する経路を使う。

`_perkValue` のfilter/mapも、同じ種類の成分を順に読むループへ置き換えた。式・丸め・加算順・乱数・演出時間・セーブ形式は変更しない。

## 比較検査

変更前のcombat.js全体を別モジュールとして読み、同じ状態で比較した。

- HP高/低/0、異常あり/なし、仲間の生死と復帰、パッシブ再計算、装備の再生成、効果量更新、装備解除、保存復元を含む19状態で値が一致。
- 60通りで、作戦の全候補の採点・最終選択が一致。
- 入力と乱数は不変。
- 分類の準備後、同じ種類の補正を反復参照する検査で、成分の種類フィールドの読み出しは24,000回→0回。効果の条件や量は引き続き読み直す。

時間計測では読み出し計測用のgetterを使わず、通常のデータを使う。変更前後に別の戦闘を用意し、各回で成分列を再生成して分類の初回コストも含めた。ウォームアップ後に交互に8回ずつ測った例:

| 6人・3体・支援候補を含む作戦1回 | 変更前中央値 | 変更後中央値 |
|---|---:|---:|
| 装備効果なし | 13.3ms | 13.0ms |
| 1人40成分の装備効果あり | 32.4ms | 16.9ms |

後者は約48%短縮した一例。仮の能力と効果を用いた計算部分の測定であり、通常の装備が必ず40成分あるという意味ではない。実際の端末・職業・装備・技・Worker・描画・通信で変わる。戦闘全体の改善率は算出しない。実機Safariと公開オンライン戦闘の遅延は未計測。

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、既存の140/144条件・属性合算の5,184通りの比較、破魔の祝詞・待ち伏せ等の実パッシブの検査、全JS構文も通過。実Worker一致は30条件、既知の敵との40秒オートはWorker13回成功・同期版への退避0回だった。

## 再検証

```bash
node tools/performance/auto-passive-check.mjs
# 変更前の実ソースで比較・計測する:
git show 91445937:src/combat.js > /tmp/combat-before-passive.js
node tools/performance/auto-passive-check.mjs --reference /tmp/combat-before-passive.js --bench
node tools/performance/auto-element-check.mjs
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/balance/exorcist-norito.mjs
node tools/balance/ambush-sakinotachi-hissatsu.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-passive-balance.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-passive-auto.json python3 tools/performance/auto-combat-browser.py
```

通常の検査では従来の全件走査を行う比較用モジュールを作る。`--reference` で変更前の実ファイルを指定できる。比較検査を既存のオート戦闘CIへ追加する。新しい出荷ファイル・SWのCACHE変更・心得の変更なし（内部の最適化）。

既存の `job-overhaul.mjs` は、隠修士の仙薬について旧「道具回復量」を期待するfixtureと現仕様「開幕の能力強化」が食い違い、18行目で失敗した。変更前のcombat.jsでも同じ失敗を再現した。この検査全体を成功とは扱わず、今回の変更で説明やゲーム仕様は変更しない。

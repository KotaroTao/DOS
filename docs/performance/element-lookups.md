# 単一属性の参照と合算の短縮（2026-11-06）

基準: PR #1489のマージ `e82b759f`。mainへのマージ後、GitHub Pagesが配布用artifactを取得できず公開に一度失敗したため、同じコミットのワークフロー全体を再実行した。公開成功と公開サイトの版の一致を確認済み。

## 実装

攻撃属性の倍率や軽減を計算する際、必要なのは一つの属性の値だが、`elementAttack` / `elementResistance` は毎回6属性を抽出して表を作っていた。さらに `combat.js` の `edefOf` は装備と出来事の全属性を合算・正規化し、その後一つの属性だけを読んでいた。

単一の値を読む `elementValue` を追加し、旧 `{el,lv}` / `{el,pct}`、`{values}`、直接指定の優先順を保って参照する。`edefOf` も今回の属性だけを合算する。従来の `elementStat` と同じく負の合計は残さず、装備の直接軽減は別に渡す。

全属性を表示・合成する `elementValues` / `elementStat` は維持する。キャッシュは使わず、装備や出来事の値が変われば次の計算で読み直す。式・丸め・上限・属性の開示・乱数・演出時間・セーブ形式は変更しない。

## 変更前との比較

変更前のcombat.jsとcombatrules.jsをそれぞれ別モジュールとして読み込んで比較した。

- 24種類の形式×9属性キー×攻防の432条件で、単一値・属攻・耐性力・直接軽減・倍率が一致。旧Lv、0/負値、複数属性、values優先、非数値/無限値、直接軽減のみ、継承プロパティなどを含む。
- 装備24形式×出来事24形式×9属性の5,184通りで、戦闘中の倍率・恒常軽減補正・攻撃呪文予測が一致。
- 属性開示、物理/魔法の非対称な抵抗値、抵抗低下、通常/魔法武器、敵/味方を含む144条件の予測値が一致し、72条件で全候補の採点と選択が一致。
- 入力と乱数は不変。
- 上記の単一属性参照の検査で、`Object.fromEntries` による表の生成は630回→0回。

変更前の実ソースとウォームアップ後に交互に6回ずつ計測した例:

| 対象 | 変更前 | 変更後 |
|---|---:|---:|
| 通常攻撃＋呪文の予測を各1000回・中央値 | 19.1ms | 10.8ms |
| 6人・3体・支援候補を含む作戦1回・中央値 | 23.9ms | 16.4ms |

後者は約31%短縮した一例。仮の能力・裸の人業を使った計算部分の測定であり、実際の端末・装備・技・GC・Worker・描画・通信で変わる。戦闘全体の改善率は算出しない。実機Safariと公開オンライン戦闘の遅延は未計測。

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、割合計算、既存の140条件比較と144条件の一時生成比較、装備提案の検査、全JS構文も通過。実Workerの一致は30条件で確認し、既知の敵との40秒オートはWorker13回成功・同期版への退避0回だった。

## 再検証

```bash
node tools/performance/auto-element-check.mjs
# 実際の変更前ソースで直接比較・計測する:
git show e82b759f:src/combat.js > /tmp/combat-before-element.js
git show e82b759f:src/combatrules.js > /tmp/combatrules-before-element.js
node tools/performance/auto-element-check.mjs --reference /tmp/combat-before-element.js --rules-reference /tmp/combatrules-before-element.js --bench
node tools/performance/auto-allocation-check.mjs
node tools/performance/auto-estimate-check.mjs
node tools/performance/gear-hints-check.mjs
node tools/balance/combat-percent.mjs
node tools/balance/check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-element-balance.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-element-auto.json python3 tools/performance/auto-combat-browser.py
```

通常の検査では従来の表生成・合算を使う比較用モジュールを作る。`--reference` / `--rules-reference` で変更前の実ファイル一式を使える。比較検査を既存のオート戦闘CIへ追加。新しい出荷ファイル・SWのCACHE変更・心得の変更なし（内部の最適化）。

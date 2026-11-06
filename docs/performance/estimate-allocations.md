# 予測計算の一時オブジェクト削減（2026-11-06）

基準: PR #1488のマージ `c9107b2f`。PR #1488はmainへマージし、Pages公開成功と公開サイトの版の一致を確認済み。

## 実装

`estPhys` / `estSpell` は、恒常軽減の下限補正へ抵抗値を渡すため、対象を継承する一時オブジェクトを `Object.create` で毎回作っていた。物理の予測では、くさび等で既に調整した抵抗値を差し替え、くさび等の二重適用を防ぐためのフィールドも置いていた。

敵への予測では、計算済みの抵抗値を `_passiveCorrection` の引数で渡す。攻撃呪文の予測では、従来の補正内と同じく、予測上の抵抗値を上限・くさび等で調整してから渡す。通常の戦闘計算は追加引数を使わず、従来の入口を維持する。

未知の属性を伏せる `elemMask` も、同じ一発の予測内で既に作った見かけを再利用する。ターンや手番をまたぐキャッシュは作らない。

味方を対象とする予測は従来の差し替え経路を維持する。味方の固有パッシブには隊員本人との参照比較があるため、この作業でその動作まで変更しない。

## 変更前との比較

変更前のcombat.jsを別モジュールで読み、属性既知/未知、敵/味方、抵抗値0/50/80/100と物理・魔法の非対称な組、くさび・武魂の抵抗低下0/15/60、通常/魔法武器の144条件で比較した。

- 通常攻撃・物理技・攻撃呪文の予測値が完全一致。
- 敵を対象とする72条件で、作戦の全候補・最終選択が一致。
- 入力と乱数は不変。
- 敵への予測検査中の `Object.create` は1,020回→180回。味方への予測では生成回数も従来と同じ。

変更前の実ソースを使い、ウォームアップ後に交互に6回ずつ計測した例:

| 対象 | 変更前 | 変更後 |
|---|---:|---:|
| 通常攻撃＋呪文の予測を各1000回・中央値 | 18.7ms | 15.8ms |
| 6人・3体・支援候補を含む重い作戦1回・中央値 | 41.0ms | 23.7ms |

後者は約42%短縮した一例であり、戦闘全体の速度の改善率ではない。端末・技・図鑑の開示状態・GC・Worker往復・描画・通信によって変動する。演出時間・計算式・候補の採点・セーブ形式は変更しない。実機Safariと公開オンライン戦闘の応答時間は未計測。

全960技、全356出来事・1,026選択肢、74職業条件・1,480模擬戦、既存の140条件の予測比較も通過。実Workerとの一致は30条件で確認し、既知の敵との40秒連続オートではWorker13回成功・同期版への退避0回だった。フレーム間隔p95は16.7msで、今回の検査から画面全体の改善率は算出しない。

## 再検証

```bash
node tools/performance/auto-allocation-check.mjs
# 実際の変更前ソースと直接比較・計測する:
git show c9107b2f:src/combat.js > /tmp/combat-before-allocation.js
node tools/performance/auto-allocation-check.mjs --reference /tmp/combat-before-allocation.js --bench
node tools/performance/auto-estimate-check.mjs
node tools/balance/auto-intelligence.mjs
node tools/balance/auto-resistance.mjs
node tools/balance/check.mjs
node tools/balance/run.mjs --sim --levels 40,120 --seeds 1 --rounds 12 --out /tmp/dos-allocation-balance.json
python3 tools/performance/auto-worker-browser.py
AUTO_KNOWN=1 AUTO_REPORT=/tmp/dos-allocation-auto.json python3 tools/performance/auto-combat-browser.py
```

通常の比較検査では差し替えオブジェクトを使う比較用モジュールを検査内で作る。`--reference` を付ければ変更前の実ファイル全体を使う。比較検査を既存のオート戦闘CIへ追加する。出荷ファイルの追加・SWのCACHE変更・心得の変更はなし（内部の実装変更のみ）。

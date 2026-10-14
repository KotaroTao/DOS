# 別セッションで一門の印の修正を再開する

PR #953の引き継ぎ時点では、出荷対象153枚のうち由来の絵2枚を修正・確認済み、11枚を修正保留、9枚を要確認としていた。

**現在は修正不要131枚、修正・確認済み3枚、修正保留10枚、要確認9枚。** ユーザーの明示許可でPython局所合成を試したirene_torso（A-23）1枚を修正・確認済みとした。比較・変更範囲・再現手順は [composite-irene-torso/README.md](composite-irene-torso/README.md)。ユーザー確認待ちであり、残り10枚の合成は今回行っていない。根拠不足の9枚は推測で修正しない。

## 再開後の記録

最新main `d4353e92` から11枚を上記引き継ぎの順に再編集・照合。PR #957では採用0枚で、修正保留11枚・要確認9枚は未完了のまま、その時点の原画をすべて保持した。今回の候補・部分照合・入力記録は [resume-review/README.md](resume-review/README.md) を参照。各採否の直後にprogress.jsonとprogress.mdを保存した。

## 最初に読む資料

1. リポジトリの `AGENTS.md` と作業に関わる `CLAUDE.md` の節。
2. [rules.md](rules.md)：印の形、あるべき位置、ないべき位置、隠れた位置の扱い。
3. [progress.md](progress.md)：全153枚の判定と修正状況。[progress.json](progress.json) は同じ内容の構造化記録。
4. [evidence.json](evidence.json)：各場面の一覧本文とゲーム内本文の抜粋。現在の本文は `node tools/storyart/prompt.mjs <場面ID>` でも必ず確認する。
5. `docs/art/codex-story-art-brief.md` の正典とA-23〜A-35、承認済み形の正本 `docs/art/story-refs/sigil.png`。

`sigil-reference-tight.png` は正本から切り出して縮小した入力用資料。再生成した別案ではない。`small/` は4枚以下ずつの384×256の確認用、`detail/` は必要部分の切り出し。これらは元の原画の位置を特定する補助で、修正候補に差し替えた原画ではない。

## 修正を再開する順序

| 順 | 場面 | 指示書 | 変更対象 | 触らない／保留する箇所 |
|---|---|---|---|---|
| 1 | irene_torso (済・確認待ち) | A-23 | 左下に置かれたセラの頭の額の印 | イレーヌの額は無地。腕内側の視認できない位置へ追加しない |
| 2 | w16_legs | A-24 | 足の甲の印を除き、露出する内くるぶしの近くに小さく | すねや足の甲へ配置しない。脚・足・関節の形を変えない |
| 3 | ch5_end | A-25 | セラの額の炎状の印 | 盾の大きな印は配置根拠が不足し要確認。旗へ追加しない |
| 4 | irene_husks | A-26 | セラの額の杯状の印 | イレーヌの額・髪飾り、関節の金の縁 |
| 5 | irene_lineage | A-27 | セラの額の杯状の印 | 隠れた関節内側に追加しない |
| 6 | irene_crest | A-28 | セラの額と、イレーヌが見せている肘内側の既存の印 | 肘の位置・手指・関節の形 |
| 7 | irene_order | A-29 | セラの額の杯状の印 | イレーヌの額、手を組む姿勢 |
| 8 | irene_rain | A-30 | セラの額の杯状の印 | 隠れた手首内側に追加しない |
| 9 | irene_rest | A-31 | 左寄りに座るセラの額の印 | 最新mainで修正された脚と胸を保持。開いた蓋の金の図形の配置は要確認 |
| 10 | irene_names | A-32 | 右寄りに身を乗り出すセラの額の印 | イレーヌの額、札、ほかの装飾 |
| 11 | lore_w07 | A-34 | 布に包まれたセラの頭の額の印 | 壁の印は基準に合っているので保持 |

A-33（lore_w02の壁の浮き彫り）とA-35（lore_w12の胴前面の紋の除去）は修正・確認済み。PR #953時点の「(済)」はこの2項目だけ。現在はA-23も「(済)」で、ユーザー確認待ち。PR #953へのmainマージ指示は引き継ぎ資料とこの2枚に対するもの。PR #953のマージ自体は未完了の修正やPython編集への切り替えの指定を意味しない。後続のユーザー指示で、irene_torsoの1枚だけPython局所合成を許可された。

## 原画の変更を検出する

最新mainから新しい作業ブランチを作り、リポジトリのルートで実行する。記録と現在の原画が異なる場合、以前の座標・判定をそのまま使わず現在の原画を再確認する。

```bash
python3 - <<'PY'
import json, hashlib
from pathlib import Path
rows = json.loads(Path('art/story-review/sigil-audit/progress.json').read_text())
for row in rows:
    actual = hashlib.sha256(Path(row['master']).read_bytes()).hexdigest()
    if actual != row['current_sha256']:
        print('原画が更新されているため再確認:', row['id'], row['master'])
    if row['status'] == '修正保留':
        print('未完了:', row['id'], row['master'])
PY
```

`sha256` は初回確認開始時、`current_sha256` は進捗保存時の原画。`irene_rest` と `report_w34` は別セッションの更新をmain `e9286bf2` から取り込み再確認済み。現在の見本は `irene_rest-main-current.jpg`・`report_w34-main-current.jpg`、額の部分は `detail/irene_rest-main-current.png`。以前の部分参照は当時の原画の記録であり、現在の原画と取り違えない。

`before/` は前セッションの修正前原画、`rejected/` は不採用候補。**不採用候補を原画として上書き・出荷しない。** 原画の正本は各記録の `master`。`edit-queue.json` と各 `*-prompt.md` は前セッションの依頼を保存した記録で、最新状態はprogress.jsonを優先する。

## 入力・確認・保存

確認は縮小を少量ずつ、必要部分だけ拡大。修正入力は原寸の対象1枚と必要最小限の参考のみ。典型は対象＋小さい印の基準。別の人物を誤修正しないよう必要な場合だけ対象部位の部分参照を追加する。`image_request_too_large` が出たら同じ入力を再送せず、参考の枚数やサイズを減らす。

前セッションでは、額の旧形が残る、指が4本になる、別人の額や背景の旗に追加される、脚の印が足の甲に残るなどが起きた。生成できたことだけで修正済みとしない。左の親指1本・右の指3本・短い手首・独立した炎を拡大で照合し、位置・人物・周囲の保持を確認する。

各画像を確認・修正した直後に保存する例：

```bash
python3 - <<'PY'
import sys
sys.path.insert(0, 'art/story-review/sigil-audit')
from track import update
# 実際の場面・確認結果に置き換える。未完了なら修正保留のまま具体的な理由を記す。
update([('irene_torso', '修正保留', '再編集候補の確認結果と未完了の理由を記す。')])
PY
```

この道具は進捗JSON・Markdownと現在の原画ハッシュを保存し、原画を加工しない。採用した原画だけ所定のパスへ反映し、今回の修正前も別名で保存。指示書の該当項目に「(済)」を付け、`python3 tools/storyart/build.py` で変換・登録・検査する。次のPRのマージは次セッションのユーザー指示に従う。

## 要確認の9枚

mem_w21、report_w20、report_w21、w20_cup、w14_lamp、mem_w29、lore_w14、lore_w16、lore_w29。理由はprogress.jsonのnoteに保存している。指定外の印に見えても、配置根拠がない場所を推測で削除・移動しない。苔・陰・水の濁りで指定位置が読めない場合も、欠落を断定して追加しない。

# 別セッションで一門の印の修正を再開する

**現在：出荷対象153枚、修正不要131枚、修正・確認済み6枚、修正保留7枚、要確認9枚。** 修正・確認済み6枚はユーザー承認・mainへマージ済み。残る7枚の修正と根拠不足の9枚は未完了。

次のセッションに貼る依頼は [RESUME_PROMPT.md](RESUME_PROMPT.md)。**最初はirene_lineage（A-27）1枚**をPython局所合成で修正し、比較と検査を添えたPRで確認を待つ。新しいPRのmainマージは別途ユーザー指示に従う。

## 最初に読む資料

1. `AGENTS.md` と関連する `CLAUDE.md` の節。
2. [rules.md](rules.md)：形・配置・隠れた位置・胸の魂火の基準。
3. [progress.json](progress.json) と [progress.md](progress.md)：全153枚の判定・現在原画・現在ハッシュ。
4. [evidence.json](evidence.json)：本文抜粋。各対象では `node tools/storyart/prompt.mjs <場面ID>` で現在の一覧・ゲーム内本文と指示も確認。
5. [resume-checkpoint.json](resume-checkpoint.json)：引き継ぎ時のmain、正本ハッシュ、7枚の順序・原画パス・ハッシュ・要確認9枚の理由。
6. `docs/art/codex-story-art-brief.md` の正典2-1・2-2とA-27〜A-32・A-34、正本 `docs/art/story-refs/sigil.png`。

## 残る7枚の順序

| 順 | 場面 | 指示書 | 変更対象 | 保持・保留 |
|---|---|---|---|---|
| 1 | irene_lineage | A-27 | セラの額の印 | 隠れた関節内側へ追加しない |
| 2 | irene_crest | A-28 | 額と肘内側の既存の印 | 肘の位置・手指・関節の形を保持 |
| 3 | irene_order | A-29 | セラの額の印 | イレーヌの額、手を組む姿勢を保持 |
| 4 | irene_rain | A-30 | セラの額の印 | 隠れた手首内側へ追加しない |
| 5 | irene_rest | A-31 | 左寄りに座るセラの額の印 | 別セッションで修正済みの脚・胸を保持。開いた蓋の金の図形は要確認 |
| 6 | irene_names | A-32 | 右寄りに身を乗り出すセラの額の印 | イレーヌの額・札・他の装飾を保持 |
| 7 | lore_w07 | A-34 | 布に包まれたセラの頭の額の印 | 基準に合う壁の印を保持 |

[next-session-small/](next-session-small/) は現在原画から作った384×256の引き継ぎ見本。新たに目視確認済み・修正済みを意味しない。再開時のハッシュが変わっていれば見本も作り直し、古い座標・判定を流用しない。

## 承認・マージ済み6枚

| 場面 | 指示書 | PR | 修正と記録 |
|---|---|---|---|
| lore_w02 | A-33 | [#953](https://github.com/KotaroTao/DOS/pull/953) | 壁の浮き彫りを正本へ置換 |
| lore_w12 | A-35 | [#953](https://github.com/KotaroTao/DOS/pull/953) | 胴前面の紋を除去。背へ追加しない |
| irene_torso | A-23 | [#959](https://github.com/KotaroTao/DOS/pull/959) | [額、659画素](composite-irene-torso/README.md) |
| w16_legs | A-24 | [#961](https://github.com/KotaroTao/DOS/pull/961) | [甲の印を除去し内くるぶし近くへ、1090画素](composite-w16-legs/README.md) |
| ch5_end | A-25 | [#965](https://github.com/KotaroTao/DOS/pull/965) | [額と背中の魂火除去、1381画素](composite-ch5-end/README.md) |
| irene_husks | A-26 | [#968](https://github.com/KotaroTao/DOS/pull/968) | [額、742画素](composite-irene-husks/README.md) |

原画・WebPはmainへ反映済み。「(済)」はA-23〜A-26・A-33・A-35。ハッシュが変わっていなければ再修正しない。

## 方法と許可

ユーザーは「Pythonによる局所合成を許可します。まずirene_torsoの1枚を修正してPRを作ってください」と指示し、承認後にw16_legs、ch5_end、irene_husksの各1枚も同じ方法で実装する指示を出した。[RESUME_PROMPT.md](RESUME_PROMPT.md) は次のirene_lineageをPython局所合成で修正する依頼。

正本 `sigil.png` から輪郭を抽出し、角張った掌、左親指1本、右の平行な指3本、短い手首、独立した涙形の炎1つを保持する。対象面の小さい寸法・角度・遠近・金色や彫りの質感へ合わせる。描き直し・再生成した別形を使わず、右の指を4本にしない。人物の実際の手は親指＋4本で、印とは別。

承認済み `composite-*/make_candidate.py` はPillow・NumPy・SciPyによる再現用。入力はその時点の保存した修正前と正本のハッシュに固定され、現在原画へ書き込まない。手法を参考にし、次の対象の現在ハッシュ・座標・補修範囲は改めて決める。既存スクリプトを別画像へそのまま実行しない。

**セラの魂火は胸にあり、背中へ付けない**（ユーザー追記を正典・rules.mdへ保存済み）。ch5_endの背中の灯・金枠・取り付け部分はPR #965で除去済み。胸の灯、関節の金の縁、首飾りは一門の印とは別。

## 現在原画と過去の記録

現在原画はprogress.jsonの `master`。`sha256` は最初の確認時、`current_sha256` は進捗保存時の原画ハッシュ。

`before/`・`rejected/`・`fixes/`・過去の `candidate.png` は修正前・候補・再現の記録で、**新しい編集の現在原画として使わない**。承認済みスクリプトが修正前を読むのは、採用結果の再現を検査するためだけ。

`sigil-reference-tight.png` は正本の切り出し。`small/`・`detail/`・`resume-review/`・`edit-queue.json`・古い `*-prompt.md` は当時の記録。最新の状態はprogress.jsonを優先する。

irene_restとreport_w34は別セッションのmain `e9286bf2` の更新を取り込み済み。irene_restの脚・胸の修正版を保持し、以前の部分参照や不採用候補へ戻さない。

## 再開時のハッシュ照合

最新mainからcodex/の新しいブランチを作り、リポジトリのルートで実行する。

```bash
python3 - <<'PY'
import json, hashlib
from pathlib import Path
rows = json.loads(Path('art/story-review/sigil-audit/progress.json').read_text())
for row in rows:
    actual = hashlib.sha256(Path(row['master']).read_bytes()).hexdigest()
    if actual != row['current_sha256']:
        print('更新されているため再確認:', row['id'], row['master'])
    if row['status'] == '修正保留':
        print('未完了:', row['id'], row['master'])
PY
```

準備時は153枚すべて一致。今後更新があれば現在原画から再確認。正本のハッシュもresume-checkpoint.jsonと照合する。

## 1枚ごとの確認・保存・PR

1. `node tools/storyart/prompt.mjs <場面ID>` で本文・指示を確認。
2. 384×256の縮小を4枚以下ずつ、必要部分だけ原寸・拡大で確認。隠れた位置へ追加しない。
3. 現在原画1536×1024の1枚だけを局所編集。参考は現在原画と正本を基本に必要最小限。
4. 候補の形・指の数・位置・人物・周囲を照合し、変更領域外のRGBが修正前と完全一致することを検査。不適合候補は理由とともに保存し不採用にする。
5. 確認・採否ごとにtrack.pyのupdateでprogress.json・progress.mdと現在ハッシュを保存。
6. 採用候補だけ現在原画へ反映し、今回の修正前をfixes/の別名へ保存。過去の修正前を上書きしない。該当項目へ「(済)」。
7. `python3 tools/storyart/build.py` で仕上げと検査。WebPの必要部分も照合。本文・自動生成台帳は手で変更しない。
8. PR前にmainを取り込む。PRに拡大比較・全体縮小・検証・確認ページを載せ、1枚の確認を待つ。新しいPRのマージは別途指示に従う。

進捗保存の例（実際の判定へ置き換える）：

```bash
python3 - <<'PY'
import sys
sys.path.insert(0, 'art/story-review/sigil-audit')
from track import update
update([('irene_lineage', '修正保留', '候補の具体的な不採用理由。原画は保持。')])
PY
```

imagegenを使う必要がある場合も原寸対象1枚＋最小限の参考のみ。image_request_too_largeが出たら同じ入力を再送せず参考の枚数・サイズを減らす。

## 要確認9枚と追加の保留箇所

mem_w21、report_w20、report_w21、w20_cup、w14_lamp、mem_w29、lore_w14、lore_w16、lore_w29。理由はprogress.jsonとresume-checkpoint.jsonへ保存済み。根拠のない場所を推測で追加・削除・移動しない。苔・陰・水の濁りで読めない箇所は欠落と断定しない。

9枚とは別に、ch5_endの盾の大きな印、irene_restの開いた胸の蓋の金の図形も配置が要確認。該当画像を編集しても保持する。

## 過去の失敗

PR #953で監査と由来2枚を保存。PR #957では保留11枚をimagegenで再編集したが旧形・旧位置が残り採用0枚。[resume-review/README.md](resume-review/README.md) に候補を保存。その後、上記4枚をPython局所合成で修正・承認済み。

小さい額の旧印が残る、右の指が4本になる、別人の額や旗へ追加される、脚の印が甲に残る、額の編集が髪際へ重なる、といった失敗を原画へ反映しない。

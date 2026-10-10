# AGENTS.md

Codex など AGENTS.md を読むエージェント向けの要約。**仕様の正本は `CLAUDE.md`** (約150KB。Codex が自動で読む上限を超えるので、ここには要点と目次だけを置く)。作業に関わる節は必ず `CLAUDE.md` の該当箇所を開いて読むこと。README とコードが食い違う時はコードを信じる。

## 返答の言語
- ユーザーへの返答・計画・質問・PR の説明は **必ず日本語**。
- コメントとゲーム内の文字列も日本語 (コードの識別子は英語)。周りの文の調子 (ダークファンタジー) に合わせる。
- 地の文にも品・魔物・技・パッシブの名前にも、難しすぎる漢字・言い回しを使わない (鑿 → つるはし、纏う → まとう、鎖帷子 → くさりかたびら など。名前は全体で重複させない)。

## これは何か
ビルド不要のブラウザ RPG「魂の迷宮 (Dungeon of Souls)」。素の HTML + ES Modules + Canvas。**bundler・package.json・npm・テストランナー・lint 設定は無い**。import には `.js` の拡張子を明記する。TypeScript・JSX・フレームワークは使わない。

## 動かす・確かめる
```bash
python3 -m http.server 8000   # http://localhost:8000/ (file:// では動かない)
for f in $(git ls-files 'src/*.js'); do node --check "$f"; done   # 構文チェック
```
- テストは無い。ロジックは Node で直接 import して確かめる (`combat.js`・`dungeons/*` など純粋なモジュール)。戦闘を単体で試す時は先に `Object.assign(MONSTERS, DUNGEON_MONSTERS)` (普段は game.js が行う)。
- `src/game.js` を丸ごと読み込む時は `document`/`window`/`localStorage`/`AudioContext` の偽物を `globalThis` に置く。
- 技・出来事・戦闘の式を変えたら、`CLAUDE.md` に書かれた一括の確認 (全技を1回ずつ・全出来事×全選択肢・模擬戦) を回す。

## 必ず守る規則
- **`sw.js` の `const CACHE = "dos-dev"` は書き換えない。** デプロイ時に `.github/workflows/pages.yml` がコミットのハッシュへ書き換える (手で版を上げる旧運用は廃止)。新しく出荷するファイル (JS/CSS/画像) は **`sw.js` の `ASSETS` に足す** (物語・由来の絵 `art/story/` だけは手で足さず、置いてから `node tools/storyart/register.mjs` で登録する — `docs/art/codex-story-art-brief.md` の 1-4)。 SW の導入で先読みするのはコード (JS/CSS/HTML) だけで、絵は版をまたいで残る `dos-media` に置き、使う時と切り替えの後に裏で集める。
- `main` へ push すると GitHub Pages に自動でデプロイされる。`main` へ直接 push しない (PR 経由)。
- GitHub Pages の公開サイトは **1GB まで**。デプロイは `docs/`・`tools/`・`art/story-review/`・ルートの `*.md` と確認用 PNG を外して公開し、800MB を超えるか `ASSETS` の品が欠けると止まる。原画・制作記録は `docs/` か `art/story-review/` に置き、ゲームが読むフォルダ (`art/story/`・`art/jobs/` など) には置かない。
- **ID は足すだけ** (セーブ・図鑑が参照する): 魔物 (`bs_*` など)・品 (`w_`/`lr_`…)・技の鍵・出来事 (`c01`…)・依頼・勲章の段・イレーヌの台詞・迷宮 (`w01`…) の id を改名・再利用・削除しない。
- セーブのキーは `dos-save-v7`。保存するのは game.js の `SAVE_FIELDS` だけ。共有参照は `refSerialize` が保つので、状態を複製し直さない。
- 依存の向き: `src/ui/*` と `src/events.js` は **game.js を import しない** (ui は `ctx.js` の `UI`/`game`/`ops`、出来事は `evApi` 経由)。`combat.js` は純粋なロジックで、演出・効果音は game.js 側。
- 画面: ページ送り (‹ 1/2 ›) は作らない。入りきらない中身は内側の箱を縦にスクロールさせる。説明文の改行は `src/ui/phrase.js` が自動で行うので、手で `\n` を入れて折らない。
- **迷宮の数は第4層から1層 = 本筋4 + 寄り道・依頼の迷宮2** (ユーザーの指示: 20層で百の迷宮以上。第1〜3層には寄り道を増やさず、その分は第10層以降へ)。新しい層を作る時は寄り道も同時に足し、ときどき「格上の迷宮」(`challenge`) と「極端な掟の迷宮」(魔封じ `physOnly`・必ず奇襲 `alwaysAmbush` など) を混ぜる。寄り道1つに要るもの (台帳・依頼・極・由来・景色・心得) は `CLAUDE.md` の迷宮の台帳の節「迷宮の数の目安」。
- **新しい迷宮では足元の仕掛け `floorHaz: { fall, harm }` を必ず決める** (ユーザーの指示: どの迷宮も毒の沼と落とし穴では世界観が壊れる)。仕組みは落ちる床・蝕む床の2つだけで、名前・絵・言葉をその土地のものにする (`src/dungeons/floorhaz.js`、置かないなら null。墓所に沼は置かない)。詳細は `CLAUDE.md` の迷宮の台帳の節「足元の仕掛け」。
- **新しい迷宮を追加する時は、その迷宮専用の「極めて稀なる出来事」を必ずちょうど1件実装する** (最初の迷宮 `w01` と奈落は除外。依頼の迷宮も対象)。`src/events.js` の `DUNGEON_GIFTS` に追加し、全職業の永続強化を9種の中から偏りなく割り当てる。詳細は `CLAUDE.md` の迷宮の台帳の節。完了前に `node tools/balance/event-boons.mjs` を必ず実行する。
- **師の手がかり (`src/story.js` の `STORY_CELLS`) を足す時は、必ず見返り `boon` を付ける** (迷宮が開く・依頼が出る・館の働きが良くなる など。最初の師のランタンだけは例外。効き目は小さめにし、職業のパッシブと重ねない。ユーザーの指示)。詳細は `CLAUDE.md` の迷宮の台帳の節の「手がかりの恵み」。
- **酒場の顔ぶれの話 (`src/tavern.js` `TAVERN_TALKS`) はヘルプも兼ねる。新機能・仕様変更を入れる時は、同じ変更の中で話も更新する** (ユーザーの指示): 関係する心得 (`k: "tip"`) の数字・説明を新しい仕様に直し、新しい機能・仕組みには心得を少なくとも1つ足す (`req` で機能が開くまで伏せる)。新しい章・場所には、その章までに明かされたことだけで言い伝え (`k: "lore"`) を足す。id は足すだけ (古い話は文を直す)。PR の説明に直した/足した話の id を書く。詳細は `CLAUDE.md` の `## Conventions`。
- 魔物を足す時は固有の絵 (`ARTS` の色違いで済ませない) と 1〜2個の特徴を付ける。1匹ごとの固有ドロップは作らない (名のある強敵の首級だけは例外)。
- 生成物は手で直さない: 物語の絵の登録 (`python3 tools/storyart/build.py`)、`schema.js` の `hd_*` ブロック (`node tools/hdart/run.mjs <layer> --apply`)、`src/itemart/salts.js` (`node tools/itemart/check.mjs --apply`)、`monart.js` の `<<MONSTER_ART>>` ブロック (`tools/monart.mjs`)。

## 物語の絵 (ストーリーの挿絵・踏破した迷宮の由来) の作り方
人の手が要るのは「描く」(Codex) と「承認する」(ユーザー) だけ。ほかは道具が行う。詳しくは `docs/art/codex-story-art-brief.md` の 1-3。
1. **依頼を出す**: `node tools/storyart/prompt.mjs <場面ID>` (由来は `lore_<迷宮ID>`、人物・小道具の基準シートは `ref:<名前>`、章ごとの一覧は `--chapter N`)。保存先・参照画像 (この順に渡す)・本文 (一覧とゲーム内)・描くもの/描かないもの・英語の指示 (前置き込み) が出る。**指示を自分で組み立てず、この出力どおりに作る。**
2. **描いて置く**: 原画 PNG (1536×1024) を出力の保存先 (`art/story-review/chapterN/<場面ID>.png` など) に置く。修正は同じ名前で上書きし、修正前を `art/story-review/fixes/<場面ID>-before.png` に残し、指示書の項目の末尾に「(済)」を付ける。
3. **仕上げる**: `python3 tools/storyart/build.py` (要 Pillow・Node 22)。変わった原画だけを WebP にし、ゲームへ登録し (`src/storyimages.js`・`sw.js` の `<<STORY_ART>>`)、確認ページ `art/story-review/review/chapterN.md`・縮小の見本 `chapterN-small.jpg`・進み具合 `status.md` を書き、検査を回す。✗ が出たら直して回し直す。
4. **PR を出して止まる**: 本文に確認ページと縮小の見本を載せる。CI「物語の絵の検査」(`.github/workflows/storyart-check.yml`) が登録の漏れ・作り直し忘れ・指示書との食い違いを調べる。main へ取り込まれれば遊ぶ人に届く。
- 手で書かないもの: `src/storyimages.js`、`sw.js` の `<<STORY_ART>>` の欄、`tools/storyart/masters.json`、`art/story-review/review/`。原画・案・比較画像を `art/story/` に置かない (出荷物は WebP だけ)。本文 (`src/story.js`・`src/archive-stories.js`・`src/journal.js`) は変えない — 絵を本文に合わせる。
- 指示書 (`docs/art/codex-story-art-brief.md`) は道具が読む。見出しの書式を崩さない。指示が無い場面は Claude に足してもらう。

## Claude と並行して作業する時
- ブランチは `codex/<内容>` を切り、PR で `main` に入れる (Claude は `claude/…`)。
- 作業の前とPRの前に `main` を取り込む。衝突したら両方の意図を残して解く。履歴の書き換え (rebase・force-push) は自分のブランチだけ。
- ユーザーがPRのマージを指示した後は `python3 tools/release/merge.py <PR番号> --head <確認済みの40桁SHA> --merge` で検査・マージ・公開確認を一度に行う (詳しくは `docs/merge-and-publish.md`)。同じ許可を聞き直さず、公開結果まで報告する。マージの指示が無いPRは取り込まない。
- `src/game.js` (約1.5万行) はほぼ全機能が触る。同じ時期に Claude 側も game.js を大きく触っている時は、変更を小さく保つ。
- `CLAUDE.md` は仕様の正本。仕様を変えた時は該当する節だけを短く直す (全体の書き直し・並べ替えはしない — 衝突の元)。このファイル (`AGENTS.md`) は、ここに書いた規則そのものが変わった時だけ直す。

## `CLAUDE.md` の目次 (作業に応じて読む節)
| 作業 | 読む節 (`CLAUDE.md` の見出し・項目) |
|---|---|
| 何を触るにも最初に | `## Running & "building"`、`## Conventions` |
| 全体の構造・各モジュールの役割 | `### Module layout (src/)` |
| 迷宮・物語・推奨Lv・奈落 | `### 🗺 迷宮の台帳 (src/dungeons/world.js) と師を捜す物語` |
| レベルの曲線・報酬の物差し | `### Module layout` の **`levelcurve.js`** |
| 戦闘・状態異常・逃走・回避・強化弱体の段 | `### Module layout` の **`combat.js`**、**`autotactics.js`** |
| 職業・魂・技・パッシブ | `### Module layout` の **`souls.js`**、**`jobkit/`** |
| 出来事・依頼・勲章 | `### Module layout` の **`events.js`**、**`quests.js`**、**勲章** |
| 装備・道具・値段 | **`items.js`**、**`pricing.js`**、`### 装備のレア度`、`### Item catalog (src/catalog/)` |
| 物語の挿絵・由来の絵 | このファイルの「物語の絵」、`docs/art/codex-story-art-brief.md`、`### UI 構造` の ヘルプ・ストーリー |
| 装備・収集品の絵 | `### 装備の絵 (src/itemart/)`、`### Item catalog` の 収集品の絵 |
| 魔物の追加・絵・特徴 | `### Dungeon registry`、`### Monster individuation`、`### 名のある強敵` |
| 属性 | `### Element / affinity system` |
| セーブ | `### State & persistence` |
| 画面・UI の部品 | `### UI 構造 (src/ui/)`、`### 画面テーマ — theme.css` |
| 大きな分割・整理 | `## 整理の計画` → `docs/refactor-plan.md` (着手前にユーザーの了解を取る) |

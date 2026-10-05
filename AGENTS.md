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
- **`sw.js` の `const CACHE = "dos-dev"` は書き換えない。** デプロイ時に `.github/workflows/pages.yml` がコミットのハッシュへ書き換える (手で版を上げる旧運用は廃止)。新しく出荷するファイル (JS/CSS/画像) は **`sw.js` の `ASSETS` に足す**。
- `main` へ push すると GitHub Pages に自動でデプロイされる。`main` へ直接 push しない (PR 経由)。
- **ID は足すだけ** (セーブ・図鑑が参照する): 魔物 (`bs_*` など)・品 (`w_`/`lr_`…)・技の鍵・出来事 (`c01`…)・依頼・勲章の段・イレーヌの台詞・迷宮 (`w01`…) の id を改名・再利用・削除しない。
- セーブのキーは `dos-save-v7`。保存するのは game.js の `SAVE_FIELDS` だけ。共有参照は `refSerialize` が保つので、状態を複製し直さない。
- 依存の向き: `src/ui/*` と `src/events.js` は **game.js を import しない** (ui は `ctx.js` の `UI`/`game`/`ops`、出来事は `evApi` 経由)。`combat.js` は純粋なロジックで、演出・効果音は game.js 側。
- 画面: ページ送り (‹ 1/2 ›) は作らない。入りきらない中身は内側の箱を縦にスクロールさせる。説明文の改行は `src/ui/phrase.js` が自動で行うので、手で `\n` を入れて折らない。
- 魔物を足す時は固有の絵 (`ARTS` の色違いで済ませない) と 1〜2個の特徴を付ける。1匹ごとの固有ドロップは作らない (名のある強敵の首級だけは例外)。
- 生成物は手で直さない: `schema.js` の `hd_*` ブロック (`node tools/hdart/run.mjs <layer> --apply`)、`src/itemart/salts.js` (`node tools/itemart/check.mjs --apply`)、`monart.js` の `<<MONSTER_ART>>` ブロック (`tools/monart.mjs`)。

## Claude と並行して作業する時
- ブランチは `codex/<内容>` を切り、PR で `main` に入れる (Claude は `claude/…`)。
- 作業の前とPRの前に `main` を取り込む。衝突したら両方の意図を残して解く。履歴の書き換え (rebase・force-push) は自分のブランチだけ。
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
| 装備・収集品の絵 | `### 装備の絵 (src/itemart/)`、`### Item catalog` の 収集品の絵 |
| 魔物の追加・絵・特徴 | `### Dungeon registry`、`### Monster individuation`、`### 名のある強敵` |
| 属性 | `### Element / affinity system` |
| セーブ | `### State & persistence` |
| 画面・UI の部品 | `### UI 構造 (src/ui/)`、`### 画面テーマ — theme.css` |
| 大きな分割・整理 | `## 整理の計画` → `docs/refactor-plan.md` (着手前にユーザーの了解を取る) |

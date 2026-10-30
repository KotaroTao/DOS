# クラウドセーブの導入

画面操作での導入とGitHubからの自動セットアップは [使い始める手順](cloud-save-setup.md) を参照してください。

## 仕様

- タイトルから規約同意後にゲストまたはメール登録で開始。冒険の記録は1枠、最新1件。ゲストも匿名認証によるクラウド保存を使う。
- タイトルの開始操作と規約確認・認証の後にクラウドの記録を取得する。通信失敗時に端末の古い記録へ戻らない。
- 現行の `backgroundBattle` 対応版は、選択と乱数を端末へ保管してから既存の `combat.js` で計算し、最新地点を裏でクラウドへ送る。旧版との互換接続ではEdge Functionで計算し、DB保存後に表示する。死亡・道具消費・窃盗・レベルドレインも保存対象。
- 終了・画面非表示時は、非同期の記録準備を待たず端末に最新地点を同期保管する。起動時は旧要求→最新の端末記録→クラウドの読み戻しを終えてから操作を許可する。戦闘中に終了しても同じ戦闘から再開。送信前に要求IDと内容を端末へ保存し、返答を失った時は同じIDで再送する。同じ要求はDB上で1回しか更新しない。
- 更新番号を比較して古い上書きを拒否。端末の占有期限は120秒、待機中は45秒ごとに更新。同じ端末ではWeb Locksも使い、複数タブの進行を止める。
- 通常保存中は操作を継続できる。戦闘結果待ち・通信失敗の復旧中は操作を止め、未保存の結果を見て選び直すことを防ぐ。
- クラウド未設定の開発版とURLで明示したテストプレイは、既存のローカル動作を使う。テストプレイから通常のクラウド記録へ書き込まない。

探索・街・戦闘報酬は現在のブラウザのロジックを継続し、その結果を保存する。今回の範囲は「終了・再読み込みによる通常の巻き戻しを防ぐ」ことであり、改造クライアントが新しい要求IDで偽の状態を送ることへの完全な対策ではない。ランキング・有料通貨などの不正対策が必要な場合は、それらの操作もサーバー側のコマンドに移す。

## Supabaseの設定

1. Supabaseでプロジェクトを作成する。プレイヤーの近くのリージョンを選ぶ。
2. SQL Editorで `supabase/migrations/202610120001_cloud_save.sql`、`supabase/migrations/202610160001_save_slots.sql`、`supabase/migrations/202610300001_guest_onboarding.sql` の順に実行する（既存環境は未適用分のみ）。CLIならプロジェクトをリンクし `supabase db push` を実行する。
3. AuthenticationでEmailログインとメール確認を有効にする。Site URLとRedirect URLsにゲームの公開URLを登録する。開発時は `http://127.0.0.1:8001/` も登録する。
4. 公開運用ではCustom SMTPを設定する。Supabase標準のメール送信は開発向けで、一般プレイヤー1000人の登録・パスワード再設定には使わない。メール配信サービスの無料枠・料金は別途確認する。
5. Edge Functionのsecret `GAME_ALLOWED_ORIGINS` に `https://kotarotao.github.io` を設定する。URLの `/DOS/` は含めない。開発元も許可する場合はカンマ区切りで `http://127.0.0.1:8001` を足す。
6. リポジトリのルートから `supabase functions deploy game-save --use-docker` を実行する（Dockerが必要）。`supabase/config.toml` によりゲートウェイの旧JWT検証を無効にし、関数自身が `/auth/v1/user` に照会してユーザーを検証する。自動設定・公開では、実行環境内だけでesbuild 0.25.12によるESMの結合・圧縮を行い、CLIのDocker方式で圧縮ESZIPを作成して配置する。非圧縮のソースを送る `--use-api` ではアップロード上限を超えるため使わない。Dockerの起動確認に失敗した場合も配置を止める。ブラウザ用コードやリポジトリの関数ソースは変更しない。
7. `src/cloud-config.js` の `url` をプロジェクトURL、`anonKey` を公開用のanonキーまたはpublishableキーにし、`enabled: true` にする。`protocol` は1のまま。

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はEdge Functionの標準環境変数を使う。service_roleキーやSMTPパスワードはブラウザのファイル、Git、GitHub Pagesへ置かない。保存テーブルと更新関数はanon/authenticatedからアクセスできず、検証済みユーザーIDを使うEdge Functionだけが読み書きする。

CLIでの接続例（アクセス権がある端末で実行）:

```sh
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set GAME_ALLOWED_ORIGINS=https://kotarotao.github.io
supabase functions deploy game-save --use-docker
```

## 既存プレイヤーの移行

クラウドに記録がないアカウントで初回ログインすると、端末記録（`dos-save-v7`）を引き継ぐか、新しい冒険を始めるかを選べる。クラウドに記録がある場合は必ずそちらを使い、端末の記録はアップロードしない。端末の旧記録は削除しないが、クラウド有効時の通常プレイでは読み込まない。

同じ端末での再読み込みには端末の接続IDを引き継ぐ。別端末へ移る時は先の画面を閉じて待つ。進行中の端末を強制的に追い出す操作は用意していない。一時的な通信障害は同じ要求を最大3回自動再送する。解消しない時はHTTP状態と問い合わせ番号を表示し、「再接続」で待っている要求を再送する。再起動しても同じ要求の失敗が続く場合は「保存済みの記録から再開」を選べる。元の要求を端末の送信待ちキーに`:recovery`を付けて保管する。localStorageの容量が足りない場合は別のIndexedDB `dos-cloud-recovery`の`requests`へ保管完了してから、サーバーの確定済み記録を読み直す（未確定の操作は反映されない場合がある）。保管に失敗した場合は元の要求を残して停止する。競合した場合はサーバーの最新記録から再開する。

## 保存要求の大きさ

保存と戦闘の要求はUTF-8で16MiBまで受け付ける。進行したセーブが旧上限2MiBを超えるとHTTP 413となっていたため拡張した。上限を超える本文は読み込み中に打ち切り、DBは更新しない。旧上限で止まった端末の送信待ちも、API更新後は同じ要求ID・内容のまま再接続して保存できる。保存頻度と戦闘の確定方式は変更しない。

## 費用と運用

設定の「保存と通信の計測」で、通常プレイの保存API回数・本文容量・応答時間を端末に記録しJSONで書き出せる。試遊は容量サンプルとして別集計する。手順と人数への換算、課金量との違いは[保存・通信の実測](save-metrics.md)を参照。

本番はSupabase Proの1プロジェクトで開始する。無料枠でも検証できるが、無料枠の容量・実行回数・休止条件を本番の前提にしない。探索の各歩と戦闘の各手番で保存を予約し、未送信分は約0.5秒単位で束ねる。登録人数よりも行動回数・保存頻度・記録の大きさが費用を左右する。戦闘には選択の保存・実行・手番進行の呼び出しがあり、1行動が必ず1リクエストになるわけではない。

公開後はEdge Functionsの呼び出し回数、転送量、DBの使用量・応答時間を確認する。バックアップは運営の障害復旧用に用意し、プレイヤーが過去の状態を選んで戻す機能にはしない。ゲームとEdge Functionは同じコミットの戦闘ロジックを公開し、互換性が変わる更新ではブラウザと関数のprotocolを同時に変更する。

## 検証

共有参照・同一乱数での再開・死亡・再送・送信待ち回収:

```sh
node tools/cloud/check.mjs
```

SQLの権限と競合、実際のEdge FunctionはPostgres互換のPGliteで確認できる。開発用依存はリポジトリ外に置く:

```sh
npm install --prefix /tmp/dos-cloud-check --cache /tmp/dos-npm-cache --no-audit --no-fund @electric-sql/pglite
node tools/cloud/database-check.mjs /tmp/dos-cloud-check/node_modules/@electric-sql/pglite/dist/index.js
```

ブラウザ確認は別のターミナルでゲームと検証用APIを起動してから実行する。検証用APIはAuthだけを模擬し、実際のSQL・Edge Functionを使う。PlaywrightとChromiumが必要。実プロジェクトの接続情報は使わない:

```sh
python3 -m http.server 8001 --bind 127.0.0.1
node tools/cloud/test-server.mjs /tmp/dos-cloud-check/node_modules/@electric-sql/pglite/dist/index.js
python3 tools/cloud/browser-check.py
```

公開前に実プロジェクトでも、新規登録・メール確認・ログイン・パスワード再設定・戦闘中断・死亡直後の終了・別端末の競合・通信切断からの再接続を確認する。

本番は記録1のみ。旧URLの`saveSlot=2/3`は記録1として開き、サーバーも2・3枠への操作を拒否する。旧テスト記録は消さない。

## ゲストと規約

初回の明示同意後だけ匿名ユーザーを作成する。同意本文は`src/legal.js`、版・日時は`cloud_saves`に保存する。登録は同じ匿名ユーザーのメールとパスワードを更新し、確認後も同じユーザーIDで記録を維持する。設定から登録・退会を行え、匿名のログアウトは設けない。退会は認証ユーザーの削除と外部キーのcascadeで記録を削除する。既存の別アカウントへのログインでは記録を合成・上書きせず、ゲスト接続を端末へ保管する。

Supabaseの匿名認証は自動セットアップで有効になる。匿名作成の上限は10件/IP/時。一般公開時はAuthenticationのBot and Abuse ProtectionでTurnstileを設定し、GitHub Variable `TURNSTILE_SITE_KEY`に公開サイトキーを登録する。秘密キーはSupabaseだけに保存する。CAPTCHAが有効なのに公開サイトキーがない場合は配置を止める。ゲストもオンライン専用で、ブラウザのデータ削除後は未登録の記録を復旧できない場合がある。

検証: `python3 tools/cloud/onboarding-browser-check.py`（検証用API・ゲームサーバーを起動して実行）。

修道院（w03）を踏破して街へ帰還したゲストには、一度だけ記録保護と端末移行の案内を出す。引き継ぎは任意で、設定からも行える。旧版の森で案内済みでも対象とする。

今後の課金決済では、メールアドレスの登録・確認が完了した非匿名アカウントを必須とする。決済開始・購入確定のサーバー処理で認証情報を検証し、ゲストや確認前のユーザーは決済へ進めない。案内では購入内容と記録の保護・端末移行のメリットを伝える。現時点では決済は未実装。

## 総点検と回帰検査

[2026-10-30の点検記録](cloud-save-audit.md) に確認範囲と制限をまとめた。

```sh
# ゲームを8000/8001、検証APIを8002で起動してから実行する。実アカウントは使わない。
python3 tools/cloud/audit.py --pglite /tmp/dos-cloud-check/node_modules/@electric-sql/pglite/dist/index.js
# ブラウザを使わない8検査だけを実行する場合
python3 tools/cloud/audit.py --node-only --pglite /tmp/dos-cloud-check/node_modules/@electric-sql/pglite/dist/index.js
```

`.github/workflows/cloud-save-check.yml` は関連コードのPRで上記8検査とJS構文検査を自動実行し、結果のログを保存する。Workerが存在しても生成が拒否される環境では、従来の同期シリアライズへ戻して記録を保つ。

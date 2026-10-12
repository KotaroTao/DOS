# クラウドセーブの導入

画面操作での導入とGitHubからの自動セットアップは [使い始める手順](cloud-save-setup.md) を参照してください。

## 仕様

- メールアドレス・パスワードでログイン。冒険の最新記録はアカウントごとに1件。
- 起動時はクラウドの記録を取得する。通信失敗時に端末の古い記録へ戻らない。
- 戦闘の確定済み行動・敵の行動・行動不能の手番・次の手番への進行は、既存の `combat.js` をEdge Functionで実行し、DBへの保存が成功してから表示する。死亡、道具消費、窃盗、レベルドレインも結果に含む。
- 戦闘中に終了しても同じ戦闘から再開。送信前に要求IDと内容を端末へ保存し、返答を失った時は同じIDで再送する。同じ要求はDB上で1回しか更新しない。
- 更新番号を比較して古い上書きを拒否。端末の占有期限は120秒、待機中は45秒ごとに更新。同じ端末ではWeb Locksも使い、複数タブの進行を止める。
- 保存中・通信失敗中は画面と入力を止め、未保存の結果を見て選び直すことを防ぐ。クラウドの削除・過去記録の復元はゲーム内に設けない。
- クラウド未設定の開発版とURLで明示したテストプレイは、既存のローカル動作を使う。テストプレイから通常のクラウド記録へ書き込まない。

探索・街・戦闘報酬は現在のブラウザのロジックを継続し、その結果を保存する。今回の範囲は「終了・再読み込みによる通常の巻き戻しを防ぐ」ことであり、改造クライアントが新しい要求IDで偽の状態を送ることへの完全な対策ではない。ランキング・有料通貨などの不正対策が必要な場合は、それらの操作もサーバー側のコマンドに移す。

## Supabaseの設定

1. Supabaseでプロジェクトを作成する。プレイヤーの近くのリージョンを選ぶ。
2. SQL Editorで `supabase/migrations/202610120001_cloud_save.sql` を実行する。CLIならプロジェクトをリンクし `supabase db push` を実行する。
3. AuthenticationでEmailログインとメール確認を有効にする。Site URLとRedirect URLsにゲームの公開URLを登録する。開発時は `http://127.0.0.1:8001/` も登録する。
4. 公開運用ではCustom SMTPを設定する。Supabase標準のメール送信は開発向けで、一般プレイヤー1000人の登録・パスワード再設定には使わない。メール配信サービスの無料枠・料金は別途確認する。
5. Edge Functionのsecret `GAME_ALLOWED_ORIGINS` に `https://kotarotao.github.io` を設定する。URLの `/DOS/` は含めない。開発元も許可する場合はカンマ区切りで `http://127.0.0.1:8001` を足す。
6. リポジトリのルートから `supabase functions deploy game-save` を実行する。`supabase/config.toml` によりゲートウェイの旧JWT検証を無効にし、関数自身が `/auth/v1/user` に照会してユーザーを検証する。自動設定・公開では、アップロード上限を超えないよう実行環境内だけでesbuild 0.25.12によるESMの結合・圧縮を行ってから `--use-api` で配置する。ブラウザ用コードやリポジトリの関数ソースは変更しない。
7. `src/cloud-config.js` の `url` をプロジェクトURL、`anonKey` を公開用のanonキーまたはpublishableキーにし、`enabled: true` にする。`protocol` は1のまま。

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はEdge Functionの標準環境変数を使う。service_roleキーやSMTPパスワードはブラウザのファイル、Git、GitHub Pagesへ置かない。保存テーブルと更新関数はanon/authenticatedからアクセスできず、検証済みユーザーIDを使うEdge Functionだけが読み書きする。

CLIでの接続例（アクセス権がある端末で実行）:

```sh
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set GAME_ALLOWED_ORIGINS=https://kotarotao.github.io
supabase functions deploy game-save
```

## 既存プレイヤーの移行

クラウドに記録がないアカウントで初回ログインすると、端末の `dos-save-v7` を引き継ぐか、新しい冒険を始めるかを選べる。クラウドに記録がある場合は必ずそちらを使い、端末の記録はアップロードしない。端末の旧記録は削除しないが、クラウド有効時の通常プレイでは読み込まない。

同じ端末での再読み込みには端末の接続IDを引き継ぐ。別端末へ移る時は先の画面を閉じて待つ。進行中の端末を強制的に追い出す操作は用意していない。通信失敗時は「再接続」で待っている要求を再送する。競合した場合はサーバーの最新記録から再開する。

## 費用と運用

本番はSupabase Proの1プロジェクトで開始する。無料枠でも検証できるが、無料枠の容量・実行回数・休止条件を本番の前提にしない。探索の各歩と戦闘の各手番で通信するため、登録人数よりも行動回数とセーブの大きさが費用を左右する。戦闘には選択の保存・実行・手番進行の呼び出しがあり、1行動が必ず1リクエストになるわけではない。

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

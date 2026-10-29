# クラウドセーブを使い始める手順

コードと自動セットアップは用意済みです。アカウントと接続情報の登録だけは、所有者の画面で行います。最初は無料プランで設定を確認でき、保存テーブルの作成やサーバー配置でSQLを手入力する必要はありません。

## 1. Supabaseでゲーム用プロジェクトを用意する

1. https://supabase.com/dashboard を開き、GitHubアカウントなどでログインする。
2. プロジェクト一覧にこのゲーム用のものがあれば開く。別のアプリのプロジェクトは使わない。
3. ゲーム用のものがなければ「New project」を押す。名前は `DOS`、リージョンは東京（Tokyo / ap-northeast-1）、最初のプランはFreeでよい。データベースのパスワードは自動生成し、パスワード管理アプリなどへ保管する。この手順ではCodexへ渡す必要はない。
4. 作成が終わるまで待つ。開いた画面のURLは `https://supabase.com/dashboard/project/xxxxxxxxxxxxxxxxxxxx` の形になる。

URL末尾の20文字が「Project ID（Project ref）」です。これは公開してよい情報です。

## 2. GitHubに2つの接続情報を登録する

GitHubの https://github.com/KotaroTao/DOS/settings/secrets/actions を開きます。所有者アカウントで操作します。

### Secret: SUPABASE_ACCESS_TOKEN

1. https://supabase.com/dashboard/account/tokens を開く。
2. 「Generate new token」で `DOS deployment` という名前のトークンを作る。有効期限を選べる場合は運用に合わせて設定する。
3. GitHubへ戻り「New repository secret」を押す。
4. Nameに `SUPABASE_ACCESS_TOKEN`、Secretに生成したトークンを入力して保存する。

このトークンは秘密です。チャットやソースコードへ貼らず、GitHubのSecretだけに登録してください。service_roleキーやデータベースのパスワードは不要です。

### Variable: SUPABASE_PROJECT_REF

1. 同じGitHub画面の「Variables」タブへ切り替える。
2. 「New repository variable」を押す。
3. Nameに `SUPABASE_PROJECT_REF`、Valueに手順1のProject ID（20文字）を入力して保存する。プロジェクトの名前やURL全体ではありません。

ここまで終わったら「接続情報を登録した」とCodexに伝えてください。画面操作だけで続ける場合は、次の手順3へ進めます。

## 3. 自動セットアップを実行する

1. https://github.com/KotaroTao/DOS/actions/workflows/cloud-save.yml を開く。
2. 「Run workflow」を押す。Branchは `main` のまま実行する。
3. 実行結果が緑のチェックになるまで待つ。

自動で行うこと:

- 保存テーブルとサーバー専用の更新関数を作成する。再実行しても既存セーブは消さない。
- メールログイン、確認メール、ゲームへ戻るURLを設定する。
- 保存APIを配置し、未ログインのアクセス拒否・接続元・DB権限を確認する。

この段階ではゲームのクラウド保存はまだ有効になりません。

## 4. 確認メールを送れるようにする

一般プレイヤー向けのメール配信サービスが必要です。Supabase標準のメールは開発・チーム内確認向けです。

独自ドメインを持っている場合はResendなどのメール配信サービスでドメインを登録し、案内されたDNSレコードを設定します。そのサービスが発行するSMTP情報を、SupabaseのAuthenticationのEmail / SMTP設定へ入力します。表示名はゲーム名、送信元はそのドメインのメールアドレスにします。

ドメインを持っていない、またはSMTPの設定が分からない場合は、この段階でCodexに伝えてください。登録状況に合わせて次の操作を案内します。SMTPのパスワードやAPIキーもチャットへ貼る必要はありません。

メール配信サービスの無料枠・料金はSupabaseとは別です。1000人へ公開する前に、SupabaseをProへ変更し、メールの送信上限も見積もります。

## 5. ゲームのクラウド保存を有効にする

SMTPの設定を終え、確認メールが届くことを確認してから進めます。

1. GitHubの「Variables」に `CLOUD_SAVE_ENABLED` を追加し、Valueを `true` にする。
2. https://github.com/KotaroTao/DOS/actions/workflows/pages.yml を開く。
3. 「Run workflow」で `main` を実行する。
4. 緑のチェックになったら https://kotarotao.github.io/DOS/ を開く。

サーバーとログイン設定を確認し、公開用のAPIキーだけをゲームへ設定して公開します。SMTPや権限が未設定の場合は公開を止めます。以後はmainの更新時にも保存APIを一緒に更新するので、戦闘ロジックを別途手作業で配置する必要はありません。

クラウド有効化後にVariableを削除したり `false` にしたりするとローカル保存へ戻るため、停止・障害対応の目的では変更しないでください。通信失敗時はクラウドの記録を保ったまま進行を止めます。

最後にログイン、既存記録の引き継ぎ、戦闘中断と再開、死亡直後の再読み込み、別端末からの再開を確認します。実装の詳しい説明は `docs/cloud-save.md` にあります。

## ゲスト開始の追加設定（2026-10-30）

最新の自動設定は匿名認証を有効にし、本番の記録を1枠にする。旧記録1はそのまま引き継ぐ。旧テスト枠は削除しない。

一般公開時はSupabase AuthenticationのBot and Abuse ProtectionでCloudflare Turnstileを設定する。Turnstile側には公開ホスト`kotarotao.github.io`を登録する。秘密キーはSupabaseへ、公開サイトキーはGitHub Variable `TURNSTILE_SITE_KEY`へ登録する。匿名作成の上限も設定される。既存のCAPTCHAを別方式で使っていた場合はTurnstileへ統一する。

公開後、タイトル表示だけでは登録・ログインを要求しないこと、未同意では開始しないこと、ゲストの再開、登録確認メール、同じ記録の別端末再開、退会を確認する。規約とプライバシーの本文は`src/legal.js`。

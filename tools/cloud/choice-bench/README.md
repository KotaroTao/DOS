# B方式の選択記録の速度を実サーバーで比べる

B方式を採用する前の試作。ゲーム本体・本番のgame-save関数・本番アカウントのセーブを変更しない。別のschema・RPC・Edge Functionと、一時的な試験アカウントだけを作り、終了時に削除する。試験アカウントの作成とログインリンク生成でメールは送らない。

比較するもの:

- `current`: 現在公開中のgame-saveへ、小さな戦闘命令を送る。合成した200品/2,000品の記録を試験アカウントに保存し、サーバーで結果・セーブ全体が確定するまでを測る。
- `B_auth_api`: 現在と同様にEdge Functionから認証APIへ照会し、小さな命令表への追記を1回のRPCで確定する。戦闘計算とセーブ全体の読み書きは行わない。
- `B_db_jwt`: PostgRESTのJWT検証・`auth.uid()`で所有者を確認し、同じ追記RPCを直接呼ぶ。認証APIへの追加照会がない比較であり、失効・退会等の運用を含む採用決定ではない。

各方式で3回のウォームアップ後に20回（または40回）、順序を交互に変えて直列測定する。中央値・平均・p95・最大・本文バイト数と、BのEdge内の認証API/DB往復の時間を残す。`edge_region=database`はEdgeへの要求に`x-region`を付け、DBと同じリージョンを指定する。Bの関数が返す実行リージョンで指定の適用も確認する。初回の値も別に残すが、初回が必ずコールドスタートとは限らない。現在方式の結果が同じコードによる独立計算と一致しなければ停止する。

**この測定はGitHubの検証環境からの実サーバーへの応答時間。利用者の端末・回線、演出を含む体感速度、B方式の戦闘開始・終了検証・全体保存・同時接続の容量は測っていない。** p95は少数標本の参考値。Bの試作は記録順・所有者・再送・変更拒否を備えるが、戦闘の合法性や報酬検証は実装していない。速度が速くても、それだけでBを本番採用できるわけではない。

実行:

```bash
node tools/cloud/choice-bench/check.mjs /tmp/dos-cloud-check/node_modules/@electric-sql/pglite/dist/index.js
gh workflow run cloud-save-check.yml --ref codex/choice-speed-probe -f choice_benchmark=true -f samples=20 -f edge_region=auto
```

Actionsの`choice-speed-benchmark`成果物に`setup.json`・`results.json`・`cleanup.json`が入る。認証情報・JWT・メールアドレスは成果物に含めない。結果と片付けの成功を両方確認する。通常の完了・ステップ失敗時は`always()`の片付けを行うが、runnerの強制停止等で実行されない場合は、同じ実行IDの試験リソースの削除が必要。計測本体は6分、個々の測定は15秒で打ち切り、通常の失敗時に片付けへ進む。

SQL試作の命令は1つ2KiBまで、1試験256手まで、1時間で失効する。RPCの開始はservice_roleだけに許可し、クライアントは自分の試験にだけ追記できる。試験schemaはAPIへ公開せず、表への直接アクセスを許可しない。
